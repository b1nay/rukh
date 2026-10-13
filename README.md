# Rukh

Measures travel emissions and funds specific, satellite-verified trees in Nepal. Landowners are paid to keep the trees standing.

Built on **Solana**. Every price is in **SOL**. Climate Partners pay invoices from their own wallet, and Rukh pays
landowners straight to theirs. Each payment is a Solana transaction whose memo names the invoice or payout it
settles, so anyone can check it on Solana Explorer.

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

## Solana payments

Payments run on **devnet** by default (test SOL, no real money).

1. **Get a wallet.** Install [Phantom](https://phantom.com/download), [Solflare](https://solflare.com/download) or
   Backpack. Any Wallet Standard wallet is detected. Get test SOL from [faucet.solana.com](https://faucet.solana.com),
   or click **Get 1 devnet SOL** when a payment screen says the balance is too low.
2. **Set the treasury.** Log in as the superadmin, open **Pay**, connect your wallet and click **Use connected wallet**.
   Climate Partners pay invoices to this address, and the same wallet pays landowners. You can also set
   `RUKH_SOLANA_TREASURY` instead.
3. **Climate Partners** open **Billing → Pay now**, connect a wallet and approve one transfer to the treasury.
4. **The superadmin** opens **Pay**, selects landowners and approves one transaction with a transfer to each
   landowner's wallet (up to 8 per transaction; larger batches are split).
5. **Land Partners** give a Solana address at sign-up and can change it under **Payments**.

The wallet only signs. The app sends the transaction to the configured cluster itself, so a wallet left on mainnet
can't move real SOL by mistake. The API then fetches the transaction over RPC and marks the bill paid only if it
succeeded, sent at least the amount owed to each expected address, and carries the expected memo
(`Rukh invoice RUKH-2026-0001`, `Rukh payouts PAY-2026-0001 PAY-2026-0002`). No private key is kept on the server.

| Setting | Default | |
| --- | --- | --- |
| `RUKH_SOLANA_CLUSTER` | `devnet` | `devnet`, `testnet` or `mainnet-beta`. Explorer links follow it. |
| `RUKH_SOLANA_RPC_URL` | `https://api.devnet.solana.com` | Must be on the same cluster. The public endpoints rate-limit hard, so use a dedicated RPC for demos. |
| `RUKH_SOLANA_TREASURY` | none | Fallback when the superadmin hasn't set one in the app. |

**Prices** (`backend/app/catalog.py`, mirrored in `frontend/src/lib/content.ts`): Protect 0.1 SOL/t, Plant 0.19 SOL/t,
Operator plan 0.45 SOL/month. Landowners get 60% of the tonne price.

**Demo data:** demo landowners have generated wallet addresses that nobody holds keys for. Demo payments that are
already marked paid carry a `DEMO-…` reference instead of a transaction, so they have no Explorer link.

**Older databases:** on first start after the switch to SOL, money columns (`*_usd`) are renamed to `*_sol` and
existing amounts are converted at a fixed reference rate of $180/SOL (`backend/app/migrate.py`). A copy of the SQLite file
is saved first as `rukh.db.<time>.pre-sol.bak`. Landowners who signed up before wallets existed must add one under
**Payments** before they can be paid.

**How trees get allocated:**
1. A Climate Partner clicks **Request trees** on a trip. This creates a bill in SOL (tonnes × price + plan fee) and notifies the superadmin.
2. The superadmin opens the request and sees the trees and land it needs. **Choose trees on the map** opens the field map
   with the suggested fields selected (smallest fields first). Click fields to add or remove them, adjust tree counts, and confirm.
3. Trees are allocated and an invoice is issued (due in 14 days). The partner and each funded landowner are notified.
   A payment is raised for every landowner whose trees were used, and the superadmin lands on **Pay** to send them
   in SOL to each landowner's wallet.
4. Partners see and pay their bills under **Billing** with a Solana wallet.
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
- **Land Partner dashboard:** an overview, fields with capacity meters, adding a field with a live earnings estimate in SOL, and earnings by Climate Partner.
- **Field detail** (`/dashboard/fields/[id]`): a tree inventory in groups (species, count, age, height, trunk width, planting date). It shows the CO₂ stored now, a 5–30 year projection of absorption and earnings, and who the field is allocated to with each sale's payment status. On existing fields the groups set the sellable capacity. An edit can't drop capacity below what is already sold this year. On planting land, groups record the trees planted against the funded slots.
- **Payments** (`/dashboard/payments`): a Land Partner's payout wallet, and their payments received and on the way, with field breakdown and a Solana Explorer link for each transfer.
- **Models** (`backend/app/services/`):
  - Emissions use distance-based factors.
  - Tree absorption uses rates by species and tree age. Carbon already stored uses the Chave et al. (2014) equation (wood density, trunk diameter, height, IPCC root and carbon fractions) when the trunk is measured. Otherwise it adds up yearly uptake over the tree's age.
  - Allocation keeps a ledger with a 15% buffer, never sells capacity twice, and fills the smallest fields first.
- **Not built yet:** on-chain tree certificates (e.g. compressed NFTs per allocation), mainnet launch checks, satellite verification (new fields are verified automatically for now), and drawing field boundaries on a map.
