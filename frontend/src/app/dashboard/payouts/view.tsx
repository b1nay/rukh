"use client";

import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { RoleOnly } from "@/components/dashboard/shell";
import { useApi } from "@/components/dashboard/session";
import { ClusterNote, PayerWallet, useCheckout } from "@/components/dashboard/solana-pay";
import { Badge, Card, Empty, ErrorNote, inputCls, Loading, PageHeader, StatCard } from "@/components/dashboard/ui";
import { api } from "@/lib/api";
import { fmtDate, fmtSol } from "@/lib/format";
import { AddressLink, isAddress, TxLink, useSolanaConfig } from "@/lib/solana";
import type { InvoiceStatus, Payout, PayoutList, SolanaConfig, SolanaIntent } from "@/lib/types";

const PER_TRANSACTION = 8; // mirrors MAX_PER_TRANSACTION in backend/app/api/payouts.py

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
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const params = new URLSearchParams();
  if (tab !== "all") params.set("status", tab);
  if (arrived) params.set("request", arrived.request);
  const { data, error, reload } = useApi<PayoutList>(`/api/v1/admin/payouts?${params}`);
  const checkout = useCheckout();
  const busy = checkout.busy;

  if (error) return <ErrorNote message={error} />;
  if (!data) return <Loading />;

  const pending = data.items.filter((p) => p.status === "pending");
  const selection = pending.filter((p) => chosen.has(p.id));
  const client = data.items.find((p) => p.client)?.client;

  const payable = pending.filter((p) => p.wallet);
  const toPay = (selection.length ? selection : pending).filter((p) => p.wallet);

  async function pay(items: Payout[]) {
    setMsg(null);
    let sent = 0;
    try {
      // One transaction per batch; each landowner gets their own transfer inside it.
      for (let i = 0; i < items.length; i += PER_TRANSACTION) {
        const ids = items.slice(i, i + PER_TRANSACTION).map((p) => p.id);
        const intent = await api.post<SolanaIntent>("/api/v1/admin/payouts/solana", { ids });
        await checkout.run(intent, (signature) => api.post<Payout[]>("/api/v1/admin/payouts/pay", { ids, signature }));
        sent += ids.length;
      }
      const total = items.reduce((s, p) => s + p.amount_sol, 0);
      setMsg({ ok: true, text: `Sent ${fmtSol(total)} to ${items.length} landowner${items.length === 1 ? "" : "s"} on Solana. They've been notified.` });
      setChosen(new Set());
    } catch (e) {
      const done = sent ? `${sent} of ${items.length} paid. ` : "";
      setMsg({ ok: false, text: done + (e instanceof Error ? e.message : "Payment failed") });
    } finally {
      reload();
    }
  }

  async function retry() {
    setMsg(null);
    try {
      await checkout.retry();
      setMsg({ ok: true, text: "Payment confirmed and recorded." });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Still not confirmed" });
    } finally {
      reload();
    }
  }

  function showAll() {
    router.replace("/dashboard/payouts");
  }

  return (
    <div>
      <PageHeader title="Pay landowners" subtitle="Payments are raised automatically when trees on a landowner's field are allocated, and sent in SOL to each landowner's wallet." />

      <Treasury />

      {arrived && (
        <Card tint className="mb-6 flex flex-wrap items-center justify-between gap-3 border-brand/30 p-4 text-sm">
          <div>
            <p className="font-medium text-brand-strong">
              ✓ Trees allocated{arrived.invoice ? `. Invoice ${arrived.invoice}` : ""}
              {arrived.total ? ` (${fmtSol(arrived.total)})` : ""} sent to {client ?? "the client"}.
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
        <StatCard icon="⏳" label="Waiting to be paid" value={fmtSol(data.totals.pending_sol)} sub={`${data.totals.pending_count} payment${data.totals.pending_count === 1 ? "" : "s"}`} />
        <StatCard icon="✅" label="Paid out" value={fmtSol(data.totals.paid_sol)} sub="on Solana" />
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
        {payable.length > 0 && (
          <button
            onClick={() => pay(toPay)}
            disabled={busy || !checkout.ready || toPay.length === 0}
            className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-strong disabled:opacity-50"
          >
            {checkout.label ??
              (selection.length
                ? `Pay ${toPay.length} selected · ${fmtSol(toPay.reduce((s, p) => s + p.amount_sol, 0))}`
                : `Pay all ${toPay.length} · ${fmtSol(toPay.reduce((s, p) => s + p.amount_sol, 0))}`)}
          </button>
        )}
      </div>

      {payable.length > 0 && (
        <div className="mt-4">
          <PayerWallet amountSol={toPay.reduce((s, p) => s + p.amount_sol, 0)} />
        </div>
      )}
      {checkout.pending && (
        <button onClick={retry} disabled={busy} className="mt-3 rounded-md border border-brand px-3 py-1.5 text-xs font-medium text-brand disabled:opacity-50">
          Check again
        </button>
      )}

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
                      <p className="text-xs text-muted">
                        {p.number}
                        {p.landowner_phone ? ` · ${p.landowner_phone}` : ""}
                      </p>
                      <p className="text-xs">
                        {p.wallet ? <AddressLink address={p.wallet} className="text-muted" /> : <span className="text-amber-700">No Solana wallet yet</span>}
                      </p>
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
                      <p className="font-semibold">{fmtSol(p.amount_sol)}</p>
                      {p.status === "paid" && <TxLink signature={p.reference} className="text-xs text-muted" />}
                    </div>
                    <div className="w-24 lg:text-right">
                      {p.status === "pending" ? (
                        <button
                          onClick={() => pay([p])}
                          disabled={busy || !checkout.ready || !p.wallet}
                          title={!p.wallet ? "This landowner hasn't added a Solana wallet" : !checkout.ready ? "Connect a wallet first" : undefined}
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
      <p className="mt-3"><ClusterNote /></p>
    </div>
  );
}

/** The wallet that receives Climate Partner payments. Usually the same wallet that pays landowners. */
function Treasury() {
  const { config, reload } = useSolanaConfig();
  const { publicKey } = useWallet();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function save(address: string) {
    setError(null);
    try {
      await api.put<SolanaConfig>("/api/v1/admin/solana/treasury", { address });
      setEditing(false);
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save");
    }
  }

  const mine = publicKey?.toBase58();
  return (
    <Card className={`mb-6 p-4 text-sm ${config.treasury ? "" : "border-amber-300 bg-amber-50!"}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-medium">Treasury wallet</p>
          <p className="text-xs text-muted">
            {config.treasury ? (
              <>Climate Partners pay invoices to <AddressLink address={config.treasury} /> on Solana {config.cluster}.</>
            ) : (
              "Not set. Climate Partners can't pay invoices until it is."
            )}
          </p>
        </div>
        <div className="flex gap-2">
          {mine && mine !== config.treasury && (
            <button onClick={() => save(mine)} className="rounded-md border border-brand px-3 py-1.5 text-xs font-medium text-brand hover:bg-brand hover:text-white">
              Use connected wallet
            </button>
          )}
          <button onClick={() => setEditing(!editing)} className="text-xs font-medium text-muted hover:text-foreground">
            {editing ? "Cancel" : "Enter address"}
          </button>
        </div>
      </div>
      {editing && (
        <form onSubmit={(e) => { e.preventDefault(); save(value.trim()); }} className="mt-3 flex gap-2">
          <input value={value} onChange={(e) => setValue(e.target.value)} placeholder="Solana address" className={`${inputCls} py-1.5 font-mono text-xs`} />
          <button disabled={!isAddress(value)} className="rounded-md bg-brand px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50">Save</button>
        </form>
      )}
      {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
    </Card>
  );
}
