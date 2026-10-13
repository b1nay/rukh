"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { RoleOnly } from "@/components/dashboard/shell";
import { useApi } from "@/components/dashboard/session";
import { Card, ErrorNote, FieldLabel, inputCls, PageHeader } from "@/components/dashboard/ui";
import { api } from "@/lib/api";
import { BUFFER_SHARE, FARMER_SHARE, IMPACT_TYPES } from "@/lib/content";
import { fmtSol, fmtT } from "@/lib/format";
import { DISTRICT_OPTIONS } from "@/lib/signup-fields";
import type { Field, Species } from "@/lib/types";

// Hectares per local land unit
const UNITS = { Ropani: 0.050872, Bigha: 0.677263, Kattha: 0.033863, Hectare: 1 } as const;
type Unit = keyof typeof UNITS;
const PLANTING_DENSITY_PER_HA = 400;
const NEW_TREE_LIFETIME_T = 0.5;

// Mirrors backend/app/services/sequestration.py age_factor
function ageFactor(age: number) {
  if (age < 8) return Math.max(0.15, (age + 1) / 9);
  return age > 40 ? 0.6 : 1;
}

export function View() {
  return (
    <RoleOnly side="landowner">
      <NewField />
    </RoleOnly>
  );
}

function NewField() {
  const router = useRouter();
  const species = useApi<Species[]>("/api/v1/species");
  const [kind, setKind] = useState<"existing" | "planting">("existing");
  const [name, setName] = useState("");
  const [district, setDistrict] = useState("");
  const [area, setArea] = useState("");
  const [unit, setUnit] = useState<Unit>("Ropani");
  const [speciesId, setSpeciesId] = useState("utis");
  const [trees, setTrees] = useState("");
  const [age, setAge] = useState("10");
  const [height, setHeight] = useState("");
  const [dbh, setDbh] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const areaHa = Number(area) * UNITS[unit] || 0;
  const rate = species.data?.find((s) => s.id === speciesId)?.kg_per_year ?? 0;
  const treeCount = Number(trees) || (kind === "planting" ? Math.round(areaHa * PLANTING_DENSITY_PER_HA) : 0);

  const yearlyT = kind === "existing" ? (treeCount * rate * ageFactor(Number(age) || 0) * (1 - BUFFER_SHARE)) / 1000 : 0;
  const estimateSol =
    kind === "existing"
      ? yearlyT * IMPACT_TYPES.protect.pricePerTonne * FARMER_SHARE
      : treeCount * NEW_TREE_LIFETIME_T * IMPACT_TYPES.plant.pricePerTonne * FARMER_SHARE;

  function locate() {
    if (!navigator.geolocation) {
      setError("Location isn't available on this device.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setCoords({ lat: +p.coords.latitude.toFixed(5), lon: +p.coords.longitude.toFixed(5) });
        setLocating(false);
      },
      () => {
        setError("Couldn't get your location. You can skip this for now.");
        setLocating(false);
      },
    );
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (areaHa <= 0) {
      setError("Enter the land area.");
      return;
    }
    setSaving(true);
    try {
      await api.post<Field>("/api/v1/land/fields", {
        name,
        kind,
        district,
        area_ha: +areaHa.toFixed(4),
        species: speciesId,
        tree_count: trees ? Number(trees) : kind === "planting" ? null : undefined,
        tree_age_years: kind === "existing" ? Number(age) || 0 : 0,
        height_m: kind === "existing" && height ? Number(height) : null,
        dbh_cm: kind === "existing" && height && dbh ? Number(dbh) : null,
        latitude: coords?.lat ?? null,
        longitude: coords?.lon ?? null,
      });
      // The page stays mounted when hidden, so clear the form for the next visit.
      setName("");
      setArea("");
      setTrees("");
      setHeight("");
      setDbh("");
      setCoords(null);
      setSaving(false);
      router.push("/dashboard/fields");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the field");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <PageHeader title="Add a field" subtitle="Tell us about one plot of land. You can add more later." back={{ href: "/dashboard/fields", label: "My fields" }} />

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2">
            {(
              [
                ["existing", "🌳", "Trees already growing", "Get paid each year to keep them standing"],
                ["planting", "🌱", "Land for new trees", "Host new trees planted for Climate Partners"],
              ] as const
            ).map(([k, icon, title, body]) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className={`card-tint rounded-2xl border p-5 text-left transition ${kind === k ? "border-brand ring-1 ring-brand/30" : "border-border hover:border-brand/50"}`}
              >
                <span className="text-2xl">{icon}</span>
                <p className="mt-2 font-semibold">{title}</p>
                <p className="text-xs text-muted">{body}</p>
              </button>
            ))}
          </div>

          <Card className="p-6">
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <FieldLabel label="Field name">
                  <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Upper terrace" className={inputCls} />
                </FieldLabel>
              </div>
              <FieldLabel label="District">
                <select required value={district} onChange={(e) => setDistrict(e.target.value)} className={inputCls}>
                  <option value="" disabled>Select…</option>
                  {DISTRICT_OPTIONS.map((d) => <option key={d}>{d}</option>)}
                </select>
              </FieldLabel>
              <FieldLabel label="Land area">
                <div className="flex gap-2">
                  <input required type="number" min={0} step="any" value={area} onChange={(e) => setArea(e.target.value)} className={inputCls} />
                  <select value={unit} onChange={(e) => setUnit(e.target.value as Unit)} className={`${inputCls} w-32`}>
                    {Object.keys(UNITS).map((u) => <option key={u}>{u}</option>)}
                  </select>
                </div>
              </FieldLabel>
              <FieldLabel label={kind === "existing" ? "Tree species" : "Species to plant"}>
                <select value={speciesId} onChange={(e) => setSpeciesId(e.target.value)} className={inputCls}>
                  {species.data?.filter((s) => kind === "existing" || s.id !== "tea").map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </FieldLabel>
              <FieldLabel label={kind === "existing" ? "Number of trees" : "Trees to plant"} hint={kind === "planting" ? "Optional" : undefined}>
                <input
                  required={kind === "existing"}
                  type="number"
                  min={1}
                  value={trees}
                  onChange={(e) => setTrees(e.target.value)}
                  placeholder={kind === "planting" && areaHa > 0 ? `About ${Math.round(areaHa * PLANTING_DENSITY_PER_HA)}` : ""}
                  className={inputCls}
                />
              </FieldLabel>
              {kind === "existing" && (
                <FieldLabel label="Average tree age (years)">
                  <input type="number" min={0} max={300} value={age} onChange={(e) => setAge(e.target.value)} className={inputCls} />
                </FieldLabel>
              )}
              {kind === "existing" && (
                <FieldLabel label="Average height (m)" hint="Optional">
                  <input type="number" min={0.1} max={90} step="0.1" value={height} onChange={(e) => setHeight(e.target.value)} className={inputCls} />
                </FieldLabel>
              )}
              {kind === "existing" && (
                <FieldLabel label="Average trunk width (cm)" hint="At chest height, optional">
                  <input type="number" min={0.1} max={500} step="0.1" value={dbh} onChange={(e) => setDbh(e.target.value)} className={inputCls} />
                </FieldLabel>
              )}
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-surface-muted p-4">
              <div className="text-sm">
                <p className="font-medium">Field location</p>
                <p className="text-xs text-muted">
                  {coords ? `${coords.lat}, ${coords.lon}` : "Stand on your field and tap the button, or skip for now."}
                </p>
              </div>
              <button type="button" onClick={locate} disabled={locating} className="rounded-md border border-border bg-white px-3 py-2 text-sm font-medium hover:border-brand hover:text-brand">
                {locating ? "Locating…" : coords ? "Update location" : "📍 Use my location"}
              </button>
            </div>
          </Card>
        </div>

        <aside className="h-fit lg:sticky lg:top-8">
          <Card tint className="p-6">
            <p className="text-sm text-muted">Estimated earnings</p>
            <p className="mt-1 text-3xl font-semibold text-brand">{fmtSol(estimateSol)}</p>
            <p className="text-xs text-muted">{kind === "existing" ? "per year, if fully sold" : "over the 30-year commitment"}</p>
            <dl className="mt-5 space-y-2 border-t border-border pt-4 text-sm">
              <Row k="Area" v={`${areaHa.toFixed(2)} ha`} />
              <Row k={kind === "existing" ? "Trees" : "New trees"} v={treeCount.toLocaleString()} />
              {kind === "existing" ? (
                <Row k="Sellable CO₂ / year" v={fmtT(yearlyT)} />
              ) : (
                <Row k="CO₂ over 30 years" v={fmtT(treeCount * NEW_TREE_LIFETIME_T)} />
              )}
              <Row k="Your share" v={`${FARMER_SHARE * 100}%`} />
            </dl>
            <p className="mt-4 text-xs text-muted">
              {BUFFER_SHARE * 100}% of capacity is held back as a safety buffer. Fields are checked by satellite before trees are sold.
            </p>
          </Card>
          {error && <div className="mt-4"><ErrorNote message={error} /></div>}
          <button type="submit" disabled={saving} className="mt-4 w-full rounded-md bg-brand px-6 py-2.5 text-sm font-medium text-white hover:bg-brand-strong disabled:opacity-60">
            {saving ? "Saving…" : "Add field"}
          </button>
        </aside>
      </div>
    </form>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-muted">{k}</dt>
      <dd className="font-medium">{v}</dd>
    </div>
  );
}
