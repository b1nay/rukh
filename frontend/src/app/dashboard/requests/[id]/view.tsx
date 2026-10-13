"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { Correspondence, MessageButton } from "@/components/dashboard/correspondence";
import { RequestStatusBadge } from "@/components/dashboard/request-status";
import { RoleOnly } from "@/components/dashboard/shell";
import { useApi } from "@/components/dashboard/session";
import { Card, ErrorNote, Loading, PageHeader, StatCard } from "@/components/dashboard/ui";
import { api } from "@/lib/api";
import { ALL_CATEGORIES, IMPACT_TYPES } from "@/lib/content";
import { fmtDate, fmtT, fmtSol } from "@/lib/format";
import { CATEGORIES, fmtKg } from "@/lib/itinerary";
import type { RequestDetail } from "@/lib/types";

export function View() {
  return (
    <RoleOnly side="admin">
      <Request />
    </RoleOnly>
  );
}

function Request() {
  const { id } = useParams<{ id: string }>();
  const { data, error, reload } = useApi<RequestDetail>(`/api/v1/admin/requests/${id}`);
  const [thread, setThread] = useState(() => typeof window !== "undefined" && window.location.hash === "#messages");

  if (error) return <ErrorNote message={error} />;
  if (!data) return <Loading />;

  const { request: r, trip } = data;
  const plant = r.impact_type === "plant";
  const category = ALL_CATEGORIES.find((c) => c.id === data.requester_category)?.title;

  async function decline() {
    const reason = prompt("Reason for declining (sent to the client):");
    if (!reason?.trim()) return;
    await api.post(`/api/v1/admin/requests/${id}/reject`, { admin_note: reason.trim() });
    reload();
  }

  return (
    <div>
      <PageHeader
        title={`Request #${r.id} · ${r.requester}`}
        subtitle={`${trip.name} · sent ${fmtDate(r.created_at)}`}
        back={{ href: "/dashboard/requests", label: "Requests" }}
        action={
          <div className="flex items-center gap-3">
            <RequestStatusBadge status={r.status} />
            <MessageButton count={r.messages} onClick={() => setThread(true)} label="Message client" />
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon="☁️" label="Requested" value={fmtT(r.tonnes)} sub={`${IMPACT_TYPES[r.impact_type].name} · $${r.price_per_tonne}/t`} />
        <StatCard icon="🧾" label="Bill" value={fmtSol(r.total_sol)} sub={`${fmtSol(r.subtotal_sol)} + ${Math.round(r.fee_rate * 100)}% fee`} />
        <StatCard icon="👥" label="Travelers" value={String(trip.travelers)} sub={`${fmtT(trip.co2_t)} total trip CO₂`} />
        <StatCard icon="🏢" label="Client" value={r.requester} sub={[category, data.requester_email].filter(Boolean).join(" · ")} />
      </div>

      {r.note && (
        <Card tint className="mt-6 p-4 text-sm">
          <span className="font-medium">Client note: </span>“{r.note}”
        </Card>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.6fr]">
        <Card className="p-6">
          <p className="font-semibold">Trip</p>
          <p className="mt-1 text-xs text-muted">
            {fmtDate(trip.start_date)} · {trip.travelers} travelers · {fmtKg(trip.shared_kg_per_person)} per person in Nepal
          </p>
          <ul className="mt-4 space-y-2 text-sm">
            {trip.by_category.map((c) => (
              <li key={c.category} className="flex justify-between">
                <span>{CATEGORIES[c.category].icon} {CATEGORIES[c.category].label}</span>
                <span className="text-muted">{fmtKg(c.kg)}</span>
              </li>
            ))}
          </ul>
          <ol className="mt-5 max-h-64 space-y-1.5 overflow-y-auto border-t border-border pt-4 text-xs">
            {trip.legs.map((l, i) => (
              <li key={i} className="flex justify-between gap-2">
                <span className="truncate"><span className="text-muted">D{l.day}</span> {CATEGORIES[l.category].icon} {l.label}</span>
                <span className="shrink-0 text-muted">{l.mode === "international" && !l.origin ? "per traveler" : fmtKg(l.kg_per_person)}</span>
              </li>
            ))}
          </ol>
        </Card>

        {r.status === "pending" ? (
          <Card className="flex flex-col p-6">
            <p className="font-semibold">What this request needs</p>
            <p className="text-xs text-muted">
              {plant ? "New trees on bare land, at 0.5 t per tree over its lifetime." : "A year of growth from standing trees."}
            </p>
            <div className="mt-5 grid grid-cols-3 gap-3">
              {[
                ["CO₂", fmtT(data.open_tonnes)],
                [plant ? "New trees" : "Trees", data.trees_needed.toLocaleString()],
                ["Land", `${data.area_needed_ha.toLocaleString()} ha`],
              ].map(([k, v]) => (
                <div key={k} className="rounded-xl bg-surface-muted p-4">
                  <p className="text-xs text-muted">{k}</p>
                  <p className="mt-1 text-xl font-semibold tracking-tight">{v}</p>
                </div>
              ))}
            </div>
            <p className="mt-4 text-sm text-muted">
              {data.fields.length === 0
                ? `No ${plant ? "bare land" : "free standing trees"} is available. Decline, or message the client about switching to ${plant ? "Protect" : "Plant"}.`
                : `${data.fields.length} field${data.fields.length === 1 ? "" : "s"} can take this. ${data.fields.filter((f) => f.suggested).length} suggested, smallest first.`}
            </p>
            {data.shortfall > 0 && (
              <p className="mt-2 text-xs text-amber-700">
                Available land is {fmtT(data.shortfall)} short. The tree and land totals include new planting to cover the gap.
              </p>
            )}
            <div className="mt-auto flex justify-between gap-3 pt-6">
              <button onClick={decline} className="rounded-md px-3 py-2 text-sm text-muted hover:text-red-600">Decline</button>
              {data.fields.length > 0 && (
                <Link
                  href={`/dashboard/requests/${r.id}/allocate`}
                  className="rounded-md bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-strong"
                >
                  Choose trees on the map →
                </Link>
              )}
            </div>
          </Card>
        ) : (
          <Card className="p-6">
            <p className="font-semibold">Decision</p>
            <p className="mt-1 text-sm text-muted">
              {r.status === "cancelled" ? "Cancelled by the client" : `Decided ${r.decided_at ? fmtDate(r.decided_at) : ""}`}
              {r.admin_note && ` · “${r.admin_note}”`}
            </p>
            <ul className="mt-4 space-y-2">
              {trip.allocations
                .filter((a) => a.request_id === r.id)
                .map((a) => (
                  <li key={a.id} className="flex justify-between rounded-xl border border-border p-3 text-sm">
                    <span>
                      <span className="font-medium">{a.field_name}</span>
                      <span className="block text-xs text-muted">{a.landowner} · {a.district}</span>
                    </span>
                    <span className="text-right">
                      {a.trees ? `${a.trees} trees · ` : ""}{fmtT(a.tonnes)}
                      <span className="block text-xs text-muted">{fmtSol(a.amount_sol)}</span>
                    </span>
                  </li>
                ))}
            </ul>
            {(r.status === "allocated" || r.status === "partial") && (
              <Link href={`/dashboard/payouts?request=${r.id}`} className="mt-4 inline-block text-sm font-medium text-brand">
                Landowner payments →
              </Link>
            )}
          </Card>
        )}
      </div>

      {thread && <Correspondence requestId={r.id} title={`${r.requester} · ${trip.name}`} onClose={() => { setThread(false); reload(); }} />}
    </div>
  );
}
