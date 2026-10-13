import json

import pytest
from sqlalchemy import create_engine, text

from app.migrate import convert_usd_to_sol
from app.services import solana
from tests.conftest import PAYER, TREASURY, auth
from tests.test_dashboards import add_field, new_trip
from tests.test_payouts import _allocate_suggested
from tests.test_requests import request_trees


def _unpaid_invoice(client, operator, farmer, admin):
    add_field(client, farmer["token"])
    trip = new_trip(client, operator["token"])
    req = request_trees(client, operator["token"], trip["id"], impact="protect")
    _allocate_suggested(client, auth(admin["token"]), req["id"])
    h = auth(operator["token"])
    inv = client.get("/api/v1/climate/invoices", headers=h).json()["items"][0]
    intent = client.get(f"/api/v1/climate/invoices/{inv['id']}/solana", headers=h).json()
    return inv, intent, h


def test_invoice_payment_is_checked_on_chain(client, operator, farmer, admin, chain):
    inv, intent, h = _unpaid_invoice(client, operator, farmer, admin)
    amount = intent["transfers"][0]["lamports"]
    pay = lambda sig: client.post(f"/api/v1/climate/invoices/{inv['id']}/pay", json={"signature": sig}, headers=h)  # noqa: E731

    cases = {
        "underpaid": chain.send([(TREASURY, amount - 1)], intent["memo"]),
        "wrong recipient": chain.send([(PAYER, amount)], intent["memo"]),
        "wrong memo": chain.send([(TREASURY, amount)], "Rukh invoice RUKH-1999-0001"),
        "no memo": chain.send([(TREASURY, amount)], None),
        "failed": chain.send([(TREASURY, amount)], intent["memo"], failed=True),
        "unknown": solana.b58encode(b"\x07" * 64),
    }
    for name, sig in cases.items():
        res = pay(sig)
        assert res.status_code == 422, name
    assert pay("x" * 70).status_code == 422  # not base58
    assert client.get("/api/v1/climate/invoices?status=paid", headers=h).json()["items"] == []

    # overpaying is accepted
    res = pay(chain.send([(TREASURY, amount + 5)], intent["memo"]))
    assert res.status_code == 200 and res.json()["status"] == "paid"


def test_treasury_is_set_by_superadmin(client, operator, admin):
    assert client.get("/api/v1/solana/config").json() == {
        "cluster": "devnet", "rpc_url": "https://api.devnet.solana.com", "treasury": TREASURY,
    }
    h = auth(admin["token"])
    assert client.put("/api/v1/admin/solana/treasury", json={"address": "nope"}, headers=h).status_code == 422
    assert client.put("/api/v1/admin/solana/treasury", json={"address": PAYER}, headers=auth(operator["token"])).status_code == 403
    res = client.put("/api/v1/admin/solana/treasury", json={"address": PAYER}, headers=h)
    assert res.status_code == 200 and client.get("/api/v1/solana/config").json()["treasury"] == PAYER


def test_old_usd_database_is_converted(tmp_path):
    path = tmp_path / "old.db"
    engine = create_engine(f"sqlite:///{path}")
    with engine.begin() as c:
        c.execute(text("CREATE TABLE allocation_requests (id INTEGER PRIMARY KEY, price_per_tonne FLOAT, subtotal_usd FLOAT, fee_usd FLOAT, total_usd FLOAT)"))
        c.execute(text("INSERT INTO allocation_requests VALUES (1, 18, 180, 12.6, 192.6)"))
        c.execute(text("CREATE TABLE invoices (id INTEGER PRIMARY KEY, lines JSON, subtotal_usd FLOAT, fee_usd FLOAT, total_usd FLOAT)"))
        lines = [{"description": "Protect", "quantity": 10, "unit": "t CO₂", "unit_price": 18, "amount": 180}]
        c.execute(text("INSERT INTO invoices VALUES (1, :l, 180, 12.6, 192.6)"), {"l": json.dumps(lines)})

    assert sorted(convert_usd_to_sol(engine)) == sorted(
        f"{t}.{c}_usd" for t in ("allocation_requests", "invoices") for c in ("subtotal", "fee", "total")
    )
    assert convert_usd_to_sol(engine) == []  # runs once
    with engine.connect() as c:
        assert c.execute(text("SELECT price_per_tonne, subtotal_sol, total_sol FROM allocation_requests")).one() == (0.1, 1.0, 1.07)
        stored = json.loads(c.execute(text("SELECT lines FROM invoices")).scalar())
    assert stored[0]["unit_price"] == 0.1 and stored[0]["amount"] == 1.0 and stored[0]["quantity"] == 10
    assert len(list(tmp_path.glob("old.db.*.pre-sol.bak"))) == 1


@pytest.mark.parametrize("sol,lamports", [(0.1, 100_000_000), (1.926, 1_926_000_000), (0.000001, 1000)])
def test_lamports(sol, lamports):
    assert solana.lamports(sol) == lamports
