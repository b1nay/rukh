"use client";

import { useMemo, useState } from "react";
import { CABINS, csvToTravelers, downloadCsv, fmtHours, fmtKg, travelersToCsv } from "@/lib/itinerary";
import type { Airport, Cabin, MajorRoute, TravelerInput } from "@/lib/types";
import { Modal } from "./modal";
import { useApi } from "./session";
import { ErrorNote, FieldLabel, inputCls } from "./ui";

type Mode = "same" | "each" | "csv";

const blank = (): TravelerInput => ({ name: "", email: "", phone: "", nationality: "", home_airport: "", cabin: "economy" });

/**
 * Collects details for every traveler on a trip: the same details for everyone,
 * one by one, or from a CSV file.
 */
export function TravelersModal({
  pax,
  hasInternational,
  title,
  submitting,
  error,
  onPaxChange,
  onClose,
  onSubmit,
}: {
  pax: number;
  hasInternational: boolean;
  title: string;
  submitting: boolean;
  error: string | null;
  onPaxChange: (n: number) => void;
  onClose: () => void;
  onSubmit: (travelers: TravelerInput[]) => void;
}) {
  const airports = useApi<Airport[]>("/api/v1/airports");
  const routes = useApi<MajorRoute[]>("/api/v1/routes");
  const airportCodes = useMemo(() => new Set(airports.data?.map((a) => a.code) ?? []), [airports.data]);
  const [mode, setMode] = useState<Mode>(pax > 6 ? "same" : "each");

  // Same for everyone
  const [same, setSame] = useState({ names: "", nationality: "", home_airport: "", cabin: "economy" as Cabin, email: "" });
  // Commas or new lines separate people.
  const sameNames = same.names.split(/[,\n]/).map((n) => n.trim()).filter(Boolean);

  // One by one
  const [rows, setRows] = useState<TravelerInput[]>(() => Array.from({ length: pax }, blank));
  const [index, setIndex] = useState(0);
  const list = rows.length === pax ? rows : resize(rows, pax);
  const current = list[Math.min(index, pax - 1)];

  // CSV
  const [csvRows, setCsvRows] = useState<TravelerInput[] | null>(null);
  const [csvErrors, setCsvErrors] = useState<string[]>([]);
  const [localError, setLocalError] = useState<string | null>(null);

  function update(patch: Partial<TravelerInput>) {
    setRows(list.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function goTo(i: number) {
    // Carry airport, cabin and nationality forward so groups fill in faster.
    if (i > index && !list[i].name && !list[i].home_airport) {
      const prev = list[index];
      setRows(list.map((r, j) => (j === i ? { ...r, home_airport: prev.home_airport, cabin: prev.cabin, nationality: prev.nationality } : r)));
    }
    setIndex(i);
  }

  async function onFile(file: File) {
    const result = csvToTravelers(await file.text(), airportCodes);
    setCsvRows(result.rows);
    setCsvErrors(result.errors);
  }

  function airportError(code?: string) {
    return code && airportCodes.size > 0 && !airportCodes.has(code) ? `Unknown airport ${code}` : null;
  }

  function submit() {
    setLocalError(null);
    let travelers: TravelerInput[];
    if (mode === "same") {
      if (hasInternational && !same.home_airport) return setLocalError("Choose the home airport for the group.");
      if (sameNames.length > pax)
        return setLocalError(`You entered ${sameNames.length} names for ${pax} travelers. Remove some or change the group size.`);
      const err = airportError(same.home_airport);
      if (err) return setLocalError(err);
      travelers = Array.from({ length: pax }, (_, i) => ({
        name: sameNames[i] ?? `Traveler ${i + 1}`,
        email: i === 0 ? same.email : "",
        nationality: same.nationality,
        home_airport: same.home_airport,
        cabin: same.cabin,
      }));
    } else if (mode === "each") {
      const missing = list.findIndex((r) => !r.name.trim() || (hasInternational && !r.home_airport));
      if (missing !== -1) {
        setIndex(missing);
        return setLocalError(`Traveler ${missing + 1}: enter a name${hasInternational ? " and home airport" : ""}.`);
      }
      const bad = list.findIndex((r) => airportError(r.home_airport));
      if (bad !== -1) {
        setIndex(bad);
        return setLocalError(`Traveler ${bad + 1}: ${airportError(list[bad].home_airport)}`);
      }
      travelers = list;
    } else {
      if (!csvRows) return setLocalError("Upload a CSV file first.");
      if (csvErrors.length) return setLocalError("Fix the errors in the CSV and upload it again.");
      if (csvRows.length !== pax) return setLocalError(`The CSV has ${csvRows.length} travelers, but the trip is for ${pax}.`);
      travelers = csvRows;
    }
    onSubmit(travelers.map(clean));
  }

  const tabs: [Mode, string][] = [
    ["same", "Same for everyone"],
    ["each", "One by one"],
    ["csv", "CSV upload"],
  ];

  return (
    <Modal
      wide
      title={title}
      subtitle={`${pax} traveler${pax === 1 ? "" : "s"} · enter their details`}
      onClose={onClose}
      footer={
        <>
          <span className="text-xs text-muted">
            {hasInternational ? "Each traveler's flight is calculated from their home airport." : "This itinerary has no international flight."}
          </span>
          <button
            onClick={submit}
            disabled={submitting}
            className="rounded-md bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-strong disabled:opacity-60"
          >
            {submitting ? "Creating trip…" : "Create trip →"}
          </button>
        </>
      }
    >
      <div className="mb-5 flex rounded-full border border-border bg-surface-muted p-1 text-sm">
        {tabs.map(([m, label]) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`flex-1 rounded-full px-3 py-1.5 font-medium transition ${mode === m ? "bg-white text-brand shadow-sm" : "text-muted hover:text-foreground"}`}
          >
            {label}
          </button>
        ))}
      </div>

      <datalist id="airport-list">
        {airports.data?.map((a) => (
          <option key={a.code} value={a.code}>{`${a.city} · ${a.name}`}</option>
        ))}
      </datalist>

      {mode === "same" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <FieldLabel label="Traveler names" hint={`${Math.min(sameNames.length, pax)} of ${pax} named · separate with commas`}>
              <textarea
                rows={2}
                value={same.names}
                onChange={(e) => setSame({ ...same, names: e.target.value })}
                placeholder="Rohan Khatri, Binayak Karki, Ramesh Parajuli"
                className={`${inputCls} resize-y`}
              />
            </FieldLabel>
            {sameNames.length > pax ? (
              <p className="mt-1.5 flex items-center gap-2 text-xs text-red-600">
                {sameNames.length} names for {pax} travelers.
                <button type="button" onClick={() => onPaxChange(sameNames.length)} className="font-medium text-brand">
                  Change group size to {sameNames.length}
                </button>
              </p>
            ) : (
              sameNames.length < pax && (
                <p className="mt-1.5 text-xs text-muted">
                  {sameNames.length === 0 ? "Optional. " : ""}Unnamed travelers are listed as Traveler {sameNames.length + 1}
                  {pax - sameNames.length > 1 ? `–${pax}` : ""}.
                </p>
              )
            )}
          </div>
          <FieldLabel label="Group contact email" hint="Optional">
            <input type="email" value={same.email} onChange={(e) => setSame({ ...same, email: e.target.value })} className={inputCls} />
          </FieldLabel>
          <FieldLabel label="Home airport">
            <HomeAirport routes={routes.data} value={same.home_airport} onChange={(v) => setSame({ ...same, home_airport: v })} />
          </FieldLabel>
          <FieldLabel label="Cabin">
            <CabinSelect value={same.cabin} onChange={(v) => setSame({ ...same, cabin: v })} />
          </FieldLabel>
          <FieldLabel label="Nationality" hint="Optional">
            <input value={same.nationality} onChange={(e) => setSame({ ...same, nationality: e.target.value })} className={inputCls} />
          </FieldLabel>
          <p className="self-end rounded-xl bg-brand-soft p-3 text-xs text-brand-strong sm:col-span-1">
            Quickest for groups. You can add names later from the trip page.
          </p>
        </div>
      )}

      {mode === "each" && current && (
        <div>
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm font-medium">
              Traveler {index + 1} <span className="text-muted">of {pax}</span>
            </p>
            <div className="flex gap-1 overflow-x-auto">
              {list.map((r, i) => (
                <button
                  key={i}
                  onClick={() => goTo(i)}
                  aria-label={`Traveler ${i + 1}`}
                  className={`h-2.5 w-2.5 shrink-0 rounded-full ${i === index ? "bg-brand" : r.name ? "bg-mint" : "bg-border"}`}
                />
              ))}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <FieldLabel label="Full name">
              <input autoFocus value={current.name} onChange={(e) => update({ name: e.target.value })} className={inputCls} />
            </FieldLabel>
            <FieldLabel label="Email" hint="For their tree certificate">
              <input type="email" value={current.email} onChange={(e) => update({ email: e.target.value })} className={inputCls} />
            </FieldLabel>
            <FieldLabel label="Home airport">
              <HomeAirport routes={routes.data} value={current.home_airport ?? ""} onChange={(v) => update({ home_airport: v })} />
            </FieldLabel>
            <FieldLabel label="Cabin">
              <CabinSelect value={current.cabin} onChange={(v) => update({ cabin: v })} />
            </FieldLabel>
            <FieldLabel label="Nationality" hint="Optional">
              <input value={current.nationality} onChange={(e) => update({ nationality: e.target.value })} className={inputCls} />
            </FieldLabel>
            <FieldLabel label="Phone" hint="Optional">
              <input type="tel" value={current.phone} onChange={(e) => update({ phone: e.target.value })} className={inputCls} />
            </FieldLabel>
          </div>
          <div className="mt-5 flex justify-between">
            <button disabled={index === 0} onClick={() => goTo(index - 1)} className="text-sm font-medium text-muted hover:text-foreground disabled:opacity-30">
              ← Previous
            </button>
            <button disabled={index === pax - 1} onClick={() => goTo(index + 1)} className="text-sm font-medium text-brand disabled:opacity-30">
              Next traveler →
            </button>
          </div>
        </div>
      )}

      {mode === "csv" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-border p-4">
            <div className="text-sm">
              <p className="font-medium">Start from our template</p>
              <p className="text-xs text-muted">Columns: name, email, phone, nationality, home_airport, cabin</p>
            </div>
            <button
              onClick={() =>
                downloadCsv(
                  "rukh-travelers.csv",
                  travelersToCsv(Array.from({ length: pax }, (_, i) => ({ name: `Traveler ${i + 1}`, home_airport: "LHR", cabin: "economy" }))),
                )
              }
              className="rounded-md border border-border bg-white px-3 py-2 text-sm font-medium hover:border-brand hover:text-brand"
            >
              ↓ Download template
            </button>
          </div>

          <label className="card-tint flex cursor-pointer flex-col items-center rounded-xl border border-border px-4 py-8 text-center hover:border-brand">
            <span className="text-2xl">📄</span>
            <span className="mt-2 text-sm font-medium">Upload your CSV</span>
            <span className="text-xs text-muted">Your own file works too, as long as it has a name column</span>
            <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
          </label>

          {csvErrors.length > 0 && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <p className="font-medium">{csvErrors.length} problem{csvErrors.length === 1 ? "" : "s"} found</p>
              <ul className="mt-1 list-inside list-disc text-xs">
                {csvErrors.slice(0, 6).map((e) => <li key={e}>{e}</li>)}
              </ul>
            </div>
          )}

          {csvRows && csvRows.length > 0 && (
            <div>
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="font-medium">{csvRows.length} travelers found</span>
                {csvRows.length !== pax && (
                  <button onClick={() => onPaxChange(csvRows.length)} className="text-xs font-medium text-brand">
                    Change group size to {csvRows.length}
                  </button>
                )}
              </div>
              <div className="max-h-48 overflow-y-auto rounded-xl border border-border text-xs">
                {csvRows.map((r, i) => (
                  <div key={i} className="flex justify-between border-b border-border px-3 py-2 last:border-0">
                    <span>{r.name}</span>
                    <span className="text-muted">{[r.home_airport, r.cabin.replace("_", " "), r.nationality].filter(Boolean).join(" · ")}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {(localError || error) && <div className="mt-4"><ErrorNote message={(localError || error)!} /></div>}
    </Modal>
  );
}

function resize(rows: TravelerInput[], n: number) {
  return rows.length >= n ? rows.slice(0, n) : [...rows, ...Array.from({ length: n - rows.length }, blank)];
}

function clean(t: TravelerInput): TravelerInput {
  return {
    name: t.name.trim(),
    email: t.email?.trim() || undefined,
    phone: t.phone?.trim() || undefined,
    nationality: t.nationality?.trim() || undefined,
    home_airport: t.home_airport?.trim().toUpperCase() || undefined,
    cabin: t.cabin,
  };
}

const OTHER = "__other";

/** The 10 major airports with saved routes, or any other airport (direct estimate). */
function HomeAirport({ routes, value, onChange }: { routes: MajorRoute[] | null; value: string; onChange: (v: string) => void }) {
  const known = routes?.find((r) => r.code === value);
  const [other, setOther] = useState(!!value && !known && !!routes);
  const showOther = other || (!!value && !!routes && !known);

  return (
    <div>
      <select
        value={showOther ? OTHER : value}
        onChange={(e) => {
          if (e.target.value === OTHER) {
            setOther(true);
            onChange("");
          } else {
            setOther(false);
            onChange(e.target.value);
          }
        }}
        className={inputCls}
      >
        <option value="" disabled>Select…</option>
        {routes?.map((r) => (
          <option key={r.code} value={r.code}>
            {r.city} ({r.code}){r.via.length ? ` · via ${r.via.join(", ")}` : " · direct"}
          </option>
        ))}
        <option value={OTHER}>Other airport…</option>
      </select>
      {showOther && <div className="mt-2"><AirportInput value={value} onChange={onChange} /></div>}
      {known ? (
        <p className="mt-1.5 text-[11px] leading-snug text-muted">
          {[known.code, ...known.via, "KTM"].join(" → ")} · {known.km_one_way.toLocaleString()} km · {fmtHours(known.hours_one_way)}
          {known.via.length ? " incl. layover" : ""} · {fmtKg(known.kg_round_trip_economy)} return in economy
        </p>
      ) : (
        showOther && value.length === 3 && <p className="mt-1.5 text-[11px] text-muted">No saved route: estimated as a direct flight.</p>
      )}
    </div>
  );
}

function AirportInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      list="airport-list"
      maxLength={3}
      placeholder="LHR"
      value={value}
      onChange={(e) => onChange(e.target.value.toUpperCase())}
      className={`${inputCls} font-mono uppercase`}
    />
  );
}

function CabinSelect({ value, onChange }: { value: Cabin; onChange: (v: Cabin) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value as Cabin)} className={inputCls}>
      {CABINS.map(([v, l]) => (
        <option key={v} value={v}>{l}</option>
      ))}
    </select>
  );
}
