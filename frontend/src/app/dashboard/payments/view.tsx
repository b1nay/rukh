"use client";

import { useState } from "react";
import { RoleOnly } from "@/components/dashboard/shell";
import { useApi } from "@/components/dashboard/session";
import { Badge, Card, Empty, ErrorNote, Loading, PageHeader, StatCard } from "@/components/dashboard/ui";
import { fmtDate, fmtNpr, fmtT, fmtUsd, USD_TO_NPR } from "@/lib/format";
import type { LandPayments, ReceivedPayout } from "@/lib/types";

const TABS = { all: "All", paid: "Received", pending: "On the way" } as const;
type Tab = keyof typeof TABS;

export function View() {
  return (
    <RoleOnly side="landowner">
      <Payments />
    </RoleOnly>
  );
}

function Payments() {
  const { data, error } = useApi<LandPayments>("/api/v1/land/payouts");
  const [tab, setTab] = useState<Tab>("all");
  const [open, setOpen] = useState<number | null>(null);

  if (error) return <ErrorNote message={error} />;
  if (!data) return <Loading />;

  const t = data.totals;
  const items = data.items.filter((p) => tab === "all" || p.status === tab);

  return (
    <div>
      <PageHeader title="Payments" subtitle={`Money sent to you for your trees. Payments go to your ${t.method} account.`} />
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard icon="✅" label="Received" value={fmtNpr(t.received_usd)} sub={`${t.received_count} payment${t.received_count === 1 ? "" : "s"} · ${fmtUsd(t.received_usd)}`} />
        <StatCard icon="⏳" label="On the way" value={fmtNpr(t.pending_usd)} sub={`${t.pending_count} payment${t.pending_count === 1 ? "" : "s"} being prepared`} />
        <StatCard icon="📅" label="Last payment" value={t.last_paid_at ? fmtDate(t.last_paid_at) : "—"} sub={t.method} />
      </div>

      <div className="mt-6 flex gap-1 rounded-lg border border-border bg-white p-0.5 text-sm w-fit">
        {(Object.keys(TABS) as Tab[]).map((k) => (
          <button key={k} onClick={() => setTab(k)} className={`rounded-md px-3 py-1 ${tab === k ? "bg-brand-soft font-medium text-brand" : "text-muted"}`}>
            {TABS[k]}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {items.length === 0 ? (
          <Empty
            icon="💸"
            title={data.items.length === 0 ? "No payments yet" : "Nothing here"}
            body="When a Climate Partner funds your trees, Rukh prepares a payment for you. It shows here, and you're notified when it's sent."
          />
        ) : (
          <Card className="overflow-hidden">
            <ul className="divide-y divide-border">
              {items.map((p) => (
                <Row key={p.id} p={p} open={open === p.id} toggle={() => setOpen(open === p.id ? null : p.id)} />
              ))}
            </ul>
          </Card>
        )}
      </div>
    </div>
  );
}

function Row({ p, open, toggle }: { p: ReceivedPayout; open: boolean; toggle: () => void }) {
  return (
    <li>
      <button onClick={toggle} className="grid w-full gap-1 px-5 py-4 text-left text-sm hover:bg-surface-muted/50 md:grid-cols-[1.2fr_1.6fr_1fr_1fr] md:items-center md:gap-4">
        <div>
          <p className="font-medium">{p.number}</p>
          <p className="text-xs text-muted">{p.paid_at ? `Sent ${fmtDate(p.paid_at)}` : `Raised ${fmtDate(p.created_at)}`}</p>
        </div>
        <div className="min-w-0">
          <p className="truncate">{p.client ?? "—"}</p>
          <p className="truncate text-xs text-muted">{p.trip_name}</p>
        </div>
        <span>
          {p.status === "paid" ? <Badge tone="green">Received · {p.method}</Badge> : <Badge tone="amber">On the way</Badge>}
        </span>
        <span className="font-semibold text-brand md:text-right">{fmtNpr(p.amount_usd)}</span>
      </button>
      {open && (
        <div className="border-t border-border bg-surface-muted/40 px-5 py-4 text-sm">
          <ul className="space-y-1.5">
            {p.lines.map((l) => (
              <li key={l.field_id} className="flex justify-between gap-3">
                <span>
                  {l.field_name} <span className="text-muted">· {l.trees.toLocaleString()} trees · {fmtT(l.tonnes)} CO₂</span>
                </span>
                <span>{fmtNpr(l.amount)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted">
            {p.reference ? `Reference ${p.reference} · ` : ""}
            {fmtUsd(p.amount_usd)} at NPR {USD_TO_NPR} / USD
          </p>
        </div>
      )}
    </li>
  );
}
