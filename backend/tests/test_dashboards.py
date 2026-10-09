import pytest

from app.services.emissions import passenger_co2_kg
from app.services.routes import journey
from tests.conftest import auth

ITINERARY = {
    "name": "Poon Hill short trek",
    "kind": "trek",
    "days": 5,
    "legs": [
        {"category": "flight", "mode": "international", "destination": "KTM"},
        {"category": "road", "mode": "taxi", "distance_km": 10, "share": 2},
        {"category": "flight", "mode": "domestic", "origin": "KTM", "destination": "PKR"},
        {"category": "stay", "mode": "teahouse", "nights": 4, "share": 2},
        {"category": "trail", "mode": "trek", "distance_km": 40},
        {"category": "activity", "mode": "paragliding"},
    ],
}


def travelers(n, origin="LHR"):
    return [{"name": f"T{i}", "email": f"t{i}@example.com", "home_airport": origin} for i in range(n)]


def new_trip(client, token, **kw):
    body = {"start_date": "2026-04-06", "pax": 2, "itinerary": ITINERARY, "travelers": travelers(2), **kw}
    res = client.post("/api/v1/climate/trips", json=body, headers=auth(token))
    assert res.status_code == 201, res.text
    return res.json()


def test_emission_factors():
    distance, kg = passenger_co2_kg("LHR", "KTM")
    assert distance == pytest.approx(2 * 7359, rel=0.01)
    assert kg == pytest.approx(1351, rel=0.02)
    _, business = passenger_co2_kg("LHR", "KTM", cabin="business")
    assert business == pytest.approx(kg * 2.9)


def test_leg_preview(client, operator):
    res = client.post("/api/v1/climate/legs/preview", json={"legs": ITINERARY["legs"]}, headers=auth(operator["token"]))
    assert res.status_code == 200, res.text
    legs = {l["mode"]: l["kg_per_person"] for l in res.json()["legs"]}
    assert legs["international"] == 0  # per traveler, not shared
    assert legs["taxi"] == pytest.approx(10 * 0.17 / 2)
    assert legs["teahouse"] == pytest.approx(4 * 12 / 2)
    assert legs["trek"] == 0
    assert res.json()["has_international"] is True

    bad = client.post("/api/v1/climate/legs/preview", json={"legs": [{"category": "road", "mode": "rocket"}]}, headers=auth(operator["token"]))
    assert bad.status_code == 422


def test_trip_totals_flights_plus_shared_legs(client, operator):
    trip = new_trip(client, operator["token"])
    flight = journey("LHR").kg
    shared = trip["shared_kg_per_person"]
    assert trip["travelers"] == 2
    assert trip["co2_t"] == pytest.approx(2 * (flight + shared) / 1000, abs=0.002)
    cats = {c["category"]: c["kg"] for c in trip["by_category"]}
    assert cats["stay"] == pytest.approx(2 * 24, abs=0.1)
    t0 = trip["traveler_list"][0]
    assert t0["flight_kg"] == pytest.approx(flight, abs=0.1)
    assert [s["destination"] for s in t0["journey"]["segments"]] == ["DOH", "KTM"]


def test_saved_routes_segments_layovers_and_time():
    lhr = journey("LHR")
    assert not lhr.estimated and lhr.layovers == {"DOH": 2.5}
    assert lhr.km_one_way == 5241 + 3360
    # flying (km / 850 + 0.5 h per flight) + layover
    assert lhr.hours_one_way == pytest.approx(5241 / 850 + 0.5 + 3360 / 850 + 0.5 + 2.5, abs=0.02)
    # a connection costs more than flying direct
    assert lhr.kg > passenger_co2_kg("LHR", "KTM")[1]

    fra = journey("FRA")  # FRA-IST is under 1,500 km, so it uses the short-haul factor
    assert fra.segments[0].kg / fra.segments[0].km > fra.segments[1].kg / fra.segments[1].km

    delhi = journey("DEL", round_trip=False)
    assert len(delhi.segments) == 1 and delhi.layovers == {}

    other = journey("MUC")  # no saved route: direct estimate
    assert other.estimated and len(other.segments) == 1


def test_routes_endpoint(client):
    routes = client.get("/api/v1/routes").json()
    assert len(routes) == 10 and routes[0]["code"] == "LHR" and routes[0]["via"] == ["DOH"]
    assert client.get("/api/v1/journey?origin=ZZZ").status_code == 422


def test_trip_requires_details_for_every_traveler(client, operator):
    body = {"start_date": "2026-04-06", "pax": 3, "itinerary": ITINERARY, "travelers": travelers(2)}
    assert client.post("/api/v1/climate/trips", json=body, headers=auth(operator["token"])).status_code == 422
    body = {**body, "travelers": [{"name": "X", "home_airport": "ZZZ"}] * 3}
    assert client.post("/api/v1/climate/trips", json=body, headers=auth(operator["token"])).status_code == 422


def test_most_used_itineraries_come_first(client, operator):
    h = auth(operator["token"])
    first = new_trip(client, operator["token"])
    itinerary_id = first["itinerary_id"]
    for _ in range(2):  # new departures reuse the saved itinerary
        new_trip(client, operator["token"], itinerary=None, itinerary_id=itinerary_id, pax=1, travelers=travelers(1, "FRA"))

    ranked = client.get("/api/v1/climate/itineraries", headers=h).json()
    assert ranked[0]["id"] == itinerary_id and ranked[0]["times_used"] == 3
    assert any(i["is_template"] for i in ranked)  # starter itineraries are listed too
    summary = client.get("/api/v1/climate/summary", headers=h).json()
    assert summary["top_itineraries"][0]["id"] == itinerary_id

    template = next(i for i in ranked if i["is_template"])
    assert client.delete(f"/api/v1/climate/itineraries/{template['id']}", headers=h).status_code == 403


def add_field(client, token, **kw):
    body = {"name": "Grove", "kind": "existing", "district": "Kaski", "area_ha": 2, "species": "utis",
            "tree_count": 800, "tree_age_years": 12, **kw}
    res = client.post("/api/v1/land/fields", json=body, headers=auth(token))
    assert res.status_code == 201, res.text
    return res.json()


def test_field_capacity_and_activation(client, farmer):
    field = add_field(client, farmer["token"])
    # 800 trees x 25 kg x (1 - 15% buffer) = 17 t / yr
    assert field["capacity_unit"] == "t"
    assert field["capacity_total"] == pytest.approx(17.0)
    me = client.get("/api/v1/auth/me", headers=auth(farmer["token"])).json()
    assert me["status"] == "active"

    planting = add_field(client, farmer["token"], kind="planting", tree_count=None, area_ha=1.5)
    assert planting["capacity_unit"] == "trees" and planting["capacity_total"] == 600


def test_partners_cannot_allocate_directly(client, operator):
    trip = new_trip(client, operator["token"])
    res = client.post(f"/api/v1/climate/trips/{trip['id']}/allocate", json={"impact_type": "plant"}, headers=auth(operator["token"]))
    assert res.status_code in (404, 405)


def test_group_international_flight_from_major_airport(client, operator):
    legs = [{"category": "flight", "mode": "international", "origin": "JFK", "destination": "KTM"}, *ITINERARY["legs"][1:]]
    h = auth(operator["token"])
    preview = client.post("/api/v1/climate/legs/preview", json={"legs": legs}, headers=h).json()
    assert preview["legs"][0]["kg_per_person"] == pytest.approx(journey("JFK").kg)
    assert preview["has_international"] is False  # home airports no longer matter

    trip = new_trip(client, operator["token"], itinerary={**ITINERARY, "legs": legs})
    t0 = trip["traveler_list"][0]
    assert t0["flight_kg"] == 0 and t0["journey"] is None  # flight is in the shared legs
    assert trip["co2_t"] == pytest.approx(2 * trip["shared_kg_per_person"] / 1000, abs=0.002)

    bad = [{"category": "flight", "mode": "international", "origin": "MUC", "destination": "KTM"}]
    assert client.post("/api/v1/climate/legs/preview", json={"legs": bad}, headers=h).status_code == 422


def test_domestic_flights_use_nepal_airports(client, operator):
    h = auth(operator["token"])
    ok = [{"category": "flight", "mode": "domestic", "origin": "KTM", "destination": "IMK"}]
    assert client.post("/api/v1/climate/legs/preview", json={"legs": ok}, headers=h).status_code == 200
    for o, d in (("KTM", "DEL"), ("LUA", "LUA")):
        bad = [{"category": "flight", "mode": "domestic", "origin": o, "destination": d}]
        assert client.post("/api/v1/climate/legs/preview", json={"legs": bad}, headers=h).status_code == 422
    nepal = client.get("/api/v1/airports/nepal").json()
    assert nepal[0]["code"] == "KTM" and len(nepal) == 36
