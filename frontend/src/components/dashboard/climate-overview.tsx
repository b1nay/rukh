"use client";

import Link from "next/link";
import { useState } from "react";
import { fmtDate, fmtT, fmtUsd } from "@/lib/format";
import type { ClimateSummary, Itinerary } from "@/lib/types";
import { CoverageChart } from "./coverage-chart";
import { DepartureFlow, ItineraryCard } from "./departure";
import { RoleMap } from "./role-map";
import { useApi, useSession } from "./session";
import { ButtonLink, Card, Empty, ErrorNote, Loading, Meter, PageHeader, StatCard, TripStatusBadge } from "./ui";

export function ClimateOverview() {
  const { user } = useSession();
  const { data, error } = useApi<ClimateSummary>("/api/v1/climate/summary");
  const [starting, setStarting] = useState<Itinerary | null>(null);

  if (error) return <ErrorNote message={error} />;
  if (!data) return <Loading />;

  const coverage = data.co2_t > 0 ? Math.round((data.covered_t / data.co2_t) * 100) : 0;
  const newTrip = <ButtonLink href="/dashboard/trips/new">+ New trip</ButtonLink>;

  return (
    <div>
      <PageHeader title={`Welcome back, ${user.full_name.split(" ")[0]}`} subtitle={user.display_name} action={newTrip} />

      <section className="mb-8">
        <div className="mb-3 flex items-end justify-between">
          <div>
            <p className="font-semibold">{data.top_itineraries.some((i) => i.times_used > 0) ? "Your most-used itineraries" : "Start from a popular itinerary"}</p>
            <p className="text-xs text-muted">Pick one, enter the group, and the trip is ready.</p>
          </div>
          <Link href="/dashboard/itineraries" className="text-xs font-medium text-brand">All itineraries</Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {data.top_itineraries.map((it) => (
            <ItineraryCard key={it.id} it={it} onStart={setStarting} />
          ))}
        </div>
      </section>
      {starting && <DepartureFlow itinerary={starting} onClose={() => setStarting(null)} />}

      {data.trips === 0 ? (
        <Empty
          icon="✈️"
          title="No trips yet"
          body="Pick an itinerary above, or build your own, to measure your group's footprint and cover it with verified trees in Nepal."
          action={newTrip}
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard icon="☁️" label="CO₂ measured" value={fmtT(data.co2_t)} sub={`${data.travelers} travelers · ${data.trips} trips`} />
            <StatCard icon="✅" label="Covered" value={`${coverage}%`} sub={`${fmtT(data.covered_t)} of ${fmtT(data.co2_t)}`} />
            <StatCard
              icon="🌳"
              label="Trees funded"
              value={data.new_trees.toLocaleString()}
              sub={`new trees · ${data.tree_years.toLocaleString()} tree-years protected`}
            />
            <StatCard icon="💳" label="Spend" value={fmtUsd(data.spend_usd)} sub="Protect + Plant" />
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
            <Card className="p-6">
              <p className="font-semibold">Emissions by month</p>
              <p className="mb-5 text-xs text-muted">Tonnes of CO₂, by trip start month</p>
              <CoverageChart data={data.monthly} />
            </Card>

            <Card className="p-6">
              <div className="flex items-center justify-between">
                <p className="font-semibold">Recent trips</p>
                <Link href="/dashboard/trips" className="text-xs font-medium text-brand">View all</Link>
              </div>
              <ul className="mt-4 divide-y divide-border">
                {data.recent_trips.map((t) => (
                  <li key={t.id}>
                    <Link href={`/dashboard/trips/${t.id}`} className="block py-3 hover:opacity-80">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{t.name}</p>
                          <p className="text-xs text-muted">{fmtDate(t.start_date)} · {t.travelers} travelers</p>
                        </div>
                        <TripStatusBadge status={t.status} />
                      </div>
                      <div className="mt-2 flex items-center gap-3">
                        <div className="flex-1"><Meter value={t.covered_t} max={t.co2_t} /></div>
                        <span className="text-xs text-muted">{fmtT(t.co2_t)}</span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
          <div className="mt-6">
            <RoleMap
              path="/api/v1/climate/map"
              title="Where your trees grow"
              subtitle="Every field in Nepal your trips have funded."
              labels={{ allocated: "Your trees", free: "Other trees on the land", barren: "Land still to plant" }}
            />
          </div>
        </>
      )}
    </div>
  );
}
