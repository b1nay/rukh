"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PaxInput } from "@/components/dashboard/departure";
import { draftLeg, DraftLeg, ItineraryBuilder, startingLegs, toPayload } from "@/components/dashboard/itinerary-builder";
import { RoleOnly } from "@/components/dashboard/shell";
import { useApi } from "@/components/dashboard/session";
import { TravelersModal } from "@/components/dashboard/travelers-modal";
import { Card, ErrorNote, FieldLabel, inputCls, PageHeader } from "@/components/dashboard/ui";
import { api } from "@/lib/api";
import { CATEGORIES, fmtKg } from "@/lib/itinerary";
import type { Itinerary, Leg, LegInput, TravelerInput, TripDetail } from "@/lib/types";

function withoutKg(leg: Leg): LegInput {
  const copy: Partial<Leg> = { ...leg };
  delete copy.kg_per_person;
  return copy as LegInput;
}

const KINDS = [
  ["trek", "Trek"],
  ["tour", "Tour"],
  ["event", "Event"],
  ["business", "Business travel"],
  ["other", "Other"],
] as const;

export function View() {
  return (
    <RoleOnly side="organization">
      <NewTrip />
    </RoleOnly>
  );
}

function NewTrip() {
  const router = useRouter();
  const itineraries = useApi<Itinerary[]>("/api/v1/climate/itineraries");

  // 1. Trip basics
  const [name, setName] = useState("");
  const [kind, setKind] = useState<(typeof KINDS)[number][0]>("trek");
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [days, setDays] = useState(10);
  const [pax, setPax] = useState(10);
  const [nonCo2, setNonCo2] = useState(false);

  // 2. Itinerary: saved or new
  const [source, setSource] = useState<"saved" | "new">("new");
  const [savedId, setSavedId] = useState<number | null>(null);
  const [legs, setLegs] = useState<DraftLeg[]>(startingLegs);
  const [preview, setPreview] = useState<{ kg_per_person: number; has_international: boolean } | null>(null);

  // 3. Travelers modal
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const saved = itineraries.data?.find((i) => i.id === savedId);
  const hasInternational = source === "saved" ? !!saved?.has_international : !!preview?.has_international;

  function pickSaved(it: Itinerary) {
    setSavedId(it.id);
    setDays(it.days);
    setKind(it.kind as typeof kind);
  }

  function editCopy(it: Itinerary) {
    setSource("new");
    setLegs(it.legs.map((l) => draftLeg(withoutKg(l))));
    setDays(it.days);
    setKind(it.kind as typeof kind);
    if (!name) setName(it.name);
  }

  function next() {
    setFormError(null);
    if (source === "saved" && !saved) return setFormError("Choose a saved itinerary, or build a new one.");
    if (source === "new") {
      if (!name.trim()) return setFormError("Give the trip a name. It's also used to save the itinerary for next time.");
      if (legs.length === 0) return setFormError("Add at least one leg to the itinerary.");
      if (!preview) return setFormError("Fix the itinerary errors first.");
    }
    setOpen(true);
  }

  async function create(travelers: TravelerInput[]) {
    setSubmitting(true);
    setError(null);
    try {
      const body =
        source === "saved"
          ? { itinerary_id: savedId }
          : { itinerary: { name: name.trim(), kind, days, legs: legs.map(toPayload) } };
      const trip = await api.post<TripDetail>("/api/v1/climate/trips", {
        ...body,
        name: name.trim() || undefined,
        start_date: startDate,
        pax: travelers.length,
        include_non_co2: nonCo2,
        travelers,
      });
      // Hidden pages stay mounted, so reset for the next visit.
      setOpen(false);
      setSubmitting(false);
      setName("");
      setLegs(startingLegs());
      setSavedId(null);
      router.push(`/dashboard/trips/${trip.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't create the trip");
      setSubmitting(false);
    }
  }

  return (
    <div>
      <PageHeader title="New trip" subtitle="Set up the group, fix the itinerary, then add travelers." back={{ href: "/dashboard/trips", label: "Trips" }} />

      <Card className="p-6">
        <p className="mb-4 text-sm font-semibold">1 · Trip</p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr]">
          <FieldLabel label="Trip name">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Everest Base Camp · Spring group" className={inputCls} />
          </FieldLabel>
          <FieldLabel label="Start date">
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputCls} />
          </FieldLabel>
          <FieldLabel label="Days">
            <input type="number" min={1} max={120} value={days} onChange={(e) => setDays(Math.max(1, Number(e.target.value) || 1))} className={inputCls} disabled={source === "saved"} />
          </FieldLabel>
          <FieldLabel label="Number of people">
            <PaxInput value={pax} onChange={setPax} />
          </FieldLabel>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3">
          <div className="flex flex-wrap gap-1.5">
            {KINDS.map(([k, l]) => (
              <button
                key={k}
                type="button"
                disabled={source === "saved"}
                onClick={() => setKind(k)}
                className={`rounded-full border px-3 py-1 text-sm transition disabled:opacity-60 ${kind === k ? "border-brand bg-brand-soft text-brand" : "border-border text-muted hover:border-brand/50"}`}
              >
                {l}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-sm text-muted">
            <input type="checkbox" checked={nonCo2} onChange={(e) => setNonCo2(e.target.checked)} className="h-4 w-4 accent-[var(--brand)]" />
            Include non-CO₂ warming from flights (×1.7)
          </label>
        </div>
      </Card>

      <Card className="mt-6 p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold">2 · Itinerary</p>
          <div className="flex rounded-full border border-border bg-surface-muted p-1 text-sm">
            {(
              [
                ["new", "Build itinerary"],
                ["saved", "Use a saved one"],
              ] as const
            ).map(([s, l]) => (
              <button key={s} type="button" onClick={() => setSource(s)} className={`rounded-full px-4 py-1.5 font-medium transition ${source === s ? "bg-white text-brand shadow-sm" : "text-muted"}`}>
                {l}
              </button>
            ))}
          </div>
        </div>

        {source === "new" ? (
          <>
            <ItineraryBuilder legs={legs} onChange={setLegs} days={days} onPreview={setPreview} />
            <p className="mt-4 text-xs text-muted">This itinerary is saved, so the next departure only needs dates and travelers.</p>
          </>
        ) : !itineraries.data ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {itineraries.data.map((it) => (
              <div
                key={it.id}
                onClick={() => pickSaved(it)}
                className={`cursor-pointer rounded-xl border p-4 transition ${savedId === it.id ? "border-brand bg-brand-soft/40 ring-1 ring-brand/30" : "border-border hover:border-brand/50"}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium">{it.name}</p>
                  <span className="text-xs text-muted">{it.is_template ? "Starter" : `Used ${it.times_used}×`}</span>
                </div>
                <p className="mt-1 text-xs text-muted">
                  {it.days} days · {it.legs.map((l) => CATEGORIES[l.category].icon).join(" ")}
                </p>
                <div className="mt-2 flex items-center justify-between text-xs">
                  <span className="text-muted">In Nepal {fmtKg(it.kg_per_person)} / person</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      editCopy(it);
                    }}
                    className="font-medium text-brand"
                  >
                    Edit a copy
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-muted">
          {source === "new" && preview ? (
            <>
              In Nepal <span className="font-semibold text-foreground">{fmtKg(preview.kg_per_person)}</span> per person × {pax} people
              {preview.has_international && " + each traveler's flight"}
            </>
          ) : source === "saved" && saved ? (
            <>
              {saved.name} · {pax} people
            </>
          ) : null}
        </p>
        <button onClick={next} className="rounded-md bg-brand px-6 py-2.5 text-sm font-medium text-white hover:bg-brand-strong">
          3 · Enter travelers →
        </button>
      </div>
      {formError && <div className="mt-4"><ErrorNote message={formError} /></div>}

      {open && (
        <TravelersModal
          title={name.trim() || saved?.name || "New trip"}
          pax={pax}
          hasInternational={hasInternational}
          submitting={submitting}
          error={error}
          onPaxChange={setPax}
          onClose={() => setOpen(false)}
          onSubmit={create}
        />
      )}
    </div>
  );
}
