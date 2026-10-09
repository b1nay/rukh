"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { RoleOnly } from "@/components/dashboard/shell";
import { useApi } from "@/components/dashboard/session";
import { Badge, Card, Empty, ErrorNote, Loading, PageHeader, StatCard } from "@/components/dashboard/ui";
import { api } from "@/lib/api";
import { fmtDate, fmtNpr, fmtUsd } from "@/lib/format";
import type { InvoiceStatus, Payout, PayoutList } from "@/lib/types";

const TABS = { pending: "To pay", paid: "Paid", all: "All" } as const;
type Tab = keyof typeof TABS;

const INVOICE_TONE: Record<InvoiceStatus, ["green" | "amber" | "gray", string]> = {
  paid: ["green", "Client paid"],
  unpaid: ["gray", "Client unpaid"],
  overdue: ["amber", "Client overdue"],
  void: ["gray", "Invoice void"],
};

export function View() {
  return (
    <RoleOnly side="admin">
      <Suspense fallback={<Loading />}>
        <Payouts />
      </Suspense>
    </RoleOnly>
  );
}

function Payouts() {
  const router = useRouter();
  // ?request=…&invoice=…&total=… is set when arriving straight from an allocation
  const q = useSearchParams();
  const arrived = q.get("request") ? { request: q.get("request")!, invoice: q.get("invoice"), total: Number(q.get("total")) || null } : null;
  const [tab, setTab] = useState<Tab>("pending");
  const [chosen, setChosen] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const params = new URLSearchParams();
  if (tab !== "all") params.set("status", tab);
  if (arrived) params.set("request", arrived.request);
  const { data, error, reload } = useApi<PayoutList>(`/api/v1/admin/payouts?${params}`);

  if (error) return <ErrorNote message={error} />;
  if (!data) return <Loading />;

  const pending = data.items.filter((p) => p.status === "pending");
  const selection = pending.filter((p) => chosen.has(p.id));
  const client = data.items.find((p) => p.client)?.client;

  async function pay(items: Payout[]) {
    setBusy(true);
    setMsg(null);
    try {
      await api.post<Payout[]>("/api/v1/admin/payouts/pay", { ids: items.map((p) => p.id) });
      const total = items.reduce((s, p) => s + p.amount_usd, 0);
      setMsg({ ok: true, text: `Sent ${fmtNpr(total)} to ${items.length} landowner${items.length === 1 ? "" : "s"}. They've been notified.` });
      setChosen(new Set());
      reload();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Payment failed" });
    } finally {
      setBusy(false);
    }
  }

  function showAll() {
    router.replace("/dashboard/payouts");
  }

  return (
    <div>
      <PageHeader title="Pay landowners" subtitle="Payments are raised automatically when trees on a landowner's field are allocated." />

      {arrived && (
        <Card tint className="mb-6 flex flex-wrap items-center justify-between gap-3 border-brand/30 p-4 text-sm">
          <div>
            <p className="font-medium text-brand-strong">
              ✓ Trees allocated{arrived.invoice ? `. Invoice ${arrived.invoice}` : ""}
              {arrived.total ? ` (${fmtUsd(arrived.total)})` : ""} sent to {client ?? "the client"}.
            </p>
            <p className="text-xs text-muted">
              Showing the landowner payments for request #{arrived.request}.{" "}
              <Link href={`/dashboard/requests/${arrived.request}`} className="text-brand">View request</Link>
            </p>
          </div>
          <button onClick={showAll} className="text-xs font-medium text-muted hover:text-foreground">Show all payments</button>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard icon="⏳" label="Waiting to be paid" value={fmtNpr(data.totals.pending_usd)} sub={`${data.totals.pending_count} payment${data.totals.pending_count === 1 ? "" : "s"} · ${fmtUsd(data.totals.pending_usd)}`} />
        <StatCard icon="✅" label="Paid out" value={fmtNpr(data.totals.paid_usd)} sub={fmtUsd(data.totals.paid_usd)} />
        <StatCard icon="👩‍🌾" label="Landowners" value={String(data.totals.landowners)} sub="with payments raised" />
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1.5">
          {(Object.keys(TABS) as Tab[]).map((k) => (
            <button
              key={k}
              onClick={() => { setTab(k); setChosen(new Set()); }}
              className={`rounded-full px-3 py-1.5 text-xs font-medium ${tab === k ? "bg-brand text-white" : "border border-border bg-white text-muted hover:text-foreground"}`}
            >
              {TABS[k]}
            </button>
          ))}
        </div>
        {pending.length > 0 && (
          <button
            onClick={() => pay(selection.length ? selection : pending)}
            disabled={busy}
            className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-strong disabled:opacity-50"
          >
            {busy
              ? "Paying…"
              : selection.length
                ? `Pay ${selection.length} selected · ${fmtNpr(selection.reduce((s, p) => s + p.amount_usd, 0))}`
                : `Pay all ${pending.length} · ${fmtNpr(pending.reduce((s, p) => s + p.amount_usd, 0))}`}
          </button>
        )}
      </div>

      {msg && (
        <p className={`mt-4 rounded-xl border p-3 text-sm ${msg.ok ? "border-brand/30 bg-brand-soft text-brand-strong" : "border-red-200 bg-red-50 text-red-700"}`}>{msg.text}</p>
      )}

      <div className="mt-4">
        {data.items.length === 0 ? (
          <Empty
            icon="💸"
            title={tab === "pending" ? "Nothing to pay" : "No payments yet"}
            body="Allocating a request creates a payment for every landowner whose trees were used."
          />
        ) : (
          <Card className="overflow-hidden">
            <div className="hidden grid-cols-[24px_1.4fr_1.6fr_1.2fr_1fr_auto] gap-4 border-b border-border bg-surface-muted px-5 py-3 text-xs font-medium text-muted lg:grid">
              <span />
              <span>Landowner</span>
              <span>Trees</span>
              <span>Funded by</span>
              <span className="text-right">Amount</span>
              <span className="w-24" />
            </div>
            <ul className="divide-y divide-border">
              {data.items.map((p) => {
                const [tone, label] = p.invoice_status ? INVOICE_TONE[p.invoice_status] : (["gray", "—"] as const);
                return (
                  <li key={p.id} className="grid gap-2 px-5 py-4 text-sm lg:grid-cols-[24px_1.4fr_1.6fr_1.2fr_1fr_auto] lg:items-center lg:gap-4">
                    <span>
                      {p.status === "pending" && (
                        <input
                          type="checkbox"
                          checked={chosen.has(p.id)}
                          onChange={() => {
                            const next = new Set(chosen);
                            if (next.has(p.id)) next.delete(p.id);
                            else next.add(p.id);
                            setChosen(next);
                          }}
                          aria-label={`Select ${p.number}`}
                          className="accent-green-600"
                        />
                      )}
                    </span>
                    <div className="min-w-0">
                      <p className="font-medium">{p.landowner}</p>
                      <p className="text-xs text-muted">{p.number} · {p.method ?? "—"}{p.landowner_phone ? ` · ${p.landowner_phone}` : ""}</p>
                    </div>
                    <div className="min-w-0 text-xs text-muted">
                      {p.lines.map((l) => (
                        <p key={l.field_id} className="truncate">
                          <span className="text-foreground">{l.field_name}</span> · {l.trees.toLocaleString()} trees · {l.tonnes.toLocaleString(undefined, { maximumFractionDigits: 2 })} t
                        </p>
                      ))}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate">{p.client ?? "—"}</p>
                      <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
                        {p.invoice_number} <Badge tone={tone}>{label}</Badge>
                      </p>
                    </div>
                    <div className="lg:text-right">
                      <p className="font-semibold">{fmtNpr(p.amount_usd)}</p>
                      <p className="text-xs text-muted">{fmtUsd(p.amount_usd)}</p>
                    </div>
                    <div className="w-24 lg:text-right">
                      {p.status === "pending" ? (
                        <button
                          onClick={() => pay([p])}
                          disabled={busy}
                          className="rounded-md border border-brand px-3 py-1.5 text-xs font-medium text-brand hover:bg-brand hover:text-white disabled:opacity-50"
                        >
                          Pay
                        </button>
                      ) : (
                        <span className="text-xs text-muted">
                          <Badge>Paid</Badge>
                          <span className="mt-1 block">{p.paid_at ? fmtDate(p.paid_at) : ""}</span>
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
        )}
      </div>
      <p className="mt-3 text-xs text-muted">Demo payments: no money moves. Each landowner is paid by the method they chose at sign-up.</p>
    </div>
  );
}
