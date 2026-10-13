"""Landowner payouts: the superadmin's Pay queue."""

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import select

from app.catalog import fmt_sol, sol
from app.core.config import settings
from app.deps import DB, Admin
from app.models import Payout
from app.schemas.admin import IdsIn, PayIn, PayoutList, PayoutOut, PayoutTotals
from app.schemas.billing import SolanaIntent, SolanaTransfer
from app.services import solana
from app.services.billing import display_status
from app.services.notify import notify
from app.services.payouts import mark_paid, wallet

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
        amount_sol=p.amount_sol,
        status=p.status,
        method=p.method,
        reference=p.reference,
        wallet=p.wallet or wallet(p.owner),
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
            pending_sol=sol(sum(p.amount_sol for p in pending)),
            paid_sol=sol(sum(p.amount_sol for p in everything if p.status == "paid")),
            landowners=len({p.owner_id for p in everything}),
        ),
        items=[payout_out(p) for p in rows],
    )


MAX_PER_TRANSACTION = 8  # transfers per Solana transaction, well under the 1232-byte limit


def _load(db: DB, ids: list[int]) -> list[Payout]:
    if len(ids) > MAX_PER_TRANSACTION:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, f"Pay at most {MAX_PER_TRANSACTION} landowners per transaction")
    found = {p.id: p for p in db.scalars(select(Payout).where(Payout.id.in_(ids)))}
    missing = set(ids) - set(found)
    if missing:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Payout {min(missing)} not found")
    done = [p for p in found.values() if p.status == "paid"]
    if done:
        raise HTTPException(status.HTTP_409_CONFLICT, f"{done[0].number} is already paid")
    no_wallet = [p for p in found.values() if not wallet(p.owner)]
    if no_wallet:
        raise HTTPException(
            status.HTTP_409_CONFLICT, f"{no_wallet[0].owner.display_name} hasn't added a Solana wallet yet",
        )
    return [found[i] for i in dict.fromkeys(ids)]


def _intent(payouts: list[Payout]) -> SolanaIntent:
    return SolanaIntent(
        cluster=settings.solana_cluster,
        memo=solana.payout_memo([p.number for p in payouts]),
        transfers=[
            SolanaTransfer(to=wallet(p.owner), lamports=solana.lamports(p.amount_sol), amount_sol=p.amount_sol, label=p.number)
            for p in payouts
        ],
    )


@router.post("/solana", response_model=SolanaIntent)
def pay_intent(payload: IdsIn, user: Admin, db: DB) -> SolanaIntent:
    """One transaction paying each selected landowner's wallet. The admin's wallet signs it."""
    return _intent(_load(db, payload.ids))


@router.post("/pay", response_model=list[PayoutOut])
def pay(payload: PayIn, user: Admin, db: DB) -> list[PayoutOut]:
    """Record landowner payments after checking the Solana transaction on chain."""
    payouts = _load(db, payload.ids)
    intent = _intent(payouts)
    wanted: dict[str, int] = {}
    for t in intent.transfers:  # one owner may have several payouts in the batch
        wanted[t.to] = wanted.get(t.to, 0) + t.lamports
    try:
        proof = solana.verify_payment(payload.signature, wanted, intent.memo)
    except solana.PaymentError as e:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, str(e)) from None
    for p in payouts:
        mark_paid(p, proof.signature, wallet(p.owner))
        notify(
            db, [p.owner_id], "payout.paid", f"Payment sent: {fmt_sol(p.amount_sol)}",
            f"{p.number} on Solana" + (f" · {p.request.trip.name}" if p.request else ""), "/dashboard/payments",
        )
    db.commit()
    return [payout_out(p) for p in payouts]
