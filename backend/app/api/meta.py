from fastapi import APIRouter, HTTPException

from app.data.airports import AIRPORTS, NEPAL_AIRPORTS, NEPAL_INTERNATIONAL
from app.services.emissions import UnknownAirport
from app.services.itinerary import catalog
from app.services.routes import journey, major_routes
from app.services.sequestration import SPECIES

router = APIRouter(tags=["reference"])


@router.get("/airports")
def airports() -> list[dict]:
    return [
        {"code": code, "name": name, "city": city}
        for code, (name, city, _, _) in sorted(AIRPORTS.items(), key=lambda kv: kv[1][1])
    ]


@router.get("/airports/nepal")
def nepal_airports() -> list[dict]:
    """Domestic network, Kathmandu first, then by city."""
    rows = [
        {"code": c, "name": AIRPORTS[c][0], "city": AIRPORTS[c][1], "international": c in NEPAL_INTERNATIONAL}
        for c in NEPAL_AIRPORTS
    ]
    return sorted(rows, key=lambda r: (r["code"] != "KTM", r["city"]))


@router.get("/species")
def species() -> list[dict]:
    return [{"id": k, "name": v["name"], "kg_per_year": v["kg_per_year"]} for k, v in SPECIES.items()]


@router.get("/leg-modes")
def leg_modes() -> list[dict]:
    return catalog()


@router.get("/routes")
def routes() -> list[dict]:
    """The 10 major source airports with their saved routing to Kathmandu."""
    return major_routes()


@router.get("/journey")
def journey_preview(origin: str, cabin: str = "economy", round_trip: bool = True) -> dict:
    try:
        return journey(origin, "KTM", cabin, round_trip).to_dict()
    except (UnknownAirport, KeyError) as e:  # KeyError: unknown cabin
        raise HTTPException(422, str(e)) from None
