import pytest

from tests.conftest import auth
from tests.test_dashboards import add_field, new_trip


def request_trees(client, token, trip_id, impact="plant", note=None):
    res = client.post(f"/api/v1/climate/trips/{trip_id}/requests", json={"impact_type": impact, "note": note}, headers=auth(token))
    assert res.status_code == 201, res.text
    return res.json()


def unread(client, token):
    return client.get("/api/v1/notifications", headers=auth(token)).json()


def test_request_bill_goes_to_admin(client, operator, admin):
    trip = new_trip(client, operator["token"])
    req = request_trees(client, operator["token"], trip["id"], note="Spring group")
    assert req["status"] == "pending"
    assert req["tonnes"] == pytest.approx(trip["co2_t"], abs=0.001)
    assert req["subtotal_usd"] == pytest.approx(req["tonnes"] * 34, abs=0.01)
    assert req["fee_rate"] == 0.07  # Operator plan
    assert req["total_usd"] == pytest.approx(req["subtotal_usd"] + req["fee_usd"], abs=0.01)

    n = unread(client, admin["token"])
    assert n["unread"] == 1 and n["items"][0]["kind"] == "request.new"
    # one open request per trip
    dup = client.post(f"/api/v1/climate/trips/{trip['id']}/requests", json={"impact_type": "protect"}, headers=auth(operator["token"]))
    assert dup.status_code == 409


def test_admin_allocates_and_partner_is_billed(client, operator, farmer, admin):
    add_field(client, farmer["token"], kind="planting", tree_count=None, area_ha=1)
    trip = new_trip(client, operator["token"])
    req = request_trees(client, operator["token"], trip["id"])
    h = auth(admin["token"])

    detail = client.get(f"/api/v1/admin/requests/{req['id']}", headers=h).json()
    assert detail["trip"]["id"] == trip["id"] and detail["fields"]
    picks = [{"field_id": f["id"], "amount": f["suggested"]} for f in detail["fields"] if f["suggested"]]
    res = client.post(f"/api/v1/admin/requests/{req['id']}/allocate", json={"picks": picks, "admin_note": "Kaski grove"}, headers=h)
    assert res.status_code == 200, res.text
    assert res.json()["status"] == "allocated"

    t = client.get(f"/api/v1/climate/trips/{trip['id']}", headers=auth(operator["token"])).json()
    assert t["status"] == "covered" and t["requests"][0]["status"] == "allocated"

    kinds = [i["kind"] for i in unread(client, operator["token"])["items"]]
    assert "request.allocated" in kinds
    assert unread(client, farmer["token"])["items"][0]["kind"] == "field.funded"

    bills = client.get("/api/v1/climate/invoices", headers=auth(operator["token"])).json()
    inv = bills["items"][0]
    assert inv["status"] == "unpaid" and inv["number"].startswith("RUKH-")
    assert inv["total_usd"] == pytest.approx(req["total_usd"], abs=0.02)
    assert bills["totals"]["outstanding_usd"] == pytest.approx(inv["total_usd"])

    assert client.get("/api/v1/climate/invoices?status=paid", headers=auth(operator["token"])).json()["items"] == []
    paid = client.post(f"/api/v1/climate/invoices/{inv['id']}/pay", json={"method": "khalti"}, headers=auth(operator["token"]))
    assert paid.json()["status"] == "paid" and paid.json()["payment_method"] == "Khalti"
    again = client.get("/api/v1/climate/invoices?status=paid", headers=auth(operator["token"])).json()
    assert len(again["items"]) == 1 and again["totals"]["outstanding_usd"] == 0


def test_admin_cannot_overallocate_a_field(client, operator, farmer, admin):
    field = add_field(client, farmer["token"], tree_count=40)  # 0.85 t/yr
    trip = new_trip(client, operator["token"])
    req = request_trees(client, operator["token"], trip["id"], impact="protect")
    h = auth(admin["token"])
    too_much = client.post(f"/api/v1/admin/requests/{req['id']}/allocate", json={"picks": [{"field_id": field["id"], "amount": 5}]}, headers=h)
    assert too_much.status_code == 409
    ok = client.post(f"/api/v1/admin/requests/{req['id']}/allocate", json={"picks": [{"field_id": field["id"], "amount": 0.85}]}, headers=h)
    assert ok.json()["status"] == "partial"
    # the trip can be requested again for the remainder
    request_trees(client, operator["token"], trip["id"], impact="protect")


def test_correspondence_notifies_the_other_side(client, operator, admin):
    trip = new_trip(client, operator["token"])
    req = request_trees(client, operator["token"], trip["id"])
    client.post("/api/v1/notifications/read", json={}, headers=auth(admin["token"]))

    sent = client.post(f"/api/v1/requests/{req['id']}/messages", json={"body": "Can you use Kaski fields?"}, headers=auth(operator["token"]))
    assert sent.status_code == 201 and sent.json()["mine"] is True
    assert unread(client, admin["token"])["unread"] == 1

    client.post(f"/api/v1/requests/{req['id']}/messages", json={"body": "Yes, allocating today."}, headers=auth(admin["token"]))
    thread = client.get(f"/api/v1/requests/{req['id']}/messages", headers=auth(operator["token"])).json()
    assert [m["from_admin"] for m in thread] == [False, True]
    assert thread[1]["sender"] == "Rukh"
    assert unread(client, operator["token"])["items"][0]["kind"] == "message"


def test_request_and_admin_access_rules(client, operator, farmer, admin):
    trip = new_trip(client, operator["token"])
    req = request_trees(client, operator["token"], trip["id"])
    assert client.get("/api/v1/admin/requests", headers=auth(operator["token"])).status_code == 403
    assert client.get(f"/api/v1/requests/{req['id']}/messages", headers=auth(farmer["token"])).status_code == 404
    cancel = client.post(f"/api/v1/climate/requests/{req['id']}/cancel", headers=auth(operator["token"]))
    assert cancel.json()["status"] == "cancelled"
    reject = client.post(f"/api/v1/admin/requests/{req['id']}/reject", json={"admin_note": "n/a"}, headers=auth(admin["token"]))
    assert reject.status_code == 409
