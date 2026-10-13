from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

InvoiceStatus = Literal["unpaid", "paid", "overdue", "void"]


class InvoiceLine(BaseModel):
    description: str
    quantity: float
    unit: str
    unit_price: float
    amount: float


class InvoiceOut(BaseModel):
    id: int
    number: str
    client: str
    trip_id: int | None
    trip_name: str | None
    request_id: int | None
    description: str
    lines: list[InvoiceLine]
    subtotal_sol: float
    fee_sol: float
    total_sol: float
    status: InvoiceStatus
    issued_at: datetime
    due_at: datetime
    paid_at: datetime | None
    payment_method: str | None
    payment_reference: str | None  # Solana transaction signature
    payer_wallet: str | None


class InvoiceTotals(BaseModel):
    count: int
    billed_sol: float
    paid_sol: float
    outstanding_sol: float
    overdue_sol: float


class InvoiceList(BaseModel):
    totals: InvoiceTotals  # across all of the client's invoices, ignoring filters
    items: list[InvoiceOut]


class PayIn(BaseModel):
    signature: str = Field(min_length=64, max_length=100)  # the confirmed Solana transaction


class SolanaTransfer(BaseModel):
    to: str
    lamports: int
    amount_sol: float
    label: str  # invoice or payout number


class SolanaIntent(BaseModel):
    """A payment for the browser wallet to sign: one transfer per recipient plus a memo."""

    cluster: str
    memo: str
    transfers: list[SolanaTransfer]
