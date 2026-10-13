import Link from "next/link";
import { Pricing } from "@/components/pricing";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { SolanaMark } from "@/components/solana-mark";

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <Hero />
        <Features />
        <section id="pricing" className="scroll-mt-20 py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <SectionHead title="Simple, per-tonne pricing" body="Choose how your tonnes are covered. Pay in SOL, only for what you use." />
            <div className="mt-12">
              <Pricing />
            </div>
          </div>
        </section>
        <Landowners />
      </main>
      <SiteFooter />
    </>
  );
}

function SectionHead({ title, body }: { title: React.ReactNode; body?: string }) {
  return (
    <div className="mx-auto max-w-xl text-center">
      <h2 className="text-3xl font-semibold tracking-tight">{title}</h2>
      {body && <p className="mt-3 text-sm text-muted">{body}</p>}
    </div>
  );
}

function ArrowRight() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M4 10h12m-5-5 5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Hero() {
  return (
    <section className="relative -mt-16 overflow-hidden pt-16">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(50%_60%_at_0%_0%,#dcfce7_0%,transparent_70%),radial-gradient(45%_55%_at_100%_0%,#ecfccb_0%,transparent_70%)]"
      />
      <div className="mx-auto max-w-6xl px-4 pb-20 pt-14 text-center sm:px-6">
        <p className="inline-flex items-center gap-2 rounded-full border border-border bg-white/70 px-3 py-1 text-xs font-medium text-brand">
          <SolanaMark /> Paid and settled on Solana · Nepal&apos;s verified tree platform 🌱
        </p>
        <h1 className="mx-auto mt-4 max-w-3xl text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
          Offset Travel with Real Trees in <span className="text-brand">Nepal</span>
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-sm text-muted sm:text-base">
          Measure your travelers&apos; flight emissions and fund specific trees you can see on a map,
          cared for by local landowners. Every payment is in SOL and can be checked on chain.
        </p>
        <Link
          href="/signup"
          className="mt-8 inline-flex items-center gap-2 rounded-md bg-brand px-5 py-2.5 text-sm font-medium text-white transition hover:bg-brand-strong"
        >
          Start for free <ArrowRight />
        </Link>

        <HeroVisual />
      </div>
    </section>
  );
}

function HeroVisual() {
  return (
    <div className="card-tint relative mx-auto mt-14 max-w-4xl overflow-hidden rounded-3xl border border-border p-6 sm:p-12">
      <div className="mx-auto max-w-md rounded-2xl border border-border bg-white p-5 text-left shadow-[0_20px_50px_-20px_rgba(22,163,74,0.25)]">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted">Trip allocation</p>
            <p className="font-medium">Annapurna Base Camp · 14 days</p>
          </div>
          <span className="rounded-full bg-brand-soft px-2.5 py-1 text-xs font-medium text-brand">Verified</span>
        </div>
        <div className="mt-4 flex items-center gap-3 rounded-xl bg-surface-muted px-4 py-3 text-sm">
          <span className="font-medium">LHR</span>
          <span className="h-px flex-1 border-t border-dashed border-brand/40" />
          <span className="text-xs text-muted">DOH</span>
          <span className="h-px flex-1 border-t border-dashed border-brand/40" />
          <span className="font-medium">KTM</span>
          <span className="ml-1 font-semibold text-brand">1.58 t CO₂</span>
        </div>
        <MiniMap className="mt-4" />
        <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
          {[
            ["4", "Utis trees"],
            ["Kaski", "District"],
            ["0.3 SOL", "Plant tier"],
          ].map(([v, l]) => (
            <div key={l} className="rounded-xl bg-surface-muted p-3">
              <p className="text-base font-semibold">{v}</p>
              <p className="text-muted">{l}</p>
            </div>
          ))}
        </div>
      </div>
      <Chip className="left-6 top-10 hidden sm:flex" icon="🌳">4 trees allocated</Chip>
      <Chip className="bottom-12 right-6 hidden sm:flex" icon="💸">0.18 SOL paid on Solana</Chip>
    </div>
  );
}

function Chip({ children, icon, className = "" }: { children: React.ReactNode; icon: string; className?: string }) {
  return (
    <span
      className={`absolute items-center gap-2 rounded-full border border-border bg-white px-3 py-1.5 text-xs font-medium shadow-sm ${className}`}
    >
      <span>{icon}</span> {children}
    </span>
  );
}

function MiniMap({ className = "" }: { className?: string }) {
  const trees: [number, number, boolean][] = [
    [70, 60, true], [110, 48, true], [150, 74, true], [190, 56, false], [100, 100, false], [160, 110, false], [205, 96, false],
  ];
  return (
    <div className={`overflow-hidden rounded-xl bg-[#e7f6ec] ${className}`}>
      <svg viewBox="0 0 280 150" className="block w-full">
        {[20, 45, 70, 95, 120].map((y) => (
          <path key={y} d={`M0 ${y} Q70 ${y - 10} 140 ${y - 2} T280 ${y - 4}`} stroke="#cdebd7" strokeWidth="1.5" fill="none" />
        ))}
        <path d="M45 30 L230 24 L248 112 L180 136 L60 128 Z" fill="rgba(22,163,74,0.08)" stroke="#16a34a" strokeWidth="1.5" strokeDasharray="5 4" />
        {trees.map(([x, y, mine], i) => (
          <circle key={i} cx={x} cy={y} r={mine ? 9 : 7} fill={mine ? "#16a34a" : "#86efac"} />
        ))}
      </svg>
    </div>
  );
}

/* ---------- Features ---------- */

const FEATURES = [
  { title: "Flight Emissions", body: "Upload travelers or connect bookings. CO₂ is calculated per flight.", art: <ArtFlight /> },
  { title: "Tree Allocation", body: "Each tonne is matched to real trees. No tree is sold twice.", art: <ArtTrees /> },
  { title: "Satellite Verification", body: "Every field is checked from space, so the trees are really there.", art: <ArtSatellite /> },
  { title: "Landowner Payouts", body: "Farmers and community forests are paid in SOL, straight to their own wallet.", art: <ArtPayout /> },
  { title: "Traveler Certificates", body: "Share a map of each traveler's trees, not a certificate number.", art: <ArtCertificate /> },
  { title: "Billing & Reports", body: "Invoices settled in SOL, each payment linked to its transaction on chain.", art: <ArtReport /> },
];

function Features() {
  return (
    <section id="features" className="scroll-mt-20 py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHead
          title="Our Key Features"
          body="Everything you need to measure travel emissions and fund verified trees in Nepal."
        />
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="card-tint overflow-hidden rounded-2xl border border-border">
              <div className="flex h-44 items-center justify-center px-6">{f.art}</div>
              <div className="px-7 pb-7">
                <h3 className="text-lg font-semibold">{f.title}</h3>
                <p className="mt-1.5 text-sm text-muted">{f.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const artCard = "rounded-xl border border-border bg-white shadow-sm";

function ArtFlight() {
  return (
    <div className={`${artCard} w-52 p-3 text-xs`}>
      <div className="flex items-center justify-between font-medium">
        <span>Round trips</span>
        <span className="text-brand">✈ KTM</span>
      </div>
      <div className="mt-2 space-y-1.5">
        {["LHR · via DOH", "LHR · via DOH", "FRA · via IST"].map((t, i) => (
          <div key={t} className="flex justify-between text-muted">
            <span>{t}</span>
            <span className="font-medium text-foreground">{[1.58, 1.58, 1.31][i]} t</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ArtTrees() {
  return (
    <div className="relative">
      <div className="grid grid-cols-6 gap-2">
        {Array.from({ length: 18 }).map((_, i) => (
          <span key={i} className={`h-5 w-5 rounded-full ${[2, 3, 8].includes(i) ? "bg-brand" : "bg-mint/70"}`} />
        ))}
      </div>
      <span className="absolute -right-6 -top-4 rounded-full border border-border bg-white px-2.5 py-1 text-[11px] font-medium shadow-sm">
        3 allocated
      </span>
    </div>
  );
}

function ArtSatellite() {
  return (
    <div className="relative">
      <MiniMap className={`${artCard} w-52 p-1`} />
      <span className="absolute -bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-brand-soft px-2.5 py-1 text-[11px] font-medium text-brand ring-1 ring-brand/20">
        ✓ Verified
      </span>
    </div>
  );
}

function ArtPayout() {
  return (
    <div className={`${artCard} w-52 p-3 text-xs`}>
      <p className="text-muted">Payout · Sita Gurung</p>
      <p className="mt-1 text-lg font-semibold">0.18 SOL</p>
      <div className="mt-2 flex items-center justify-between">
        <span className="flex items-center gap-1 rounded-md bg-surface-muted px-2 py-1 text-muted"><SolanaMark className="h-3 w-3" /> Solana</span>
        <span className="rounded-full bg-brand-soft px-2 py-0.5 font-medium text-brand">Paid</span>
      </div>
    </div>
  );
}

function ArtCertificate() {
  return (
    <div className={`${artCard} flex w-52 items-center gap-3 p-3 text-xs`}>
      <div className="grid grid-cols-4 gap-0.5">
        {Array.from({ length: 16 }).map((_, i) => (
          <span key={i} className={`h-2.5 w-2.5 ${[0, 2, 5, 6, 9, 11, 12, 15].includes(i) ? "bg-foreground" : "bg-surface-muted"}`} />
        ))}
      </div>
      <div>
        <p className="font-medium">Your 3 trees</p>
        <p className="text-muted">Kaski, Nepal</p>
      </div>
    </div>
  );
}

function ArtReport() {
  return (
    <div className={`${artCard} w-56 p-3 text-xs`}>
      <div className="flex items-center justify-between">
        <span className="font-medium">Overview</span>
        <span className="rounded-full bg-brand px-2 py-0.5 text-[10px] text-white">Month</span>
      </div>
      <div className="mt-3 flex h-16 items-end gap-1.5">
        {[30, 45, 38, 60, 52, 75, 68, 90].map((h, i) => (
          <span key={i} className={`flex-1 rounded-sm ${i === 7 ? "bg-brand" : "bg-mint"}`} style={{ height: `${h}%` }} />
        ))}
      </div>
    </div>
  );
}

/* ---------- Landowners ---------- */

function Landowners() {
  return (
    <section id="landowners" className="scroll-mt-20 pb-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="card-tint grid items-center gap-10 overflow-hidden rounded-3xl border border-border p-8 sm:p-12 md:grid-cols-2">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight">
              Own trees or land? <span className="text-brand">Get paid</span> to keep them growing.
            </h2>
            <p className="mt-3 text-sm text-muted">
              Draw your field, add your trees, and earn 60% of every tonne they absorb, paid in SOL to your wallet.
            </p>
            <Link
              href="/signup?side=landowner"
              className="mt-6 inline-flex items-center gap-2 rounded-md bg-brand px-5 py-2.5 text-sm font-medium text-white transition hover:bg-brand-strong"
            >
              Enrol your land <ArrowRight />
            </Link>
          </div>
          <div className="flex justify-center">
            <ArtPayout />
          </div>
        </div>
      </div>
    </section>
  );
}
