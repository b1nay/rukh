import os
import tempfile

_db = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
os.environ["RUKH_DATABASE_URL"] = f"sqlite:///{_db.name}"
os.environ["RUKH_SEED_DEMO_DATA"] = "false"
os.environ["RUKH_SOLANA_TREASURY"] = "4Nd1mBQtrMJVYVfKf2PJy9NZUZdTAsp7D4xWLs4gDB4T"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.db import Base, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.services import solana  # noqa: E402

TREASURY = os.environ["RUKH_SOLANA_TREASURY"]
FARMER_WALLET = solana.demo_address("test-farmer")
OTHER_WALLET = solana.demo_address("test-farmer-2")
PAYER = solana.demo_address("test-payer")


@pytest.fixture
def client():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with TestClient(app) as c:
        yield c


def otp_token(client, channel, destination, code="1234"):
    sent = client.post("/api/v1/auth/otp/send", json={"channel": channel, "destination": destination})
    assert sent.status_code == 200, sent.text
    res = client.post("/api/v1/auth/otp/verify", json={"channel": channel, "destination": destination, "code": code})
    assert res.status_code == 200, res.text
    return res.json()["otp_token"]


def signup(client, category, account, profile, plan=None):
    channel = "email" if account.get("email") else "phone"
    if category in ("farmer", "community_forest", "cooperative"):
        channel = "phone"
    token = otp_token(client, channel, account[channel])
    res = client.post(
        "/api/v1/signup",
        json={"category": category, "plan": plan, "account": account, "profile": profile, "otp_token": token},
    )
    assert res.status_code == 201, res.text
    return res.json()


def auth(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def operator(client):
    return signup(
        client,
        "tour_operator",
        {"full_name": "Maya Rai", "email": "maya@example.com", "password": "supersecret"},
        {"company_name": "Himalayan Trails", "country": "UK", "travelers_per_year": 800, "booking_system": "Our own website"},
        plan="operator",
    )


@pytest.fixture
def farmer(client):
    return signup(
        client,
        "farmer",
        {"full_name": "Sita Gurung", "phone": "9841000000", "password": "supersecret"},
        {"district": "Kaski", "land_area": 12, "land_unit": "Ropani", "solana_wallet": FARMER_WALLET},
    )


@pytest.fixture
def admin(client):
    res = client.post("/api/v1/auth/login", json={"identifier": "superadmin@rukh.com", "password": "rukh@123"})
    assert res.status_code == 200, res.text
    return res.json()


class FakeChain:
    """Stands in for Solana RPC: transactions "sent" here are what getTransaction returns."""

    def __init__(self):
        self.txs: dict[str, dict] = {}

    def send(self, transfers, memo, payer=PAYER, failed=False) -> str:
        sig = solana.b58encode(os.urandom(64))
        instructions = [
            {"program": "system", "parsed": {"type": "transfer", "info": {"source": payer, "destination": to, "lamports": amount}}}
            for to, amount in transfers
        ]
        if memo is not None:
            instructions.append({"program": "spl-memo", "parsed": memo})
        self.txs[sig] = {
            "slot": 1, "blockTime": 1_760_000_000,
            "meta": {"err": {"InstructionError": [0, "Custom"]} if failed else None},
            "transaction": {"message": {"accountKeys": [{"pubkey": payer, "signer": True}], "instructions": instructions}},
        }
        return sig

    def pay(self, intent: dict, **kw) -> str:
        """Send exactly what an API payment intent asks for."""
        return self.send([(t["to"], t["lamports"]) for t in intent["transfers"]], intent["memo"], **kw)

    def fetch(self, signature: str) -> dict:
        if signature not in self.txs:
            raise solana.PaymentError("This transaction isn't confirmed on Solana yet.")
        return self.txs[signature]


@pytest.fixture
def chain(monkeypatch):
    fake = FakeChain()
    monkeypatch.setattr(solana, "_fetch_transaction", fake.fetch)
    return fake
