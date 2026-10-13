from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class FieldIn(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    kind: Literal["existing", "planting"]
    district: str = Field(min_length=2, max_length=60)
    area_ha: float = Field(gt=0, le=100_000)
    species: str
    tree_count: int | None = Field(default=None, ge=1, le=10_000_000)
    tree_age_years: int = Field(default=0, ge=0, le=300)
    height_m: float | None = Field(default=None, gt=0, le=90)  # average, existing trees
    dbh_cm: float | None = Field(default=None, gt=0, le=500)  # average trunk diameter at 1.3 m
    latitude: float | None = Field(default=None, ge=26, le=31)
    longitude: float | None = Field(default=None, ge=80, le=89)


class FieldOut(BaseModel):
    id: int
    name: str
    kind: str
    district: str
    area_ha: float
    species: str
    species_name: str
    tree_count: int
    tree_age_years: int
    latitude: float | None
    longitude: float | None
    status: str
    created_at: datetime
    capacity_unit: Literal["t", "trees"]
    capacity_total: float
    capacity_allocated: float
    capacity_available: float
    earned_sol: float


class EarningOut(BaseModel):
    id: int
    field_name: str
    partner: str
    trip_name: str
    impact_type: str
    tonnes: float
    trees: int
    landowner_sol: float
    payout_status: Literal["pending", "paid"] | None  # None: allocated before payouts existed
    created_at: datetime


class LandSummary(BaseModel):
    fields: int
    trees: int
    planting_slots: int
    annual_capacity_t: float
    allocated_t: float
    earned_sol: float
    recent_earnings: list[EarningOut]


class WalletIn(BaseModel):
    address: str


class WalletOut(BaseModel):
    wallet: str
