"use client";

import { RoleOnly } from "@/components/dashboard/shell";
import { useApi } from "@/components/dashboard/session";
import { Badge, Card, Empty, ErrorNote, Loading, PageHeader, StatCard } from "@/components/dashboard/ui";
import { fmtDate, fmtSol, fmtT } from "@/lib/format";
import type { Earning } from "@/lib/types";

export function View() {
  return (
    <RoleOnly side="landowner">
      <Earnings />
    </RoleOnly>
  );
}

function Earnings() {
  const { data, error } = useApi<Earning[]>("/api/v1/land/earnings");

  if (error) return <ErrorNote message={error} />;
  if (!data) return <Loading />;

  const total = data.reduce((s, e) => s + e.landowner_sol, 0);
  const trees = data.reduce((s, e) => s + e.trees, 0);
  const tonnes = data.reduce((s, e) => s + e.tonnes, 0);

  return (
    <div>
      <PageHeader title="Earnings" subtitle="Every Climate Partner that funded your trees. Rukh pays you for every sale by your chosen method." />
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard icon="💰" label="Total earned" value={fmtSol(total)} sub="Paid to your Solana wallet" />
        <StatCard icon="☁️" label="CO₂ sold" value={fmtT(tonnes)} sub={`${data.length} sales`} />
        <StatCard icon="🌱" label="New trees funded" value={trees.toLocaleString()} sub="to plant and care for" />
      </div>

      <div className="mt-6">
        {data.length === 0 ? (
          <Empty icon="🌿" title="No sales yet" body="When a Climate Partner allocates your trees, the sale shows up here." />
        ) : (
          <Card className="overflow-hidden">
            <div className="hidden grid-cols-[1.4fr_1.6fr_1fr_1fr_1fr] gap-4 border-b border-border bg-surface-muted px-5 py-3 text-xs font-medium text-muted md:grid">
              <span>Climate Partner</span>
              <span>Field</span>
              <span>Type</span>
              <span>Date</span>
              <span className="text-right">You earn</span>
            </div>
            <ul className="divide-y divide-border">
              {data.map((e) => (
                <li key={e.id} className="grid gap-1 px-5 py-4 text-sm md:grid-cols-[1.4fr_1.6fr_1fr_1fr_1fr] md:items-center md:gap-4">
                  <div>
                    <p className="font-medium">{e.partner}</p>
                    <p className="text-xs text-muted">{e.trip_name}</p>
                  </div>
                  <span className="text-muted">{e.field_name}</span>
                  <span>
                    <Badge tone={e.impact_type === "plant" ? "green" : "gray"}>
                      {e.impact_type === "plant" ? `Plant · ${e.trees} trees` : `Protect · ${fmtT(e.tonnes)}`}
                    </Badge>
                  </span>
                  <span className="text-muted">{fmtDate(e.created_at)}</span>
                  <span className="md:text-right">
                    <span className="font-semibold text-brand">+{fmtSol(e.landowner_sol)}</span>
                    {e.payout_status && (
                      <span className="mt-1 block">
                        <Badge tone={e.payout_status === "paid" ? "green" : "amber"}>{e.payout_status === "paid" ? "Paid" : "Payment pending"}</Badge>
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </div>
  );
}
