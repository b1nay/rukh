"""Allocation ledger: matches a trip's uncovered tonnes to field capacity.

Protect draws on the yearly sellable growth of existing trees.
Plant reserves tree slots on planting land (one tree = NEW_TREE_LIFETIME_TONNES).
A field's capacity is never allocated beyond what it has, so no growth is sold twice.
Smallholders first: fields with the least available capacity are filled before
large forests, so income reaches small farms rather than pooling in the biggest plot.
"""

from dataclasses import dataclass
from math import ceil

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.catalog import IMPACT_TYPES, LANDOWNER_SHARE
from app.models import Allocation, Field, Trip
from app.services.inventory import sellable_tonnes
from app.services.sequestration import NEW_TREE_LIFETIME_TONNES

EPSILON_T = 0.001
ROUNDING_T = 0.0005


class AllocationError(Exception):
    pass


@dataclass
class Capacity:
    unit: str  # "t" for existing trees, "trees" for planting land
    total: float
    allocated: float

    @property
    def available(self) -> float:
        return max(0.0, self.total - self.allocated)


def field_capacity(db: Session, field: Field, year: int) -> Capacity:
    if field.kind == "planting":
        used = db.scalar(select(func.coalesce(func.sum(Allocation.trees), 0)).where(Allocation.field_id == field.id))
        return Capacity("trees", field.tree_count, used or 0)
    used = db.scalar(
        select(func.coalesce(func.sum(Allocation.tonnes), 0)).where(
            Allocation.field_id == field.id, Allocation.year == year, Allocation.impact_type == "protect"
        )
    )
    return Capacity("t", sellable_tonnes(field), used or 0)


def covered_tonnes(trip: Trip) -> float:
    return sum(a.tonnes for a in trip.allocations)


def remaining_tonnes(trip: Trip) -> float:
    return max(0.0, trip.co2_kg / 1000 - covered_tonnes(trip))


@dataclass
class Pick:
    field: Field
    tonnes: float
    trees: int = 0


def _kind(impact_type: str) -> str:
    return "planting" if impact_type == "plant" else "existing"


def available_fields(db: Session, impact_type: str, year: int) -> list[tuple[Field, Capacity]]:
    """Verified fields of the right kind, smallest available capacity first."""
    fields = db.scalars(select(Field).where(Field.kind == _kind(impact_type), Field.status == "verified")).all()
    pool = [(f, field_capacity(db, f, year)) for f in fields]
    return sorted((fc for fc in pool if fc[1].available > EPSILON_T), key=lambda fc: fc[1].available)


def suggest(db: Session, impact_type: str, tonnes: float, year: int) -> tuple[list[Pick], float]:
    """Smallholders-first plan for `tonnes`, without writing. Returns (picks, shortfall)."""
    remaining = tonnes
    picks: list[Pick] = []
    for field, cap in available_fields(db, impact_type, year):
        if remaining < EPSILON_T:
            break
        if impact_type == "plant":
            trees = min(int(cap.available), ceil(remaining / NEW_TREE_LIFETIME_TONNES))
            if trees <= 0:
                continue
            take = min(trees * NEW_TREE_LIFETIME_TONNES, remaining)
            picks.append(Pick(field, take, trees))
        else:
            take = min(cap.available, remaining)
            picks.append(Pick(field, take))
        remaining -= take
    return picks, max(0.0, round(remaining, 3))


def apply(
    db: Session, trip: Trip, impact_type: str, year: int, picks: list[Pick], request_id: int | None = None
) -> list[Allocation]:
    """Write allocations after checking each field's capacity and the trip's open tonnes. Caller commits."""
    price = IMPACT_TYPES[impact_type]["price_per_tonne_usd"]
    remaining = remaining_tonnes(trip)
    created: list[Allocation] = []
    for pick in picks:
        f = pick.field
        if f.kind != _kind(impact_type) or f.status != "verified":
            raise AllocationError(f"{f.name} can't be used for {IMPACT_TYPES[impact_type]['name']}")
        cap = field_capacity(db, f, year)
        used = sum((a.trees if impact_type == "plant" else a.tonnes) for a in created if a.field_id == f.id)
        need = pick.trees if impact_type == "plant" else pick.tonnes
        if need <= 0:
            continue
        # Amounts are shown and sent rounded to 3 decimals, so allow that much over and clamp.
        if need > cap.available - used + ROUNDING_T:
            raise AllocationError(f"{f.name} has only {cap.available - used:g} {cap.unit} available")
        if impact_type == "plant":
            tonnes = min(pick.trees * NEW_TREE_LIFETIME_TONNES, remaining)
        else:
            tonnes = min(pick.tonnes, cap.available - used, remaining)
        if tonnes < EPSILON_T:
            raise AllocationError("Those picks cover more than the trip's open tonnes")
        amount = round(tonnes * price, 2)
        alloc = Allocation(
            trip_id=trip.id,
            request_id=request_id,
            field_id=f.id,
            impact_type=impact_type,
            year=year,
            tonnes=round(tonnes, 3),
            trees=pick.trees if impact_type == "plant" else 0,
            amount_usd=amount,
            landowner_usd=round(amount * LANDOWNER_SHARE, 2),
        )
        db.add(alloc)
        trip.allocations.append(alloc)
        created.append(alloc)
        remaining -= tonnes
    if not created:
        raise AllocationError("Choose at least one field")
    return created


def allocate(db: Session, trip: Trip, impact_type: str, year: int) -> tuple[list[Allocation], float]:
    """Auto-allocate the trip's open tonnes (smallholders first) and commit."""
    remaining = remaining_tonnes(trip)
    if remaining < EPSILON_T:
        raise AllocationError("This trip is already fully covered")
    picks, shortfall = suggest(db, impact_type, remaining, year)
    if not picks:
        raise AllocationError(f"No {IMPACT_TYPES[impact_type]['name']} capacity is available right now")
    created = apply(db, trip, impact_type, year, picks)
    db.commit()
    db.refresh(trip)
    return created, shortfall
