"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useCallback, useState } from "react";
import { fmtSol } from "@/lib/format";
import { AddressLink, requestDevnetSol, shortAddress, useBalance, usePay, useSolanaConfig, WalletButton } from "@/lib/solana";
import type { SolanaIntent } from "@/lib/types";

const FEE_BUFFER_SOL = 0.00002; // network fee for a few transfers, with room to spare

/**
 * Pays an API payment intent with the connected wallet, then records it with the API.
 * If the transfer went through but recording failed (e.g. the RPC is lagging), `pending`
 * keeps the signature so `retry` can record it again without paying twice.
 */
export function useCheckout() {
  const { pay, status, ready } = usePay();
  const [recording, setRecording] = useState(false);
  const [pending, setPending] = useState<{ signature: string; record: (sig: string) => Promise<unknown> } | null>(null);

  const finish = useCallback(async <T,>(signature: string, record: (sig: string) => Promise<T>): Promise<T> => {
    setRecording(true);
    try {
      const result = await record(signature);
      setPending(null);
      return result;
    } catch (e) {
      setPending({ signature, record });
      const why = e instanceof Error ? e.message : "unknown error";
      throw new Error(`Your SOL was sent (tx ${shortAddress(signature)}), but Rukh couldn't confirm it yet: ${why} Use “Check again”. Don't pay twice.`);
    } finally {
      setRecording(false);
    }
  }, []);

  const run = useCallback(
    async <T,>(intent: SolanaIntent, record: (sig: string) => Promise<T>): Promise<T> => finish(await pay(intent), record),
    [pay, finish],
  );

  const retry = useCallback(() => (pending ? finish(pending.signature, pending.record) : Promise.resolve(null)), [pending, finish]);

  const label =
    status === "signing" ? "Approve in your wallet…" : status === "confirming" ? "Confirming on Solana…" : recording ? "Recording payment…" : null;
  return { run, retry, pending, label, ready, busy: !!label };
}

/** The paying wallet: connect prompt, balance, and a devnet top-up when it runs short. */
export function PayerWallet({ amountSol }: { amountSol: number }) {
  const { publicKey } = useWallet();
  const { config } = useSolanaConfig();
  const { sol, refresh } = useBalance();
  const [topping, setTopping] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  if (!publicKey) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-border p-3 text-sm">
        <span className="text-muted">Connect a Solana wallet to pay.</span>
        <WalletButton />
      </div>
    );
  }

  const short = sol !== null && sol < amountSol + FEE_BUFFER_SOL;
  async function topUp() {
    setTopping(true);
    setNote(null);
    try {
      await requestDevnetSol(config.rpc_url, publicKey!);
      refresh();
    } catch {
      setNote("The devnet faucet is busy. Get test SOL at faucet.solana.com instead.");
    } finally {
      setTopping(false);
    }
  }

  return (
    <div className={`rounded-xl border p-3 text-sm ${short ? "border-amber-300 bg-amber-50" : "border-border"}`}>
      <p className="flex flex-wrap justify-between gap-2">
        <span className="text-muted">
          From <AddressLink address={publicKey.toBase58()} className="text-foreground" />
        </span>
        <span>Balance {sol === null ? "…" : fmtSol(sol)}</span>
      </p>
      {short && (
        <p className="mt-2 text-xs text-amber-800">
          Not enough SOL for this payment and its network fee.
          {config.cluster === "devnet" && (
            <>
              {" "}
              <button onClick={topUp} disabled={topping} className="font-medium text-brand disabled:opacity-60">
                {topping ? "Requesting…" : "Get 1 devnet SOL"}
              </button>{" "}
              or use{" "}
              <a href="https://faucet.solana.com" target="_blank" rel="noreferrer" className="font-medium text-brand">faucet.solana.com</a>.
            </>
          )}
        </p>
      )}
      {note && <p className="mt-2 text-xs text-amber-800">{note}</p>}
    </div>
  );
}

export function ClusterNote() {
  const { config } = useSolanaConfig();
  if (config.cluster === "mainnet-beta") return <span className="text-xs text-muted">Paid in SOL on Solana.</span>;
  return <span className="text-xs text-muted">Solana {config.cluster}: test SOL only, no real money.</span>;
}
