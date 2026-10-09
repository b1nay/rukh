"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { DotGrid, FieldMap, MapLegend } from "@/components/dashboard/field-map";
import { RoleOnly } from "@/components/dashboard/shell";
import { useApi } from "@/components/dashboard/session";
import { Badge, Card, ErrorNote, Loading, PageHeader } from "@/components/dashboard/ui";
import { api } from "@/lib/api";
import { FARMER_SHARE, IMPACT_TYPES } from "@/lib/content";
import { fmtNpr, fmtT, fmtUsd } from "@/lib/format";
import type { AllocateResult, FieldMapData, FieldOption, RequestDetail } from "@/lib/types";

export function View() {
  return (
    <RoleOnly side="admin">
      <Allocate />
    </RoleOnly>
  );
}

type Line = { field: FieldOption; trees: number; tonnes: number; amount: number };

/** Turn trees picked per field into API picks, capped by each field and by what the request still needs. */
function plan(fields: FieldOption[], trees: Record<number, number>, need: number, plant: boolean) {
  let left = need;
  const lines: Line[] = [];
  const unneeded: FieldOption[] = [];
  for (const f of fields) {
    const n = Math.min(trees[f.id] ?? 0, f.available_trees);
    if (n <= 0) continue;
    if (left < 0.001) {
      unneeded.push(f);
      continue;
    }
    // Protect is billed in tonnes of this year's growth, capped by what the field has left.
    const tonnes = plant ? Math.min(n * f.t_per_tree, left) : Math.min(n * f.t_per_tree, f.available, left);
    lines.push({ field: f, trees: n, tonnes, amount: plant ? n : Math.round(tonnes * 1000) / 1000 });
    left -= tonnes;
  }
  return { lines, unneeded, covered: need - Math.max(0, left) };
}

function Allocate() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const req = useApi<RequestDetail>(`/api/v1/admin/requests/${id}`);
  const map = useApi<FieldMapData>("/api/v1/admin/map");
  const [picked, setPicked] = useState<Record<number, number> | null>(null); // null: the suggested plan
  const [focus, setFocus] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const suggested = useMemo(
    () => Object.fromEntries((req.data?.fields ?? []).filter((f) => f.suggested_trees).map((f) => [f.id, f.suggested_trees])),
    [req.data],
  );
  const eligible = useMemo(() => new Set((req.data?.fields ?? []).map((f) => f.id)), [req.data]);
  const trees = picked ?? suggested;

  if (req.error || map.error) return <ErrorNote message={(req.error || map.error)!} />;
  if (!req.data || !map.data) return <Loading />;

  const { request: r } = req.data;
  const plant = r.impact_type === "plant";
  const need = Math.min(r.tonnes, req.data.open_tonnes);
  const { lines, unneeded, covered } = plan(req.data.fields, trees, need, plant);
  const treeTotal = lines.reduce((s, l) => s + l.trees, 0);
  const subtotal = covered * r.price_per_tonne;
  const pct = need > 0 ? Math.min(100, (covered / need) * 100) : 0;
  const mapFields = map.data.fields.filter((f) => (plant ? f.kind === "planting" : f.kind === "existing"));
  const byId = Object.fromEntries(map.data.fields.map((f) => [f.id, f]));

  if (r.status !== "pending") {
    return (
      <div>
        <PageHeader title={`Request #${r.id}`} back={{ href: `/dashboard/requests/${r.id}`, label: "Request" }} />
        <ErrorNote message={`This request is already ${r.status}.`} />
      </div>
    );
  }

  function toggle(fieldId: number) {
    const f = req.data!.fields.find((x) => x.id === fieldId);
    if (!f) return;
    const next = { ...trees };
    if (next[fieldId]) delete next[fieldId];
    else {
      // take only what is still needed
      const left = Math.max(0, need - covered);
      next[fieldId] = Math.max(1, Math.min(f.available_trees, Math.ceil(left / f.t_per_tree - 1e-9)));
    }
    setPicked(next);
    setFocus(fieldId);
  }

  async function confirm() {
    setBusy(true);
    setErr(null);
    try {
      const res = await api.post<AllocateResult>(`/api/v1/admin/requests/${id}/allocate`, {
        picks: lines.map((l) => ({ field_id: l.field.id, amount: l.amount })),
        admin_note: note.trim() || null,
      });
      router.push(`/dashboard/payouts?request=${id}&invoice=${encodeURIComponent(res.invoice_number)}&total=${res.invoice_total_usd}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Allocation failed");
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        title={`Allocate trees · ${r.requester}`}
        subtitle={`${r.trip_name} · ${fmtT(need)} ${IMPACT_TYPES[r.impact_type].name}`}
        back={{ href: `/dashboard/requests/${r.id}`, label: `Request #${r.id}` }}
      />

      <Card tint className="grid gap-4 p-5 sm:grid-cols-4">
        <Need label="CO₂ to cover" value={fmtT(need)} />
        <Need label={plant ? "New trees needed" : "Trees needed"} value={req.data.trees_needed.toLocaleString()} />
        <Need label="Land needed" value={`${req.data.area_needed_ha.toLocaleString()} ha`} />
        <Need label="Client bill" value={fmtUsd(r.total_usd)} sub={`${fmtUsd(r.price_per_tonne)}/t + ${Math.round(r.fee_rate * 100)}% fee`} />
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted">Click a field to add or remove it.</p>
            <MapLegend selecting />
          </div>
          <FieldMap fields={mapFields} selected={trees} clickable={eligible} focusId={focus} onFieldClick={toggle} className="h-[620px]" />
        </div>

        <Card className="flex flex-col p-5">
          <div className="flex items-center justify-between">
            <p className="font-semibold">Selected fields</p>
            <div className="flex gap-3 text-xs font-medium">
              <button onClick={() => setPicked(null)} className="text-brand">Auto-fill</button>
              <button onClick={() => setPicked({})} className="text-muted hover:text-foreground">Clear</button>
            </div>
          </div>
          <p className="text-xs text-muted">Auto-fill uses the smallest fields first, so income reaches small farms.</p>

          {req.data.fields.length === 0 ? (
            <p className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
              No {plant ? "bare land" : "free standing trees"} is available. Go back to decline, or message the client about switching to {plant ? "Protect" : "Plant"}.
            </p>
          ) : (
            <ul className="mt-4 max-h-[400px] space-y-2 overflow-y-auto pr-1">
              {req.data.fields.map((f) => {
                const on = (trees[f.id] ?? 0) > 0;
                const line = lines.find((l) => l.field.id === f.id);
                return (
                  <li key={f.id} className={`rounded-xl border p-3 text-sm transition ${on ? "border-blue-500 bg-blue-50/40" : "border-border"}`}>
                    <div className="flex items-start gap-3">
                      <input type="checkbox" checked={on} onChange={() => toggle(f.id)} className="mt-1 accent-blue-600" />
                      <button onClick={() => setFocus(f.id)} className="min-w-0 flex-1 text-left">
                        <p className="truncate font-medium">{f.name}</p>
                        <p className="truncate text-xs text-muted">{f.landowner} · {f.district} · {f.species_name}</p>
                        <p className="text-xs text-muted">{f.available_trees.toLocaleString()} {plant ? "bare slots" : "free trees"}</p>
                      </button>
                      {on && (
                        <input
                          type="number"
                          min={1}
                          max={f.available_trees}
                          step={1}
                          value={trees[f.id]}
                          onChange={(e) => setPicked({ ...trees, [f.id]: Math.max(0, Math.floor(Number(e.target.value) || 0)) })}
                          aria-label={`Trees from ${f.name}`}
                          className={`w-20 rounded-lg border px-2 py-1 text-sm outline-none ${trees[f.id] > f.available_trees ? "border-red-400" : "border-border focus:border-blue-500"}`}
                        />
                      )}
                    </div>
                    {on && byId[f.id] && (
                      <div className="mt-2 flex items-end justify-between gap-2 pl-7">
                        <DotGrid field={byId[f.id]} picked={line?.trees ?? 0} max={60} />
                        <span className="shrink-0 text-xs text-muted">{line ? fmtT(line.tonnes) : "not needed"}</span>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          <div className="mt-4 rounded-xl bg-surface-muted p-3 text-sm">
            <div className="flex items-center justify-between">
              <span>
                <span className="font-semibold">{treeTotal.toLocaleString()} trees</span> · {fmtT(covered)} of {fmtT(need)}
              </span>
              {covered < need - 0.001 ? <Badge tone="amber">Partial</Badge> : <Badge>Full</Badge>}
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white">
              <div className="h-full rounded-full bg-blue-600" style={{ width: `${pct}%` }} />
            </div>
            <p className="mt-2 text-xs text-muted">
              Landowners receive {fmtNpr(subtotal * FARMER_SHARE)} across {new Set(lines.map((l) => l.field.landowner)).size} payment(s).
            </p>
          </div>
          {req.data.shortfall > 0 && (
            <p className="mt-2 text-xs text-amber-700">Available land is {fmtT(req.data.shortfall)} short of this request. You can allocate part of it now.</p>
          )}
          {unneeded.length > 0 && (
            <p className="mt-2 text-xs text-red-600">{unneeded.map((f) => f.name).join(", ")} isn&apos;t needed: the request is already covered. Remove it to continue.</p>
          )}

          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="Note to the client (optional)"
            className="mt-4 w-full resize-none rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
          />
          {err && <div className="mt-3"><ErrorNote message={err} /></div>}
          <div className="mt-4 flex items-center justify-between gap-3">
            <Link href={`/dashboard/requests/${r.id}`} className="text-sm text-muted hover:text-foreground">Back</Link>
            <button
              onClick={confirm}
              disabled={busy || lines.length === 0 || unneeded.length > 0}
              className="rounded-md bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-strong disabled:opacity-50"
            >
              {busy ? "Allocating…" : "Allocate & bill client →"}
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
}

function Need({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-xl font-semibold tracking-tight">{value}</p>
      {sub && <p className="text-xs text-muted">{sub}</p>}
    </div>
  );
}
