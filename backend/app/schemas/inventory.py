from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.admin import PayoutLine
from app.schemas.land import FieldOut


class TreeGroupIn(BaseModel):
    species: str
    count: int = Field(ge=1, le=10_000_000)
    age_years: int = Field(default=0, ge=0, le=300)
    height_m: float | None = Field(default=None, gt=0, le=90)
    dbh_cm: float | None = Field(default=None, gt=0, le=500)
    planted_on: date | None = None
    note: str | None = Field(default=None, max_length=300)


class TreeGroupOut(BaseModel):
    id: int | None  # None: read from the enrollment summary, not saved yet
    species: str
    species_name: str
    count: int
    age_years: int
    height_m: float | None
    dbh_cm: float | None
    planted_on: date | None
    note: str | None
    stored_kg_per_tree: float
    stored_t: float
    annual_t: float
    method: Literal["measured", "age"]


class CarbonOut(BaseModel):
    stored_t: float  # CO2 held in the trees today
    annual_gross_t: float  # absorbed this year
    annual_sellable_t: float  # this year, less the buffer
    measured_share: float  # share of trees sized by trunk and height, not age


class ProjectionRow(BaseModel):
    year: int
    gross_t: float
    sellable_t: float
    cumulative_t: float


class ProjectionOut(BaseModel):
    years: int
    total_t: float
    sellable_t: float
    earnings_sol: float  # landowner share if every sellable tonne is sold at the Protect price
    unplanted_trees: int  # reserved slots counted as seedlings (planting land)
    rows: list[ProjectionRow]


class FieldAllocationOut(BaseModel):
    id: int
    partner: str
    trip_name: str
    impact_type: Literal["protect", "plant"]
    year: int
    tonnes: float
    trees: int
    landowner_sol: float
    payout_number: str | None
    payout_status: Literal["pending", "paid"] | None
    created_at: datetime


class SoldYear(BaseModel):
    year: int
    tonnes: float
    trees: int
    landowner_sol: float


class FieldDetail(FieldOut):
    inventory_saved: bool
    planted: int
    groups: list[TreeGroupOut]
    carbon: CarbonOut
    projection: ProjectionOut
    allocations: list[FieldAllocationOut]
    sold_by_year: list[SoldYear]


class ReceivedPayout(BaseModel):
    id: int
    number: str
    client: str | None
    trip_name: str | None
    lines: list[PayoutLine]
    trees: int
    tonnes: float
    amount_sol: float
    status: Literal["pending", "paid"]
    method: str | None
    reference: str | None  # Solana transaction signature
    wallet: str | None
    created_at: datetime
    paid_at: datetime | None


class PaymentTotals(BaseModel):
    received_sol: float
    received_count: int
    pending_sol: float
    pending_count: int
    last_paid_at: datetime | None
    wallet: str | None  # the Solana address payments go to


class PaymentsOut(BaseModel):
    totals: PaymentTotals
    items: list[ReceivedPayout]
