"""Sign-up payloads. Each category has its own profile schema, selected by
the `category` discriminator. Field names match frontend/src/lib/signup-fields.ts.
"""

from datetime import date, datetime
from typing import Annotated, Literal, Union

from pydantic import BaseModel, ConfigDict, EmailStr, Field, HttpUrl, field_validator

from app.catalog import Side


class _Strict(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


Name = Annotated[str, Field(min_length=2, max_length=160)]
Count = Annotated[int, Field(ge=0)]
Positive = Annotated[float, Field(gt=0)]


class Account(_Strict):
    full_name: Name
    email: EmailStr | None = None
    phone: Annotated[str, Field(pattern=r"^\+?[0-9 \-]{7,20}$")] | None = None
    password: Annotated[str, Field(min_length=8, max_length=128)]


# --- Organization profiles -------------------------------------------------

class TourOperatorProfile(_Strict):
    company_name: Name
    country: Name
    website: HttpUrl | None = None
    travelers_per_year: Count
    booking_system: Literal["Our own website", "TourRadar or marketplace", "Through agents", "Email / phone"]
    source_markets: list[str] = []
    nepal_license_no: str | None = None


class EventOrganizerProfile(_Strict):
    organization_name: Name
    event_name: Name
    event_start: date
    event_city: Name
    expected_attendees: Count
    registration_platform: str | None = None
    who_pays: Literal["Organizer covers all attendees", "Included in registration fee", "Attendee opt-in"]


class NgoProfile(_Strict):
    organization_name: Name
    organization_type: Literal["INGO", "National NGO", "UN agency", "Embassy / mission", "Bilateral donor"]
    staff_in_nepal: Count | None = None
    flights_per_year: Count | None = None
    has_climate_policy: Literal["Yes", "In progress", "No"] | None = None


class UniversityProfile(_Strict):
    institution_name: Name
    department: str | None = None
    country: Name
    has_flight_levy: Literal["Yes", "Planned", "No"] | None = None
    flights_per_year: Count | None = None


class HospitalityProfile(_Strict):
    property_name: Name
    district: Name
    rooms: Count | None = None
    energy_sources: list[str] = []


class IndividualProfile(_Strict):
    home_country: str | None = None
    district_interest: str | None = None


# --- Landowner profiles ----------------------------------------------------

PayoutMethod = Literal["eSewa", "Khalti", "Bank transfer", "Through cooperative"]


class FarmerProfile(_Strict):
    district: Name
    municipality: str | None = None
    land_area: Positive
    land_unit: Literal["Ropani", "Bigha", "Kattha", "Hectare"]
    existing_trees: Count | None = None
    open_to_planting: Literal["Yes", "Maybe", "No"] | None = None
    species: list[str] = []
    payout_method: PayoutMethod


class CommunityForestProfile(_Strict):
    cfug_name: Name
    registration_no: str | None = None
    district: Name
    area_ha: Positive
    households: Count | None = None
    species: list[str] = []
    payout_method: Literal["Bank transfer", "Through cooperative"]


class CooperativeProfile(_Strict):
    cooperative_name: Name
    registration_no: str | None = None
    district: Name
    members: Count | None = None
    plots: Count | None = None
    crops: list[str] = []


# --- Requests --------------------------------------------------------------

class _SignupBase(_Strict):
    plan: Literal["starter", "operator", "institution"] | None = None
    account: Account
    # From POST /auth/otp/verify for the primary contact (phone for Land Partners, email otherwise)
    otp_token: str = Field(min_length=8)


class _OrganizationSignup(_SignupBase):
    @field_validator("account")
    @classmethod
    def email_required(cls, account: Account) -> Account:
        if not account.email:
            raise ValueError("a work email is required")
        return account


class _LandownerSignup(_SignupBase):
    @field_validator("account")
    @classmethod
    def phone_required(cls, account: Account) -> Account:
        if not account.phone:
            raise ValueError("a mobile number is required")
        return account


class TourOperatorSignup(_OrganizationSignup):
    category: Literal["tour_operator"]
    profile: TourOperatorProfile


class EventOrganizerSignup(_OrganizationSignup):
    category: Literal["event_organizer"]
    profile: EventOrganizerProfile


class NgoSignup(_OrganizationSignup):
    category: Literal["ngo"]
    profile: NgoProfile


class UniversitySignup(_OrganizationSignup):
    category: Literal["university"]
    profile: UniversityProfile


class HospitalitySignup(_OrganizationSignup):
    category: Literal["hospitality"]
    profile: HospitalityProfile


class IndividualSignup(_OrganizationSignup):
    category: Literal["individual"]
    profile: IndividualProfile = IndividualProfile()


class FarmerSignup(_LandownerSignup):
    category: Literal["farmer"]
    profile: FarmerProfile


class CommunityForestSignup(_LandownerSignup):
    category: Literal["community_forest"]
    profile: CommunityForestProfile


class CooperativeSignup(_LandownerSignup):
    category: Literal["cooperative"]
    profile: CooperativeProfile


SignupRequest = Annotated[
    Union[
        TourOperatorSignup,
        EventOrganizerSignup,
        NgoSignup,
        UniversitySignup,
        HospitalitySignup,
        IndividualSignup,
        FarmerSignup,
        CommunityForestSignup,
        CooperativeSignup,
    ],
    Field(discriminator="category"),
]


class SignupResponse(BaseModel):
    id: str
    category: str
    side: Side
    status: Literal["active", "pending_verification", "waitlisted"]
    display_name: str
    created_at: datetime
