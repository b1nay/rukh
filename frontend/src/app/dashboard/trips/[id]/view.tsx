"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { Correspondence, MessageButton } from "@/components/dashboard/correspondence";
import { RequestStatusBadge } from "@/components/dashboard/request-status";
import { RoleOnly } from "@/components/dashboard/shell";
import { RoleMap } from "@/components/dashboard/role-map";
import { useApi, useSession } from "@/components/dashboard/session";
import { Badge, Card, ErrorNote, Loading, Meter, PageHeader, StatCard, TripStatusBadge } from "@/components/dashboard/ui";
import { api } from "@/lib/api";
import { FEE_RATES, IMPACT_TYPES, ImpactType } from "@/lib/content";
import { fmtDate, fmtT, fmtSol, osmLink } from "@/lib/format";
import { CATEGORIES, fmtHours, fmtKg } from "@/lib/itinerary";
import type { AllocationRequest, TripDetail } from "@/lib/types";

export function View() {
  return (
    <RoleOnly side="organization">
      <Trip />
    </RoleOnly>
  );
}

function Trip() {
  const { id } = useParams<{ id: string }>();
  const { user } = useSession();
  const { data: trip, error, reload } = useApi<TripDetail>(`/api/v1/climate/trips/${id}`);
  const [impact, setImpact] = useState<ImpactType>("plant");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [picked, setThread] = useState<AllocationRequest | null>(null);
  // Notification links end in #messages: open the latest thread once.
  const [fromLink, setFromLink] = useState(() => typeof window !== "undefined" && window.location.hash === "#messages");
  const thread = picked ?? (fromLink ? (trip?.requests[0] ?? null) : null);

  if (error) return <ErrorNote message={error} />;
  if (!trip) return <Loading />;

  const remaining = Math.max(0, trip.co2_t - trip.covered_t);
  const pending = trip.requests.find((r) => r.status === "pending");
  const price = IMPACT_TYPES[impact].pricePerTonne;
  const feeRate = FEE_RATES[user.plan ?? "starter"] ?? 0;
  const subtotal = remaining * price;

  async function requestTrees() {
    setBusy(true);
    setNotice(null);
    try {
      await api.post(`/api/v1/climate/trips/${id}/requests`, { impact_type: impact, note: note.trim() || null });
      setNote("");
      setNotice({ ok: true, text: "Request sent. Rukh will allocate fields and notify you." });
      reload();
    } catch (e) {
      setNotice({ ok: false, text: e instanceof Error ? e.message : "Couldn't send the request" });
    } finally {
      setBusy(false);
    }
  }

  async function cancel(r: AllocationRequest) {
    if (!confirm("Cancel this request?")) return;
    await api.post(`/api/v1/climate/requests/${r.id}/cancel`);
    reload();
  }

  return (
    <div>
      <PageHeader
        title={trip.name}
        subtitle={`${fmtDate(trip.start_date)} · ${trip.travelers} travelers${trip.include_non_co2 ? " · incl. non-CO₂" : ""}`}
        back={{ href: "/dashboard/trips", label: "Trips" }}
        action={<TripStatusBadge status={trip.status} />}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard icon="☁️" label="CO₂ measured" value={fmtT(trip.co2_t)} sub={`${fmtT(trip.co2_t / Math.max(1, trip.travelers))} per traveler · ${trip.travelers} people`} />
        <StatCard icon="✅" label="Covered" value={fmtT(trip.covered_t)} sub={`${fmtT(remaining)} still open`} />
        <StatCard icon="💳" label="Spend" value={fmtSol(trip.spend_sol)} sub={`${trip.allocations.length} allocations`} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <Card className="p-6">
          <p className="font-semibold">Where the CO₂ comes from</p>
          <ul className="mt-4 space-y-3">
            {trip.by_category.map((c) => {
              const pct = trip.co2_t > 0 ? (c.kg / 1000 / trip.co2_t) * 100 : 0;
              return (
                <li key={c.category}>
                  <div className="flex justify-between text-sm">
                    <span>
                      {CATEGORIES[c.category].icon} {CATEGORIES[c.category].label}
                    </span>
                    <span className="tabular-nums text-muted">
                      {fmtKg(c.kg)} · {pct < 1 && pct > 0 ? "<1" : Math.round(pct)}%
                    </span>
                  </div>
                  <div className="mt-1.5"><Meter value={c.kg} max={trip.co2_t * 1000} /></div>
                </li>
              );
            })}
          </ul>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <p className="font-semibold">Itinerary</p>
            <span className="text-xs text-muted">{fmtKg(trip.shared_kg_per_person)} per person in Nepal</span>
          </div>
          <ol className="relative mt-4 space-y-3 border-l border-border pl-5">
            {trip.legs.map((l, i) => (
              <li key={i} className="relative">
                <span className="absolute -left-[27px] top-0.5 grid h-3 w-3 place-items-center rounded-full border-2 border-white bg-brand" />
                <div className="flex items-start justify-between gap-3 text-sm">
                  <div>
                    <p className="font-medium">
                      {CATEGORIES[l.category].icon} {l.label}
                    </p>
                    <p className="text-xs text-muted">
                      Day {l.day}
                      {l.origin && l.destination ? ` · ${l.origin} → ${l.destination}` : ""}
                      {l.distance_km ? ` · ${l.distance_km} km` : ""}
                      {l.nights ? ` · ${l.nights} night${l.nights > 1 ? "s" : ""}` : ""}
                      {l.hours ? ` · ${l.hours} h` : ""}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-muted">
                    {l.mode === "international" && !l.origin ? "per traveler" : l.category === "trail" ? "0 🌿" : fmtKg(l.kg_per_person)}
                  </span>
                </div>
              </li>
            ))}
          </ol>
        </Card>
      </div>

      {pending && (
        <Card tint className="mt-6 flex flex-wrap items-center justify-between gap-4 p-6">
          <div>
            <div className="flex items-center gap-2">
              <p className="font-semibold">Request sent to Rukh</p>
              <RequestStatusBadge status="pending" />
            </div>
            <p className="mt-1 text-sm text-muted">
              {fmtT(pending.tonnes)} {IMPACT_TYPES[pending.impact_type].name} · bill {fmtSol(pending.total_sol)} · sent {fmtDate(pending.created_at)}.
              You&apos;ll be notified when fields are allocated.
            </p>
          </div>
          <div className="flex gap-2">
            <MessageButton count={pending.messages} onClick={() => setThread(pending)} />
            <button onClick={() => cancel(pending)} className="rounded-md px-3 py-2 text-sm text-muted hover:text-red-600">
              Cancel
            </button>
          </div>
        </Card>
      )}

      {remaining > 0.001 && !pending && (
        <Card tint className="mt-6 p-6">
          <p className="font-semibold">Cover the remaining {fmtT(remaining)}</p>
          <p className="text-xs text-muted">Rukh reviews each request and allocates verified fields in Nepal.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {(Object.keys(IMPACT_TYPES) as ImpactType[]).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setImpact(k)}
                className={`rounded-xl border bg-white p-4 text-left transition ${impact === k ? "border-brand ring-1 ring-brand/30" : "border-border hover:border-brand/50"}`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{IMPACT_TYPES[k].name}</span>
                  <span className="text-sm text-muted">{IMPACT_TYPES[k].pricePerTonne} SOL/t</span>
                </div>
                <p className="mt-1 text-xs text-muted">{IMPACT_TYPES[k].tagline}</p>
              </button>
            ))}
          </div>
          <div className="mt-5 grid gap-5 md:grid-cols-[1fr_280px]">
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="Note for Rukh (optional), e.g. preferred district or deadline"
              className="w-full resize-none rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
            />
            <div className="rounded-xl border border-border bg-white p-4 text-sm">
              <p className="flex justify-between"><span className="text-muted">{fmtT(remaining)} × {price} SOL</span><span>{fmtSol(subtotal)}</span></p>
              <p className="mt-1 flex justify-between"><span className="text-muted">Platform fee ({Math.round(feeRate * 100)}%)</span><span>{fmtSol(subtotal * feeRate)}</span></p>
              <p className="mt-2 flex justify-between border-t border-border pt-2 font-semibold"><span>Estimated bill</span><span>{fmtSol(subtotal * (1 + feeRate))}</span></p>
              {impact === "plant" && <p className="mt-1 text-xs text-muted">About {Math.ceil(remaining / 0.5)} new trees</p>}
            </div>
          </div>
          <div className="mt-5 flex justify-end">
            <button onClick={requestTrees} disabled={busy} className="rounded-md bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-strong disabled:opacity-60">
              {busy ? "Sending…" : "Request trees →"}
            </button>
          </div>
        </Card>
      )}

      {notice && (
        <p className={`mt-4 rounded-xl border p-3 text-sm ${notice.ok ? "border-brand/30 bg-brand-soft text-brand-strong" : "border-amber-200 bg-amber-50 text-amber-800"}`}>
          {notice.text}
        </p>
      )}

      {trip.requests.length > 0 && (
        <Card id="messages" className="mt-6 p-6">
          <p className="font-semibold">Requests & correspondence</p>
          <ul className="mt-4 divide-y divide-border">
            {trip.requests.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">#{r.id} · {IMPACT_TYPES[r.impact_type].name} · {fmtT(r.tonnes)}</span>
                    <RequestStatusBadge status={r.status} />
                  </div>
                  <p className="text-xs text-muted">
                    Bill {fmtSol(r.total_sol)} · {fmtDate(r.created_at)}
                    {r.allocated_tonnes > 0 && ` · ${fmtT(r.allocated_tonnes)} allocated`}
                    {r.admin_note && ` · Rukh: “${r.admin_note}”`}
                  </p>
                </div>
                <MessageButton count={r.messages} onClick={() => setThread(r)} label="Messages" />
              </li>
            ))}
          </ul>
        </Card>
      )}

      {thread && (
        <Correspondence
          requestId={thread.id}
          title={`${trip.name} · request #${thread.id}`}
          onClose={() => {
            setThread(null);
            setFromLink(false);
            reload();
          }}
        />
      )}

      <Card className="mt-6 p-6">
        <p className="font-semibold">Your trees</p>
          {trip.allocations.length === 0 ? (
            <p className="mt-4 text-sm text-muted">No trees allocated yet.</p>
          ) : (
            <>
            <div className="mt-4">
              <RoleMap path={`/api/v1/climate/map?trip_id=${trip.id}`} title="Where they grow" subtitle="Red dots are the trees this trip funded." labels={{ allocated: "Your trees", free: "Other trees on the land", barren: "Land still to plant" }} className="h-[360px]" />
            </div>
            <ul className="mt-4 grid gap-3 md:grid-cols-2">
              {trip.allocations.map((a) => (
                <li key={a.id} className="rounded-xl border border-border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{a.field_name}</p>
                      <p className="text-xs text-muted">{a.district} · {a.species} · {a.landowner}</p>
                    </div>
                    <Badge tone={a.impact_type === "plant" ? "green" : "gray"}>{a.impact_type === "plant" ? "Plant" : "Protect"}</Badge>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-sm">
                    <span>
                      {a.impact_type === "plant" ? `${a.trees} new trees · ` : ""}
                      {fmtT(a.tonnes)}
                    </span>
                    <span className="flex items-center gap-3">
                      <span className="text-muted">{fmtSol(a.amount_sol)}</span>
                      {a.latitude != null && a.longitude != null && (
                        <a href={osmLink(a.latitude, a.longitude)} target="_blank" rel="noreferrer" className="text-xs font-medium text-brand">
                          Map ↗
                        </a>
                      )}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
            </>
          )}
      </Card>

      <Card className="mt-6 overflow-hidden">
        <div className="flex items-center justify-between px-6 pt-5 pb-3">
          <p className="font-semibold">Travelers · {trip.travelers}</p>
          <span className="text-xs text-muted">{fmtT(trip.co2_t)} total</span>
        </div>
        <div className="max-h-[420px] overflow-auto border-t border-border">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="sticky top-0 z-10 bg-surface-muted text-xs text-muted">
              <tr>
                <th className="px-4 py-2.5 font-medium">#</th>
                <th className="px-4 py-2.5 font-medium">Name</th>
                <th className="px-4 py-2.5 font-medium">Nationality</th>
                <th className="px-4 py-2.5 font-medium">Flight route</th>
                <th className="px-4 py-2.5 font-medium">Cabin</th>
                <th className="px-4 py-2.5 text-right font-medium">Flight</th>
                <th className="px-4 py-2.5 text-right font-medium">Total CO₂</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {trip.traveler_list.map((t, i) => (
                <tr key={t.id} className="hover:bg-surface-muted/50">
                  <td className="px-4 py-2.5 text-xs text-muted tabular-nums">{i + 1}</td>
                  <td className="px-4 py-2.5">
                    <p className="font-medium">{t.name}</p>
                    {t.email && <p className="text-xs text-muted">{t.email}</p>}
                  </td>
                  <td className="px-4 py-2.5 text-muted">{t.nationality ?? "—"}</td>
                  <td className="px-4 py-2.5 text-xs text-muted">
                    {t.journey ? (
                      <>
                        <span className="text-foreground">
                          {[t.journey.origin, ...t.journey.segments.slice(0, -1).map((s) => s.destination), t.journey.destination].join(" → ")}
                        </span>
                        <br />
                        {fmtHours(t.journey.hours_one_way)} each way
                        {Object.entries(t.journey.layovers).map(([at, h]) => ` · ${fmtHours(h)} at ${at}`).join("")}
                        {t.journey.estimated && " · estimated direct"}
                      </>
                    ) : (
                      "Group flight in itinerary"
                    )}
                  </td>
                  <td className="px-4 py-2.5 capitalize text-muted">{t.cabin.replace("_", " ")}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-muted">{t.flight_kg > 0 ? fmtKg(t.flight_kg) : "—"}</td>
                  <td className="px-4 py-2.5 text-right font-semibold tabular-nums">{fmtT(t.co2_kg / 1000)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
