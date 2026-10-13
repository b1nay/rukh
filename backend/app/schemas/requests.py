from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

RequestStatus = Literal["pending", "allocated", "partial", "rejected", "cancelled"]


class RequestIn(BaseModel):
    impact_type: Literal["protect", "plant"]
    note: str | None = Field(default=None, max_length=1000)


class RequestOut(BaseModel):
    id: int
    trip_id: int
    trip_name: str
    requester: str
    impact_type: str
    year: int
    tonnes: float
    price_per_tonne: float
    subtotal_sol: float
    fee_rate: float
    fee_sol: float
    total_sol: float
    status: RequestStatus
    note: str | None
    admin_note: str | None
    allocated_tonnes: float
    messages: int
    created_at: datetime
    decided_at: datetime | None


class MessageIn(BaseModel):
    body: str = Field(min_length=1, max_length=4000)


class MessageOut(BaseModel):
    id: int
    sender: str
    from_admin: bool
    mine: bool
    body: str
    created_at: datetime


class NotificationOut(BaseModel):
    id: int
    kind: str
    title: str
    body: str | None
    link: str | None
    read: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class NotificationList(BaseModel):
    unread: int
    items: list[NotificationOut]


class ReadIn(BaseModel):
    ids: list[int] | None = None  # None marks everything read


class FieldOption(BaseModel):
    id: int
    name: str
    landowner: str
    district: str
    species_name: str
    unit: Literal["t", "trees"]
    available: float
    total: float
    suggested: float  # tonnes (protect) or trees (plant) from the smallholders-first plan
    t_per_tree: float  # tonnes one tree covers here: a year's growth (protect) or a lifetime (plant)
    available_trees: int
    suggested_trees: int


class PickIn(BaseModel):
    field_id: int
    amount: float = Field(gt=0, description="Tonnes for Protect, trees for Plant")


class AllocateIn(BaseModel):
    picks: list[PickIn] = Field(min_length=1)
    admin_note: str | None = Field(default=None, max_length=1000)


class RejectIn(BaseModel):
    admin_note: str = Field(min_length=2, max_length=1000)
