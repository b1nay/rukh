# Rukh: Crypto World Fair submission

Team: **Binayak Karki, Aalok Sapkota, Abinash Oli** · Repo: **https://github.com/b1nay/rukh**

## Deliverables checklist

| # | Deliverable | Status | Where |
|---|---|---|---|
| 1 | Project name | ✅ Ready | Rukh |
| 2 | Project description | ✅ Ready | [below](#project-description) |
| 3 | GitHub repo | ✅ Public, code pushed | https://github.com/b1nay/rukh |
| 4 | Link to your submission | ⚠️ No deployed app yet; use the repo link, or deploy and paste the URL | [below](#link-to-your-submission) |
| 5 | Pitch deck (10 slides) | ✅ Ready · ⚠️ private until shared | https://claude.ai/artifact/KVNa2zhPVjxZJBf86HNFNp (Share → public link, or Export → PDF/PPTX) |
| 6 | Demo video (60 s, 1080p) | ✅ Ready · ⚠️ upload to YouTube or Loom | `brag-output/brag.mp4` · poster `brag-output/brag.jpg` |
| 7 | Pitch video (2–3 min) | ⚠️ To record (script ready) | [script below](#pitch-video-script-about-230) |
| 8 | Project logo / graphic | ✅ Ready | `submission/logo.png` (512×512), `submission/banner.png` (1200×630) |
| 9 | Project detail answers (7) | ✅ Ready | [below](#project-details) |
| 10 | Share caption | ✅ Ready | `brag-output/share-copy.txt` |

Public links to the files:
- Logo: https://github.com/b1nay/rukh/blob/main/submission/logo.png
- Banner: https://github.com/b1nay/rukh/blob/main/submission/banner.png
- Demo video file: https://github.com/b1nay/rukh/blob/main/brag-output/brag.mp4

---

## Link to your submission

### Link to your submission
https://github.com/b1nay/rukh. Replace this with the live app URL if you deploy one.

### Project name
Rukh

### Project description
Rukh turns travel emissions into specific, mapped trees in Nepal. Tour operators, event organisers and universities measure each traveler's flight CO₂ and pay in SOL. Nepali farmers and community forests are paid in SOL straight to their own wallet to keep those trees standing. Every payment is a Solana transaction that anyone can check on Solana Explorer.

### Project GitHub link
https://github.com/b1nay/rukh

### Link to your pitch deck or Loom/video presentation
Pitch deck: https://claude.ai/artifact/KVNa2zhPVjxZJBf86HNFNp. Add the Loom or YouTube link once the pitch video is recorded.

---

## Project details

### What are you building, and who is it for?
Rukh is a two-sided marketplace for carbon removal from trees, with Solana as the payment layer.

- **Climate Partners** are tour operators, conference organisers, NGOs and universities that fly people to Nepal. They upload travelers and itineraries. Rukh calculates each traveler's flight CO₂, then funds that exact tonnage either by protecting existing trees (**Protect, 0.1 SOL/t**) or planting new native trees (**Plant, 0.19 SOL/t**). They pay the invoice from their Solana wallet.
- **Land Partners** are Nepali farmers, community forests and tea and cardamom cooperatives. They map their fields and record their trees by species, age and size. Rukh's models calculate how much CO₂ those trees absorb each year. Landowners receive **60% of every tonne sold, paid in SOL to their own wallet**.
- **Rukh's superadmin** matches requests to fields on a map, never selling the same tree twice and holding 15% back as a buffer. They pay all the funded landowners in one batched Solana transaction.

### Why did you decide to build this, and why build it now?
Most "carbon neutral" offset deals are opaque. A buyer gets a certificate number, not a tree, and can't see who was paid or how much. We wanted something a traveler can actually check: these trees, in this district, cared for by this landowner, who received this payment.

Solana makes that possible now. Landowners in rural Nepal can't be paid cheaply or quickly across borders by card or bank. A Solana transfer settles in seconds for a fraction of a cent and needs only a phone wallet. Putting every payment on chain, each tagged with the invoice or payout number it settles, turns "trust us" into a public record.

### What technologies are you using or integrating with to build your product?
- **Solana:**
  - `@solana/web3.js` and Solana Wallet Adapter with Wallet Standard (Phantom, Solflare, Backpack).
  - The System Program for SOL transfers and the Memo program to tag each payment.
  - JSON-RPC `getTransaction` for server-side verification, and Solana Explorer links.
- **Backend:** Python, FastAPI, SQLAlchemy, Pydantic, SQLite (PostgreSQL/PostGIS planned).
- **Frontend:** Next.js 16, React 19, TypeScript, Tailwind CSS, Leaflet with OpenStreetMap for field maps.
- **Models:**
  - Distance-based flight emission factors with cabin multipliers and optional non-CO₂ effects.
  - The Chave et al. (2014) allometric equation with IPCC root and carbon fractions, for carbon stored in trees.
  - Species and age growth curves for yearly absorption.
- **Ops:**
  - Docker Compose, with a built-in demo platform: 16 Land Partners, 23 GPS-mapped fields, 4 Climate Partners and 14 trips.
  - 46 backend tests.

### Which chains does your product use?
Solana. It runs on devnet now, and the cluster is a single setting (`devnet`, `testnet` or `mainnet-beta`).

### How does your product use these chains?
All money in Rukh is SOL, and every payment is a Solana transaction.

1. **Clients pay invoices.** The API returns a payment intent: the treasury address, the amount in lamports, and a memo such as `Rukh invoice RUKH-2026-0005`. The client's wallet signs one System Program transfer plus a Memo instruction. Rukh then fetches the transaction over RPC and marks the invoice paid only if it succeeded, paid at least the amount owed to the treasury, and carries that exact memo. The memo ties the transaction to one invoice, so it can't be reused.
2. **Landowners get paid.** When trees are allocated, Rukh raises a payout for each landowner. The superadmin pays up to 8 landowners in one transaction, one transfer per wallet, with a memo listing the payout numbers. The API checks each recipient and amount before marking the payouts paid.
3. **Transparency.** Every invoice and payout links to its transaction on Solana Explorer, so a traveler, auditor or landowner can follow the money from the client to the treasury to the farmer.
4. **Safety.** No private keys live on the server. The wallet only signs, and the app submits to the configured cluster itself, so a wallet left on mainnet can't move real SOL during a devnet demo.

Next we plan to mint each allocation as a compressed-NFT tree certificate for the traveler, and to move the treasury into an escrow program that pays landowners automatically when an invoice is paid.

### Is your project a mobile-focused dApp?
No. It's a responsive web app that works in mobile browsers and with mobile wallets, but it isn't built mobile-first. Landowners receive their SOL in any Solana wallet on their phone.

### Where is your team primarily based?
Nepal.

---

## Media and code

### Project logo or graphic
- Square logo: `submission/logo.png` (512×512, transparent corners). Use this for the logo field.
- Cover banner: `submission/banner.png` (1200×630).
- Vector source: `submission/logo.svg`.

### GitHub link
https://github.com/b1nay/rukh. Judges can run it with `docker compose up --build`, then open http://localhost:3000 and log in with the demo accounts below.

### Demo video
`brag-output/brag.mp4`, 60 s, 1920×1080, with music. Upload it to YouTube (Unlisted or Public) or Loom and paste the link. Tick **Show demo video on the public project page**.

- **Upload title:** Rukh: real trees in Nepal, every payment on Solana
- **Upload description:**
  > 12 trekkers fly London → Kathmandu. Rukh measures their 18.96 t of CO₂, the operator pays 3.85 SOL from a Solana wallet, and 48 Utis trees are planted on farmers' land in Kaski. Each landowner is paid in SOL to their own wallet, and every payment can be checked on Solana Explorer. Built for Crypto World Fair by Binayak Karki, Aalok Sapkota and Abinash Oli. Code: https://github.com/b1nay/rukh
- **Thumbnail:** `brag-output/brag.jpg`
- **What it shows:**
  1. Flight CO₂ is measured.
  2. Plant is chosen at 0.19 SOL/t.
  3. Rukh allocates the trees.
  4. A wallet approves the payment with memo `Rukh invoice RUKH-2026-0005`, and it is confirmed on Solana.
  5. The landowner receives 0.5404 SOL in her wallet.
  6. Lockup: "Real trees in Nepal. Every payment on Solana."

### Pitch video
Record a 2–3 minute Loom with the deck on screen, then switch to the live app. The script is below.

---

## Pitch video script (about 2:30)

| Time | On screen | Say |
|---|---|---|
| 0:00–0:15 | Deck slide 1 (cover) | "We're Binayak, Aalok and Abinash, and this is Rukh, which means 'tree' in Nepali. Rukh turns travel emissions into real, mapped trees in Nepal, and every payment settles in SOL on Solana." |
| 0:15–0:35 | Slide 2 (problem) | "Carbon offsets today sell a certificate number, not a tree. Buyers can't see which trees, landowners rarely see the money, and nobody outside can audit either side." |
| 0:35–0:55 | Slides 3–4 (solution, flow) | "Rukh has three sides. Tour operators and events measure each traveler's flight CO₂. Rukh matches that tonnage to real fields on a map. Farmers and community forests get 60% of every tonne." |
| 0:55–1:20 | Slides 5–6 (why Solana, on-chain design) | "Solana is what makes direct payouts practical. A farmer in Kaski can be paid in seconds for a fraction of a cent, with only a phone wallet. Every payment carries a memo naming its invoice or payout, and our API checks it on chain before marking anything paid. No keys live on our server." |
| 1:20–2:05 | Live app (see demo steps below) | Walk through: the trip's CO₂ → Request trees → the superadmin allocates on the map → the client pays from Phantom → open the transaction on Solana Explorer → the batched landowner payout → the landowner's Payments page. |
| 2:05–2:20 | Slides 8–9 (business model, what's built) | "Protect costs 0.1 SOL per tonne and Plant 0.19. Rukh keeps a 7–12% platform fee. It's working today on devnet, with 23 mapped fields and a full demo platform." |
| 2:20–2:30 | Slide 10 (roadmap) | "Next: compressed-NFT tree certificates for travelers, an escrow program for instant payouts, then mainnet. Thank you." |

---

## Live demo steps

**Before recording:**
1. Run `docker compose up --build` and open http://localhost:3000.
2. Fund two devnet wallets at https://faucet.solana.com.
3. Log in as the superadmin, open **Pay**, and click **Use connected wallet** to set the treasury.

**Demo accounts** (password `rukh@123`):

| Role | Login |
|---|---|
| Superadmin | `superadmin@rukh.com` |
| Climate Partner | `company@rukh.com` |
| Land Partner | `landowner@rukh.com` |

**Steps:**
1. As the Climate Partner, open a trip and show CO₂ per traveler, then click **Request trees**.
2. As the superadmin, open the request, click **Choose trees on the map**, and confirm. An invoice is issued and payouts are raised.
3. As the Climate Partner, open **Billing → Pay now**. Connect Phantom on devnet, approve, and open the Explorer link to show the memo.
4. As the superadmin, open **Pay** and pay the landowners in one transaction. Show the Explorer link with a transfer to each wallet.
5. As the Land Partner, open **Payments** and show the SOL received with its Explorer link.

---

## Share caption
> Rukh is live on Solana. 12 trekkers fly London → Kathmandu: Rukh measures their 18.96 t of CO₂, the operator pays 3.85 SOL from a Solana wallet, and 48 Utis trees go on farmers' land in Kaski, with each landowner paid in SOL to their own wallet.
> Real trees in Nepal. Every payment on Solana Explorer.
