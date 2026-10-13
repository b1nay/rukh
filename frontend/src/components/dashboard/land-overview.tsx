"use client";

import Link from "next/link";
import { fmtDate, fmtSol, fmtT } from "@/lib/format";
import type { Field, LandSummary } from "@/lib/types";
import { useApi, useSession } from "./session";
import { Badge, ButtonLink, Card, Empty, ErrorNote, Loading, Meter, PageHeader, StatCard } from "./ui";

export function LandOverview() {
  const { user } = useSession();
  const summary = useApi<LandSummary>("/api/v1/land/summary");
  const fields = useApi<Field[]>("/api/v1/land/fields");

  if (summary.error || fields.error) return <ErrorNote message={(summary.error || fields.error)!} />;
  if (!summary.data || !fields.data) return <Loading />;

  const s = summary.data;
  const addField = <ButtonLink href="/dashboard/fields/new">+ Add field</ButtonLink>;

  return (
    <div>
      <PageHeader title={`नमस्ते, ${user.full_name.split(" ")[0]}`} subtitle={user.display_name} action={addField} />

      {user.status === "pending_verification" && (
        <Card tint className="mb-6 flex flex-wrap items-center justify-between gap-4 p-5">
          <div>
            <p className="font-semibold">Finish setting up your account</p>
            <p className="text-sm text-muted">Add your first field so Climate Partners can fund your trees.</p>
          </div>
          {addField}
        </Card>
      )}

      {s.fields === 0 ? (
        <Empty icon="🌱" title="No fields yet" body="Add the land where your trees stand, or land you can plant on." action={addField} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard icon="💰" label="Total earned" value={fmtSol(s.earned_sol)} sub="Paid to your Solana wallet" />
            <StatCard icon="🌳" label="Trees enrolled" value={s.trees.toLocaleString()} sub={`${s.fields} fields`} />
            <StatCard icon="☁️" label="Yearly capacity" value={fmtT(s.annual_capacity_t)} sub={`${fmtT(s.allocated_t)} sold this year`} />
            <StatCard icon="🌱" label="Planting slots" value={s.planting_slots.toLocaleString()} sub="new trees you can host" />
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
            <Card className="p-6">
              <div className="flex items-center justify-between">
                <p className="font-semibold">My fields</p>
                <Link href="/dashboard/fields" className="text-xs font-medium text-brand">View all</Link>
              </div>
              <ul className="mt-4 space-y-4">
                {fields.data.slice(0, 4).map((f) => (
                  <li key={f.id}>
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="truncate font-medium">{f.name}</span>
                      <span className="shrink-0 text-xs text-muted">
                        {f.capacity_unit === "t"
                          ? `${fmtT(f.capacity_allocated)} / ${fmtT(f.capacity_total)} sold`
                          : `${f.capacity_allocated} / ${f.capacity_total} trees planted`}
                      </span>
                    </div>
                    <div className="mt-2">
                      <Meter value={f.capacity_allocated} max={f.capacity_total} />
                    </div>
                  </li>
                ))}
              </ul>
            </Card>

            <Card className="p-6">
              <div className="flex items-center justify-between">
                <p className="font-semibold">Recent earnings</p>
                <Link href="/dashboard/earnings" className="text-xs font-medium text-brand">View all</Link>
              </div>
              {s.recent_earnings.length === 0 ? (
                <p className="mt-6 text-sm text-muted">No sales yet. You&apos;ll see each Climate Partner that funds your trees here.</p>
              ) : (
                <ul className="mt-4 divide-y divide-border">
                  {s.recent_earnings.slice(0, 5).map((e) => (
                    <li key={e.id} className="flex items-center justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{e.partner}</p>
                        <p className="truncate text-xs text-muted">
                          {e.impact_type === "plant" ? `${e.trees} new trees` : `${fmtT(e.tonnes)} protected`} · {fmtDate(e.created_at)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-brand">+{fmtSol(e.landowner_sol)}</p>
                        <Badge tone="gray">{e.impact_type === "plant" ? "Plant" : "Protect"}</Badge>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
