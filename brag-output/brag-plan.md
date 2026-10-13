# Brag Plan: Rukh (Solana edition)

Re-cut on 2026-10-13 for the Crypto World Fair: all money is SOL, payments are Solana transactions verified on chain. Audience: hackathon judges.

## What is this app?
Rukh measures the flight CO₂ of a travel group and funds specific, satellite-verified trees in Nepal. Climate Partners pay in SOL from a Solana wallet, Land Partners host the trees and receive 60% of every tonne in SOL to their own wallet, and Rukh matches the two, verifies every transaction on chain, and takes a platform fee.

## The angle
**One trip, three dashboards.** Follow one booking from start to finish: 12 trekkers fly London → Doha → Kathmandu for Annapurna Base Camp. The Climate Partner measures 18.96 t CO₂ and requests trees. Rukh auto-fills the smallest fields and issues the bill. The operator pays the invoice from a Solana wallet with the memo `Rukh invoice RUKH-2026-0005`, Rukh verifies it on chain, and a farmer in Kaski with spare land is paid in SOL to her own wallet in one batched transaction. Every side of the marketplace gets a chapter, and the same numbers carry through all three, so the video reads as a working system rather than a feature list.

Claims stay inside the product's own wording. The company's claim is the product copy *"funded verified carbon removal"*, not "carbon free".

## Hook (first 2-3 seconds)
"Every flight to Nepal leaves something behind." Then the dashed route LHR · DOH · KTM draws across the frame and the CO₂ counter climbs to 1.58 t per traveler.

## Key moments (the middle)
- Traveler rows paste into the trip one by one, and the total counts up to **18.96 t CO₂ measured**.
- The cursor picks **Plant · 0.19 SOL/t** over Protect (0.1 SOL/t), then clicks **Request trees**.
- The superadmin clicks **Auto-fill**. Capacity bars fill smallest field first: *"Auto-fill uses the smallest fields first, so income reaches small farms."*
- **Paid in SOL. Proven on Solana.** Invoice 3.8546 SOL → a wallet "Approve transaction" card (send 3.8546 SOL, to Rukh treasury, memo `Rukh invoice RUKH-2026-0005`) → **Confirmed on Solana · tx on Explorer** → split chips: 60% → Land Partners 2.1614 SOL · 7% → Rukh 0.2522 SOL.
- Land Partner adds "Land for new trees". A live earnings estimate ticks up, then a **Verified** badge lands.
- Payout card: **Sita Gurung · 0.5404 SOL · 1 transaction, 4 landowners · Solana · Paid**, while 12 trees light up on her field map.

## Outro / punchline
A three-node loop (Climate Partner → pays 3.8546 SOL → Rukh → pays 2.1614 SOL → Land Partner) closes over "48 real trees on a map · every payment on Solana Explorer", then the lockup: **Rukh — Real trees in Nepal. Every payment on Solana.** · "Built on Solana · paid in SOL" · "Start for free".

## User flow worth showing
1. Climate Partner: new trip → paste travelers → CO₂ measured → pick Plant → Request trees.
2. Rukh superadmin: open request → Auto-fill fields → Allocate & bill client.
3. Land Partner: add field (land for new trees) → live earnings estimate in SOL → trees funded → payout paid to her Solana wallet.

## Tone
- Preset: `app-store`
- Creative direction: "one tonne of CO₂, followed from a London booking to a Kaski hillside — a three-sided marketplace film"
- Interpretation: clean feature-card reveals and smooth slides, real UI recreated at video scale, warm and confident without hype. Each chapter carries a numbered label (01 / 02 / 03) so the three perspectives stay legible over 60s.

## Format: landscape — 1920x1080
## Duration: 60s (user-requested; overrides the 15-25s default)

## Visual identity (from the project)
- Background: `#ffffff` with the hero's radial tints `#dcfce7` / `#ecfccb` and `.card-tint`
- Surface muted: `#f6faf7`, border `#e8efea`
- Solana accent: purple `#7b2fe0` for text, `#9945ff` / `#14f195` in the Solana mark, wallet card `#1b1035`
- Accent: `#16a34a` (brand), `#15803d` (brand-strong, used for small text so it passes contrast), soft `#ecfdf3`, mint `#bbf7d0`
- Text: `#101814`, muted `#5f6b65`
- Display + body font: Poppins 400/500/600/700 (the site uses Poppins for everything)
- Strongest visual element: the hero "Trip allocation" card (route line, MiniMap with dashed field polygon and green tree dots, 3 stat tiles) and the "Payout · Sita Gurung" card

## Share copy (draft)
12 trekkers fly London → Kathmandu. Rukh measures their 18.96 t of CO₂, the operator pays 3.85 SOL from a Solana wallet, and 48 trees are planted on farmers' land in Kaski, with each landowner paid in SOL to their own wallet. Every payment is on Solana Explorer.

## Audio direction
- Role: warm, punchy bed with a consistent light SFX layer
- Music: `happy-beats-business-moves-vol-10-by-ende-dot-app.mp3` (exactly 60.00s, ~110 BPM)
- Music treatment: 0.32 volume, short fade-in, fade out over the final ~2s under the lockup
- Music cue guidance: bundled preset read (`assets/music/cues/…vol-10….music-cues.json`). Scene cuts snap to the beat grid: 5.19, 10.38, 17.47, 24.01 (strong .98), 30.56 (strong 1.00), 38.74 (strong 1.00), 45.82 (strong .99), 51.83 (strong 1.00). Beat ≈ 0.545s. Sequential traveler rows go on every other beat (~1.1s) or reveal fast and hold.
- Audio-reactive treatment: subtle. Music RMS/bass makes the background green glow breathe and gives the focal card's shadow a little presence. No waveform visuals.
- SFX posture: moderate, low-HF picks. Clicks on cursor presses, a soft slide for card and row arrivals, soft impacts on chapter cards, a bell on the payout and the logo.
- Audio-coupled moments: route draw, rows pasting, cursor clicks (Plant, Request trees, Auto-fill, Allocate), field name typing, payout "Paid", logo.
- Restraint rule: never more than one SFX per ~0.5s, and no stacked impacts. The music carries the energy.

## Storyboard

### Scene 1 — Hook — 0.00–5.19s (5.19s)
"Every flight to Nepal leaves something behind." holds about 2.4s. Then a hero route strip: LHR — DOH — KTM, a dashed line drawing with a plane dot, and "1.58 t CO₂ per traveler" counting up.
Sequential/interaction: yes. The route draws left to right and the counter ticks.
Audio intent: confident open. Audio-coupled: soft impact on the line slam, light tick on the counter landing.
Transition mood: clean slide → Scene 2

### Scene 2 — Reveal — 5.19–10.38s (5.19s)
"Rukh" wordmark plus "Offset Travel with Real Trees in **Nepal**". Then "One platform. Three sides." and three role cards slide in one by one: Climate Partner ("I want to offset travel emissions"), Rukh ("Platform control"), Land Partner ("I own trees or land in Nepal").
Sequential/interaction: yes. Three cards arrive one by one and hold together about 2s.
Audio-coupled: card slide per card.
Transition mood: clean wipe → Scene 3

### Scene 3 — 01 Climate Partner · Measure — 10.38–17.47s (7.09s)
Chapter label "01 · Climate Partner". A trip card: "Annapurna Base Camp · 14 days", "Himalaya Treks". A travelers table: rows paste in (LHR · via DOH · 1.58 t ×6 visible, "+6 more"). The total counts up: **18.96 t CO₂ measured**, 12 travelers.
Sequential/interaction: yes. Rows paste in fast, then the full set holds about 2.5s.
Audio-coupled: a single slide for the paste, chip tick on the total.
Transition mood: slide → Scene 4

### Scene 4 — 01 Climate Partner · Choose & request — 17.47–24.01s (6.54s)
Two impact cards side by side: Protect 0.1 SOL/t "Pay for this year's measured growth of standing trees" and Plant 0.19 SOL/t "New trees planted for you, absorbing CO₂ over 30 years". The cursor clicks Plant, which takes a selected ring. The claim chip appears: *Claim: "funded verified carbon removal"*. The summary reads 18.96 t × 0.19 SOL = 3.6024 SOL + 7% fee 0.2522 SOL. The cursor clicks **Request trees** and the line becomes "Request sent · bill 3.8546 SOL".
Sequential/interaction: yes, two simulated clicks.
Audio-coupled: click, click, soft drop on the toast.
Transition mood: slide → Scene 5

### Scene 5 — 02 Rukh · Allocate — 24.01–30.56s (6.55s)
Chapter label "02 · Rukh — Platform control". Request header "Himalaya Treks · Annapurna Base Camp · 18.96 t Plant". Five field rows with capacity meters (small to large). The cursor clicks **Auto-fill** and the bars fill smallest first. Caption: "Auto-fill uses the smallest fields first, so income reaches small farms." The cursor clicks **Allocate & bill client →**.
Sequential/interaction: yes. Bars fill in order on the beat grid.
Audio-coupled: click on Auto-fill, soft ticks on bar fills (first and last only), click on Allocate.
Transition mood: slide → Scene 6

### Scene 6 — 02 Rukh · Paid in SOL, proven on Solana — 30.56–38.74s (8.18s)
Headline "Paid in SOL. Proven on **Solana**." Invoice RUKH-2026-0005 lines in: Trees 18.96 t × 0.19 SOL = 3.6024 SOL, Platform fee (7%) 0.2522 SOL, Total **3.8546 SOL**. A dark wallet card "Approve transaction · Solana devnet" counts Send up to 3.8546 SOL and shows To "Rukh treasury · 7xKX…n4Qp" and Memo "Rukh invoice RUKH-2026-0005". The cursor clicks **Approve**, then a card lands: "✓ Confirmed on Solana · Verified by Rukh · tx 5Kq8…9xFp on Explorer ↗ · Invoice paid". Split chips: "60% → Land Partners · 2.1614 SOL", "7% → Rukh · 0.2522 SOL".
Sequential/interaction: yes. Invoice lines, wallet count-up, approve click, confirmation, chips.
Audio-coupled: card slide, soft impact as the wallet arrives, click on Approve, drop on the chips.
Transition mood: slide → Scene 7

### Scene 7 — 03 Land Partner · Enrol — 38.74–45.82s (7.08s)
Chapter label "03 · Land Partner — I own trees or land in Nepal". Add-field form: the "Land for new trees" option is selected ("Host new trees planted for Climate Partners"). Field name types "Gurung terrace, Kaski", land area 0.4 ha, species Utis. The **Estimated earnings** panel ticks up to 0.5404 SOL (paid to your Solana wallet), then the **✓ Verified** satellite badge lands.
Sequential/interaction: yes, typed field name with key ticks.
Audio-coupled: keypresses (sparse), drop on Verified.
Transition mood: slide → Scene 8

### Scene 8 — 03 Land Partner · Get paid — 45.82–51.83s (6.01s)
Notification "Himalaya Treks funded 12 trees on your field". The MiniMap's tree dots light up green. Payout card: **Payout · Sita Gurung — 0.5404 SOL — To HFfY…mTAM · 1 transaction, 4 landowners — Solana — Paid**. Line: "Paid in SOL, straight to her wallet."
Sequential/interaction: yes. Dots light in sequence, then the Paid badge lands.
Audio-coupled: bell on Paid.
Transition mood: dramatic-but-clean → Scene 9

### Scene 9 — Loop + lockup — 51.83–60.00s (8.17s)
Three nodes connect in a loop with labels on the arrows: "pays 3.8546 SOL" → "pays 2.1614 SOL", over "48 real trees on a map · every payment on Solana Explorer". Then the lockup: **Rukh**, "Real trees in Nepal. Every payment on Solana.", a "Built on Solana · paid in SOL" pill, and a "Start for free →" button. Hold to the end while the music fades.
Audio-coupled: soft impact on the loop close, bell/bong on the logo.

**Music mood for this video:** upbeat, warm
**Audio summary:** a punchy 60s bed that starts confident, carries the three chapters with light UI clicks and slides, peaks on the payout bell, and fades under the logo.
