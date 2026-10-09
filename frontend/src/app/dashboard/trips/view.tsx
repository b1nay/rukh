"use client";

import Link from "next/link";
import { RoleOnly } from "@/components/dashboard/shell";
import { useApi } from "@/components/dashboard/session";
import { ButtonLink, Card, Empty, ErrorNote, Loading, Meter, PageHeader, TripStatusBadge } from "@/components/dashboard/ui";
import { fmtDate, fmtT } from "@/lib/format";
import type { TripSummary } from "@/lib/types";

export function View() {
  return (
    <RoleOnly side="organization">
      <Trips />
    </RoleOnly>
  );
}

function Trips() {
  const { data, error } = useApi<TripSummary[]>("/api/v1/climate/trips");
  const action = <ButtonLink href="/dashboard/trips/new">+ New trip</ButtonLink>;

  if (error) return <ErrorNote message={error} />;
  if (!data) return <Loading />;

  return (
    <div>
      <PageHeader title="Trips" subtitle="Each trip is a group of travelers and their flights." action={action} />
      {data.length === 0 ? (
        <Empty icon="✈️" title="No trips yet" body="Add travelers and their departure airports to measure CO₂." action={action} />
      ) : (
        <Card className="overflow-hidden">
          <div className="hidden grid-cols-[2fr_1fr_1fr_1.4fr_1fr] gap-4 border-b border-border bg-surface-muted px-5 py-3 text-xs font-medium text-muted md:grid">
            <span>Trip</span>
            <span>Start</span>
            <span>Travelers</span>
            <span>Covered</span>
            <span className="text-right">Status</span>
          </div>
          <ul className="divide-y divide-border">
            {data.map((t) => (
              <li key={t.id}>
                <Link
                  href={`/dashboard/trips/${t.id}`}
                  className="grid gap-2 px-5 py-4 transition hover:bg-surface-muted/60 md:grid-cols-[2fr_1fr_1fr_1.4fr_1fr] md:items-center md:gap-4"
                >
                  <span className="font-medium">{t.name}</span>
                  <span className="text-sm text-muted">{fmtDate(t.start_date)}</span>
                  <span className="text-sm text-muted">{t.travelers}</span>
                  <span className="flex items-center gap-3">
                    <span className="flex-1"><Meter value={t.covered_t} max={t.co2_t} /></span>
                    <span className="w-24 text-right text-xs text-muted">{fmtT(t.covered_t)} / {fmtT(t.co2_t)}</span>
                  </span>
                  <span className="md:text-right"><TripStatusBadge status={t.status} /></span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
