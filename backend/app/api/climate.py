from collections import defaultdict
from datetime import date

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import func, or_, select

from app.deps import DB, ClimatePartner
from app.models import Itinerary, Traveler, Trip, User
from app.api.requests import request_out
from app.schemas.climate import (
    AllocationOut,
    CategoryTotal,
    ClimateSummary,
    ItineraryIn,
    ItineraryOut,
    Leg,
    LegsPreviewIn,
    LegsPreviewOut,
    MonthPoint,
    TravelerOut,
    TripDetail,
    TripIn,
    TripSummary,
)
from app.services.allocation import covered_tonnes
from app.services.emissions import UnknownAirport
from app.services.itinerary import LegError, per_traveler_flights, price_legs, traveler_journey
from app.services.sequestration import SPECIES

router = APIRouter(prefix="/climate", tags=["climate partner"])

UNPROCESSABLE = status.HTTP_422_UNPROCESSABLE_CONTENT


def _price(legs: list[dict], include_non_co2: bool = False) -> tuple[list[dict], float]:
    try:
        return price_legs(legs, include_non_co2)
    except (LegError, UnknownAirport) as e:
        raise HTTPException(UNPROCESSABLE, str(e)) from None


# --- itineraries ------------------------------------------------------------

def _usage(db: DB, user: User) -> dict[int, tuple[int, date]]:
    rows = db.execute(
        select(Trip.itinerary_id, func.count(Trip.id), func.max(Trip.start_date))
        .where(Trip.owner_id == user.id, Trip.itinerary_id.is_not(None))
        .group_by(Trip.itinerary_id)
    )
    return {r[0]: (r[1], r[2]) for r in rows}


def _itinerary_out(it: Itinerary, usage: dict[int, tuple[int, date]]) -> ItineraryOut:
    used, last = usage.get(it.id, (0, None))
    return ItineraryOut(
        id=it.id,
        name=it.name,
        kind=it.kind,
        days=it.days,
        description=it.description,
        legs=[Leg(**leg) for leg in it.legs],
        kg_per_person=it.kg_per_person,
        has_international=per_traveler_flights(it.legs),
        is_template=it.owner_id is None,
        times_used=used,
        last_used=last,
    )


def _visible_itineraries(db: DB, user: User) -> list[Itinerary]:
    return list(
        db.scalars(
            select(Itinerary)
            .where(or_(Itinerary.owner_id == user.id, Itinerary.owner_id.is_(None)), Itinerary.archived.is_(False))
            .order_by(Itinerary.created_at.desc())
        )
    )


def ranked_itineraries(db: DB, user: User) -> list[ItineraryOut]:
    """Most used first (own or starter), then the operator's own, then starters."""
    usage = _usage(db, user)
    out = [_itinerary_out(it, usage) for it in _visible_itineraries(db, user)]
    return sorted(out, key=lambda i: (-i.times_used, -(i.last_used or date.min).toordinal(), i.is_template, i.name))


def _create_itinerary(db: DB, user: User, payload: ItineraryIn) -> Itinerary:
    legs, per_person = _price([leg.model_dump(exclude_none=True) for leg in payload.legs])
    it = Itinerary(
        owner_id=user.id,
        name=payload.name,
        kind=payload.kind,
        days=payload.days,
        description=payload.description,
        legs=legs,
        kg_per_person=per_person,
    )
    db.add(it)
    db.flush()
    return it


@router.post("/legs/preview", response_model=LegsPreviewOut)
def preview_legs(payload: LegsPreviewIn, user: ClimatePartner) -> LegsPreviewOut:
    legs, per_person = _price([leg.model_dump(exclude_none=True) for leg in payload.legs], payload.include_non_co2)
    return LegsPreviewOut(
        legs=[Leg(**leg) for leg in legs], kg_per_person=per_person, has_international=per_traveler_flights(legs)
    )


@router.get("/itineraries", response_model=list[ItineraryOut])
def list_itineraries(user: ClimatePartner, db: DB) -> list[ItineraryOut]:
    return ranked_itineraries(db, user)


@router.post("/itineraries", response_model=ItineraryOut, status_code=status.HTTP_201_CREATED)
def create_itinerary(payload: ItineraryIn, user: ClimatePartner, db: DB) -> ItineraryOut:
    it = _create_itinerary(db, user, payload)
    db.commit()
    return _itinerary_out(it, {})


def _visible_itinerary(db: DB, user: User, itinerary_id: int) -> Itinerary:
    it = db.get(Itinerary, itinerary_id)
    if it is None or it.archived or it.owner_id not in (None, user.id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Itinerary not found")
    return it


@router.get("/itineraries/{itinerary_id}", response_model=ItineraryOut)
def get_itinerary(itinerary_id: int, user: ClimatePartner, db: DB) -> ItineraryOut:
    return _itinerary_out(_visible_itinerary(db, user, itinerary_id), _usage(db, user))


@router.delete("/itineraries/{itinerary_id}", status_code=status.HTTP_204_NO_CONTENT)
def archive_itinerary(itinerary_id: int, user: ClimatePartner, db: DB) -> None:
    it = _visible_itinerary(db, user, itinerary_id)
    if it.owner_id is None:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Starter itineraries can't be removed")
    it.archived = True  # past trips keep their snapshot
    db.commit()


# --- trips --------------------------------------------------------------------

def _summary(trip: Trip) -> TripSummary:
    co2_t = trip.co2_kg / 1000
    covered = covered_tonnes(trip)
    state = "uncovered" if covered == 0 else "covered" if covered >= co2_t - 0.001 else "partial"
    return TripSummary(
        id=trip.id,
        name=trip.name,
        kind=trip.kind,
        start_date=trip.start_date,
        travelers=len(trip.travelers),
        co2_t=round(co2_t, 3),
        covered_t=round(covered, 3),
        status=state,
        itinerary_id=trip.itinerary_id,
    )


def _by_category(trip: Trip) -> list[CategoryTotal]:
    totals: dict[str, float] = defaultdict(float)
    totals["flight"] += sum(t.flight_kg for t in trip.travelers)
    for leg in trip.legs:
        totals[leg["category"]] += leg["kg_per_person"] * trip.pax
    order = ["flight", "helicopter", "road", "stay", "activity", "trail"]
    return [CategoryTotal(category=c, kg=round(totals[c], 1)) for c in order if c in totals]


def _detail(trip: Trip) -> TripDetail:
    return TripDetail(
        **_summary(trip).model_dump(),
        include_non_co2=trip.include_non_co2,
        legs=[Leg(**leg) for leg in trip.legs],
        shared_kg_per_person=trip.shared_kg_per_person,
        by_category=_by_category(trip),
        traveler_list=[TravelerOut.model_validate(t) for t in trip.travelers],
        spend_usd=round(sum(a.amount_usd for a in trip.allocations), 2),
        requests=[request_out(r) for r in trip.requests],
        allocations=[
            AllocationOut(
                id=a.id,
                request_id=a.request_id,
                impact_type=a.impact_type,
                year=a.year,
                tonnes=a.tonnes,
                trees=a.trees,
                amount_usd=a.amount_usd,
                field_id=a.field.id,
                field_name=a.field.name,
                district=a.field.district,
                species=SPECIES[a.field.species]["name"],
                landowner=a.field.owner.full_name,
                latitude=a.field.latitude,
                longitude=a.field.longitude,
                created_at=a.created_at,
            )
            for a in trip.allocations
        ],
    )


def _own_trip(db: DB, user_id: str, trip_id: int) -> Trip:
    trip = db.get(Trip, trip_id)
    if trip is None or trip.owner_id != user_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Trip not found")
    return trip


@router.get("/summary", response_model=ClimateSummary)
def summary(user: ClimatePartner, db: DB) -> ClimateSummary:
    trips = db.scalars(select(Trip).where(Trip.owner_id == user.id).order_by(Trip.start_date.desc())).all()
    allocations = [a for t in trips for a in t.allocations]
    monthly: dict[str, list[float]] = defaultdict(lambda: [0.0, 0.0])
    for t in trips:
        key = t.start_date.strftime("%Y-%m")
        monthly[key][0] += t.co2_kg / 1000
        monthly[key][1] += covered_tonnes(t)
    protect_t = sum(a.tonnes for a in allocations if a.impact_type == "protect")
    return ClimateSummary(
        trips=len(trips),
        travelers=sum(len(t.travelers) for t in trips),
        co2_t=round(sum(t.co2_kg for t in trips) / 1000, 3),
        covered_t=round(sum(a.tonnes for a in allocations), 2),
        new_trees=sum(a.trees for a in allocations),
        tree_years=round(protect_t * 1000 / 20),  # ~20 kg per tree-year
        spend_usd=round(sum(a.amount_usd for a in allocations), 2),
        monthly=[MonthPoint(month=m, co2_t=round(v[0], 2), covered_t=round(v[1], 2)) for m, v in sorted(monthly.items())][-12:],
        recent_trips=[_summary(t) for t in trips[:5]],
        top_itineraries=ranked_itineraries(db, user)[:4],
    )


@router.get("/trips", response_model=list[TripSummary])
def list_trips(user: ClimatePartner, db: DB) -> list[TripSummary]:
    trips = db.scalars(select(Trip).where(Trip.owner_id == user.id).order_by(Trip.start_date.desc())).all()
    return [_summary(t) for t in trips]


@router.post("/trips", response_model=TripDetail, status_code=status.HTTP_201_CREATED)
def create_trip(payload: TripIn, user: ClimatePartner, db: DB) -> TripDetail:
    it = (
        _visible_itinerary(db, user, payload.itinerary_id)
        if payload.itinerary_id is not None
        else _create_itinerary(db, user, payload.itinerary)  # type: ignore[arg-type]
    )
    # Re-price the snapshot with this departure's non-CO2 choice.
    legs, per_person = _price([{k: v for k, v in leg.items() if k != "kg_per_person"} for leg in it.legs], payload.include_non_co2)

    trip = Trip(
        owner_id=user.id,
        itinerary_id=it.id,
        name=payload.name or f"{it.name} · {payload.start_date:%b %Y}",
        kind=it.kind,
        start_date=payload.start_date,
        pax=payload.pax,
        include_non_co2=payload.include_non_co2,
        legs=legs,
        shared_kg_per_person=per_person,
    )
    total = 0.0
    for i, t in enumerate(payload.travelers, start=1):
        try:
            j = traveler_journey(legs, t.home_airport, t.cabin, payload.include_non_co2)
        except UnknownAirport as e:
            raise HTTPException(UNPROCESSABLE, f"Traveler {i} ({t.name}): {e}") from None
        flight = j.kg if j else 0.0
        co2 = flight + per_person
        trip.travelers.append(
            Traveler(
                name=t.name,
                email=t.email,
                phone=t.phone,
                nationality=t.nationality,
                home_airport=t.home_airport,
                cabin=t.cabin,
                flight_kg=round(flight, 2),
                journey=j.to_dict() if j else None,
                co2_kg=round(co2, 2),
            )
        )
        total += co2
    trip.co2_kg = round(total, 2)
    db.add(trip)
    db.commit()
    db.refresh(trip)
    return _detail(trip)


@router.get("/trips/{trip_id}", response_model=TripDetail)
def get_trip(trip_id: int, user: ClimatePartner, db: DB) -> TripDetail:
    return _detail(_own_trip(db, user.id, trip_id))


@router.delete("/trips/{trip_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_trip(trip_id: int, user: ClimatePartner, db: DB) -> None:
    trip = _own_trip(db, user.id, trip_id)
    if trip.allocations:
        raise HTTPException(status.HTTP_409_CONFLICT, "Trips with allocated trees can't be deleted")
    db.delete(trip)
    db.commit()
