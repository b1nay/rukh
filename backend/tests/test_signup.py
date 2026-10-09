from tests.conftest import auth, otp_token, signup


def test_tour_operator_signup_returns_session(client, operator):
    assert operator["user"]["side"] == "organization"
    assert operator["user"]["display_name"] == "Himalayan Trails"
    me = client.get("/api/v1/auth/me", headers=auth(operator["token"]))
    assert me.status_code == 200
    assert me.json()["email"] == "maya@example.com"


def test_farmer_requires_phone_and_is_pending(client):
    payload = {
        "category": "farmer",
        "account": {"full_name": "Sita Gurung", "password": "supersecret"},
        "profile": {"district": "Kaski", "land_area": 12, "land_unit": "Ropani", "payout_method": "eSewa"},
    }
    payload["otp_token"] = otp_token(client, "phone", "9841000000")
    assert client.post("/api/v1/signup", json=payload).status_code == 422
    payload["account"]["phone"] = "9841000000"
    res = client.post("/api/v1/signup", json=payload)
    assert res.status_code == 201
    assert res.json()["user"]["status"] == "pending_verification"


def test_profile_fields_are_category_specific(client):
    res = client.post("/api/v1/signup", json={
        "category": "event_organizer",
        "otp_token": otp_token(client, "email", "a@example.com"),
        "account": {"full_name": "A B", "email": "a@example.com", "password": "supersecret"},
        "profile": {"company_name": "X", "country": "UK", "travelers_per_year": 1, "booking_system": "Our own website"},
    })
    assert res.status_code == 422


def test_duplicate_email_conflicts(client):
    acct = {"full_name": "A B", "email": "a@example.com", "password": "supersecret"}
    assert signup(client, "individual", acct, {})["user"]["status"] == "waitlisted"
    res = client.post("/api/v1/signup", json={
        "category": "individual", "account": acct, "profile": {}, "otp_token": otp_token(client, "email", acct["email"]),
    })
    assert res.status_code == 409


def test_login_with_email_or_phone(client, operator, farmer):
    ok = client.post("/api/v1/auth/login", json={"identifier": "MAYA@example.com", "password": "supersecret"})
    assert ok.status_code == 200
    ok = client.post("/api/v1/auth/login", json={"identifier": "9841000000", "password": "supersecret"})
    assert ok.json()["user"]["side"] == "landowner"
    bad = client.post("/api/v1/auth/login", json={"identifier": "9841000000", "password": "wrongpass"})
    assert bad.status_code == 401


def test_roles_are_enforced(client, operator, farmer):
    assert client.get("/api/v1/land/summary", headers=auth(operator["token"])).status_code == 403
    assert client.get("/api/v1/climate/summary", headers=auth(farmer["token"])).status_code == 403
    assert client.get("/api/v1/climate/summary").status_code == 401


def test_otp_rejects_wrong_code_and_unverified_signup(client):
    client.post("/api/v1/auth/otp/send", json={"channel": "phone", "destination": "9841000000"})
    bad = client.post("/api/v1/auth/otp/verify", json={"channel": "phone", "destination": "9841000000", "code": "0000"})
    assert bad.status_code == 400

    payload = {
        "category": "farmer",
        "otp_token": "not-a-real-token",
        "account": {"full_name": "Sita Gurung", "phone": "9841000000", "password": "supersecret"},
        "profile": {"district": "Kaski", "land_area": 12, "land_unit": "Ropani", "payout_method": "eSewa"},
    }
    assert client.post("/api/v1/signup", json=payload).status_code == 400


def test_otp_token_is_bound_to_contact(client):
    token = otp_token(client, "phone", "9841000000")
    base = {
        "category": "farmer",
        "profile": {"district": "Kaski", "land_area": 12, "land_unit": "Ropani", "payout_method": "eSewa"},
    }
    other = {**base, "otp_token": token, "account": {"full_name": "X Y", "phone": "9841999999", "password": "supersecret"}}
    assert client.post("/api/v1/signup", json=other).status_code == 400  # verified a different number

    ok = {**base, "otp_token": token, "account": {"full_name": "Sita Gurung", "phone": "9841000000", "password": "supersecret"}}
    assert client.post("/api/v1/signup", json=ok).status_code == 201
