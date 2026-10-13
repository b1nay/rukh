from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

PayoutStatus = Literal["pending", "paid"]


class MapField(BaseModel):
    id: int
    name: str
    landowner: str
    district: str
    kind: Literal["existing", "planting"]
    species_name: str
    area_ha: float
    latitude: float
    longitude: float
    approximate: bool  # placed at the district HQ because the field has no GPS
    trees_total: int  # standing trees, or planting slots
    trees_allocated: int  # red
    trees_free: int  # green (existing trees) or yellow (bare planting land)
    t_per_tree: float


class MapTotals(BaseModel):
    fields: int
    trees_free: int
    trees_allocated: int
    barren_slots: int
    area_ha: float


class FieldMap(BaseModel):
    totals: MapTotals
    fields: list[MapField]


class PayoutLine(BaseModel):
    field_id: int
    field_name: str
    trees: int
    tonnes: float
    amount: float


class PayoutOut(BaseModel):
    id: int
    number: str
    landowner: str
    landowner_phone: str | None
    request_id: int | None
    client: str | None
    trip_name: str | None
    invoice_number: str | None
    invoice_status: str | None
    lines: list[PayoutLine]
    trees: int
    amount_sol: float
    status: PayoutStatus
    method: str | None
    reference: str | None  # Solana transaction signature
    wallet: str | None  # the landowner's Solana address (where it was sent, once paid)
    created_at: datetime
    paid_at: datetime | None


class PayoutTotals(BaseModel):
    pending_count: int
    pending_sol: float
    paid_sol: float
    landowners: int


class PayoutList(BaseModel):
    totals: PayoutTotals
    items: list[PayoutOut]


class IdsIn(BaseModel):
    ids: list[int] = Field(min_length=1)


class PayIn(IdsIn):
    signature: str = Field(min_length=64, max_length=100)  # the confirmed Solana transaction


class AllocateOut(BaseModel):
    status: str
    invoice_number: str
    invoice_total_sol: float
    payout_ids: list[int]
