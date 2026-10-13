from app.db import SessionLocal
from app.demo import ADMIN_EMAIL, COMPANY_EMAIL, LANDOWNER_EMAIL, PASSWORD, build
from tests.conftest import auth


def login(client, identifier):
    res = client.post("/api/v1/auth/login", json={"identifier": identifier, "password": PASSWORD})
    assert res.status_code == 200, res.text
    return auth(res.json()["token"])


def test_demo_fills_every_role(client):
    with SessionLocal() as db:
        assert build(db)
        assert not build(db)  # only ever loaded once

    admin, company, land = (login(client, e) for e in (ADMIN_EMAIL, COMPANY_EMAIL, LANDOWNER_EMAIL))
    get = lambda h, path: client.get(f"/api/v1{path}", headers=h).json()  # noqa: E731

    fmap = get(admin, "/admin/map")
    assert fmap["totals"]["fields"] >= 20
    assert fmap["totals"]["trees_allocated"] and fmap["totals"]["trees_free"] and fmap["totals"]["barren_slots"]
    assert all(not f["approximate"] for f in fmap["fields"])
    requests = get(admin, "/admin/requests")
    assert {"pending", "allocated", "partial", "rejected"} <= {r["status"] for r in requests}
    invoices = get(admin, "/admin/invoices")["items"]
    assert {"paid", "unpaid", "overdue"} <= {i["status"] for i in invoices}
    payouts = get(admin, "/admin/payouts")["items"]
    assert {"paid", "pending"} <= {p["status"] for p in payouts}
    assert get(admin, "/notifications")["items"]

    trips = get(company, "/climate/trips")
    assert {"covered", "partial", "uncovered"} <= {t["status"] for t in trips}
    assert get(company, "/climate/invoices")["items"]

    # each role has its own map: the company's funded trees, the landowner's own fields
    cmap = get(company, "/climate/map")
    assert cmap["fields"] and all(f["trees_allocated"] > 0 for f in cmap["fields"])
    covered = next(t for t in trips if t["status"] == "covered")
    assert 0 < len(get(company, f"/climate/map?trip_id={covered['id']}")["fields"]) <= len(cmap["fields"])
    assert len(get(land, "/land/map")["fields"]) == 4
    assert client.get("/api/v1/climate/map", headers=land).status_code == 403

    fields = get(land, "/land/fields")
    assert len(fields) == 4 and get(land, "/land/earnings")
    assert get(land, "/land/summary")["earned_sol"] > 0

    # every pending demo request can be allocated from the map
    for r in (r for r in requests if r["status"] == "pending"):
        detail = get(admin, f"/admin/requests/{r['id']}")
        assert detail["trees_needed"] > 0 and detail["shortfall"] == 0
        picks = [{"field_id": f["id"], "amount": f["suggested"]} for f in detail["fields"] if f["suggested"]]
        res = client.post(f"/api/v1/admin/requests/{r['id']}/allocate", json={"picks": picks}, headers=admin)
        assert res.status_code == 200, res.text
