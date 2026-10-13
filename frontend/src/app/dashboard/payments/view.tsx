"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useState } from "react";
import { RoleOnly } from "@/components/dashboard/shell";
import { useApi } from "@/components/dashboard/session";
import { Badge, Card, Empty, ErrorNote, inputCls, Loading, PageHeader, StatCard } from "@/components/dashboard/ui";
import { api } from "@/lib/api";
import { fmtDate, fmtSol, fmtT } from "@/lib/format";
import { AddressLink, isAddress, TxLink } from "@/lib/solana";
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
  const { data, error, reload } = useApi<LandPayments>("/api/v1/land/payouts");
  const [tab, setTab] = useState<Tab>("all");
  const [open, setOpen] = useState<number | null>(null);

  if (error) return <ErrorNote message={error} />;
  if (!data) return <Loading />;

  const t = data.totals;
  const items = data.items.filter((p) => tab === "all" || p.status === tab);

  return (
    <div>
      <PageHeader title="Payments" subtitle="SOL sent to your Solana wallet for your trees. Every payment can be checked on Solana Explorer." />
      <WalletCard wallet={t.wallet} onSaved={reload} />
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard icon="✅" label="Received" value={fmtSol(t.received_sol)} sub={`${t.received_count} payment${t.received_count === 1 ? "" : "s"}`} />
        <StatCard icon="⏳" label="On the way" value={fmtSol(t.pending_sol)} sub={`${t.pending_count} payment${t.pending_count === 1 ? "" : "s"} being prepared`} />
        <StatCard icon="📅" label="Last payment" value={t.last_paid_at ? fmtDate(t.last_paid_at) : "—"} sub="on Solana" />
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
        <span className="font-semibold text-brand md:text-right">{fmtSol(p.amount_sol)}</span>
      </button>
      {open && (
        <div className="border-t border-border bg-surface-muted/40 px-5 py-4 text-sm">
          <ul className="space-y-1.5">
            {p.lines.map((l) => (
              <li key={l.field_id} className="flex justify-between gap-3">
                <span>
                  {l.field_name} <span className="text-muted">· {l.trees.toLocaleString()} trees · {fmtT(l.tonnes)} CO₂</span>
                </span>
                <span>{fmtSol(l.amount)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 flex flex-wrap gap-x-2 text-xs text-muted">
            {p.wallet && <span>Sent to <AddressLink address={p.wallet} /></span>}
            <TxLink signature={p.reference} />
          </p>
        </div>
      )}
    </li>
  );
}

/** Where Rukh sends this Land Partner's SOL. */
function WalletCard({ wallet, onSaved }: { wallet: string | null; onSaved: () => void }) {
  const { publicKey } = useWallet();
  const [editing, setEditing] = useState(!wallet);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save(address: string) {
    setSaving(true);
    setError(null);
    try {
      await api.put("/api/v1/land/wallet", { address });
      setEditing(false);
      setValue("");
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save");
    } finally {
      setSaving(false);
    }
  }

  const connected = publicKey?.toBase58();
  return (
    <Card className={`mb-6 p-4 text-sm ${wallet ? "" : "border-amber-300 bg-amber-50!"}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-medium">Your Solana wallet</p>
          <p className="text-xs text-muted">
            {wallet ? <>Payments are sent to <AddressLink address={wallet} />.</> : "Add a wallet so Rukh can pay you in SOL."}
          </p>
        </div>
        <div className="flex gap-2">
          {connected && connected !== wallet && (
            <button onClick={() => save(connected)} disabled={saving} className="rounded-md border border-brand px-3 py-1.5 text-xs font-medium text-brand hover:bg-brand hover:text-white disabled:opacity-50">
              Use connected wallet
            </button>
          )}
          {wallet && (
            <button onClick={() => setEditing(!editing)} className="text-xs font-medium text-muted hover:text-foreground">
              {editing ? "Cancel" : "Change"}
            </button>
          )}
        </div>
      </div>
      {editing && (
        <form onSubmit={(e) => { e.preventDefault(); save(value.trim()); }} className="mt-3 flex gap-2">
          <input value={value} onChange={(e) => setValue(e.target.value)} placeholder="Paste your Solana address" className={`${inputCls} py-1.5 font-mono text-xs`} />
          <button disabled={saving || !isAddress(value)} className="rounded-md bg-brand px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50">Save</button>
        </form>
      )}
      {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
    </Card>
  );
}
