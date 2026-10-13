# Hyperframes Composition Brief: Rukh (Solana edition)

## Objective
Create a 60s launch-style brag video for Rukh that shows all three sides of the marketplace: Climate Partner, Rukh, and Land Partner.

## Output
- Composition directory: `brag-output/composition/`
- Rendered video: `brag-output/brag.mp4`
- Format: landscape, 1920x1080, 30fps
- Duration: 60s (user-requested)

## Source Material
- Project root: `carbon-calculator/`
- Primary files read: `frontend/src/app/page.tsx`, `frontend/src/app/globals.css`, `frontend/src/app/layout.tsx`, `frontend/src/lib/content.ts`, `frontend/src/components/dashboard/*` (admin, climate, land overviews, allocate, new field), `backend/app/catalog.py`, `README.md`
- Product name: Rukh
- Tagline: "Real trees in Nepal. Every payment on Solana."
- Key UI to recreate: hero "Trip allocation" card (route LHR · DOH · KTM, MiniMap, stat tiles), Protect/Plant impact cards, allocate screen with Auto-fill, "Payout · Sita Gurung" card (now in SOL), plus a Solana wallet "Approve transaction" card and an on-chain confirmation
- Copy that must appear verbatim:
  - Real trees in Nepal. Every payment on Solana.
  - Paid in SOL. Proven on Solana.
  - Rukh invoice RUKH-2026-0005
  - I want to offset travel emissions / I own trees or land in Nepal
  - New trees planted for you, absorbing CO₂ over 30 years
  - Claim: "funded verified carbon removal"
  - Auto-fill uses the smallest fields first, so income reaches small farms.
  - Host new trees planted for Climate Partners
  - Paid in SOL, straight to her wallet.
  - Confirmed on Solana · Verified by Rukh

## Creative Direction
- Tone preset: app-store
- Creative direction: one tonne of CO₂, followed from a London booking to a Kaski hillside
- Angle: one trip, three dashboards, with the same numbers carried through (12 travelers × 1.58 t = 18.96 t; Plant 0.19 SOL/t = 3.6024 SOL + 7% fee 0.2522 SOL = 3.8546 SOL, paid from a Solana wallet with memo "Rukh invoice RUKH-2026-0005"; 60% = 2.1614 SOL to landowners in one batched transaction, 0.5404 SOL to Sita for 12 of the 48 Utis trees)
- Hook: "Every flight to Nepal leaves something behind." + route draw + CO₂ counter
- Outro: three-node loop (pays 3.8546 SOL → pays 2.1614 SOL), then the Rukh lockup "Real trees in Nepal. Every payment on Solana." with a "Built on Solana · paid in SOL" pill and "Start for free →"
- Avoid: generic SaaS language, abstract filler, "carbon free" claims, emoji glyphs (use inline SVG icons)

## Visual Identity
- Background #ffffff with radial #dcfce7 / #ecfccb tints; muted surface #f6faf7; border #e8efea
- Text #101814, muted #5f6b65; accent #16a34a (large), #15803d (small text), soft #ecfdf3, mint #bbf7d0
- Font: Poppins 400–700, local woff2

## Storyboard
See `brag-plan.md`. Scenes: Hook 5.19 · Reveal 5.19 · Measure 7.09 · Choose 6.54 · Allocate 6.55 · Split 8.18 · Enrol 7.08 · Paid 6.01 · Lockup 8.17 = 60.00s.

## Audio
- Music: `assets/music/happy-beats-business-moves-vol-10-by-ende-dot-app.mp3` at 0.32, fade-in 0.4s, fade-out over the last 2s
- Cue source: bundled preset; scene cuts snap to beats, with strong-cue locks at 30.56, 38.74 and 51.83
- Audio-reactive: `assets/audio-data.js` (per-frame RMS + bass at 30fps, extracted with ffmpeg + node because numpy is unavailable) drives the background glow scale/opacity and the focal card's shadow
- SFX: low-HF picks copied into `assets/sfx/` and chosen against the implemented motion, at volumes 0.55–0.8
