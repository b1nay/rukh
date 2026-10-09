"""International journeys to Kathmandu: segments, layovers, flight time and CO2.

Known origins (data/routes.py) use their saved routing via a hub. Any other
airport falls back to a direct great-circle estimate, flagged as estimated.
Each segment is priced on its own distance, so short connecting hops use the
higher short-haul factor.
"""

from dataclasses import asdict, dataclass

from app.data.airports import AIRPORTS
from app.data.routes import TO_KTM
from app.services.emissions import (
    CABIN_MULTIPLIER,
    KG_PER_PKM,
    NON_CO2_MULTIPLIER,
    ROUTING_UPLIFT,
    SHORT_HAUL_KM,
    UnknownAirport,
    great_circle_km,
)

CRUISE_KMH = 850
TAXI_CLIMB_HOURS = 0.5  # taxi, climb and descent per flight


@dataclass
class Segment:
    origin: str
    destination: str
    km: float
    hours: float
    kg: float  # one passenger, one direction


@dataclass
class Journey:
    origin: str
    destination: str
    segments: list[Segment]
    layovers: dict[str, float]
    carrier: str | None
    estimated: bool  # True when no saved route exists
    km_one_way: float
    hours_one_way: float  # flying + layovers
    round_trip: bool
    kg: float  # one passenger, whole journey (both ways if round trip)

    def to_dict(self) -> dict:
        return asdict(self)


def block_hours(km: float) -> float:
    return round(km / CRUISE_KMH + TAXI_CLIMB_HOURS, 2)


def segment_kg(km: float, cabin: str, include_non_co2: bool) -> float:
    factor = KG_PER_PKM["short" if km < SHORT_HAUL_KM else "long"]
    kg = km * ROUTING_UPLIFT * factor * CABIN_MULTIPLIER[cabin]
    return kg * NON_CO2_MULTIPLIER if include_non_co2 else kg


def journey(
    origin: str,
    destination: str = "KTM",
    cabin: str = "economy",
    round_trip: bool = True,
    include_non_co2: bool = False,
) -> Journey:
    origin, destination = origin.upper(), destination.upper()
    for code in (origin, destination):
        if code not in AIRPORTS:
            raise UnknownAirport(f"Unknown airport code {code}")

    saved = TO_KTM.get(origin) if destination == "KTM" else None
    if saved:
        legs = saved["segments"]
        layovers = dict(saved["layovers"])
        carrier = saved["carrier"]
    else:
        legs = [(origin, destination, round(great_circle_km(origin, destination)))]
        layovers, carrier = {}, None

    segments = [
        Segment(a, b, km, block_hours(km), round(segment_kg(km, cabin, include_non_co2), 2))
        for a, b, km in legs
    ]
    one_way_kg = sum(s.kg for s in segments)
    return Journey(
        origin=origin,
        destination=destination,
        segments=segments,
        layovers=layovers,
        carrier=carrier,
        estimated=saved is None,
        km_one_way=sum(s.km for s in segments),
        hours_one_way=round(sum(s.hours for s in segments) + sum(layovers.values()), 2),
        round_trip=round_trip,
        kg=round(one_way_kg * (2 if round_trip else 1), 2),
    )


def major_routes() -> list[dict]:
    out = []
    for code in TO_KTM:
        j = journey(code)
        _, city, _, _ = AIRPORTS[code]
        out.append({
            "code": code,
            "city": city,
            "via": [s.destination for s in j.segments[:-1]],
            "carrier": j.carrier,
            "km_one_way": j.km_one_way,
            "hours_one_way": j.hours_one_way,
            "kg_round_trip_economy": j.kg,
        })
    return out
