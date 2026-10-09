"use client";

import Link from "next/link";
import { useState } from "react";
import { api } from "@/lib/api";
import { fmtDate, fmtUsd } from "@/lib/format";
import type { Invoice, InvoiceList, InvoiceStatus } from "@/lib/types";
import { Modal } from "./modal";
import { useApi } from "./session";
import { Badge, Card, Empty, ErrorNote, inputCls, Loading, StatCard } from "./ui";

const STATUS: Record<InvoiceStatus, ["green" | "amber" | "gray", string]> = {
  unpaid: ["amber", "Unpaid"],
  overdue: ["amber", "Overdue"],
  paid: ["green", "Paid"],
  void: ["gray", "Void"],
};

const TABS: [string, string][] = [
  ["", "All"],
  ["unpaid", "Unpaid"],
  ["overdue", "Overdue"],
  ["paid", "Paid"],
];

const METHODS = [
  ["khalti", "Khalti", "🟣"],
  ["esewa", "eSewa", "🟢"],
  ["card", "Card", "💳"],
  ["bank_transfer", "Bank transfer", "🏦"],
] as const;

/** Invoice list with totals and filters. `admin` shows every client and lets Rukh mark bills paid. */
export function Invoices({ admin }: { admin?: boolean }) {
  const [status, setStatus] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [q, setQ] = useState("");
  const params = new URLSearchParams(Object.entries({ status, from, to, q }).filter(([, v]) => v));
  const base = admin ? "/api/v1/admin/invoices" : "/api/v1/climate/invoices";
  const { data, error, reload } = useApi<InvoiceList>(`${base}${params.size ? `?${params}` : ""}`);
  const [open, setOpen] = useState<Invoice | null>(null);
  const [paying, setPaying] = useState<Invoice | null>(null);

  async function markPaid(inv: Invoice) {
    if (!confirm(`Mark ${inv.number} as paid?`)) return;
    await api.post(`/api/v1/admin/invoices/${inv.id}/mark-paid`);
    reload();
  }

  const t = data?.totals;
  return (
    <div>
      {t && (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard icon="🧾" label="Billed" value={fmtUsd(t.billed_usd)} sub={`${t.count} invoice${t.count === 1 ? "" : "s"}`} />
          <StatCard icon="✅" label="Paid" value={fmtUsd(t.paid_usd)} />
          <StatCard icon="⏳" label="Outstanding" value={fmtUsd(t.outstanding_usd)} />
          <StatCard icon="⚠️" label="Overdue" value={fmtUsd(t.overdue_usd)} />
        </div>
      )}

      <Card className="mb-4 flex flex-wrap items-end gap-3 p-4">
        <div className="flex flex-wrap gap-1.5">
          {TABS.map(([k, l]) => (
            <button key={k} onClick={() => setStatus(k)} className={`rounded-full border px-3 py-1 text-sm ${status === k ? "border-brand bg-brand-soft text-brand" : "border-border text-muted hover:border-brand/50"}`}>
              {l}
            </button>
          ))}
        </div>
        <label className="text-xs text-muted">
          From
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={`${inputCls} mt-1 w-40 py-1.5`} />
        </label>
        <label className="text-xs text-muted">
          To
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={`${inputCls} mt-1 w-40 py-1.5`} />
        </label>
        <label className="min-w-48 flex-1 text-xs text-muted">
          Search
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={admin ? "Invoice no., trip or client" : "Invoice no. or trip"} className={`${inputCls} mt-1 py-1.5`} />
        </label>
        {(status || from || to || q) && (
          <button onClick={() => { setStatus(""); setFrom(""); setTo(""); setQ(""); }} className="pb-2 text-xs font-medium text-muted hover:text-foreground">
            Clear filters
          </button>
        )}
      </Card>

      {error ? (
        <ErrorNote message={error} />
      ) : !data ? (
        <Loading />
      ) : data.items.length === 0 ? (
        <Empty
          icon="🧾"
          title={t?.count ? "No bills match these filters" : "No bills yet"}
          body={admin ? "Invoices are issued when you allocate a request." : "You'll get a bill from Rukh when trees are allocated to one of your trips."}
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="max-h-[560px] overflow-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="sticky top-0 bg-surface-muted text-xs text-muted">
                <tr>
                  {["Invoice", ...(admin ? ["Client"] : []), "Trip", "Issued", "Due", "Amount", "Status", ""].map((h) => (
                    <th key={h} className="px-4 py-2.5 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.items.map((inv) => {
                  const [tone, label] = STATUS[inv.status];
                  return (
                    <tr key={inv.id} className="hover:bg-surface-muted/50">
                      <td className="px-4 py-3">
                        <button onClick={() => setOpen(inv)} className="font-mono text-xs font-medium text-brand">{inv.number}</button>
                      </td>
                      {admin && <td className="px-4 py-3 font-medium">{inv.client}</td>}
                      <td className="px-4 py-3">
                        {inv.trip_id && !admin ? <Link href={`/dashboard/trips/${inv.trip_id}`} className="hover:text-brand">{inv.trip_name}</Link> : inv.trip_name ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-muted">{fmtDate(inv.issued_at)}</td>
                      <td className={`px-4 py-3 ${inv.status === "overdue" ? "font-medium text-amber-700" : "text-muted"}`}>{fmtDate(inv.due_at)}</td>
                      <td className="px-4 py-3 font-semibold tabular-nums">{fmtUsd(inv.total_usd)}</td>
                      <td className="px-4 py-3"><Badge tone={tone}>{label}</Badge></td>
                      <td className="px-4 py-3 text-right">
                        {inv.status === "unpaid" || inv.status === "overdue" ? (
                          admin ? (
                            <button onClick={() => markPaid(inv)} className="text-xs font-medium text-brand">Mark paid</button>
                          ) : (
                            <button onClick={() => setPaying(inv)} className="rounded-md bg-brand px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-strong">Pay now</button>
                          )
                        ) : (
                          <button onClick={() => setOpen(inv)} className="text-xs font-medium text-muted hover:text-foreground">View</button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {open && <InvoiceModal inv={open} onClose={() => setOpen(null)} onPay={admin ? undefined : () => { setPaying(open); setOpen(null); }} />}
      {paying && <PayModal inv={paying} onClose={() => setPaying(null)} onPaid={() => { setPaying(null); reload(); }} />}
    </div>
  );
}

function InvoiceModal({ inv, onClose, onPay }: { inv: Invoice; onClose: () => void; onPay?: () => void }) {
  const [tone, label] = STATUS[inv.status];
  const payable = inv.status === "unpaid" || inv.status === "overdue";
  return (
    <Modal
      wide
      title={`Invoice ${inv.number}`}
      subtitle={`Rukh → ${inv.client}`}
      onClose={onClose}
      footer={
        <>
          <button onClick={() => window.print()} className="text-sm font-medium text-muted hover:text-foreground">Print</button>
          {payable && onPay && (
            <button onClick={onPay} className="rounded-md bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-strong">
              Pay {fmtUsd(inv.total_usd)} →
            </button>
          )}
        </>
      }
    >
      <div className="flex flex-wrap justify-between gap-4 text-sm">
        <div>
          <p className="font-medium">{inv.description}</p>
          <p className="text-xs text-muted">Issued {fmtDate(inv.issued_at)} · Due {fmtDate(inv.due_at)}</p>
        </div>
        <Badge tone={tone}>{label}</Badge>
      </div>
      <table className="mt-5 w-full text-sm">
        <thead className="border-b border-border text-left text-xs text-muted">
          <tr>
            <th className="py-2 font-medium">Item</th>
            <th className="py-2 text-right font-medium">Qty</th>
            <th className="py-2 text-right font-medium">Price</th>
            <th className="py-2 text-right font-medium">Amount</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {inv.lines.map((l, i) => (
            <tr key={i}>
              <td className="py-2.5">{l.description}</td>
              <td className="py-2.5 text-right tabular-nums">{l.quantity.toLocaleString()} {l.unit}</td>
              <td className="py-2.5 text-right tabular-nums">{fmtUsd(l.unit_price)}</td>
              <td className="py-2.5 text-right tabular-nums">{fmtUsd(l.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="ml-auto mt-4 w-60 space-y-1 text-sm">
        <p className="flex justify-between"><span className="text-muted">Subtotal</span><span>{fmtUsd(inv.subtotal_usd)}</span></p>
        <p className="flex justify-between"><span className="text-muted">Platform fee</span><span>{fmtUsd(inv.fee_usd)}</span></p>
        <p className="flex justify-between border-t border-border pt-2 text-base font-semibold"><span>Total</span><span>{fmtUsd(inv.total_usd)}</span></p>
      </div>
      {inv.paid_at && (
        <p className="mt-5 rounded-xl bg-brand-soft p-3 text-sm text-brand-strong">
          Paid {fmtDate(inv.paid_at)} by {inv.payment_method} · ref {inv.payment_reference}
        </p>
      )}
    </Modal>
  );
}

function PayModal({ inv, onClose, onPaid }: { inv: Invoice; onClose: () => void; onPaid: () => void }) {
  const [method, setMethod] = useState<(typeof METHODS)[number][0]>("khalti");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pay() {
    setBusy(true);
    setError(null);
    try {
      await api.post(`/api/v1/climate/invoices/${inv.id}/pay`, { method });
      onPaid();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Payment failed");
      setBusy(false);
    }
  }

  return (
    <Modal
      title={`Pay ${fmtUsd(inv.total_usd)}`}
      subtitle={`${inv.number} · ${inv.trip_name ?? inv.description}`}
      onClose={onClose}
      footer={
        <>
          <span className="text-xs text-muted">Demo mode: no money is charged.</span>
          <button onClick={pay} disabled={busy} className="rounded-md bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-strong disabled:opacity-60">
            {busy ? "Processing…" : "Pay now"}
          </button>
        </>
      }
    >
      <p className="mb-3 text-sm font-medium">Payment method</p>
      <div className="grid grid-cols-2 gap-2">
        {METHODS.map(([k, label, icon]) => (
          <button
            key={k}
            onClick={() => setMethod(k)}
            className={`flex items-center gap-2 rounded-xl border p-3 text-left text-sm transition ${method === k ? "border-brand bg-brand-soft/40 ring-1 ring-brand/30" : "border-border hover:border-brand/50"}`}
          >
            <span>{icon}</span> {label}
          </button>
        ))}
      </div>
      {error && <p className="mt-4 rounded-lg bg-red-50 p-2.5 text-sm text-red-700">{error}</p>}
    </Modal>
  );
}
