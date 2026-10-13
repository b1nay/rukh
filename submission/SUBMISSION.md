# Rukh: submission answers

Fill in the items marked **TODO** before submitting.

## Basics

**Project name:** Rukh

**Project description (short):**
Rukh turns travel emissions into specific, mapped trees in Nepal. Tour operators, event organisers and universities measure each traveler's flight CO₂ and pay in SOL. Nepali farmers and community forests are paid in SOL straight to their own wallet to keep those trees standing. Every payment is a Solana transaction anyone can check.

**Link to your submission:** TODO (deployed app URL, if any)

**GitHub link:** https://github.com/kachhuwagroup/climate. TODO: the repo is currently private (it returns 404 to visitors). Make it public or give the judges access.

**Pitch deck or Loom/video:** TODO

## Project details

**What are you building, and who is it for?**
Rukh is a two-sided marketplace for carbon removal from trees, with Solana as the payment layer.

- **Climate Partners** are tour operators, conference organisers, NGOs and universities that fly people to Nepal. They upload travelers and itineraries. Rukh calculates each traveler's flight CO₂, then funds that exact tonnage either by protecting existing trees (Protect, 0.1 SOL/t) or planting new native trees (Plant, 0.19 SOL/t). They pay the invoice from their Solana wallet.
- **Land Partners** are Nepali farmers, community forests and tea and cardamom cooperatives. They map their fields and record their trees by species, age and size. Rukh's models calculate how much CO₂ those trees absorb each year. Landowners receive 60% of every tonne sold, paid in SOL to their own wallet.
- **Rukh's superadmin** matches requests to fields on a map, never selling the same tree twice and holding 15% back as a buffer. They pay all the funded landowners in one batched Solana transaction.

**Why did you decide to build this, and why build it now?**
Most "carbon neutral" offset deals are opaque. A buyer gets a certificate number, not a tree, and can't see who was paid or how much. We wanted something a traveler can actually check: these trees, in this district, cared for by this landowner, who received this payment.

Solana makes that possible now. Landowners in rural Nepal can't be paid cheaply or quickly across borders by card or bank. A Solana transfer settles in seconds for a fraction of a cent and needs only a phone wallet. Putting every payment on chain, each tagged with the invoice or payout number it settles, turns "trust us" into a public record.

**What technologies are you using or integrating with to build your product?**

- **Solana:** `@solana/web3.js`, Solana Wallet Adapter with Wallet Standard (Phantom, Solflare, Backpack), the System Program for SOL transfers, the Memo program to tag each payment, JSON-RPC (`getTransaction`) for server-side verification, and Solana Explorer links.
- **Backend:** Python, FastAPI, SQLAlchemy, Pydantic, SQLite (PostgreSQL/PostGIS planned).
- **Frontend:** Next.js 16, React 19, TypeScript, Tailwind CSS, Leaflet with OpenStreetMap for field maps.
- **Models:**
  - Distance-based flight emission factors with cabin multipliers and optional non-CO₂ effects.
  - Chave et al. (2014) allometric equation with IPCC root and carbon fractions for carbon stored in trees.
  - Species and age growth curves for yearly absorption.
- **Ops:** Docker Compose, plus a built-in demo platform: 16 Land Partners, 23 GPS-mapped fields, 4 Climate Partners and 14 trips.

**Which chains does your product use?**
Solana. It runs on devnet now, and the cluster is a single setting (`devnet`, `testnet` or `mainnet-beta`).

**How does your product use these chains?**
All money in Rukh is SOL, and every payment is a Solana transaction.

1. **Clients pay invoices.** The API returns a payment intent: the treasury address, the amount in lamports, and a memo such as `Rukh invoice RUKH-2026-0005`. The client's wallet signs one SystemProgram transfer plus a Memo instruction. Rukh then fetches the transaction over RPC and marks the invoice paid only if it succeeded, paid at least the amount owed to the treasury, and carries that exact memo. The memo ties the transaction to one invoice, so it can't be reused.
2. **Landowners get paid.** When trees are allocated, Rukh raises a payout for each landowner. The superadmin pays up to 8 landowners in one transaction, one transfer per wallet, with a memo listing the payout numbers. The API verifies each recipient and amount before marking the payouts paid.
3. **Transparency.** Every invoice and payout links to its transaction on Solana Explorer, so a traveler, auditor or landowner can follow the money from the client to the treasury to the farmer.
4. **Safety.** No private keys live on the server. The wallet only signs, and the app submits to the configured cluster itself, so a wallet left on mainnet can't move real SOL during a devnet demo.

Next steps: mint each allocation as a compressed NFT tree certificate for the traveler, and move the treasury to an escrow program that releases landowner payouts automatically when an invoice is paid.

**Is your project a mobile-focused dApp?**
No. It's a responsive web app that works in mobile browsers and with mobile wallets, but it isn't built mobile-first. Landowner payouts arrive in any Solana wallet on their phone.

**Where is your team primarily based?**
TODO: confirm. Suggested: Nepal (Kathmandu).

## Media and code

**Project logo or graphic:** `submission/logo.png` (512×512 square) and `submission/banner.png` (1200×630 cover). The source is `logo.svg`.

**GitHub link:** see above. The repo must be public, or the judges invited, before submitting.

**Demo video:** TODO. `brag-output/brag.mp4` is from before the switch to Solana and still shows eSewa payouts, so don't submit it.

**Pitch video:** TODO

## Suggested demo script (about 2 minutes)

1. Homepage, then log in as `company@rukh.com` / `rukh@123` (Climate Partner). Open a trip and show CO₂ per traveler, then **Request trees**.
2. Log in as `superadmin@rukh.com`. Open the request and **Choose trees on the map**, then confirm. An invoice is issued and payouts are raised.
3. As the Climate Partner, open **Billing → Pay now**. Connect Phantom on devnet, approve, and show the Explorer link with the memo.
4. As the superadmin, open **Pay**, pay the landowners in one transaction, and show the Explorer link with a transfer to each wallet.
5. Log in as `landowner@rukh.com` and open **Payments**. Show the SOL received with its Explorer link.

Before recording: set the treasury (superadmin → **Pay** → **Use connected wallet**), and fund the demo wallets from https://faucet.solana.com.
