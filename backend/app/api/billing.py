"""Bills from Rukh. Climate Partners see and pay their own; admins see all."""

import secrets
from datetime import date, datetime, time, timezone

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import or_, select

from app.deps import DB, Admin, ClimatePartner
from app.models import Invoice, Trip, User
from app.schemas.billing import InvoiceList, InvoiceOut, InvoiceTotals, PayIn
from app.services.billing import PAYMENT_METHODS, display_status
from app.services.notify import admin_ids, notify

router = APIRouter(tags=["billing"])


def invoice_out(inv: Invoice) -> InvoiceOut:
    return InvoiceOut(
        id=inv.id,
        number=inv.number,
        client=inv.user.display_name,
        trip_id=inv.trip_id,
        trip_name=inv.trip.name if inv.trip else None,
        request_id=inv.request_id,
        description=inv.description,
        lines=inv.lines,
        subtotal_usd=inv.subtotal_usd,
        fee_usd=inv.fee_usd,
        total_usd=inv.total_usd,
        status=display_status(inv),
        issued_at=inv.issued_at,
        due_at=inv.due_at,
        paid_at=inv.paid_at,
        payment_method=PAYMENT_METHODS.get(inv.payment_method or "", inv.payment_method),
        payment_reference=inv.payment_reference,
    )


def _totals(invoices: list[Invoice]) -> InvoiceTotals:
    live = [i for i in invoices if i.status != "void"]
    paid = sum(i.total_usd for i in live if i.status == "paid")
    billed = sum(i.total_usd for i in live)
    return InvoiceTotals(
        count=len(live),
        billed_usd=round(billed, 2),
        paid_usd=round(paid, 2),
        outstanding_usd=round(billed - paid, 2),
        overdue_usd=round(sum(i.total_usd for i in live if display_status(i) == "overdue"), 2),
    )


def _filtered(
    db: DB,
    user_id: str | None,
    status_filter: str | None,
    date_from: date | None,
    date_to: date | None,
    q: str | None,
) -> tuple[list[Invoice], list[Invoice]]:
    base = select(Invoice).outerjoin(Trip, Invoice.trip_id == Trip.id).join(User, Invoice.user_id == User.id)
    if user_id:
        base = base.where(Invoice.user_id == user_id)
    everything = list(db.scalars(base.order_by(Invoice.issued_at.desc())))
    stmt = base
    if date_from:
        stmt = stmt.where(Invoice.issued_at >= datetime.combine(date_from, time.min, timezone.utc))
    if date_to:
        stmt = stmt.where(Invoice.issued_at <= datetime.combine(date_to, time.max, timezone.utc))
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(or_(Invoice.number.ilike(like), Trip.name.ilike(like), User.display_name.ilike(like)))
    rows = list(db.scalars(stmt.order_by(Invoice.issued_at.desc())))
    if status_filter:
        rows = [i for i in rows if display_status(i) == status_filter]
    return everything, rows


StatusQ = Query(default=None, pattern="^(unpaid|paid|overdue|void)$", alias="status")


@router.get("/climate/invoices", response_model=InvoiceList)
def my_invoices(
    user: ClimatePartner,
    db: DB,
    status_filter: str | None = StatusQ,
    date_from: date | None = Query(default=None, alias="from"),
    date_to: date | None = Query(default=None, alias="to"),
    q: str | None = None,
) -> InvoiceList:
    everything, rows = _filtered(db, user.id, status_filter, date_from, date_to, q)
    return InvoiceList(totals=_totals(everything), items=[invoice_out(i) for i in rows])


def _own_invoice(db: DB, user: User, invoice_id: int) -> Invoice:
    inv = db.get(Invoice, invoice_id)
    if inv is None or (user.side != "admin" and inv.user_id != user.id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Invoice not found")
    return inv


@router.get("/climate/invoices/{invoice_id}", response_model=InvoiceOut)
def get_invoice(invoice_id: int, user: ClimatePartner, db: DB) -> InvoiceOut:
    return invoice_out(_own_invoice(db, user, invoice_id))


def _mark_paid(inv: Invoice, method: str) -> None:
    if inv.status != "unpaid":
        raise HTTPException(status.HTTP_409_CONFLICT, f"This invoice is already {inv.status}")
    inv.status = "paid"
    inv.paid_at = datetime.now(timezone.utc)
    inv.payment_method = method
    inv.payment_reference = f"DEMO-{secrets.token_hex(4).upper()}"


@router.post("/climate/invoices/{invoice_id}/pay", response_model=InvoiceOut)
def pay_invoice(invoice_id: int, payload: PayIn, user: ClimatePartner, db: DB) -> InvoiceOut:
    """Dummy checkout: no money moves. Swap in Stripe / Khalti / eSewa here."""
    inv = _own_invoice(db, user, invoice_id)
    _mark_paid(inv, payload.method)
    notify(
        db, admin_ids(db), "invoice.paid", f"{user.display_name} paid {inv.number}",
        f"${inv.total_usd:,.2f} by {PAYMENT_METHODS[payload.method]}", "/dashboard/invoices",
    )
    db.commit()
    return invoice_out(inv)


@router.get("/admin/invoices", response_model=InvoiceList)
def all_invoices(
    user: Admin,
    db: DB,
    status_filter: str | None = StatusQ,
    date_from: date | None = Query(default=None, alias="from"),
    date_to: date | None = Query(default=None, alias="to"),
    q: str | None = None,
) -> InvoiceList:
    everything, rows = _filtered(db, None, status_filter, date_from, date_to, q)
    return InvoiceList(totals=_totals(everything), items=[invoice_out(i) for i in rows])


@router.post("/admin/invoices/{invoice_id}/mark-paid", response_model=InvoiceOut)
def admin_mark_paid(invoice_id: int, user: Admin, db: DB) -> InvoiceOut:
    inv = _own_invoice(db, user, invoice_id)
    _mark_paid(inv, "bank_transfer")
    notify(db, [inv.user_id], "invoice.paid", f"Payment received for {inv.number}", f"${inv.total_usd:,.2f}", "/dashboard/billing")
    db.commit()
    return invoice_out(inv)
