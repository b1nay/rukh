"""Invoices from Rukh to Climate Partners."""

from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.catalog import IMPACT_TYPES
from app.models import Allocation, AllocationRequest, Invoice

PAYMENT_TERMS_DAYS = 14
PAYMENT_METHODS = {"card": "Card", "bank_transfer": "Bank transfer", "khalti": "Khalti", "esewa": "eSewa"}


def _now() -> datetime:
    return datetime.now(timezone.utc)


def display_status(inv: Invoice) -> str:
    if inv.status == "unpaid" and inv.due_at < _now():
        return "overdue"
    return inv.status


def next_number(db: Session, year: int) -> str:
    count = db.scalar(select(func.count(Invoice.id)).where(Invoice.number.like(f"RUKH-{year}-%"))) or 0
    return f"RUKH-{year}-{count + 1:04d}"


def issue_for_request(db: Session, req: AllocationRequest, allocations: list[Allocation]) -> Invoice:
    """Bill what was actually allocated (may be less than requested). Caller commits."""
    name = IMPACT_TYPES[req.impact_type]["name"]
    tonnes = round(sum(a.tonnes for a in allocations), 3)
    trees = sum(a.trees for a in allocations)
    subtotal = round(sum(a.amount_usd for a in allocations), 2)
    fee = round(subtotal * req.fee_rate, 2)
    lines = [
        {
            "description": f"{name} · {req.trip.name}" + (f" · {trees} new trees" if trees else ""),
            "quantity": tonnes,
            "unit": "t CO₂",
            "unit_price": req.price_per_tonne,
            "amount": subtotal,
        }
    ]
    if fee:
        lines.append({
            "description": f"Platform fee ({req.fee_rate:.0%})",
            "quantity": 1,
            "unit": "",
            "unit_price": fee,
            "amount": fee,
        })
    issued = _now()
    inv = Invoice(
        number=next_number(db, issued.year),
        user_id=req.requester_id,
        trip_id=req.trip_id,
        request_id=req.id,
        description=f"{name} for {req.trip.name}",
        lines=lines,
        subtotal_usd=subtotal,
        fee_usd=fee,
        total_usd=round(subtotal + fee, 2),
        issued_at=issued,
        due_at=issued + timedelta(days=PAYMENT_TERMS_DAYS),
    )
    db.add(inv)
    return inv
