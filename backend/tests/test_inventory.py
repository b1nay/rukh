from datetime import date

import pytest

from app.services.sequestration import TreeStand, project, stored_kg_per_tree
from tests.conftest import auth
from tests.test_dashboards import add_field, new_trip
from tests.test_payouts import _allocate_suggested
from tests.test_requests import request_trees


def test_stored_carbon_measured_and_by_age():
    # Chave 2014: 0.0673 x (0.38 x 30^2 x 20)^0.976 = 372 kg biomass -> x1.24 roots x0.47 C x44/12
    kg, method = stored_kg_per_tree(TreeStand("utis", 1, 20, height_m=20, dbh_cm=30))
    assert method == "measured" and kg == pytest.approx(796, rel=0.01)
    # without a trunk measurement: yearly uptake added up over the tree's age
    kg, method = stored_kg_per_tree(TreeStand("utis", 1, 10))
    assert method == "age" and kg == pytest.approx(25 * (sum(max(0.15, (a + 1) / 9) for a in range(8)) + 2))


def test_projection_follows_age():
    rows = project([TreeStand("utis", 100, 5)], 2026, 5)
    assert [r.year for r in rows] == [2026, 2027, 2028, 2029, 2030]
    assert rows[0].gross_t == pytest.approx(100 * 25 * 6 / 9 / 1000, abs=0.001)  # young, still growing
    assert rows[3].gross_t == pytest.approx(2.5)  # age 8: full rate
    assert rows[-1].cumulative_t == pytest.approx(sum(r.gross_t for r in rows), abs=0.002)


def test_field_inventory_sets_capacity(client, farmer):
    h = auth(farmer["token"])
    field = add_field(client, farmer["token"], height_m=14, dbh_cm=22)  # 800 utis, age 12
    detail = client.get(f"/api/v1/land/fields/{field['id']}/detail?years=20", headers=h).json()
    assert detail["inventory_saved"] and len(detail["groups"]) == 1
    g = detail["groups"][0]
    assert g["method"] == "measured" and g["height_m"] == 14
    assert detail["carbon"]["annual_sellable_t"] == pytest.approx(17.0)
    assert detail["carbon"]["measured_share"] == 1
    assert detail["projection"]["years"] == 20 and len(detail["projection"]["rows"]) == 20
    assert detail["projection"]["earnings_usd"] > 0

    # mixed planting: add 200 sal, so capacity grows and utis stays the main species
    res = client.post(f"/api/v1/land/fields/{field['id']}/trees", json={"species": "sal", "count": 200, "age_years": 30}, headers=h)
    assert res.status_code == 201, res.text
    detail = res.json()
    assert detail["tree_count"] == 1000 and detail["species"] == "utis"
    assert detail["capacity_total"] == pytest.approx((800 * 25 + 200 * 18) * 0.85 / 1000)

    sal = next(g for g in detail["groups"] if g["species"] == "sal")
    res = client.put(f"/api/v1/land/fields/{field['id']}/trees/{sal['id']}", json={"species": "sal", "count": 50, "age_years": 30}, headers=h)
    assert res.json()["tree_count"] == 850

    res = client.delete(f"/api/v1/land/fields/{field['id']}/trees/{sal['id']}", headers=h)
    assert res.json()["tree_count"] == 800
    last = res.json()["groups"][0]["id"]
    assert client.delete(f"/api/v1/land/fields/{field['id']}/trees/{last}", headers=h).status_code == 409


def test_inventory_cannot_drop_below_sold_growth(client, operator, farmer, admin):
    field = add_field(client, farmer["token"], tree_count=60, area_ha=0.2)
    trip = new_trip(client, operator["token"])
    req = request_trees(client, operator["token"], trip["id"], impact="protect")
    _allocate_suggested(client, auth(admin["token"]), req["id"])

    h = auth(farmer["token"])
    detail = client.get(f"/api/v1/land/fields/{field['id']}/detail", headers=h).json()
    assert detail["capacity_available"] == 0
    a = detail["allocations"][0]
    assert a["partner"] == "Himalayan Trails" and a["payout_status"] == "pending" and a["payout_number"].startswith("PAY-")
    assert detail["sold_by_year"][0]["tonnes"] == pytest.approx(detail["capacity_allocated"], abs=0.01)

    group = detail["groups"][0]["id"]
    res = client.put(f"/api/v1/land/fields/{field['id']}/trees/{group}", json={"species": "utis", "count": 10, "age_years": 12}, headers=h)
    assert res.status_code == 409 and "already sold" in res.json()["detail"]
    # more trees is fine
    res = client.put(f"/api/v1/land/fields/{field['id']}/trees/{group}", json={"species": "utis", "count": 90, "age_years": 12}, headers=h)
    assert res.status_code == 200


def test_legacy_field_reads_enrollment_summary(client, farmer):
    from app.db import SessionLocal
    from app.models import Field, TreeGroup

    field = add_field(client, farmer["token"])
    with SessionLocal() as db:  # fields enrolled before tree groups existed
        for g in db.query(TreeGroup).filter_by(field_id=field["id"]):
            db.delete(g)
        db.commit()
        assert db.get(Field, field["id"]).tree_groups == []

    h = auth(farmer["token"])
    detail = client.get(f"/api/v1/land/fields/{field['id']}/detail", headers=h).json()
    assert not detail["inventory_saved"] and detail["groups"][0]["id"] is None
    assert detail["capacity_total"] == pytest.approx(17.0)
    # the first edit saves the summary as a real group alongside the new one
    res = client.post(f"/api/v1/land/fields/{field['id']}/trees", json={"species": "sal", "count": 100, "age_years": 20}, headers=h)
    assert res.json()["inventory_saved"] and len(res.json()["groups"]) == 2 and res.json()["tree_count"] == 900


def test_planting_land_records_planted_trees(client, farmer):
    h = auth(farmer["token"])
    field = add_field(client, farmer["token"], kind="planting", tree_count=None, area_ha=0.5)  # 200 slots
    detail = client.get(f"/api/v1/land/fields/{field['id']}/detail", headers=h).json()
    assert detail["groups"] == [] and detail["planted"] == 0 and detail["carbon"]["annual_sellable_t"] == 0

    body = {"species": "utis", "count": 150, "planted_on": f"{date.today().year - 2}-01-01", "height_m": 1.5}
    res = client.post(f"/api/v1/land/fields/{field['id']}/trees", json=body, headers=h)
    assert res.status_code == 201, res.text
    detail = res.json()
    assert detail["planted"] == 150 and detail["groups"][0]["age_years"] == 2
    assert detail["capacity_total"] == 200  # slots don't change

    too_many = client.post(f"/api/v1/land/fields/{field['id']}/trees", json={"species": "utis", "count": 51}, headers=h)
    assert too_many.status_code == 409
    future = client.post(f"/api/v1/land/fields/{field['id']}/trees", json={"species": "utis", "count": 1, "planted_on": "2999-01-01"}, headers=h)
    assert future.status_code == 422


def test_inventory_is_private(client, farmer):
    from tests.conftest import signup

    field = add_field(client, farmer["token"])
    other = signup(
        client, "farmer",
        {"full_name": "Ram Thapa", "phone": "9841000001", "password": "supersecret"},
        {"district": "Gorkha", "land_area": 8, "land_unit": "Ropani", "payout_method": "Khalti"},
    )
    assert client.get(f"/api/v1/land/fields/{field['id']}/detail", headers=auth(other["token"])).status_code == 404
    res = client.post(f"/api/v1/land/fields/{field['id']}/trees", json={"species": "sal", "count": 1}, headers=auth(other["token"]))
    assert res.status_code == 404


def test_landowner_sees_payments_received(client, operator, farmer, admin):
    add_field(client, farmer["token"], tree_count=60, area_ha=0.2)
    trip = new_trip(client, operator["token"])
    req = request_trees(client, operator["token"], trip["id"], impact="protect")
    _, res = _allocate_suggested(client, auth(admin["token"]), req["id"])

    h = auth(farmer["token"])
    pay = client.get("/api/v1/land/payouts", headers=h).json()
    assert pay["totals"]["pending_count"] == 1 and pay["totals"]["received_usd"] == 0
    assert pay["totals"]["method"] == "eSewa"
    item = pay["items"][0]
    assert item["client"] == "Himalayan Trails" and item["trees"] > 0 and item["status"] == "pending"

    paid = client.post("/api/v1/admin/payouts/pay", json={"ids": res["payout_ids"]}, headers=auth(admin["token"]))
    assert paid.status_code == 200, paid.text
    pay = client.get("/api/v1/land/payouts", headers=h).json()
    assert pay["totals"]["received_count"] == 1 and pay["totals"]["pending_usd"] == 0
    assert pay["totals"]["received_usd"] == pytest.approx(item["amount_usd"])
    assert pay["items"][0]["reference"].startswith("DEMO-") and pay["totals"]["last_paid_at"]


def test_editing_enrollment_summary_replaces_it(client, farmer):
    from app.db import SessionLocal
    from app.models import TreeGroup

    field = add_field(client, farmer["token"])
    with SessionLocal() as db:
        db.query(TreeGroup).filter_by(field_id=field["id"]).delete()
        db.commit()
    body = {"species": "utis", "count": 700, "age_years": 15, "height_m": 12, "dbh_cm": 20}
    res = client.post(f"/api/v1/land/fields/{field['id']}/trees?replace_summary=true", json=body, headers=auth(farmer["token"]))
    assert len(res.json()["groups"]) == 1 and res.json()["tree_count"] == 700
