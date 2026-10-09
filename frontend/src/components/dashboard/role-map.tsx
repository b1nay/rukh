"use client";

import { useState } from "react";
import type { FieldMapData } from "@/lib/types";
import { FieldMap, MapLegend, type MapLabels } from "./field-map";
import { useApi } from "./session";
import { Card } from "./ui";

/** A titled map card for a role's own map endpoint (/land/map, /climate/map). */
export function RoleMap({
  path,
  title,
  subtitle,
  labels,
  className = "h-[420px]",
}: {
  path: string;
  title: string;
  subtitle?: string;
  labels: MapLabels;
  className?: string;
}) {
  const { data } = useApi<FieldMapData>(path);
  const [focus, setFocus] = useState<number | null>(null);
  if (!data || data.fields.length === 0) return null;

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-semibold">{title}</p>
          {subtitle && <p className="text-xs text-muted">{subtitle}</p>}
        </div>
        <MapLegend labels={labels} />
      </div>
      {data.fields.length > 1 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {data.fields.map((f) => (
            <button
              key={f.id}
              onClick={() => setFocus(f.id)}
              className={`rounded-full border px-2.5 py-1 text-xs ${focus === f.id ? "border-brand text-brand" : "border-border text-muted hover:text-foreground"}`}
            >
              {f.name}
            </button>
          ))}
        </div>
      )}
      <div className="mt-3">
        <FieldMap fields={data.fields} focusId={focus} labels={{ allocated: labels.allocated.toLowerCase(), free: labels.free.toLowerCase(), barren: labels.barren.toLowerCase() }} className={className} />
      </div>
      <p className="mt-2 text-xs text-muted">Zoom in to see every tree as a dot.</p>
    </Card>
  );
}
