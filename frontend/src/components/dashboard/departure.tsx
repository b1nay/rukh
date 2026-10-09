"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api";
import { CATEGORIES, fmtKg } from "@/lib/itinerary";
import type { Itinerary, LegCategory, TravelerInput, TripDetail } from "@/lib/types";
import { Modal } from "./modal";
import { TravelersModal } from "./travelers-modal";
import { Badge, Card, FieldLabel, inputCls } from "./ui";

/** Icons for the distinct leg categories of an itinerary, in order of appearance. */
function categoryIcons(it: Itinerary) {
  const seen: LegCategory[] = [];
  it.legs.forEach((l) => !seen.includes(l.category) && seen.push(l.category));
  return seen;
}

export function ItineraryCard({ it, onStart }: { it: Itinerary; onStart: (it: Itinerary) => void }) {
  return (
    <button
      type="button"
      onClick={() => onStart(it)}
      className="card-tint group flex flex-col rounded-2xl border border-border p-5 text-left transition hover:border-brand hover:shadow-[0_16px_40px_-24px_rgba(22,163,74,0.4)]"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold leading-snug">{it.name}</p>
        {it.times_used > 0 ? <Badge>Used {it.times_used}×</Badge> : it.is_template && <Badge tone="gray">Starter</Badge>}
      </div>
      <p className="mt-1 text-xs text-muted">
        {it.days} days · {it.legs.length} legs
      </p>
      <div className="mt-4 flex gap-1.5">
        {categoryIcons(it).map((c) => (
          <span key={c} title={CATEGORIES[c].label} className="grid h-7 w-7 place-items-center rounded-lg border border-border bg-white text-sm">
            {CATEGORIES[c].icon}
          </span>
        ))}
      </div>
      <p className="mt-4 text-xs text-muted">
        In Nepal <span className="font-semibold text-foreground">{fmtKg(it.kg_per_person)}</span> per person
        {it.has_international && " + flights"}
      </p>
      <span className="mt-4 text-sm font-medium text-brand">
        New departure <span className="inline-block transition group-hover:translate-x-1">→</span>
      </span>
    </button>
  );
}

/** Date + group size, then traveler details, then creates the trip. */
export function DepartureFlow({ itinerary, onClose }: { itinerary: Itinerary; onClose: () => void }) {
  const router = useRouter();
  const [step, setStep] = useState<"departure" | "travelers">("departure");
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [pax, setPax] = useState(10);
  const [nonCo2, setNonCo2] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create(travelers: TravelerInput[]) {
    setSubmitting(true);
    setError(null);
    try {
      const trip = await api.post<TripDetail>("/api/v1/climate/trips", {
        itinerary_id: itinerary.id,
        start_date: startDate,
        pax: travelers.length,
        include_non_co2: nonCo2,
        travelers,
      });
      onClose();
      router.push(`/dashboard/trips/${trip.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't create the trip");
      setSubmitting(false);
    }
  }

  if (step === "travelers") {
    return (
      <TravelersModal
        title={itinerary.name}
        pax={pax}
        hasInternational={itinerary.has_international}
        submitting={submitting}
        error={error}
        onPaxChange={setPax}
        onClose={onClose}
        onSubmit={create}
      />
    );
  }

  return (
    <Modal
      title="New departure"
      subtitle={`${itinerary.name} · ${itinerary.days} days`}
      onClose={onClose}
      footer={
        <>
          <span className="text-xs text-muted">Itinerary stays exactly as saved.</span>
          <button onClick={() => setStep("travelers")} disabled={pax < 1} className="rounded-md bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-strong disabled:opacity-60">
            Enter travelers →
          </button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <FieldLabel label="Start date">
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputCls} />
        </FieldLabel>
        <FieldLabel label="Number of people">
          <PaxInput value={pax} onChange={setPax} />
        </FieldLabel>
      </div>
      <label className="mt-4 flex items-center gap-2 text-sm text-muted">
        <input type="checkbox" checked={nonCo2} onChange={(e) => setNonCo2(e.target.checked)} className="h-4 w-4 accent-[var(--brand)]" />
        Include non-CO₂ warming from flights (×1.7)
      </label>
      <Card className="mt-5 p-4">
        <p className="text-xs font-medium text-muted">Itinerary</p>
        <ol className="mt-2 space-y-1.5 text-sm">
          {itinerary.legs.map((l, i) => (
            <li key={i} className="flex items-center justify-between gap-3">
              <span className="truncate">
                <span className="mr-2 text-xs text-muted">D{l.day}</span>
                {CATEGORIES[l.category].icon} {l.label}
              </span>
              <span className="shrink-0 text-xs text-muted">{l.mode === "international" && !l.origin ? "per traveler" : fmtKg(l.kg_per_person)}</span>
            </li>
          ))}
        </ol>
      </Card>
    </Modal>
  );
}

export function PaxInput({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="mt-1.5 flex items-center rounded-lg border border-border bg-white">
      <button type="button" onClick={() => onChange(Math.max(1, value - 1))} className="px-3 py-2 text-lg text-muted hover:text-brand" aria-label="Fewer">
        −
      </button>
      <input
        type="number"
        min={1}
        max={2000}
        value={value}
        onChange={(e) => onChange(Math.max(1, Math.min(2000, Number(e.target.value) || 1)))}
        className="w-full border-x border-border py-2 text-center text-sm font-semibold outline-none"
        aria-label="Number of people"
      />
      <button type="button" onClick={() => onChange(Math.min(2000, value + 1))} className="px-3 py-2 text-lg text-muted hover:text-brand" aria-label="More">
        +
      </button>
    </div>
  );
}
