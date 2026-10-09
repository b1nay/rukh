"""Itinerary emissions: every leg of a trip, per person.

The international flight either starts from each traveler's home airport
(origin left empty, priced per traveler) or from one of the 10 major airports
for the whole group (origin set, priced per person like any shared leg).
Every other leg is shared by the group and computed once per person.

Factors are placeholders in line with UK DESNZ conversion factors (CO2 only)
and published hotel-footprint ranges; replace with Nepal-specific data.
"""

from typing import Any

from app.services.emissions import (
    CABIN_MULTIPLIER,
    NON_CO2_MULTIPLIER,
    ROUTING_UPLIFT,
    great_circle_km,
)
from app.data.airports import NEPAL_AIRPORTS, NEPAL_INTERNATIONAL
from app.data.routes import TO_KTM
from app.services.routes import Journey, journey

DOMESTIC_KG_PER_PKM = 0.15  # small turboprops (Twin Otter, ATR)
MOUNTAIN_FLIGHT_KM = 300  # typical Everest sightseeing loop
HELICOPTER_KG_PER_HOUR = 460  # ~145 kg Jet A1/hr (AS350 B3) x 3.16

# category -> mode -> spec
MODES: dict[str, dict[str, dict[str, Any]]] = {
    "flight": {
        "international": {"label": "International flight", "basis": "per_traveler"},
        "domestic": {"label": "Domestic flight", "basis": "pkm", "factor": DOMESTIC_KG_PER_PKM},
        "mountain_flight": {"label": "Mountain sightseeing flight", "basis": "fixed_km", "factor": DOMESTIC_KG_PER_PKM},
    },
    "helicopter": {
        "helicopter": {"label": "Helicopter", "basis": "hour_shared", "factor": HELICOPTER_KG_PER_HOUR, "default_share": 4},
    },
    "road": {
        "taxi": {"label": "Taxi", "basis": "vkm", "factor": 0.17, "default_share": 2},
        "private_car": {"label": "Private car", "basis": "vkm", "factor": 0.17, "default_share": 3},
        "jeep": {"label": "Jeep / 4x4", "basis": "vkm", "factor": 0.23, "default_share": 5},
        "tourist_bus": {"label": "Tourist bus", "basis": "pkm", "factor": 0.03},
        "local_bus": {"label": "Local bus", "basis": "pkm", "factor": 0.08},
        "motorbike": {"label": "Motorbike", "basis": "vkm", "factor": 0.11, "default_share": 1},
    },
    "stay": {
        "hotel_luxury": {"label": "Hotel · 4–5 star", "basis": "room_night", "factor": 40, "default_share": 2},
        "hotel_standard": {"label": "Hotel · 2–3 star", "basis": "room_night", "factor": 22, "default_share": 2},
        "hotel_budget": {"label": "Guesthouse", "basis": "room_night", "factor": 14, "default_share": 2},
        "teahouse": {"label": "Teahouse / lodge", "basis": "room_night", "factor": 12, "default_share": 2},
        "homestay": {"label": "Homestay", "basis": "room_night", "factor": 6, "default_share": 2},
        "camping": {"label": "Camping", "basis": "room_night", "factor": 3, "default_share": 2},
    },
    "trail": {
        "trek": {"label": "Trek", "basis": "zero"},
        "walk": {"label": "Walk / hike", "basis": "zero"},
        "cycle": {"label": "Cycling", "basis": "zero"},
    },
    "activity": {
        "rafting": {"label": "River rafting", "basis": "per_person", "factor": 6},
        "paragliding": {"label": "Paragliding", "basis": "per_person", "factor": 2},
        "jungle_safari": {"label": "Jungle jeep safari", "basis": "per_person", "factor": 10},
        "canoe": {"label": "Canoe ride", "basis": "per_person", "factor": 1},
        "cultural_tour": {"label": "Cultural / city tour", "basis": "per_person", "factor": 2},
    },
}

AVIATION = {"flight", "helicopter"}


class LegError(ValueError):
    pass


def mode_spec(category: str, mode: str) -> dict[str, Any]:
    try:
        return MODES[category][mode]
    except KeyError:
        raise LegError(f"Unknown leg type {category}/{mode}") from None


def leg_kg_per_person(leg: dict[str, Any], include_non_co2: bool = False) -> float:
    """CO2 per person for one shared leg. International flights return 0 here."""
    spec = mode_spec(leg["category"], leg["mode"])
    basis = spec["basis"]
    share = leg.get("share") or spec.get("default_share") or 1

    if basis == "per_traveler":
        kg = group_journey(leg, include_non_co2).kg if leg.get("origin") else 0.0
    elif basis == "zero":
        kg = 0.0
    elif basis == "pkm":
        if leg["category"] == "flight":
            if not (leg.get("origin") and leg.get("destination")):
                raise LegError("Domestic flights need an origin and destination airport")
            for code in (leg["origin"], leg["destination"]):
                if code not in NEPAL_AIRPORTS:
                    raise LegError(f"{code} is not a Nepal domestic airport")
            if leg["origin"] == leg["destination"]:
                raise LegError("A domestic flight needs two different airports")
            km = great_circle_km(leg["origin"], leg["destination"]) * ROUTING_UPLIFT
        else:
            km = float(leg.get("distance_km") or 0)
        kg = km * spec["factor"]
    elif basis == "fixed_km":
        kg = MOUNTAIN_FLIGHT_KM * spec["factor"]
    elif basis == "vkm":
        kg = float(leg.get("distance_km") or 0) * spec["factor"] / share
    elif basis == "hour_shared":
        kg = float(leg.get("hours") or 0) * spec["factor"] / share
    elif basis == "room_night":
        kg = int(leg.get("nights") or 0) * spec["factor"] / share
    elif basis == "per_person":
        kg = spec["factor"]
    else:  # pragma: no cover
        raise LegError(f"Unsupported basis {basis}")

    # Journeys apply the non-CO2 multiplier themselves.
    if leg["category"] in AVIATION and include_non_co2 and basis != "per_traveler":
        kg *= NON_CO2_MULTIPLIER
    return kg


def group_journey(leg: dict[str, Any], include_non_co2: bool = False) -> Journey:
    """International flight taken by the whole group from one major airport."""
    origin, destination = leg["origin"], leg.get("destination") or "KTM"
    if origin not in TO_KTM:
        raise LegError(f"Group flights start from one of the major airports: {', '.join(TO_KTM)}")
    if destination not in NEPAL_INTERNATIONAL:
        raise LegError(f"International flights arrive at {', '.join(NEPAL_INTERNATIONAL)}")
    return journey(origin, destination, "economy", bool(leg.get("round_trip", True)), include_non_co2)


def international_leg(legs: list[dict[str, Any]]) -> dict[str, Any] | None:
    return next((leg for leg in legs if leg["category"] == "flight" and leg["mode"] == "international"), None)


def per_traveler_flights(legs: list[dict[str, Any]]) -> bool:
    """True when each traveler's home airport decides their international flight."""
    leg = international_leg(legs)
    return leg is not None and not leg.get("origin")


def traveler_journey(
    legs: list[dict[str, Any]], home_airport: str | None, cabin: str, include_non_co2: bool
) -> Journey | None:
    """Each traveler's own international journey, if the itinerary prices it per traveler."""
    leg = international_leg(legs)
    if leg is None or leg.get("origin") or not home_airport:
        return None
    destination = leg.get("destination") or "KTM"
    if home_airport == destination:
        return None
    return journey(home_airport, destination, cabin, bool(leg.get("round_trip", True)), include_non_co2)


def traveler_flight_kg(
    legs: list[dict[str, Any]], home_airport: str | None, cabin: str, include_non_co2: bool
) -> float:
    j = traveler_journey(legs, home_airport, cabin, include_non_co2)
    return j.kg if j else 0.0


def price_legs(legs: list[dict[str, Any]], include_non_co2: bool = False) -> tuple[list[dict[str, Any]], float]:
    """Return legs annotated with kg_per_person, plus the shared per-person total."""
    if sum(1 for leg in legs if leg["category"] == "flight" and leg["mode"] == "international") > 1:
        raise LegError("An itinerary can have only one international flight")
    priced = []
    for leg in legs:
        kg = leg_kg_per_person(leg, include_non_co2)
        priced.append({**leg, "label": leg.get("label") or mode_spec(leg["category"], leg["mode"])["label"], "kg_per_person": round(kg, 2)})
    return priced, round(sum(leg["kg_per_person"] for leg in priced), 2)


def catalog() -> list[dict[str, Any]]:
    return [
        {
            "category": category,
            "mode": mode,
            "label": spec["label"],
            "basis": spec["basis"],
            "factor": spec.get("factor"),
            "default_share": spec.get("default_share"),
        }
        for category, modes in MODES.items()
        for mode, spec in modes.items()
    ]


__all__ = ["CABIN_MULTIPLIER", "LegError", "MODES", "catalog", "price_legs", "traveler_flight_kg", "traveler_journey"]
