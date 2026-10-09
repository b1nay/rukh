"use client";

import Link from "next/link";
import { IMPACT_TYPES } from "@/lib/content";
import { fmtDate, fmtT, fmtUsd } from "@/lib/format";
import type { AdminSummary } from "@/lib/types";
import { RequestStatusBadge } from "./request-status";
import { useApi } from "./session";
import { ButtonLink, Card, ErrorNote, Loading, PageHeader, StatCard } from "./ui";

export function AdminOverview() {
  const { data, error } = useApi<AdminSummary>("/api/v1/admin/summary");
  if (error) return <ErrorNote message={error} />;
  if (!data) return <Loading />;

  return (
    <div>
      <PageHeader
        title="Platform overview"
        subtitle="Requests, capacity and billing across Rukh."
        action={
          <div className="flex gap-2">
            <ButtonLink href="/dashboard/map" variant="secondary">Field map</ButtonLink>
            <ButtonLink href="/dashboard/requests">Review requests</ButtonLink>
          </div>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon="📥" label="Pending requests" value={String(data.pending_requests)} sub={`${fmtUsd(data.pending_usd)} waiting`} />
        <StatCard icon="🌳" label="Protect capacity" value={fmtT(data.protect_available_t)} sub={`${data.plant_available_trees.toLocaleString()} planting slots`} />
        <StatCard icon="🧾" label="Billed" value={fmtUsd(data.billed_usd)} sub={`${fmtUsd(data.outstanding_usd)} outstanding`} />
        <StatCard icon="💼" label="Platform fees" value={fmtUsd(data.fees_usd)} sub={`${fmtT(data.allocated_t)} allocated`} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <p className="font-semibold">Latest requests</p>
            <Link href="/dashboard/requests" className="text-xs font-medium text-brand">View all</Link>
          </div>
          {data.recent_requests.length === 0 ? (
            <p className="mt-6 text-sm text-muted">No requests yet.</p>
          ) : (
            <ul className="mt-3 divide-y divide-border">
              {data.recent_requests.map((r) => (
                <li key={r.id}>
                  <Link href={`/dashboard/requests/${r.id}`} className="flex items-center justify-between gap-3 py-3 hover:opacity-80">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{r.requester} · {r.trip_name}</p>
                      <p className="text-xs text-muted">
                        #{r.id} · {fmtT(r.tonnes)} {IMPACT_TYPES[r.impact_type].name} · {fmtUsd(r.total_usd)} · {fmtDate(r.created_at)}
                      </p>
                    </div>
                    <RequestStatusBadge status={r.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card className="p-6">
          <p className="font-semibold">Network</p>
          <dl className="mt-4 space-y-3 text-sm">
            {[
              ["Climate Partners", data.climate_partners],
              ["Land Partners", data.land_partners],
              ["Fields enrolled", data.fields],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between border-b border-border pb-3 last:border-0">
                <dt className="text-muted">{k}</dt>
                <dd className="font-semibold">{v}</dd>
              </div>
            ))}
          </dl>
        </Card>
      </div>
    </div>
  );
}
