from datetime import date

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.catalog import USD_TO_NPR
from app.deps import DB, LandPartner
from app.models import Allocation, Field, Payout, TreeGroup
from app.schemas.land import EarningOut, FieldIn, FieldOut, LandSummary
from app.services.allocation import field_capacity
from app.services.sequestration import PLANTING_DENSITY_PER_HA, SPECIES

router = APIRouter(prefix="/land", tags=["land partner"])


def _field_out(db: DB, f: Field) -> FieldOut:
    cap = field_capacity(db, f, date.today().year)
    earned = sum(a.landowner_usd for a in db.scalars(select(Allocation).where(Allocation.field_id == f.id)))
    return FieldOut(
        id=f.id,
        name=f.name,
        kind=f.kind,
        district=f.district,
        area_ha=f.area_ha,
        species=f.species,
        species_name=SPECIES[f.species]["name"],
        tree_count=f.tree_count,
        tree_age_years=f.tree_age_years,
        latitude=f.latitude,
        longitude=f.longitude,
        status=f.status,
        created_at=f.created_at,
        capacity_unit=cap.unit,
        capacity_total=round(cap.total, 3),
        capacity_allocated=round(cap.allocated, 3),
        capacity_available=round(cap.available, 3),
        earned_usd=round(earned, 2),
    )


def _earnings(db: DB, owner_id: str) -> list[Allocation]:
    return list(
        db.scalars(
            select(Allocation)
            .join(Field)
            .where(Field.owner_id == owner_id)
            .order_by(Allocation.created_at.desc())
        )
    )


def _payout_status(db: DB, owner_id: str) -> dict[int, str]:
    """request id -> status of this owner's payout for it."""
    return {p.request_id: p.status for p in db.scalars(select(Payout).where(Payout.owner_id == owner_id)) if p.request_id}


def _earning_out(a: Allocation, payouts: dict[int, str]) -> EarningOut:
    return EarningOut(
        id=a.id,
        field_name=a.field.name,
        partner=a.trip.owner.display_name,
        trip_name=a.trip.name,
        impact_type=a.impact_type,
        tonnes=a.tonnes,
        trees=a.trees,
        landowner_usd=a.landowner_usd,
        payout_status=payouts.get(a.request_id) if a.request_id else None,
        created_at=a.created_at,
    )


@router.get("/summary", response_model=LandSummary)
def summary(user: LandPartner, db: DB) -> LandSummary:
    fields = [_field_out(db, f) for f in db.scalars(select(Field).where(Field.owner_id == user.id))]
    earnings = _earnings(db, user.id)
    year = date.today().year
    earned = sum(a.landowner_usd for a in earnings)
    return LandSummary(
        fields=len(fields),
        trees=sum(f.tree_count for f in fields if f.kind == "existing"),
        planting_slots=sum(int(f.capacity_total) for f in fields if f.kind == "planting"),
        annual_capacity_t=round(sum(f.capacity_total for f in fields if f.kind == "existing"), 2),
        allocated_t=round(sum(a.tonnes for a in earnings if a.year == year), 2),
        earned_usd=round(earned, 2),
        earned_npr=round(earned * USD_TO_NPR),
        recent_earnings=[_earning_out(a, _payout_status(db, user.id)) for a in earnings[:8]],
    )


@router.get("/fields", response_model=list[FieldOut])
def list_fields(user: LandPartner, db: DB) -> list[FieldOut]:
    fields = db.scalars(select(Field).where(Field.owner_id == user.id).order_by(Field.created_at.desc()))
    return [_field_out(db, f) for f in fields]


@router.post("/fields", response_model=FieldOut, status_code=status.HTTP_201_CREATED)
def create_field(payload: FieldIn, user: LandPartner, db: DB) -> FieldOut:
    if payload.species not in SPECIES:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Unknown species")
    if payload.kind == "existing" and not payload.tree_count:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Enter how many trees are on the field")
    tree_count = payload.tree_count or round(payload.area_ha * PLANTING_DENSITY_PER_HA)
    field = Field(
        owner_id=user.id,
        name=payload.name,
        kind=payload.kind,
        district=payload.district,
        area_ha=payload.area_ha,
        species=payload.species,
        tree_count=tree_count,
        tree_age_years=payload.tree_age_years if payload.kind == "existing" else 0,
        latitude=payload.latitude,
        longitude=payload.longitude,
        # Satellite verification is not built yet; fields are auto-verified for now.
        status="verified",
    )
    if payload.kind == "existing":
        field.tree_groups.append(
            TreeGroup(
                species=payload.species,
                count=tree_count,
                age_years=payload.tree_age_years,
                height_m=payload.height_m,
                dbh_cm=payload.dbh_cm if payload.height_m else None,
            )
        )
    db.add(field)
    if user.status == "pending_verification":
        user.status = "active"
    db.commit()
    db.refresh(field)
    return _field_out(db, field)


@router.get("/fields/{field_id}", response_model=FieldOut)
def get_field(field_id: int, user: LandPartner, db: DB) -> FieldOut:
    field = db.get(Field, field_id)
    if field is None or field.owner_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Field not found")
    return _field_out(db, field)


@router.get("/earnings", response_model=list[EarningOut])
def earnings(user: LandPartner, db: DB) -> list[EarningOut]:
    payouts = _payout_status(db, user.id)
    return [_earning_out(a, payouts) for a in _earnings(db, user.id)]
