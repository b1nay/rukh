"use client";

import { useParams } from "next/navigation";
import { FormEvent, useState } from "react";
import { Modal } from "@/components/dashboard/modal";
import { RoleOnly } from "@/components/dashboard/shell";
import { useApi } from "@/components/dashboard/session";
import { Badge, Card, ErrorNote, FieldLabel, inputCls, Loading, Meter, PageHeader, StatCard } from "@/components/dashboard/ui";
import { api } from "@/lib/api";
import { BUFFER_SHARE } from "@/lib/content";
import { fmtDate, fmtNpr, fmtT, osmLink } from "@/lib/format";
import type { FieldDetail, Species, TreeGroup, TreeGroupInput } from "@/lib/types";

const SPANS = [5, 10, 20, 30] as const;

export function View() {
  return (
    <RoleOnly side="landowner">
      <FieldPage />
    </RoleOnly>
  );
}

function FieldPage() {
  const { id } = useParams<{ id: string }>();
  const [years, setYears] = useState<number>(10);
  const { data: f, error, setData } = useApi<FieldDetail>(`/api/v1/land/fields/${id}/detail?years=${years}`);
  const species = useApi<Species[]>("/api/v1/species");
  const [editing, setEditing] = useState<TreeGroup | "new" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (error) return <ErrorNote message={error} />;
  if (!f) return <Loading />;

  const existing = f.kind === "existing";

  async function remove(g: TreeGroup) {
    if (!confirm(`Remove ${g.count.toLocaleString()} ${g.species_name} from this field?`)) return;
    setNotice(null);
    try {
      setData(await api.del<FieldDetail>(`/api/v1/land/fields/${id}/trees/${g.id}?years=${years}`));
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Could not remove these trees");
    }
  }

  return (
    <div>
      <PageHeader
        title={f.name}
        subtitle={`${f.district} · ${f.area_ha.toFixed(2)} ha · ${existing ? "Protect · existing trees" : "Plant · land for new trees"}`}
        back={{ href: "/dashboard/fields", label: "My fields" }}
        action={
          <div className="flex items-center gap-3">
            {f.latitude != null && f.longitude != null && (
              <a href={osmLink(f.latitude, f.longitude)} target="_blank" rel="noreferrer" className="text-sm font-medium text-brand">
                View on map ↗
              </a>
            )}
            <Badge tone={f.status === "verified" ? "green" : "amber"}>{f.status === "verified" ? "✓ Verified" : "Pending check"}</Badge>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {existing ? (
          <StatCard icon="🌳" label="Trees" value={f.tree_count.toLocaleString()} sub={`${f.groups.length} group${f.groups.length === 1 ? "" : "s"}`} />
        ) : (
          <StatCard icon="🌱" label="Trees planted" value={f.planted.toLocaleString()} sub={`of ${f.tree_count.toLocaleString()} slots · ${f.capacity_allocated.toLocaleString()} funded`} />
        )}
        <StatCard icon="🪵" label="CO₂ stored now" value={fmtT(f.carbon.stored_t)} sub={f.carbon.measured_share > 0 ? `${Math.round(f.carbon.measured_share * 100)}% from trunk measurements` : "estimated from tree age"} />
        <StatCard
          icon="☁️"
          label="CO₂ absorbed this year"
          value={fmtT(f.carbon.annual_gross_t)}
          sub={existing ? `${fmtT(f.carbon.annual_sellable_t)} sellable after ${BUFFER_SHARE * 100}% buffer` : "by the trees planted so far"}
        />
        <StatCard icon="💰" label="Earned from this field" value={fmtNpr(f.earned_usd)} sub={`${f.allocations.length} sale${f.allocations.length === 1 ? "" : "s"}`} />
      </div>

      <Card className="mt-6 p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-semibold">{existing ? "Trees on this field" : "Trees planted"}</p>
            <p className="text-sm text-muted">
              {existing
                ? "Group trees by species and size. Add the height and trunk width for a measured carbon estimate."
                : "Record each batch of trees as you plant them."}
            </p>
          </div>
          <button onClick={() => setEditing("new")} className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-strong">
            + {existing ? "Add trees" : "Record planting"}
          </button>
        </div>
        {!f.inventory_saved && existing && (
          <p className="mt-4 rounded-lg bg-surface-muted p-3 text-xs text-muted">
            This is the summary you entered when adding the field. Edit it or add more groups to make it exact.
          </p>
        )}
        {notice && <div className="mt-4"><ErrorNote message={notice} /></div>}
        {f.groups.length === 0 ? (
          <p className="mt-6 text-sm text-muted">
            No trees recorded yet.{" "}
            {f.capacity_allocated > 0 && `${f.capacity_allocated.toLocaleString()} trees are funded and waiting to be planted.`}
          </p>
        ) : (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted">
                  <th className="py-2 pr-3 font-medium">Species</th>
                  <th className="py-2 pr-3 text-right font-medium">Trees</th>
                  <th className="py-2 pr-3 text-right font-medium">Age</th>
                  <th className="py-2 pr-3 text-right font-medium">Height</th>
                  <th className="py-2 pr-3 text-right font-medium">Trunk Ø</th>
                  <th className="py-2 pr-3 text-right font-medium">CO₂ stored</th>
                  <th className="py-2 pr-3 text-right font-medium">CO₂ / year</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {f.groups.map((g, i) => (
                  <tr key={g.id ?? `summary-${i}`}>
                    <td className="py-3 pr-3">
                      <p className="font-medium">{g.species_name}</p>
                      <p className="text-xs text-muted">
                        {g.planted_on ? `Planted ${fmtDate(g.planted_on)}` : null}
                        {g.planted_on && g.note ? " · " : null}
                        {g.note}
                      </p>
                    </td>
                    <td className="py-3 pr-3 text-right">{g.count.toLocaleString()}</td>
                    <td className="py-3 pr-3 text-right">{g.age_years} yr</td>
                    <td className="py-3 pr-3 text-right">{g.height_m != null ? `${g.height_m} m` : "—"}</td>
                    <td className="py-3 pr-3 text-right">{g.dbh_cm != null ? `${g.dbh_cm} cm` : "—"}</td>
                    <td className="py-3 pr-3 text-right">
                      {fmtT(g.stored_t)}
                      <p className="text-[11px] text-muted">{g.method === "measured" ? "measured" : "by age"} · {g.stored_kg_per_tree.toLocaleString()} kg/tree</p>
                    </td>
                    <td className="py-3 pr-3 text-right">{fmtT(g.annual_t)}</td>
                    <td className="whitespace-nowrap py-3 text-right">
                      <button onClick={() => setEditing(g)} className="text-xs font-medium text-brand">Edit</button>
                      {g.id != null && (f.groups.length > 1 || !existing) && (
                        <button onClick={() => remove(g)} className="ml-3 text-xs font-medium text-muted hover:text-red-600">Remove</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="mt-6 p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-semibold">Carbon over time</p>
            <p className="text-sm text-muted">How much CO₂ these trees take out of the air as they grow.</p>
          </div>
          <div className="flex rounded-lg border border-border bg-surface-muted p-0.5 text-sm">
            {SPANS.map((s) => (
              <button
                key={s}
                onClick={() => setYears(s)}
                className={`rounded-md px-3 py-1 ${years === s ? "bg-white font-medium text-brand shadow-sm" : "text-muted"}`}
              >
                {s} yr
              </button>
            ))}
          </div>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <Figure label={`Absorbed in ${f.projection.years} years`} value={fmtT(f.projection.total_t)} />
          {existing ? (
            <>
              <Figure label="Sellable to Climate Partners" value={fmtT(f.projection.sellable_t)} />
              <Figure label="You could earn" value={fmtNpr(f.projection.earnings_usd)} sub="if every sellable tonne is sold" />
            </>
          ) : (
            <>
              <Figure label="Per tree, on average" value={`${perTree(f)} kg`} />
              <Figure label="Trees counted" value={(f.planted + f.projection.unplanted_trees).toLocaleString()} sub={f.projection.unplanted_trees ? `incl. ${f.projection.unplanted_trees.toLocaleString()} funded, not yet planted` : undefined} />
            </>
          )}
        </div>
        {f.projection.rows.length > 0 && f.projection.total_t > 0 ? (
          <ProjectionChart rows={f.projection.rows} />
        ) : (
          <p className="mt-6 text-sm text-muted">Record the trees on this land to see how much they will absorb.</p>
        )}
      </Card>

      <Allocations f={f} />

      {editing && (
        <GroupModal
          field={f}
          group={editing === "new" ? null : editing}
          species={species.data ?? []}
          years={years}
          onClose={() => setEditing(null)}
          onSaved={(d) => {
            setData(d);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function perTree(f: FieldDetail) {
  const trees = f.planted + f.projection.unplanted_trees;
  return trees ? Math.round((f.projection.total_t * 1000) / trees).toLocaleString() : "0";
}

function Figure({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl bg-surface-muted p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-xl font-semibold text-brand">{value}</p>
      {sub && <p className="text-[11px] text-muted">{sub}</p>}
    </div>
  );
}

function ProjectionChart({ rows }: { rows: FieldDetail["projection"]["rows"] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(...rows.map((r) => r.gross_t)) || 1;
  const H = 160;
  const every = rows.length > 12 ? 5 : 1;

  return (
    <div className="mt-6">
      <div className="relative flex items-end gap-[3px]" style={{ height: H }}>
        {rows.map((r, i) => (
          <div
            key={r.year}
            className="relative flex h-full flex-1 flex-col justify-end"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          >
            <div
              className="w-full rounded-t-[3px] bg-brand transition-opacity"
              style={{ height: `${(r.gross_t / max) * 100}%`, opacity: hover === null || hover === i ? 1 : 0.45 }}
            />
            {hover === i && (
              <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 w-44 -translate-x-1/2 rounded-lg border border-border bg-white p-2.5 text-xs shadow-lg">
                <p className="font-medium">{r.year}</p>
                <p className="mt-1 flex justify-between text-muted"><span>Absorbed</span><span className="text-foreground">{fmtT(r.gross_t)}</span></p>
                <p className="flex justify-between text-muted"><span>Sellable</span><span className="text-foreground">{fmtT(r.sellable_t)}</span></p>
                <p className="flex justify-between text-muted"><span>Running total</span><span className="text-foreground">{fmtT(r.cumulative_t)}</span></p>
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-[3px] border-t border-border pt-1.5">
        {rows.map((r, i) => (
          <span key={r.year} className="flex-1 text-center text-[10px] text-muted">
            {i % every === 0 ? r.year : ""}
          </span>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted">
        Young trees absorb less until about age 8; growth slows after 40. Hover a year for details.
      </p>
      <p className="sr-only">{rows.map((r) => `${r.year}: ${r.gross_t} t absorbed.`).join(" ")}</p>
    </div>
  );
}

function Allocations({ f }: { f: FieldDetail }) {
  const existing = f.kind === "existing";
  return (
    <Card className="mt-6 p-6">
      <p className="font-semibold">Who this field is allocated to</p>
      <p className="text-sm text-muted">
        {existing
          ? "Each year's growth is sold once. Climate Partners below have funded part of it."
          : "Climate Partners who funded new trees on this land."}
      </p>

      <div className="mt-5">
        <div className="mb-1.5 flex justify-between text-xs text-muted">
          <span>{existing ? `Sold for ${new Date().getFullYear()}` : "Slots funded"}</span>
          <span>
            {existing
              ? `${fmtT(f.capacity_allocated)} of ${fmtT(f.capacity_total)} · ${fmtT(f.capacity_available)} still available`
              : `${f.capacity_allocated.toLocaleString()} of ${f.capacity_total.toLocaleString()} trees`}
          </span>
        </div>
        <Meter value={f.capacity_allocated} max={f.capacity_total} />
      </div>

      {f.sold_by_year.length > 1 && (
        <div className="mt-5 flex flex-wrap gap-2">
          {f.sold_by_year.map((y) => (
            <span key={y.year} className="rounded-lg border border-border px-3 py-1.5 text-xs">
              <span className="font-medium">{y.year}</span>
              <span className="text-muted"> · {existing ? fmtT(y.tonnes) : `${y.trees} trees`} · {fmtNpr(y.landowner_usd)}</span>
            </span>
          ))}
        </div>
      )}

      {f.allocations.length === 0 ? (
        <p className="mt-6 text-sm text-muted">Nothing allocated yet. When a Climate Partner is matched to this field, it shows up here.</p>
      ) : (
        <ul className="mt-5 divide-y divide-border">
          {f.allocations.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
              <div className="min-w-0">
                <p className="font-medium">{a.partner}</p>
                <p className="text-xs text-muted">
                  {a.trip_name} · {a.impact_type === "plant" ? `${a.trees} new trees` : `${fmtT(a.tonnes)} for ${a.year}`} · {fmtDate(a.created_at)}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {a.payout_status === "paid" ? (
                  <Badge tone="green">Paid · {a.payout_number}</Badge>
                ) : a.payout_status === "pending" ? (
                  <Badge tone="amber">Payment pending</Badge>
                ) : null}
                <span className="font-semibold text-brand">+{fmtNpr(a.landowner_usd)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function GroupModal({
  field,
  group,
  species,
  years,
  onClose,
  onSaved,
}: {
  field: FieldDetail;
  group: TreeGroup | null;
  species: Species[];
  years: number;
  onClose: () => void;
  onSaved: (d: FieldDetail) => void;
}) {
  const planting = field.kind === "planting";
  const [speciesId, setSpeciesId] = useState(group?.species ?? field.species);
  const [count, setCount] = useState(group ? String(group.count) : "");
  const [age, setAge] = useState(group ? String(group.age_years) : planting ? "0" : "");
  const [plantedOn, setPlantedOn] = useState(group?.planted_on ?? (planting ? new Date().toISOString().slice(0, 10) : ""));
  const [height, setHeight] = useState(group?.height_m != null ? String(group.height_m) : "");
  const [dbh, setDbh] = useState(group?.dbh_cm != null ? String(group.dbh_cm) : "");
  const [note, setNote] = useState(group?.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const body: TreeGroupInput = {
      species: speciesId,
      count: Number(count),
      age_years: Number(age) || 0,
      height_m: height ? Number(height) : null,
      dbh_cm: dbh ? Number(dbh) : null,
      planted_on: plantedOn || null,
      note: note.trim() || null,
    };
    try {
      // The enrollment summary has no id yet: saving it replaces the summary with a real group.
      const d =
        group?.id != null
          ? await api.put<FieldDetail>(`/api/v1/land/fields/${field.id}/trees/${group.id}?years=${years}`, body)
          : await api.post<FieldDetail>(`/api/v1/land/fields/${field.id}/trees?years=${years}&replace_summary=${group != null}`, body);
      onSaved(d);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
      setSaving(false);
    }
  }

  return (
    <Modal
      title={group ? `Edit ${group.species_name}` : planting ? "Record a planting" : "Add trees"}
      subtitle={field.name}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className="text-sm text-muted">Cancel</button>
          <button form="group-form" type="submit" disabled={saving} className="rounded-md bg-brand px-5 py-2 text-sm font-medium text-white hover:bg-brand-strong disabled:opacity-60">
            {saving ? "Saving…" : "Save"}
          </button>
        </>
      }
    >
      <form id="group-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <FieldLabel label="Species">
            <select value={speciesId} onChange={(e) => setSpeciesId(e.target.value)} className={inputCls}>
              {species.filter((s) => !planting || s.id !== "tea").map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </FieldLabel>
        </div>
        <FieldLabel label="Number of trees">
          <input required type="number" min={1} value={count} onChange={(e) => setCount(e.target.value)} className={inputCls} />
        </FieldLabel>
        {planting ? (
          <FieldLabel label="Planted on">
            <input type="date" max={new Date().toISOString().slice(0, 10)} value={plantedOn} onChange={(e) => setPlantedOn(e.target.value)} className={inputCls} />
          </FieldLabel>
        ) : (
          <FieldLabel label="Average age (years)">
            <input required type="number" min={0} max={300} value={age} onChange={(e) => setAge(e.target.value)} className={inputCls} />
          </FieldLabel>
        )}
        <FieldLabel label="Average height (m)" hint="Optional">
          <input type="number" min={0.1} max={90} step="0.1" value={height} onChange={(e) => setHeight(e.target.value)} className={inputCls} />
        </FieldLabel>
        <FieldLabel label="Trunk width (cm)" hint="At chest height">
          <input type="number" min={0.1} max={500} step="0.1" value={dbh} onChange={(e) => setDbh(e.target.value)} className={inputCls} />
        </FieldLabel>
        <div className="sm:col-span-2">
          <FieldLabel label="Note" hint="Optional">
            <input value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} placeholder="e.g. along the north terrace" className={inputCls} />
          </FieldLabel>
        </div>
        <p className="text-xs text-muted sm:col-span-2">
          With height and trunk width we measure the carbon already stored (Chave 2014 equation). Without them, we estimate it from age.
        </p>
        {error && <div className="sm:col-span-2"><ErrorNote message={error} /></div>}
      </form>
    </Modal>
  );
}
