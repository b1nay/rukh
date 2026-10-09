"""Land Partner tree inventory, carbon projections, field allocations and payments received."""

from collections import defaultdict
from datetime import date

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import select

from app.api.land import _field_out
from app.catalog import IMPACT_TYPES, LANDOWNER_SHARE, USD_TO_NPR
from app.deps import DB, LandPartner
from app.models import Allocation, Field, Payout, TreeGroup, User
from app.schemas.inventory import (
    CarbonOut,
    FieldAllocationOut,
    FieldDetail,
    PaymentsOut,
    PaymentTotals,
    ProjectionOut,
    ProjectionRow,
    ReceivedPayout,
    SoldYear,
    TreeGroupIn,
    TreeGroupOut,
)
from app.services import inventory
from app.services.allocation import EPSILON_T, Capacity, field_capacity
from app.services.payouts import preferred_method
from app.services.sequestration import SPECIES, TreeStand, annual_tonnes, project, stored_kg_per_tree

router = APIRouter(prefix="/land", tags=["land partner"])


def _own_field(db: DB, user: User, field_id: int) -> Field:
    field = db.get(Field, field_id)
    if field is None or field.owner_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Field not found")
    return field


def _group_out(g: TreeGroup) -> TreeGroupOut:
    s = inventory.stand(g)
    per_tree, method = stored_kg_per_tree(s)
    return TreeGroupOut(
        id=g.id,
        species=g.species,
        species_name=SPECIES[g.species]["name"],
        count=g.count,
        age_years=s.age_years,
        height_m=g.height_m,
        dbh_cm=g.dbh_cm,
        planted_on=g.planted_on,
        note=g.note,
        stored_kg_per_tree=round(per_tree, 1),
        stored_t=round(per_tree * g.count / 1000, 3),
        annual_t=round(annual_tonnes(g.species, g.count, s.age_years), 3),
        method=method,
    )


def _projection(field: Field, cap: Capacity, stands: list[TreeStand], years: int) -> ProjectionOut:
    unplanted = 0
    if field.kind == "planting":
        # Reserved trees not yet recorded as planted are counted as seedlings.
        unplanted = max(0, int(cap.allocated) - inventory.planted_count(field))
        if unplanted:
            stands = [*stands, TreeStand(field.species, unplanted, 0)]
    rows = project(stands, date.today().year, years)
    sellable = sum(r.sellable_t for r in rows)
    earnings = sellable * IMPACT_TYPES["protect"]["price_per_tonne_usd"] * LANDOWNER_SHARE if field.kind == "existing" else 0
    return ProjectionOut(
        years=years,
        total_t=round(rows[-1].cumulative_t, 2),
        sellable_t=round(sellable, 2),
        earnings_usd=round(earnings, 2),
        unplanted_trees=unplanted,
        rows=[ProjectionRow(**r.__dict__) for r in rows],
    )


def _detail(db: DB, field: Field, years: int) -> FieldDetail:
    cap = field_capacity(db, field, date.today().year)
    groups = inventory.groups(field)
    stands = [inventory.stand(g) for g in groups]
    group_rows = [_group_out(g) for g in groups]
    total_trees = sum(g.count for g in group_rows)
    gross = sum(g.annual_t for g in group_rows)

    allocs = list(db.scalars(select(Allocation).where(Allocation.field_id == field.id).order_by(Allocation.created_at.desc())))
    payouts = {p.request_id: p for p in db.scalars(select(Payout).where(Payout.owner_id == field.owner_id)) if p.request_id}
    by_year: dict[int, SoldYear] = defaultdict(lambda: SoldYear(year=0, tonnes=0, trees=0, landowner_usd=0))
    for a in allocs:
        row = by_year[a.year]
        row.year = a.year
        row.tonnes = round(row.tonnes + a.tonnes, 3)
        row.trees += a.trees
        row.landowner_usd = round(row.landowner_usd + a.landowner_usd, 2)

    return FieldDetail(
        **_field_out(db, field).model_dump(),
        inventory_saved=bool(field.tree_groups),
        planted=inventory.planted_count(field),
        groups=group_rows,
        carbon=CarbonOut(
            stored_t=round(sum(g.stored_t for g in group_rows), 2),
            annual_gross_t=round(gross, 3),
            annual_sellable_t=round(inventory.sellable_tonnes(field), 3) if field.kind == "existing" else 0,
            measured_share=round(sum(g.count for g in group_rows if g.method == "measured") / total_trees, 3) if total_trees else 0,
        ),
        projection=_projection(field, cap, stands, years),
        allocations=[
            FieldAllocationOut(
                id=a.id,
                partner=a.trip.owner.display_name,
                trip_name=a.trip.name,
                impact_type=a.impact_type,
                year=a.year,
                tonnes=a.tonnes,
                trees=a.trees,
                landowner_usd=a.landowner_usd,
                payout_number=payouts[a.request_id].number if a.request_id in payouts else None,
                payout_status=payouts[a.request_id].status if a.request_id in payouts else None,
                created_at=a.created_at,
            )
            for a in allocs
        ],
        sold_by_year=sorted(by_year.values(), key=lambda r: r.year, reverse=True),
    )


@router.get("/fields/{field_id}/detail", response_model=FieldDetail)
def field_detail(field_id: int, user: LandPartner, db: DB, years: int = Query(default=10, ge=1, le=50)) -> FieldDetail:
    return _detail(db, _own_field(db, user, field_id), years)


def _check(db: DB, field: Field, payload: TreeGroupIn | None) -> None:
    """Refuse inventory changes that would undo trees already sold or reserved."""
    if payload is not None:
        if payload.species not in SPECIES:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Unknown species")
        if payload.planted_on and payload.planted_on > date.today():
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Planting date can't be in the future")
        if payload.dbh_cm and not payload.height_m:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Add the tree height too, to use the trunk size")
    if field.kind == "existing":
        if not field.tree_groups:
            raise HTTPException(status.HTTP_409_CONFLICT, "A field with standing trees needs at least one tree group")
        cap = field_capacity(db, field, date.today().year)
        if cap.allocated > cap.total + EPSILON_T:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                f"{cap.allocated:g} t of this field's growth is already sold this year. "
                f"After this change it could only absorb {cap.total:.2f} t",
            )
    elif inventory.planted_count(field) > field.tree_count:
        raise HTTPException(status.HTTP_409_CONFLICT, f"This land has room for {field.tree_count:,} trees")


def _apply(group: TreeGroup, payload: TreeGroupIn) -> None:
    for k, v in payload.model_dump().items():
        setattr(group, k, v)


def _save(db: DB, field: Field, payload: TreeGroupIn | None, years: int) -> FieldDetail:
    db.flush()
    db.expire(field, ["tree_groups"])
    _check(db, field, payload)
    inventory.sync_summary(field)
    db.commit()
    db.refresh(field)
    return _detail(db, field, years)


@router.post("/fields/{field_id}/trees", response_model=FieldDetail, status_code=status.HTTP_201_CREATED)
def add_group(
    field_id: int,
    payload: TreeGroupIn,
    user: LandPartner,
    db: DB,
    years: int = Query(default=10, ge=1, le=50),
    replace_summary: bool = False,
) -> FieldDetail:
    """Add a group. With replace_summary, it takes the place of the enrollment summary instead of joining it."""
    field = _own_field(db, user, field_id)
    if not replace_summary:
        inventory.materialize(field)
    group = TreeGroup()
    _apply(group, payload)
    field.tree_groups.append(group)
    return _save(db, field, payload, years)


def _own_group(db: DB, user: User, field_id: int, group_id: int) -> tuple[Field, TreeGroup]:
    field = _own_field(db, user, field_id)
    group = db.get(TreeGroup, group_id)
    if group is None or group.field_id != field.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Tree group not found")
    return field, group


@router.put("/fields/{field_id}/trees/{group_id}", response_model=FieldDetail)
def update_group(
    field_id: int, group_id: int, payload: TreeGroupIn, user: LandPartner, db: DB, years: int = Query(default=10, ge=1, le=50)
) -> FieldDetail:
    field, group = _own_group(db, user, field_id, group_id)
    _apply(group, payload)
    return _save(db, field, payload, years)


@router.delete("/fields/{field_id}/trees/{group_id}", response_model=FieldDetail)
def delete_group(field_id: int, group_id: int, user: LandPartner, db: DB, years: int = Query(default=10, ge=1, le=50)) -> FieldDetail:
    field, group = _own_group(db, user, field_id, group_id)
    db.delete(group)
    return _save(db, field, None, years)


@router.get("/payouts", response_model=PaymentsOut)
def payments(user: LandPartner, db: DB) -> PaymentsOut:
    rows = list(db.scalars(select(Payout).where(Payout.owner_id == user.id).order_by(Payout.created_at.desc())))
    paid = [p for p in rows if p.status == "paid"]
    pending = [p for p in rows if p.status == "pending"]
    return PaymentsOut(
        totals=PaymentTotals(
            received_usd=round(sum(p.amount_usd for p in paid), 2),
            received_count=len(paid),
            pending_usd=round(sum(p.amount_usd for p in pending), 2),
            pending_count=len(pending),
            last_paid_at=max((p.paid_at for p in paid if p.paid_at), default=None),
            method=preferred_method(user),
        ),
        items=[
            ReceivedPayout(
                id=p.id,
                number=p.number,
                client=p.request.requester.display_name if p.request else None,
                trip_name=p.request.trip.name if p.request else None,
                lines=p.lines,
                trees=sum(line["trees"] for line in p.lines),
                tonnes=round(sum(line["tonnes"] for line in p.lines), 3),
                amount_usd=p.amount_usd,
                amount_npr=round(p.amount_usd * USD_TO_NPR),
                status=p.status,
                method=p.method,
                reference=p.reference,
                created_at=p.created_at,
                paid_at=p.paid_at,
            )
            for p in rows
        ],
    )
