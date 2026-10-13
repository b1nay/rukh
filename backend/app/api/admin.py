"""Superadmin: decide allocation requests and oversee the platform."""

from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import func, select

from app.catalog import fmt_sol, sol
from app.api.climate import _detail
from app.api.requests import request_out
from app.deps import DB, Admin
from app.models import Allocation, AllocationRequest, Field, Invoice, User
from app.schemas.admin import AllocateOut
from app.schemas.climate import TripDetail
from app.schemas.requests import AllocateIn, FieldOption, RejectIn, RequestOut
from app.services import payouts
from app.services.allocation import AllocationError, Pick, apply, available_fields, remaining_tonnes, suggest
from app.services.billing import issue_for_request
from app.services.fieldmap import pick_trees, requirement, tonnes_per_tree
from app.services.notify import admin_ids, notify
from app.services.sequestration import NEW_TREE_LIFETIME_TONNES, SPECIES

router = APIRouter(prefix="/admin", tags=["superadmin"])


class AdminSummary(BaseModel):
    pending_requests: int
    pending_sol: float
    climate_partners: int
    land_partners: int
    fields: int
    protect_available_t: float
    plant_available_trees: int
    allocated_t: float
    billed_sol: float
    outstanding_sol: float
    fees_sol: float
    recent_requests: list[RequestOut]


class RequestDetail(BaseModel):
    request: RequestOut
    trip: TripDetail
    requester_email: str | None
    requester_category: str
    open_tonnes: float
    fields: list[FieldOption]
    shortfall: float
    trees_needed: int  # to cover the open tonnes, including new planting for any shortfall
    area_needed_ha: float


@router.get("/summary", response_model=AdminSummary)
def summary(user: Admin, db: DB) -> AdminSummary:
    year = datetime.now(timezone.utc).year
    pending = db.scalars(select(AllocationRequest).where(AllocationRequest.status == "pending")).all()
    invoices = db.scalars(select(Invoice).where(Invoice.status != "void")).all()
    recent = db.scalars(select(AllocationRequest).order_by(AllocationRequest.id.desc()).limit(6)).all()
    return AdminSummary(
        pending_requests=len(pending),
        pending_sol=sol(sum(r.total_sol for r in pending)),
        climate_partners=db.scalar(select(func.count(User.id)).where(User.side == "organization")) or 0,
        land_partners=db.scalar(select(func.count(User.id)).where(User.side == "landowner")) or 0,
        fields=db.scalar(select(func.count(Field.id))) or 0,
        protect_available_t=round(sum(c.available for _, c in available_fields(db, "protect", year)), 2),
        plant_available_trees=int(sum(c.available for _, c in available_fields(db, "plant", year))),
        allocated_t=round(db.scalar(select(func.coalesce(func.sum(Allocation.tonnes), 0))) or 0, 2),
        billed_sol=sol(sum(i.total_sol for i in invoices)),
        outstanding_sol=sol(sum(i.total_sol for i in invoices if i.status == "unpaid")),
        fees_sol=sol(sum(i.fee_sol for i in invoices)),
        recent_requests=[request_out(r) for r in recent],
    )


@router.get("/requests", response_model=list[RequestOut])
def list_requests(
    user: Admin, db: DB, status_filter: str | None = Query(default=None, alias="status")
) -> list[RequestOut]:
    stmt = select(AllocationRequest).order_by(AllocationRequest.id.desc())
    if status_filter:
        stmt = stmt.where(AllocationRequest.status == status_filter)
    return [request_out(r) for r in db.scalars(stmt)]


def _get(db: DB, request_id: int) -> AllocationRequest:
    req = db.get(AllocationRequest, request_id)
    if req is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Request not found")
    return req


@router.get("/requests/{request_id}", response_model=RequestDetail)
def get_request(request_id: int, user: Admin, db: DB) -> RequestDetail:
    req = _get(db, request_id)
    open_t = remaining_tonnes(req.trip)
    plan, shortfall = suggest(db, req.impact_type, min(req.tonnes, open_t), req.year)
    by_field = {p.field.id: p for p in plan}
    options = []
    for f, cap in available_fields(db, req.impact_type, req.year):
        tpt = tonnes_per_tree(f)
        p = by_field.get(f.id)
        options.append(FieldOption(
            id=f.id,
            name=f.name,
            landowner=f.owner.display_name,
            district=f.district,
            species_name=SPECIES[f.species]["name"],
            unit=cap.unit,
            available=round(cap.available, 3),
            total=round(cap.total, 3),
            suggested=(p.trees if req.impact_type == "plant" else round(p.tonnes, 3)) if p else 0,
            t_per_tree=tpt,
            available_trees=int(cap.available) if cap.unit == "trees" else int(cap.available / tpt + 1e-9),
            suggested_trees=pick_trees(p) if p else 0,
        ))
    trees_needed, area_needed = requirement(req.impact_type, plan, shortfall)
    return RequestDetail(
        request=request_out(req),
        trip=_detail(req.trip),
        requester_email=req.requester.email,
        requester_category=req.requester.category,
        open_tonnes=round(open_t, 3),
        fields=options,
        shortfall=shortfall if req.status == "pending" else 0,
        trees_needed=trees_needed,
        area_needed_ha=area_needed,
    )


@router.post("/requests/{request_id}/allocate", response_model=AllocateOut)
def allocate_request(request_id: int, payload: AllocateIn, user: Admin, db: DB) -> AllocateOut:
    req = _get(db, request_id)
    if req.status != "pending":
        raise HTTPException(status.HTTP_409_CONFLICT, f"This request is already {req.status}")
    picks = []
    for p in payload.picks:
        field = db.get(Field, p.field_id)
        if field is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, f"Field {p.field_id} not found")
        if req.impact_type == "plant":
            if p.amount != int(p.amount):
                raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Plant allocations are whole trees")
            picks.append(Pick(field, p.amount * NEW_TREE_LIFETIME_TONNES, int(p.amount)))
        else:
            picks.append(Pick(field, p.amount))
    try:
        created = apply(db, req.trip, req.impact_type, req.year, picks, request_id=req.id)
    except AllocationError as e:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, str(e)) from None

    allocated = round(sum(a.tonnes for a in created), 3)
    if allocated > req.tonnes + 0.001:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, f"That allocates {allocated:g} t, more than the {req.tonnes:g} t requested")
    req.allocated_tonnes = allocated
    req.status = "allocated" if allocated >= req.tonnes - 0.001 else "partial"
    req.admin_note = payload.admin_note
    req.decided_at = datetime.now(timezone.utc)
    db.flush()
    inv = issue_for_request(db, req, created)
    db.flush()
    owed = payouts.issue_for_request(db, req, created, inv)

    trees = sum(a.trees for a in created)
    done = "Trees allocated" if req.status == "allocated" else "Trees partly allocated"
    notify(
        db, [req.requester_id], "request.allocated", f"{done} for {req.trip.name}",
        f"{allocated:g} t" + (f" · {trees} new trees" if trees else "") + f" · invoice {inv.number} {fmt_sol(inv.total_sol)}",
        f"/dashboard/trips/{req.trip_id}",
    )
    for a in created:
        notify(
            db, [a.field.owner_id], "field.funded", f"{req.requester.display_name} funded your trees",
            f"{a.field.name}: " + (f"{a.trees} new trees" if a.trees else f"{a.tonnes:g} t protected"),
            "/dashboard/earnings",
        )
    notify(
        db, admin_ids(db), "payout.new", f"{len(owed)} landowner payment{'s' if len(owed) != 1 else ''} to send",
        f"{fmt_sol(sum(p.amount_sol for p in owed))} for {req.trip.name}", f"/dashboard/payouts?request={req.id}",
    )
    db.commit()
    return AllocateOut(status=req.status, invoice_number=inv.number, invoice_total_sol=inv.total_sol, payout_ids=[p.id for p in owed])


@router.post("/requests/{request_id}/reject", response_model=RequestOut)
def reject_request(request_id: int, payload: RejectIn, user: Admin, db: DB) -> RequestOut:
    req = _get(db, request_id)
    if req.status != "pending":
        raise HTTPException(status.HTTP_409_CONFLICT, f"This request is already {req.status}")
    req.status = "rejected"
    req.admin_note = payload.admin_note
    req.decided_at = datetime.now(timezone.utc)
    notify(db, [req.requester_id], "request.rejected", f"Request declined for {req.trip.name}", payload.admin_note, f"/dashboard/trips/{req.trip_id}")
    db.commit()
    return request_out(req)


