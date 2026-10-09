"use client";

import { useState } from "react";
import { DotGrid, FieldMap, MapLegend } from "@/components/dashboard/field-map";
import { RoleOnly } from "@/components/dashboard/shell";
import { useApi } from "@/components/dashboard/session";
import { Badge, ButtonLink, Card, Empty, ErrorNote, Loading, PageHeader, StatCard } from "@/components/dashboard/ui";
import type { FieldMapData, MapField } from "@/lib/types";

const FILTERS = {
  all: { label: "All fields", test: () => true },
  existing: { label: "Standing trees", test: (f: MapField) => f.kind === "existing" },
  planting: { label: "Bare land", test: (f: MapField) => f.kind === "planting" },
  free: { label: "Has free capacity", test: (f: MapField) => f.trees_free > 0 },
} as const;

export function View() {
  return (
    <RoleOnly side="admin">
      <FieldMapPage />
    </RoleOnly>
  );
}

function FieldMapPage() {
  const { data, error } = useApi<FieldMapData>("/api/v1/admin/map");
  const [filter, setFilter] = useState<keyof typeof FILTERS>("all");
  const [focus, setFocus] = useState<number | null>(null);

  if (error) return <ErrorNote message={error} />;
  if (!data) return <Loading />;

  const { totals } = data;
  const fields = data.fields.filter(FILTERS[filter].test);
  const approx = data.fields.filter((f) => f.approximate).length;

  return (
    <div>
      <PageHeader
        title="Field map"
        subtitle="Every field onboarded from Land Partners, tree by tree."
        action={<ButtonLink href="/dashboard/requests" variant="secondary">Allocation requests</ButtonLink>}
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon="🗺" label="Fields" value={totals.fields.toLocaleString()} sub={`${totals.area_ha.toLocaleString()} ha enrolled`} />
        <StatCard icon="🟢" label="Free trees" value={totals.trees_free.toLocaleString()} sub="standing, not yet allocated" />
        <StatCard icon="🔴" label="Allocated trees" value={totals.trees_allocated.toLocaleString()} sub="funded by Climate Partners" />
        <StatCard icon="🟡" label="Bare land" value={totals.barren_slots.toLocaleString()} sub="tree slots ready to plant" />
      </div>

      {data.fields.length === 0 ? (
        <div className="mt-6">
          <Empty icon="🌱" title="No fields yet" body="Fields appear here as soon as Land Partners enrol them." />
        </div>
      ) : (
        <>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(FILTERS) as (keyof typeof FILTERS)[]).map((k) => (
                <button
                  key={k}
                  onClick={() => setFilter(k)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium ${filter === k ? "bg-brand text-white" : "border border-border bg-white text-muted hover:text-foreground"}`}
                >
                  {FILTERS[k].label}
                </button>
              ))}
            </div>
            <MapLegend />
          </div>
          <div className="mt-3">
            <FieldMap fields={fields} focusId={focus} />
          </div>
          <p className="mt-2 text-xs text-muted">
            Zoom in to see each field&apos;s trees as dots.
            {approx > 0 && ` ${approx} field${approx === 1 ? " has" : "s have"} no GPS yet and ${approx === 1 ? "is" : "are"} shown at the district centre.`}
          </p>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {fields.map((f) => (
              <button
                key={f.id}
                onClick={() => {
                  setFocus(f.id);
                  document.getElementById("field-map")?.scrollIntoView({ behavior: "smooth", block: "center" });
                }}
                className="text-left"
              >
                <Card className={`h-full p-4 transition hover:border-brand ${focus === f.id ? "border-brand" : ""}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{f.name}</p>
                      <p className="truncate text-xs text-muted">{f.landowner} · {f.district}</p>
                    </div>
                    <Badge tone={f.kind === "planting" ? "amber" : "green"}>{f.kind === "planting" ? "Bare land" : "Trees"}</Badge>
                  </div>
                  <div className="mt-3">
                    <DotGrid field={f} />
                  </div>
                  <p className="mt-2 text-xs text-muted">
                    {f.species_name} · {f.area_ha} ha · {f.trees_allocated.toLocaleString()} of {f.trees_total.toLocaleString()} {f.kind === "planting" ? "slots" : "trees"} allocated
                  </p>
                </Card>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
