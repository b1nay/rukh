"use client";

import { useEffect, useEffectEvent, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { CATEGORIES, CATEGORY_ORDER, fmtHours, fmtKg, SHARE_LABEL } from "@/lib/itinerary";
import type { Leg, LegCategory, LegInput, LegMode, MajorRoute, NepalAirport } from "@/lib/types";
import { useApi } from "./session";
const cell =
  "rounded-lg border border-border bg-white px-2.5 py-1.5 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/15";

export type DraftLeg = LegInput & { uid: number };

let nextUid = 1;
export const draftLeg = (leg: LegInput): DraftLeg => ({ ...leg, uid: nextUid++ });

/** The default first leg: everyone's international flight into Kathmandu. */
export const startingLegs = (): DraftLeg[] => [
  draftLeg({ category: "flight", mode: "international", day: 1, destination: "KTM", round_trip: true, label: "International flight to Kathmandu (return)" }),
];

type Preview = { legs: Leg[]; kg_per_person: number; has_international: boolean };

export function ItineraryBuilder({
  legs,
  onChange,
  days,
  onPreview,
}: {
  legs: DraftLeg[];
  onChange: (legs: DraftLeg[]) => void;
  days: number;
  onPreview?: (p: Preview | null) => void;
}) {
  const modes = useApi<LegMode[]>("/api/v1/leg-modes");
  const nepal = useApi<NepalAirport[]>("/api/v1/airports/nepal");
  const routes = useApi<MajorRoute[]>("/api/v1/routes");
  const places = { nepal: nepal.data ?? [], routes: routes.data ?? [] };
  const byCategory = useMemo(() => {
    const m = new Map<LegCategory, LegMode[]>();
    modes.data?.forEach((x) => m.set(x.category, [...(m.get(x.category) ?? []), x]));
    return m;
  }, [modes.data]);
  const modeOf = (l: LegInput) => modes.data?.find((m) => m.category === l.category && m.mode === l.mode);

  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const reportPreview = useEffectEvent((p: Preview | null) => onPreview?.(p));

  // Live CO2 per leg from the backend (single source of truth for factors).
  useEffect(() => {
    const t = setTimeout(() => {
      api
        .post<Preview>("/api/v1/climate/legs/preview", { legs: legs.map(toPayload) })
        .then((p) => {
          setPreview(p);
          setPreviewError(null);
          reportPreview(p);
        })
        .catch((e) => {
          setPreviewError(e instanceof Error ? e.message : "Couldn't calculate");
          reportPreview(null);
        });
    }, 350);
    return () => clearTimeout(t);
  }, [legs]);

  const update = (uid: number, patch: Partial<LegInput>) => onChange(legs.map((l) => (l.uid === uid ? { ...l, ...patch } : l)));
  const remove = (uid: number) => onChange(legs.filter((l) => l.uid !== uid));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= legs.length) return;
    const next = [...legs];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  function add(category: LegCategory) {
    const first = byCategory.get(category)?.find((m) => !(category === "flight" && m.mode === "international" && legs.some((l) => l.mode === "international")));
    if (!first) return;
    const lastDay = legs.at(-1)?.day ?? 1;
    const leg: LegInput = { category, mode: first.mode, day: Math.min(lastDay, days || lastDay) };
    if (first.basis === "pkm" && category === "flight") Object.assign(leg, { origin: "KTM", destination: "PKR" });
    if (first.basis === "vkm" || first.basis === "pkm") leg.distance_km = 10;
    if (first.basis === "room_night") leg.nights = 1;
    if (first.basis === "hour_shared") leg.hours = 1;
    if (first.default_share) leg.share = first.default_share;
    onChange([...legs, draftLeg(leg)]);
  }

  return (
    <div>
      <ol className="space-y-3">
        {legs.map((leg, i) => {
          const spec = modeOf(leg);
          const kg = preview?.legs[i]?.kg_per_person;
          return (
            <li key={leg.uid} className="rounded-xl border border-border bg-white p-4">
              <div className="grid grid-cols-[36px_64px_1fr_auto] items-center gap-2 sm:grid-cols-[36px_64px_190px_1fr_88px_auto] sm:gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-surface-muted text-lg">{CATEGORIES[leg.category].icon}</span>
                <label className="flex items-center gap-1 text-xs text-muted">
                  D
                  <input
                    type="number"
                    min={1}
                    max={days || 120}
                    value={leg.day}
                    onChange={(e) => update(leg.uid, { day: Math.max(1, Number(e.target.value) || 1) })}
                    className={`${cell} w-12 px-1.5 text-center`}
                    aria-label="Day"
                  />
                </label>
                <select
                  value={leg.mode}
                  onChange={(e) => {
                    const m = byCategory.get(leg.category)?.find((x) => x.mode === e.target.value);
                    update(leg.uid, { mode: e.target.value, share: m?.default_share ?? undefined });
                  }}
                  className={`${cell} min-w-0`}
                  aria-label="Type"
                >
                  {byCategory.get(leg.category)?.map((m) => (
                    <option key={m.mode} value={m.mode} disabled={m.mode === "international" && leg.mode !== "international" && legs.some((l) => l.mode === "international")}>
                      {m.label}
                    </option>
                  ))}
                </select>
                <div className="flex items-center gap-0.5 text-muted sm:order-last">
                  <IconBtn label="Move up" onClick={() => move(i, -1)} disabled={i === 0}>↑</IconBtn>
                  <IconBtn label="Move down" onClick={() => move(i, 1)} disabled={i === legs.length - 1}>↓</IconBtn>
                  <IconBtn label="Remove" onClick={() => remove(leg.uid)}>×</IconBtn>
                </div>
                <input
                  value={leg.label ?? ""}
                  onChange={(e) => update(leg.uid, { label: e.target.value })}
                  placeholder="Label, e.g. Kathmandu to Pokhara"
                  className={`${cell} col-span-3 min-w-0 sm:col-span-1`}
                />
                <span className="text-right text-sm font-semibold tabular-nums">
                  {spec?.basis === "per_traveler" && !leg.origin ? (
                    <span className="text-xs font-normal text-muted">per traveler</span>
                  ) : kg === undefined ? "…" : fmtKg(kg)}
                </span>
              </div>
              {spec && <LegParams leg={leg} spec={spec} places={places} onChange={(p) => update(leg.uid, p)} />}
            </li>
          );
        })}
      </ol>

      <div className="mt-4">
        <p className="mb-2 text-xs font-medium text-muted">Add to itinerary</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {CATEGORY_ORDER.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => add(c)}
              className="card-tint flex items-center gap-3 rounded-xl border border-border px-3 py-2.5 text-left transition hover:border-brand"
            >
              <span className="text-lg">{CATEGORIES[c].icon}</span>
              <span>
                <span className="block text-sm font-medium">+ {CATEGORIES[c].label}</span>
                <span className="block text-[11px] leading-tight text-muted">{CATEGORIES[c].hint}</span>
              </span>
            </button>
          ))}
        </div>
      </div>

      {previewError && <p className="mt-3 rounded-lg bg-red-50 p-2.5 text-sm text-red-700">{previewError}</p>}
    </div>
  );
}

type Places = { nepal: NepalAirport[]; routes: MajorRoute[] };

function LegParams({
  leg,
  spec,
  places,
  onChange,
}: {
  leg: LegInput;
  spec: LegMode;
  places: Places;
  onChange: (p: Partial<LegInput>) => void;
}) {
  const num = (v: string) => (v === "" ? undefined : Number(v));
  const fields: React.ReactNode[] = [];

  if (spec.basis === "per_traveler") {
    const route = leg.origin && (leg.destination ?? "KTM") === "KTM" ? places.routes.find((r) => r.code === leg.origin) : undefined;
    fields.push(
      <label key="o" className="flex items-center gap-2 text-xs text-muted">
        From
        <select value={leg.origin ?? ""} onChange={(e) => onChange({ origin: e.target.value || undefined })} className={`${cell} w-60`}>
          <option value="">Each traveler&apos;s home airport</option>
          <optgroup label="Whole group from">
            {places.routes.map((r) => (
              <option key={r.code} value={r.code}>
                {r.city} ({r.code})
              </option>
            ))}
          </optgroup>
        </select>
      </label>,
      <label key="d" className="flex items-center gap-2 text-xs text-muted">
        To
        <select value={leg.destination ?? "KTM"} onChange={(e) => onChange({ destination: e.target.value })} className={`${cell} w-52`}>
          {places.nepal
            .filter((a) => a.international)
            .map((a) => (
              <option key={a.code} value={a.code}>
                {a.city} ({a.code})
              </option>
            ))}
        </select>
      </label>,
      <label key="rt" className="flex items-center gap-1.5 text-xs text-muted">
        <input type="checkbox" checked={leg.round_trip ?? true} onChange={(e) => onChange({ round_trip: e.target.checked })} className="accent-[var(--brand)]" />
        Return flight
      </label>,
    );
    if (route) {
      fields.push(
        <span key="r" className="w-full text-[11px] text-muted">
          {[route.code, ...route.via, "KTM"].join(" → ")} · {route.km_one_way.toLocaleString()} km · {fmtHours(route.hours_one_way)} each way
          {route.via.length ? " incl. layover" : ""} · {route.carrier}
        </span>,
      );
    } else if (leg.origin) {
      fields.push(<span key="r" className="w-full text-[11px] text-muted">No saved route to this airport: estimated as a direct flight.</span>);
    }
  }
  if (spec.basis === "pkm" && leg.category === "flight") {
    fields.push(
      <AirportSelect key="o" label="From" airports={places.nepal} value={leg.origin} onChange={(v) => onChange({ origin: v })} />,
      <AirportSelect key="d" label="To" airports={places.nepal} value={leg.destination} onChange={(v) => onChange({ destination: v })} />,
    );
  }
  if (spec.basis === "fixed_km") fields.push(<span key="f" className="text-xs text-muted">About 1 hour loop · fixed per person</span>);
  if (spec.basis === "vkm" || (spec.basis === "pkm" && leg.category !== "flight") || spec.basis === "zero") {
    fields.push(<Num key="km" label="Distance (km)" value={leg.distance_km} onChange={(v) => onChange({ distance_km: num(v) })} />);
  }
  if (spec.basis === "hour_shared") fields.push(<Num key="h" label="Flight hours" step="0.1" value={leg.hours} onChange={(v) => onChange({ hours: num(v) })} />);
  if (spec.basis === "room_night") fields.push(<Num key="n" label="Nights" value={leg.nights} onChange={(v) => onChange({ nights: num(v) })} />);
  if (SHARE_LABEL[spec.basis]) {
    fields.push(<Num key="s" label={SHARE_LABEL[spec.basis]!} value={leg.share} onChange={(v) => onChange({ share: num(v) })} />);
  }
  if (spec.basis === "zero") fields.push(<span key="z" className="text-xs text-brand">No emissions 🌿</span>);
  if (spec.basis === "per_person") fields.push(<span key="p" className="text-xs text-muted">Fixed per person</span>);

  return <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 sm:pl-[52px]">{fields}</div>;
}

function Num({ label, value, onChange, step }: { label: string; value?: number; onChange: (v: string) => void; step?: string }) {
  return (
    <label className="flex items-center gap-2 text-xs text-muted">
      {label}
      <input type="number" min={0} step={step ?? "any"} value={value ?? ""} onChange={(e) => onChange(e.target.value)} className={`${cell} w-20`} />
    </label>
  );
}

function AirportSelect({
  label,
  airports,
  value,
  onChange,
}: {
  label: string;
  airports: NepalAirport[];
  value?: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-xs text-muted">
      {label}
      <select value={value ?? ""} onChange={(e) => onChange(e.target.value)} className={`${cell} w-52`}>
        {airports.map((a) => (
          <option key={a.code} value={a.code}>
            {a.city} ({a.code})
          </option>
        ))}
      </select>
    </label>
  );
}

function IconBtn({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" aria-label={label} onClick={onClick} disabled={disabled} className="grid h-7 w-7 place-items-center rounded-md hover:bg-surface-muted hover:text-foreground disabled:opacity-25">
      {children}
    </button>
  );
}

export function toPayload({ uid: _uid, ...leg }: DraftLeg): LegInput {
  void _uid;
  return Object.fromEntries(Object.entries(leg).filter(([, v]) => v !== undefined && v !== "")) as LegInput;
}
