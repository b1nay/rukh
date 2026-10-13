"use client";

import Link from "next/link";
import { useState } from "react";
import { RequestStatusBadge } from "@/components/dashboard/request-status";
import { RoleOnly } from "@/components/dashboard/shell";
import { useApi } from "@/components/dashboard/session";
import { Card, Empty, ErrorNote, Loading, PageHeader } from "@/components/dashboard/ui";
import { IMPACT_TYPES } from "@/lib/content";
import { fmtDate, fmtT, fmtSol } from "@/lib/format";
import type { AllocationRequest } from "@/lib/types";

const TABS = [
  ["pending", "Pending"],
  ["", "All"],
  ["allocated", "Allocated"],
  ["partial", "Partial"],
  ["rejected", "Declined"],
  ["cancelled", "Cancelled"],
] as const;

export function View() {
  return (
    <RoleOnly side="admin">
      <Requests />
    </RoleOnly>
  );
}

function Requests() {
  const [tab, setTab] = useState<string>("pending");
  const { data, error } = useApi<AllocationRequest[]>(`/api/v1/admin/requests${tab ? `?status=${tab}` : ""}`);

  return (
    <div>
      <PageHeader title="Allocation requests" subtitle="Bills from Climate Partners waiting for fields and trees." />
      <div className="mb-4 flex flex-wrap gap-1.5">
        {TABS.map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`rounded-full border px-3 py-1 text-sm ${tab === k ? "border-brand bg-brand-soft text-brand" : "border-border text-muted hover:border-brand/50"}`}>
            {l}
          </button>
        ))}
      </div>
      {error ? (
        <ErrorNote message={error} />
      ) : !data ? (
        <Loading />
      ) : data.length === 0 ? (
        <Empty icon="📭" title="Nothing here" body="Requests appear when a Climate Partner clicks Request trees on a trip." />
      ) : (
        <Card className="overflow-hidden">
          <div className="max-h-[560px] overflow-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="sticky top-0 bg-surface-muted text-xs text-muted">
                <tr>
                  {["#", "Client", "Trip", "Type", "Tonnes", "Bill", "Sent", "Status", ""].map((h) => (
                    <th key={h} className="px-4 py-2.5 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.map((r) => (
                  <tr key={r.id} className="hover:bg-surface-muted/50">
                    <td className="px-4 py-3 text-muted">{r.id}</td>
                    <td className="px-4 py-3 font-medium">{r.requester}</td>
                    <td className="px-4 py-3">{r.trip_name}</td>
                    <td className="px-4 py-3">{IMPACT_TYPES[r.impact_type].name}</td>
                    <td className="px-4 py-3 tabular-nums">{fmtT(r.tonnes)}</td>
                    <td className="whitespace-nowrap px-4 py-3 tabular-nums">{fmtSol(r.total_sol)}</td>
                    <td className="px-4 py-3 text-muted">{fmtDate(r.created_at)}</td>
                    <td className="px-4 py-3"><RequestStatusBadge status={r.status} /></td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/dashboard/requests/${r.id}`} className="font-medium text-brand">
                        {r.status === "pending" ? "Allocate →" : "View"}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
