# Rukh

Measures travel emissions and funds specific, satellite-verified trees in Nepal. Landowners are paid to keep the trees standing.

## Run with Docker

```bash
docker compose up --build        # frontend http://localhost:3000, API http://localhost:8000
```

The image is built with a ready-made demo platform. On first start it is copied into the `rukh-data` volume.
Log in with any of these (password `rukh@123`):

| Role | Login | Who |
| --- | --- | --- |
| Superadmin | `superadmin@rukh.com` | Rukh Admin |
| Climate Partner | `company@rukh.com` | Everest Horizon Treks |
| Land Partner | `landowner@rukh.com` | Sita Gurung, Kaski |

The demo has 16 Land Partners with 23 GPS-mapped fields across Nepal and 4 Climate Partners with 14 trips.
It also has requests in every state (pending, allocated, partly allocated, declined), invoices (paid, open,
overdue), landowner payments (paid and waiting), message threads and notifications. Dates are relative to the
build day. The supporting accounts use the same password and log in by phone, `9800000002` to `9800000016`,
or by the emails in `backend/app/demo.py`.

- The volume keeps your data across rebuilds. The demo is only copied when the volume has no database yet.
- To swap an existing database for a fresh demo copy, run `RUKH_DEMO_RESET=true docker compose up --build`.
  The old database is kept next to it as `rukh.db.<time>.bak`. Turn it off again afterwards, or every restart resets.
- To build an empty platform instead, run `RUKH_DEMO_DATA=false docker compose up --build`. The superadmin is
  then created from `RUKH_ADMIN_EMAIL` and `RUKH_ADMIN_PASSWORD` (default `superadmin@rukh.com` / `rukh@123`).
- `docker compose down -v` deletes the volume, which wipes every account.

## Run locally

Backend (FastAPI, port 8000):

```bash
cd backend
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn app.main:app --reload --port 8000
.venv/bin/python -m pytest      # tests
```

Frontend (Next.js):

```bash
cd frontend
npm install
npm run dev                      # http://localhost:3000
```

If the frontend runs on a port other than 3000, allow it in the backend:
`RUKH_CORS_ORIGINS='["http://localhost:3100"]'`. Point the frontend at another API with `NEXT_PUBLIC_API_URL`.

## Demo data

Locally, the database starts empty. To load the same demo as Docker, start the backend with
`RUKH_SEED_DEMO_DATA=true` on a database without partner accounts. You can also build a separate demo database:
`RUKH_DATABASE_URL=sqlite:///./demo.db .venv/bin/python -m app.demo`.

## Superadmin

A superadmin is created on start if that email doesn't exist yet: `superadmin@rukh.com` / `rukh@123`. Set
`RUKH_ADMIN_EMAIL` and `RUKH_ADMIN_PASSWORD` to change it. Use real values anywhere outside local dev.

**How trees get allocated:**
1. A Climate Partner clicks **Request trees** on a trip. This creates a bill (tonnes × price + plan fee) and notifies the superadmin.
2. The superadmin opens the request and sees the trees and land it needs. **Choose trees on the map** opens the field map
   with the suggested fields selected (smallest fields first). Click fields to add or remove them, adjust tree counts, and confirm.
3. Trees are allocated and an invoice is issued (due in 14 days). The partner and each funded landowner are notified.
   A payment is raised for every landowner whose trees were used, and the superadmin lands on **Pay** to send them
   (demo: no money moves, each landowner is paid by the method chosen at sign-up).
4. Partners see and pay their bills under **Billing**. Payment is a demo: no money moves.
5. Each request has a message thread. Every new message notifies the other side.

Every role has a map. The superadmin's **Field map** shows every enrolled field, Land Partners see their own land
under **My fields**, and Climate Partners see where their trees grow on the overview and on each trip. On the
superadmin map, fields show as dots: green for free trees, red for allocated trees,
yellow for bare planting land. Zoom in to see each field's dots spread over its area. Fields without GPS are
placed at their district headquarters.

`backend/app/migrate.py` adds new columns to existing SQLite databases at startup until Alembic is set up.

## Status

- **Homepage and sign-up:** sign-up has five steps: role, type, account, verify, then details.
- **OTP (dummy):** Land Partners verify their mobile number and Climate Partners their email. Nothing is actually sent, and the code is always `1234` (`RUKH_OTP_DUMMY_CODE`). To go live, plug an SMS or email provider into `_deliver` in `backend/app/services/otp.py`.
- **Climate Partner dashboard:** an overview with a monthly coverage chart, trips you can add by hand or by pasting a spreadsheet, CO₂ for each traveler, and allocation of trees with Protect or Plant.
- **Land Partner dashboard:** an overview, fields with capacity meters, adding a field with a live earnings estimate, and earnings by Climate Partner.
- **Field detail** (`/dashboard/fields/[id]`): a tree inventory in groups (species, count, age, height, trunk width, planting date). It shows the CO₂ stored now, a 5–30 year projection of absorption and earnings, and who the field is allocated to with each sale's payment status. On existing fields the groups set the sellable capacity. An edit can't drop capacity below what is already sold this year. On planting land, groups record the trees planted against the funded slots.
- **Payments** (`/dashboard/payments`): a Land Partner's payments received and on the way, with field breakdown and transfer reference.
- **Models** (`backend/app/services/`):
  - Emissions use distance-based factors.
  - Tree absorption uses rates by species and tree age. Carbon already stored uses the Chave et al. (2014) equation (wood density, trunk diameter, height, IPCC root and carbon fractions) when the trunk is measured. Otherwise it adds up yearly uptake over the tree's age.
  - Allocation keeps a ledger with a 15% buffer, never sells capacity twice, and fills the smallest fields first.
- **Not built yet:** real payment providers, satellite verification (new fields are verified automatically for now), and drawing field boundaries on a map.
