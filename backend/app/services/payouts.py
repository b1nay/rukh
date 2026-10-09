"""Payments from Rukh to Land Partners, raised automatically when their trees are allocated."""

import secrets
from collections import defaultdict
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Allocation, AllocationRequest, Invoice, Payout, User
from app.services.fieldmap import pick_trees
from app.services.allocation import Pick

DEFAULT_METHOD = "Bank transfer"


def next_number(db: Session, year: int) -> str:
    count = db.scalar(select(func.count(Payout.id)).where(Payout.number.like(f"PAY-{year}-%"))) or 0
    return f"PAY-{year}-{count + 1:04d}"


def preferred_method(owner: User) -> str:
    return (owner.profile or {}).get("payout_method") or DEFAULT_METHOD


def issue_for_request(db: Session, req: AllocationRequest, allocations: list[Allocation], invoice: Invoice) -> list[Payout]:
    """One payout per Land Partner whose fields were allocated. Caller commits."""
    by_owner: dict[str, list[Allocation]] = defaultdict(list)
    for a in allocations:
        by_owner[a.field.owner_id].append(a)
    year = datetime.now(timezone.utc).year
    payouts = []
    for owner_id, allocs in by_owner.items():
        lines = [
            {
                "field_id": a.field_id,
                "field_name": a.field.name,
                "trees": a.trees or pick_trees(Pick(a.field, a.tonnes)),
                "tonnes": a.tonnes,
                "amount": a.landowner_usd,
            }
            for a in allocs
        ]
        payout = Payout(
            number=next_number(db, year),
            owner_id=owner_id,
            request_id=req.id,
            invoice_id=invoice.id,
            lines=lines,
            amount_usd=round(sum(a.landowner_usd for a in allocs), 2),
            method=preferred_method(allocs[0].field.owner),
        )
        db.add(payout)
        db.flush()  # so the next number counts this one
        payouts.append(payout)
    return payouts


def mark_paid(payout: Payout, method: str | None = None) -> None:
    payout.status = "paid"
    payout.paid_at = datetime.now(timezone.utc)
    if method:
        payout.method = method
    payout.reference = f"DEMO-{secrets.token_hex(4).upper()}"
