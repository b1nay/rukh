from datetime import datetime
from typing import Literal

from pydantic import BaseModel

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
    subtotal_usd: float
    fee_usd: float
    total_usd: float
    status: InvoiceStatus
    issued_at: datetime
    due_at: datetime
    paid_at: datetime | None
    payment_method: str | None
    payment_reference: str | None


class InvoiceTotals(BaseModel):
    count: int
    billed_usd: float
    paid_usd: float
    outstanding_usd: float
    overdue_usd: float


class InvoiceList(BaseModel):
    totals: InvoiceTotals  # across all of the client's invoices, ignoring filters
    items: list[InvoiceOut]


class PayIn(BaseModel):
    method: Literal["card", "bank_transfer", "khalti", "esewa"]
