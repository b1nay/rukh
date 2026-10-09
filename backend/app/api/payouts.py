"""Landowner payouts: the superadmin's Pay queue."""

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import select

from app.catalog import USD_TO_NPR
from app.deps import DB, Admin
from app.models import Payout
from app.schemas.admin import PayIn, PayoutList, PayoutOut, PayoutTotals
from app.services.billing import display_status
from app.services.notify import notify
from app.services.payouts import mark_paid

router = APIRouter(prefix="/admin/payouts", tags=["superadmin"])


def payout_out(p: Payout) -> PayoutOut:
    req = p.request
    return PayoutOut(
        id=p.id,
        number=p.number,
        landowner=p.owner.display_name,
        landowner_phone=p.owner.phone,
        request_id=p.request_id,
        client=req.requester.display_name if req else None,
        trip_name=req.trip.name if req else None,
        invoice_number=p.invoice.number if p.invoice else None,
        invoice_status=display_status(p.invoice) if p.invoice else None,
        lines=p.lines,
        trees=sum(line["trees"] for line in p.lines),
        amount_usd=p.amount_usd,
        amount_npr=round(p.amount_usd * USD_TO_NPR),
        status=p.status,
        method=p.method,
        reference=p.reference,
        created_at=p.created_at,
        paid_at=p.paid_at,
    )


@router.get("", response_model=PayoutList)
def list_payouts(
    user: Admin,
    db: DB,
    status_filter: str | None = Query(default=None, pattern="^(pending|paid)$", alias="status"),
    request_id: int | None = Query(default=None, alias="request"),
) -> PayoutList:
    everything = list(db.scalars(select(Payout).order_by(Payout.id.desc())))
    rows = [
        p for p in everything
        if (not status_filter or p.status == status_filter) and (request_id is None or p.request_id == request_id)
    ]
    pending = [p for p in everything if p.status == "pending"]
    return PayoutList(
        totals=PayoutTotals(
            pending_count=len(pending),
            pending_usd=round(sum(p.amount_usd for p in pending), 2),
            paid_usd=round(sum(p.amount_usd for p in everything if p.status == "paid"), 2),
            landowners=len({p.owner_id for p in everything}),
        ),
        items=[payout_out(p) for p in rows],
    )


@router.post("/pay", response_model=list[PayoutOut])
def pay(payload: PayIn, user: Admin, db: DB) -> list[PayoutOut]:
    """Dummy transfer: no money moves. Swap in eSewa / Khalti / bank APIs here."""
    found = {p.id: p for p in db.scalars(select(Payout).where(Payout.id.in_(payload.ids)))}
    missing = set(payload.ids) - set(found)
    if missing:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Payout {min(missing)} not found")
    done = [p for p in found.values() if p.status == "paid"]
    if done:
        raise HTTPException(status.HTTP_409_CONFLICT, f"{done[0].number} is already paid")
    for p in found.values():
        mark_paid(p, payload.method)
        notify(
            db, [p.owner_id], "payout.paid", f"Payment sent: NPR {round(p.amount_usd * USD_TO_NPR):,}",
            f"{p.number} by {p.method}" + (f" · {p.request.trip.name}" if p.request else ""), "/dashboard/payments",
        )
    db.commit()
    return [payout_out(found[i]) for i in payload.ids]
