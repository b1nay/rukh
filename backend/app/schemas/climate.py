from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator

from app.schemas.requests import RequestOut

Cabin = Literal["economy", "premium_economy", "business", "first"]
Category = Literal["flight", "helicopter", "road", "stay", "trail", "activity"]
TripKind = Literal["trek", "tour", "event", "business", "other"]


def _code(v: str | None) -> str | None:
    return v.strip().upper() if v else None


# --- Itineraries -----------------------------------------------------------

class LegIn(BaseModel):
    category: Category
    mode: str = Field(min_length=2, max_length=40)
    day: int = Field(default=1, ge=1, le=120)
    label: str | None = Field(default=None, max_length=160)
    origin: str | None = Field(default=None, min_length=3, max_length=3)
    destination: str | None = Field(default=None, min_length=3, max_length=3)
    round_trip: bool = True
    distance_km: float | None = Field(default=None, ge=0, le=20000)
    hours: float | None = Field(default=None, ge=0, le=48)
    nights: int | None = Field(default=None, ge=0, le=365)
    share: float | None = Field(default=None, gt=0, le=60, description="People sharing a vehicle, helicopter or room")

    @field_validator("origin", "destination")
    @classmethod
    def upper(cls, v: str | None) -> str | None:
        return _code(v)


class Leg(LegIn):
    kg_per_person: float


class ItineraryIn(BaseModel):
    name: str = Field(min_length=2, max_length=160)
    kind: TripKind = "trek"
    days: int = Field(ge=1, le=120)
    description: str | None = Field(default=None, max_length=500)
    legs: list[LegIn] = Field(min_length=1, max_length=200)


class LegsPreviewIn(BaseModel):
    legs: list[LegIn] = Field(max_length=200)
    include_non_co2: bool = False


class LegsPreviewOut(BaseModel):
    legs: list[Leg]
    kg_per_person: float
    has_international: bool  # True when travelers' home airports set their flights


class ItineraryOut(BaseModel):
    id: int
    name: str
    kind: str
    days: int
    description: str | None
    legs: list[Leg]
    kg_per_person: float
    has_international: bool
    is_template: bool
    times_used: int
    last_used: date | None


# --- Trips -----------------------------------------------------------------

class TravelerIn(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=32)
    nationality: str | None = Field(default=None, max_length=80)
    home_airport: str | None = Field(default=None, min_length=3, max_length=3)
    cabin: Cabin = "economy"

    @field_validator("home_airport")
    @classmethod
    def upper(cls, v: str | None) -> str | None:
        return _code(v)

    @field_validator("email", "phone", "nationality", mode="before")
    @classmethod
    def blank_to_none(cls, v):
        return v or None


class TripIn(BaseModel):
    """Create a departure: either reuse an itinerary or pass a new one (saved for reuse)."""

    name: str | None = Field(default=None, max_length=160)
    itinerary_id: int | None = None
    itinerary: ItineraryIn | None = None
    start_date: date
    pax: int = Field(ge=1, le=2000)
    include_non_co2: bool = False
    travelers: list[TravelerIn]

    @model_validator(mode="after")
    def check(self):
        if (self.itinerary_id is None) == (self.itinerary is None):
            raise ValueError("Choose a saved itinerary or build a new one")
        if len(self.travelers) != self.pax:
            raise ValueError(f"Enter details for all {self.pax} travelers ({len(self.travelers)} given)")
        return self


class JourneySegment(BaseModel):
    origin: str
    destination: str
    km: float
    hours: float
    kg: float


class JourneyOut(BaseModel):
    origin: str
    destination: str
    segments: list[JourneySegment]
    layovers: dict[str, float]
    carrier: str | None
    estimated: bool
    km_one_way: float
    hours_one_way: float
    round_trip: bool
    kg: float


class TravelerOut(BaseModel):
    id: int
    name: str
    email: str | None
    phone: str | None
    nationality: str | None
    home_airport: str | None
    cabin: str
    flight_kg: float
    journey: JourneyOut | None
    co2_kg: float

    model_config = {"from_attributes": True}


class AllocationOut(BaseModel):
    id: int
    request_id: int | None
    impact_type: str
    year: int
    tonnes: float
    trees: int
    amount_sol: float
    field_id: int
    field_name: str
    district: str
    species: str
    landowner: str
    latitude: float | None
    longitude: float | None
    created_at: datetime


class TripSummary(BaseModel):
    id: int
    name: str
    kind: str
    start_date: date
    travelers: int
    co2_t: float
    covered_t: float
    status: Literal["uncovered", "partial", "covered"]
    itinerary_id: int | None


class CategoryTotal(BaseModel):
    category: str
    kg: float


class TripDetail(TripSummary):
    include_non_co2: bool
    legs: list[Leg]
    shared_kg_per_person: float
    by_category: list[CategoryTotal]
    traveler_list: list[TravelerOut]
    allocations: list[AllocationOut]
    requests: list[RequestOut]
    spend_sol: float


class MonthPoint(BaseModel):
    month: str  # YYYY-MM
    co2_t: float
    covered_t: float


class ClimateSummary(BaseModel):
    trips: int
    travelers: int
    co2_t: float
    covered_t: float
    new_trees: int
    tree_years: int
    spend_sol: float
    monthly: list[MonthPoint]
    recent_trips: list[TripSummary]
    top_itineraries: list[ItineraryOut]
