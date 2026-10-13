"use client";

import Link from "next/link";
import { RoleOnly } from "@/components/dashboard/shell";
import { useApi } from "@/components/dashboard/session";
import { Badge, ButtonLink, Card, Empty, ErrorNote, Loading, Meter, PageHeader } from "@/components/dashboard/ui";
import { RoleMap } from "@/components/dashboard/role-map";
import { fmtSol, fmtT, osmLink } from "@/lib/format";
import type { Field } from "@/lib/types";

export function View() {
  return (
    <RoleOnly side="landowner">
      <Fields />
    </RoleOnly>
  );
}

function Fields() {
  const { data, error } = useApi<Field[]>("/api/v1/land/fields");
  const action = <ButtonLink href="/dashboard/fields/new">+ Add field</ButtonLink>;

  if (error) return <ErrorNote message={error} />;
  if (!data) return <Loading />;

  return (
    <div>
      <PageHeader title="My fields" subtitle="Land and trees you've enrolled." action={action} />
      {data.length === 0 ? (
        <Empty icon="🌱" title="No fields yet" body="Add your first field to start earning." action={action} />
      ) : (
        <>
        <div className="mb-6">
          <RoleMap path="/api/v1/land/map" title="Your land on the map" subtitle="Each dot is a share of your trees." labels={{ allocated: "Funded by Climate Partners", free: "Trees not yet funded", barren: "Land waiting for new trees" }} />
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          {data.map((f) => (
            <Card key={f.id} tint className="p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Link href={`/dashboard/fields/${f.id}`} className="font-semibold hover:text-brand">{f.name}</Link>
                  <p className="text-xs text-muted">{f.district} · {f.area_ha.toFixed(2)} ha · {f.species_name}</p>
                </div>
                <Badge tone={f.status === "verified" ? "green" : "amber"}>{f.status === "verified" ? "✓ Verified" : "Pending check"}</Badge>
              </div>

              <div className="mt-5 grid grid-cols-3 gap-2 text-center">
                <Mini label={f.kind === "existing" ? "Trees" : "Slots"} value={f.tree_count.toLocaleString()} />
                <Mini label={f.kind === "existing" ? "CO₂ / year" : "Planted"} value={f.kind === "existing" ? fmtT(f.capacity_total) : f.capacity_allocated.toLocaleString()} />
                <Mini label="Earned" value={fmtSol(f.earned_sol)} />
              </div>

              <div className="mt-5">
                <div className="mb-1.5 flex justify-between text-xs text-muted">
                  <span>{f.kind === "existing" ? "Sold this year" : "Trees reserved"}</span>
                  <span>
                    {f.capacity_unit === "t"
                      ? `${fmtT(f.capacity_allocated)} of ${fmtT(f.capacity_total)}`
                      : `${f.capacity_allocated.toLocaleString()} of ${f.capacity_total.toLocaleString()}`}
                  </span>
                </div>
                <Meter value={f.capacity_allocated} max={f.capacity_total} />
              </div>

              <div className="mt-4 flex items-center justify-between gap-3 text-xs">
                <Badge tone="gray">{f.kind === "existing" ? "Protect · existing trees" : "Plant · new trees"}</Badge>
                <span className="flex gap-4">
                  {f.latitude != null && f.longitude != null && (
                    <a href={osmLink(f.latitude, f.longitude)} target="_blank" rel="noreferrer" className="font-medium text-muted hover:text-brand">
                      Map ↗
                    </a>
                  )}
                  <Link href={`/dashboard/fields/${f.id}`} className="font-medium text-brand">
                    Trees &amp; carbon →
                  </Link>
                </span>
              </div>
            </Card>
          ))}
        </div>
        </>
      )}
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-white px-2 py-3">
      <p className="text-sm font-semibold">{value}</p>
      <p className="text-[11px] text-muted">{label}</p>
    </div>
  );
}
