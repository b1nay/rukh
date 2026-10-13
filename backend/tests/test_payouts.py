import pytest

from tests.conftest import FARMER_WALLET, OTHER_WALLET, auth, signup
from tests.test_dashboards import add_field, new_trip
from tests.test_requests import request_trees, unread


def _allocate_suggested(client, h, req_id):
    detail = client.get(f"/api/v1/admin/requests/{req_id}", headers=h).json()
    picks = [{"field_id": f["id"], "amount": f["suggested"]} for f in detail["fields"] if f["suggested"]]
    res = client.post(f"/api/v1/admin/requests/{req_id}/allocate", json={"picks": picks}, headers=h)
    assert res.status_code == 200, res.text
    return detail, res.json()


def test_request_reports_trees_and_area_needed(client, operator, farmer, admin):
    add_field(client, farmer["token"], kind="planting", tree_count=None, area_ha=1)  # 400 slots
    trip = new_trip(client, operator["token"])
    req = request_trees(client, operator["token"], trip["id"], impact="plant")
    detail = client.get(f"/api/v1/admin/requests/{req['id']}", headers=auth(admin["token"])).json()
    trees = -(-req["tonnes"] // 0.5)  # 0.5 t per new tree, rounded up
    assert detail["trees_needed"] == trees
    assert detail["area_needed_ha"] == pytest.approx(trees / 400, abs=0.01)
    f = detail["fields"][0]
    assert f["t_per_tree"] == 0.5 and f["available_trees"] == 400 and f["suggested_trees"] == trees


def test_allocation_raises_one_payout_per_landowner(client, operator, farmer, admin, chain):
    other = signup(
        client, "farmer",
        {"full_name": "Ram Thapa", "phone": "9841000001", "password": "supersecret"},
        {"district": "Gorkha", "land_area": 8, "land_unit": "Ropani", "solana_wallet": OTHER_WALLET},
    )
    # two small fields, so smallest-first spreads the request across both owners
    add_field(client, farmer["token"], tree_count=60, area_ha=0.2)
    add_field(client, other["token"], tree_count=2000, area_ha=4, district="Gorkha")
    trip = new_trip(client, operator["token"])
    req = request_trees(client, operator["token"], trip["id"], impact="protect")
    h = auth(admin["token"])

    detail, res = _allocate_suggested(client, h, req["id"])
    assert len([f for f in detail["fields"] if f["suggested"]]) == 2
    assert res["invoice_number"].startswith("RUKH-") and len(res["payout_ids"]) == 2

    queue = client.get(f"/api/v1/admin/payouts?request={req['id']}", headers=h).json()
    assert {p["landowner"] for p in queue["items"]} == {"Sita Gurung", "Ram Thapa"}
    assert all(p["status"] == "pending" and p["invoice_status"] == "unpaid" for p in queue["items"])
    # landowners get their 60% share of the subtotal
    assert sum(p["amount_sol"] for p in queue["items"]) == pytest.approx(res["invoice_total_sol"] / 1.07 * 0.6, abs=1e-4)
    assert {p["method"] for p in queue["items"]} == {"Solana"}
    assert {p["wallet"] for p in queue["items"]} == {FARMER_WALLET, OTHER_WALLET}
    assert queue["totals"]["pending_count"] == 2
    assert "payout.new" in [n["kind"] for n in unread(client, admin["token"])["items"]]

    # the map now shows those trees as allocated
    fmap = client.get("/api/v1/admin/map", headers=h).json()
    assert fmap["totals"]["fields"] == 2 and fmap["totals"]["trees_allocated"] > 0
    small = next(f for f in fmap["fields"] if f["trees_total"] == 60)
    assert small["trees_allocated"] == 60 and small["trees_free"] == 0
    assert small["approximate"] and small["latitude"] == pytest.approx(28.21, abs=0.1)

    ids = [p["id"] for p in queue["items"]]
    intent = client.post("/api/v1/admin/payouts/solana", json={"ids": ids}, headers=h).json()
    by_wallet = {p["wallet"]: round(p["amount_sol"] * 1e9) for p in queue["items"]}
    assert {t["to"]: t["lamports"] for t in intent["transfers"]} == by_wallet
    assert intent["memo"] == "Rukh payouts " + " ".join(sorted(p["number"] for p in queue["items"]))

    # paying only one of the two landowners doesn't settle the batch
    short = chain.send([(FARMER_WALLET, by_wallet[FARMER_WALLET])], intent["memo"])
    res = client.post("/api/v1/admin/payouts/pay", json={"ids": ids, "signature": short}, headers=h)
    assert res.status_code == 422 and "Expected" in res.json()["detail"]

    sig = chain.pay(intent)
    paid = client.post("/api/v1/admin/payouts/pay", json={"ids": ids, "signature": sig}, headers=h)
    assert paid.status_code == 200, paid.text
    assert all(p["status"] == "paid" and p["reference"] == sig for p in paid.json())
    assert client.post("/api/v1/admin/payouts/pay", json={"ids": ids[:1], "signature": sig}, headers=h).status_code == 409

    assert unread(client, farmer["token"])["items"][0]["kind"] == "payout.paid"
    earnings = client.get("/api/v1/land/earnings", headers=auth(farmer["token"])).json()
    assert earnings[0]["payout_status"] == "paid"


def test_planting_land_shows_as_barren_until_allocated(client, operator, farmer, admin):
    add_field(client, farmer["token"], kind="planting", tree_count=None, area_ha=1)
    h = auth(admin["token"])
    before = client.get("/api/v1/admin/map", headers=h).json()
    assert before["totals"]["barren_slots"] == 400 and before["totals"]["trees_allocated"] == 0

    trip = new_trip(client, operator["token"])
    req = request_trees(client, operator["token"], trip["id"], impact="plant")
    detail, _ = _allocate_suggested(client, h, req["id"])
    after = client.get("/api/v1/admin/map", headers=h).json()["fields"][0]
    assert after["trees_allocated"] == detail["trees_needed"]
    assert after["trees_free"] == 400 - detail["trees_needed"]


def test_payouts_are_admin_only(client, farmer):
    assert client.get("/api/v1/admin/payouts", headers=auth(farmer["token"])).status_code == 403
    assert client.get("/api/v1/admin/map", headers=auth(farmer["token"])).status_code == 403


def test_payout_needs_landowner_wallet(client, operator, farmer, admin, chain):
    from app.db import SessionLocal
    from app.models import User

    add_field(client, farmer["token"], tree_count=60, area_ha=0.2)
    trip = new_trip(client, operator["token"])
    req = request_trees(client, operator["token"], trip["id"], impact="protect")
    h = auth(admin["token"])
    _, res = _allocate_suggested(client, h, req["id"])
    with SessionLocal() as db:  # an account from before wallets were required
        u = db.get(User, farmer["user"]["id"])
        u.profile = {k: v for k, v in u.profile.items() if k != "solana_wallet"}
        db.commit()

    res2 = client.post("/api/v1/admin/payouts/solana", json={"ids": res["payout_ids"]}, headers=h)
    assert res2.status_code == 409 and "Solana wallet" in res2.json()["detail"]

    fh = auth(farmer["token"])
    assert client.put("/api/v1/land/wallet", json={"address": "not-a-wallet"}, headers=fh).status_code == 422
    assert client.put("/api/v1/land/wallet", json={"address": FARMER_WALLET}, headers=fh).json() == {"wallet": FARMER_WALLET}
    intent = client.post("/api/v1/admin/payouts/solana", json={"ids": res["payout_ids"]}, headers=h).json()
    assert intent["transfers"][0]["to"] == FARMER_WALLET
