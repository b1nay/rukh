"use client";

import { useState } from "react";
import { DepartureFlow, ItineraryCard } from "@/components/dashboard/departure";
import { RoleOnly } from "@/components/dashboard/shell";
import { useApi } from "@/components/dashboard/session";
import { ButtonLink, ErrorNote, Loading, PageHeader } from "@/components/dashboard/ui";
import { api } from "@/lib/api";
import type { Itinerary } from "@/lib/types";

export function View() {
  return (
    <RoleOnly side="organization">
      <Itineraries />
    </RoleOnly>
  );
}

function Itineraries() {
  const { data, error, reload } = useApi<Itinerary[]>("/api/v1/climate/itineraries");
  const [starting, setStarting] = useState<Itinerary | null>(null);

  if (error) return <ErrorNote message={error} />;
  if (!data) return <Loading />;

  const own = data.filter((i) => !i.is_template);
  const starters = data.filter((i) => i.is_template);

  async function archive(it: Itinerary) {
    if (!confirm(`Remove "${it.name}"? Past trips keep their itinerary.`)) return;
    await api.del(`/api/v1/climate/itineraries/${it.id}`);
    reload();
  }

  return (
    <div>
      <PageHeader
        title="Itineraries"
        subtitle="Fixed routes you run again and again. Start a departure in two steps."
        action={<ButtonLink href="/dashboard/trips/new">+ Build itinerary</ButtonLink>}
      />

      <Section title="Your itineraries" note={own.length ? "Most used first" : "Itineraries you build are saved here automatically."}>
        {own.map((it) => (
          <div key={it.id} className="relative">
            <ItineraryCard it={it} onStart={setStarting} />
            <button onClick={() => archive(it)} className="absolute bottom-5 right-5 text-xs text-muted hover:text-red-600">
              Remove
            </button>
          </div>
        ))}
      </Section>

      <Section title="Popular in Nepal" note="Starter itineraries you can use as they are, or copy and edit from New trip.">
        {starters.map((it) => (
          <ItineraryCard key={it.id} it={it} onStart={setStarting} />
        ))}
      </Section>

      {starting && <DepartureFlow itinerary={starting} onClose={() => setStarting(null)} />}
    </div>
  );
}

function Section({ title, note, children }: { title: string; note: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <p className="font-semibold">{title}</p>
      <p className="mb-4 text-xs text-muted">{note}</p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{children}</div>
    </section>
  );
}
