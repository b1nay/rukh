from datetime import date, datetime, timezone
from typing import Any

from sqlalchemy import JSON, Boolean, Date, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import TypeDecorator

from app.db import Base


def _now() -> datetime:
    return datetime.now(timezone.utc)


class UTCDateTime(TypeDecorator):
    """Timestamps stored as UTC and always returned timezone-aware.

    SQLite drops tzinfo, so API responses would otherwise send naive times that
    browsers read as local time.
    """

    impl = DateTime(timezone=True)
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is not None and value.tzinfo is not None:
            value = value.astimezone(timezone.utc)
        return value

    def process_result_value(self, value, dialect):
        if value is not None and value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    side: Mapped[str] = mapped_column(String(20))  # organization | landowner | admin
    category: Mapped[str] = mapped_column(String(40))
    status: Mapped[str] = mapped_column(String(30))
    display_name: Mapped[str] = mapped_column(String(160))
    full_name: Mapped[str] = mapped_column(String(160))
    email: Mapped[str | None] = mapped_column(String(254), unique=True)
    phone: Mapped[str | None] = mapped_column(String(32), unique=True)
    password_hash: Mapped[str] = mapped_column(String(200))
    plan: Mapped[str | None] = mapped_column(String(20))
    profile: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=_now)


class AuthToken(Base):
    __tablename__ = "auth_tokens"

    token: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=_now)

    user: Mapped[User] = relationship()


class OtpChallenge(Base):
    """A one-time code sent to a phone or email during sign-up."""

    __tablename__ = "otp_challenges"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    destination: Mapped[str] = mapped_column(String(254), index=True)
    channel: Mapped[str] = mapped_column(String(10))  # phone | email
    code: Mapped[str] = mapped_column(String(8))
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    verified_token: Mapped[str | None] = mapped_column(String(64), unique=True)
    used: Mapped[bool] = mapped_column(Boolean, default=False)
    expires_at: Mapped[datetime] = mapped_column(UTCDateTime())
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=_now)


class Field(Base):
    """A plot enrolled by a Land Partner.

    kind="existing": standing trees whose yearly growth is sold (Protect).
    kind="planting": land offered for new trees (Plant); capacity is tree slots.
    """

    __tablename__ = "fields"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(120))
    kind: Mapped[str] = mapped_column(String(20))
    district: Mapped[str] = mapped_column(String(60))
    area_ha: Mapped[float] = mapped_column(Float)
    species: Mapped[str] = mapped_column(String(40))
    tree_count: Mapped[int] = mapped_column(Integer)
    tree_age_years: Mapped[int] = mapped_column(Integer, default=0)
    latitude: Mapped[float | None] = mapped_column(Float)
    longitude: Mapped[float | None] = mapped_column(Float)
    status: Mapped[str] = mapped_column(String(30), default="verified")
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=_now)

    owner: Mapped[User] = relationship()
    tree_groups: Mapped[list["TreeGroup"]] = relationship(
        back_populates="field", cascade="all, delete-orphan", order_by="TreeGroup.id"
    )


class TreeGroup(Base):
    """Trees of one species and size on a field: the field's tree inventory.

    On existing fields the groups are the standing trees and set the field's capacity.
    On planting land they record the new trees planted so far.
    """

    __tablename__ = "tree_groups"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    field_id: Mapped[int] = mapped_column(ForeignKey("fields.id", ondelete="CASCADE"), index=True)
    species: Mapped[str] = mapped_column(String(40))
    count: Mapped[int] = mapped_column(Integer)
    age_years: Mapped[int] = mapped_column(Integer, default=0)
    height_m: Mapped[float | None] = mapped_column(Float)
    dbh_cm: Mapped[float | None] = mapped_column(Float)  # trunk diameter at 1.3 m
    planted_on: Mapped[date | None] = mapped_column(Date)
    note: Mapped[str | None] = mapped_column(String(300))
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=_now)
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=_now, onupdate=_now)

    field: Mapped[Field] = relationship(back_populates="tree_groups")


class Itinerary(Base):
    """A reusable, fixed sequence of legs. owner_id=None for starter templates."""

    __tablename__ = "itineraries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    owner_id: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(160))
    kind: Mapped[str] = mapped_column(String(20))  # trek | tour | event | business | other
    days: Mapped[int] = mapped_column(Integer)
    description: Mapped[str | None] = mapped_column(String(500))
    legs: Mapped[list[dict[str, Any]]] = mapped_column(JSON)  # priced legs, see services/itinerary.py
    kg_per_person: Mapped[float] = mapped_column(Float)  # shared legs only
    archived: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=_now)


class Trip(Base):
    """One departure of an itinerary with a set group of travelers."""

    __tablename__ = "trips"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    itinerary_id: Mapped[int | None] = mapped_column(ForeignKey("itineraries.id", ondelete="SET NULL"), index=True)
    name: Mapped[str] = mapped_column(String(160))
    kind: Mapped[str] = mapped_column(String(20))
    start_date: Mapped[date] = mapped_column(Date)
    pax: Mapped[int] = mapped_column(Integer)
    include_non_co2: Mapped[bool] = mapped_column(Boolean, default=False)
    # Snapshot of the itinerary at booking time, so later edits don't change past trips.
    legs: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list)
    shared_kg_per_person: Mapped[float] = mapped_column(Float, default=0)
    co2_kg: Mapped[float] = mapped_column(Float, default=0)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=_now)

    owner: Mapped[User] = relationship()
    itinerary: Mapped[Itinerary | None] = relationship()
    travelers: Mapped[list["Traveler"]] = relationship(cascade="all, delete-orphan", order_by="Traveler.id")
    allocations: Mapped[list["Allocation"]] = relationship(back_populates="trip", cascade="all, delete-orphan")
    requests: Mapped[list["AllocationRequest"]] = relationship(
        back_populates="trip", cascade="all, delete-orphan", order_by="AllocationRequest.id.desc()"
    )


class Traveler(Base):
    __tablename__ = "travelers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    trip_id: Mapped[int] = mapped_column(ForeignKey("trips.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(160))
    email: Mapped[str | None] = mapped_column(String(254))
    phone: Mapped[str | None] = mapped_column(String(32))
    nationality: Mapped[str | None] = mapped_column(String(80))
    home_airport: Mapped[str | None] = mapped_column(String(3))
    cabin: Mapped[str] = mapped_column(String(20), default="economy")
    flight_kg: Mapped[float] = mapped_column(Float, default=0)
    # Route, segments, layovers and hours of the international journey (services/routes.py)
    journey: Mapped[dict[str, Any] | None] = mapped_column(JSON)
    co2_kg: Mapped[float] = mapped_column(Float, default=0)


class AllocationRequest(Base):
    """A Climate Partner's bill for a trip's open tonnes, decided by a superadmin.

    status: pending -> allocated | partial | rejected, or cancelled by the partner.
    """

    __tablename__ = "allocation_requests"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    trip_id: Mapped[int] = mapped_column(ForeignKey("trips.id", ondelete="CASCADE"), index=True)
    requester_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    impact_type: Mapped[str] = mapped_column(String(10))
    year: Mapped[int] = mapped_column(Integer)
    tonnes: Mapped[float] = mapped_column(Float)
    price_per_tonne: Mapped[float] = mapped_column(Float)
    subtotal_usd: Mapped[float] = mapped_column(Float)
    fee_rate: Mapped[float] = mapped_column(Float)
    fee_usd: Mapped[float] = mapped_column(Float)
    total_usd: Mapped[float] = mapped_column(Float)
    status: Mapped[str] = mapped_column(String(20), default="pending", index=True)
    note: Mapped[str | None] = mapped_column(String(1000))
    admin_note: Mapped[str | None] = mapped_column(String(1000))
    allocated_tonnes: Mapped[float] = mapped_column(Float, default=0)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=_now)
    decided_at: Mapped[datetime | None] = mapped_column(UTCDateTime())

    trip: Mapped["Trip"] = relationship(back_populates="requests")
    requester: Mapped[User] = relationship()
    messages: Mapped[list["Message"]] = relationship(cascade="all, delete-orphan", order_by="Message.id")


class Invoice(Base):
    """A bill from Rukh to a Climate Partner, issued when trees are allocated.

    status: unpaid | paid | void. "Overdue" is derived (unpaid and past due_at).
    """

    __tablename__ = "invoices"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    number: Mapped[str] = mapped_column(String(30), unique=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    trip_id: Mapped[int | None] = mapped_column(ForeignKey("trips.id", ondelete="SET NULL"), index=True)
    request_id: Mapped[int | None] = mapped_column(ForeignKey("allocation_requests.id", ondelete="SET NULL"), unique=True)
    description: Mapped[str] = mapped_column(String(300))
    lines: Mapped[list[dict[str, Any]]] = mapped_column(JSON)  # [{description, quantity, unit, unit_price, amount}]
    subtotal_usd: Mapped[float] = mapped_column(Float)
    fee_usd: Mapped[float] = mapped_column(Float)
    total_usd: Mapped[float] = mapped_column(Float)
    status: Mapped[str] = mapped_column(String(10), default="unpaid", index=True)
    issued_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=_now)
    due_at: Mapped[datetime] = mapped_column(UTCDateTime())
    paid_at: Mapped[datetime | None] = mapped_column(UTCDateTime())
    payment_method: Mapped[str | None] = mapped_column(String(30))
    payment_reference: Mapped[str | None] = mapped_column(String(80))

    user: Mapped[User] = relationship()
    trip: Mapped["Trip | None"] = relationship()


class Message(Base):
    """Correspondence between a Climate Partner and Rukh about one request."""

    __tablename__ = "messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    request_id: Mapped[int] = mapped_column(ForeignKey("allocation_requests.id", ondelete="CASCADE"), index=True)
    sender_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    body: Mapped[str] = mapped_column(String(4000))
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=_now)

    sender: Mapped[User] = relationship()


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(String(40))
    title: Mapped[str] = mapped_column(String(200))
    body: Mapped[str | None] = mapped_column(String(1000))
    link: Mapped[str | None] = mapped_column(String(300))
    read: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=_now)


class Allocation(Base):
    """Tonnes of a trip covered by a field, for one calendar year."""

    __tablename__ = "allocations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    trip_id: Mapped[int] = mapped_column(ForeignKey("trips.id", ondelete="CASCADE"), index=True)
    request_id: Mapped[int | None] = mapped_column(ForeignKey("allocation_requests.id", ondelete="SET NULL"), index=True)
    field_id: Mapped[int] = mapped_column(ForeignKey("fields.id"), index=True)
    impact_type: Mapped[str] = mapped_column(String(10))  # protect | plant
    year: Mapped[int] = mapped_column(Integer)
    tonnes: Mapped[float] = mapped_column(Float)
    trees: Mapped[int] = mapped_column(Integer, default=0)  # new trees (plant only)
    amount_usd: Mapped[float] = mapped_column(Float)
    landowner_usd: Mapped[float] = mapped_column(Float)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=_now)

    trip: Mapped[Trip] = relationship(back_populates="allocations")
    field: Mapped[Field] = relationship()


class Payout(Base):
    """What Rukh owes one Land Partner for the trees allocated to one request.

    Created automatically on allocation. status: pending | paid.
    """

    __tablename__ = "payouts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    number: Mapped[str] = mapped_column(String(30), unique=True)
    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    request_id: Mapped[int | None] = mapped_column(ForeignKey("allocation_requests.id", ondelete="SET NULL"), index=True)
    invoice_id: Mapped[int | None] = mapped_column(ForeignKey("invoices.id", ondelete="SET NULL"), index=True)
    lines: Mapped[list[dict[str, Any]]] = mapped_column(JSON)  # [{field_id, field_name, trees, tonnes, amount}]
    amount_usd: Mapped[float] = mapped_column(Float)
    status: Mapped[str] = mapped_column(String(10), default="pending", index=True)
    method: Mapped[str | None] = mapped_column(String(40))
    reference: Mapped[str | None] = mapped_column(String(80))
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=_now)
    paid_at: Mapped[datetime | None] = mapped_column(UTCDateTime())

    owner: Mapped[User] = relationship()
    request: Mapped["AllocationRequest | None"] = relationship()
    invoice: Mapped["Invoice | None"] = relationship()
