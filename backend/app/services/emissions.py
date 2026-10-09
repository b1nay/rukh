"""Flight emissions per passenger.

Distance-based method: great-circle distance with a routing uplift, times a
per-passenger-km factor by haul and cabin. Factors are in line with
UK DESNZ/DEFRA business-travel factors (CO2 only); the optional non-CO2
multiplier covers contrails and NOx. Replace with aircraft-type fuel burn
(EEA / ICAO) once airlines share flight-level data.
"""

from math import asin, cos, radians, sin, sqrt

from app.data.airports import AIRPORTS

ROUTING_UPLIFT = 1.08
SHORT_HAUL_KM = 1500
KG_PER_PKM = {"short": 0.13, "long": 0.085}
CABIN_MULTIPLIER = {"economy": 1.0, "premium_economy": 1.6, "business": 2.9, "first": 4.0}
NON_CO2_MULTIPLIER = 1.7


class UnknownAirport(ValueError):
    pass


def great_circle_km(origin: str, destination: str) -> float:
    try:
        _, _, lat1, lon1 = AIRPORTS[origin]
        _, _, lat2, lon2 = AIRPORTS[destination]
    except KeyError as e:
        raise UnknownAirport(f"Unknown airport code {e.args[0]}") from None
    p1, p2 = radians(lat1), radians(lat2)
    dp, dl = p2 - p1, radians(lon2 - lon1)
    a = sin(dp / 2) ** 2 + cos(p1) * cos(p2) * sin(dl / 2) ** 2
    return 2 * 6371.0 * asin(sqrt(a))


def passenger_co2_kg(
    origin: str,
    destination: str,
    cabin: str = "economy",
    round_trip: bool = True,
    include_non_co2: bool = False,
) -> tuple[float, float]:
    """Return (distance_km travelled, kg CO2) for one passenger."""
    one_way = great_circle_km(origin, destination)
    factor = KG_PER_PKM["short" if one_way < SHORT_HAUL_KM else "long"]
    distance = one_way * (2 if round_trip else 1)
    kg = distance * ROUTING_UPLIFT * factor * CABIN_MULTIPLIER[cabin]
    if include_non_co2:
        kg *= NON_CO2_MULTIPLIER
    return distance, kg
