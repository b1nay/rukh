"use client";

import { WalletReadyState } from "@solana/wallet-adapter-base";
import { ConnectionProvider, useConnection, useWallet, WalletProvider } from "@solana/wallet-adapter-react";
import { Connection, PublicKey, SystemProgram, Transaction, TransactionInstruction } from "@solana/web3.js";
import { Buffer } from "buffer";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { api } from "./api";
import { SolanaMark } from "@/components/solana-mark";
import type { SolanaConfig, SolanaIntent } from "./types";

const MEMO_PROGRAM = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");
const DEFAULT_CONFIG: SolanaConfig = { cluster: "devnet", rpc_url: "https://api.devnet.solana.com", treasury: null };

const ConfigContext = createContext<{ config: SolanaConfig; reload: () => void }>({ config: DEFAULT_CONFIG, reload: () => {} });

export const useSolanaConfig = () => useContext(ConfigContext);

export const shortAddress = (a: string) => `${a.slice(0, 4)}…${a.slice(-4)}`;

export function isAddress(s: string) {
  try {
    return new PublicKey(s.trim()).toBytes().length === 32 && s.trim().length >= 32;
  } catch {
    return false;
  }
}

/** Real transaction signatures are base58 and 64 bytes; demo payments use DEMO-… references instead. */
export const isSignature = (s: string | null | undefined): s is string => !!s && /^[1-9A-HJ-NP-Za-km-z]{64,88}$/.test(s);

export function explorerUrl(kind: "tx" | "address", id: string, cluster: string) {
  const q = cluster === "mainnet-beta" ? "" : `?cluster=${cluster}`;
  return `https://explorer.solana.com/${kind}/${id}${q}`;
}

/** Wallet connection for the dashboard. Network settings come from the API so both sides use the same cluster. */
export function SolanaProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<SolanaConfig>(DEFAULT_CONFIG);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    api.get<SolanaConfig>("/api/v1/solana/config").then(setConfig).catch(() => {});
  }, [version]);

  const ctx = useMemo(() => ({ config, reload: () => setVersion((v) => v + 1) }), [config]);
  // Wallets that implement the Wallet Standard (Phantom, Solflare, Backpack, …) register themselves.
  const wallets = useMemo(() => [], []);

  return (
    <ConfigContext.Provider value={ctx}>
      <ConnectionProvider endpoint={config.rpc_url} config={{ commitment: "confirmed" }}>
        <WalletProvider wallets={wallets} autoConnect>
          {children}
        </WalletProvider>
      </ConnectionProvider>
    </ConfigContext.Provider>
  );
}

function buildTransaction(intent: SolanaIntent, payer: PublicKey) {
  const tx = new Transaction();
  for (const t of intent.transfers) {
    tx.add(SystemProgram.transfer({ fromPubkey: payer, toPubkey: new PublicKey(t.to), lamports: t.lamports }));
  }
  tx.add(new TransactionInstruction({ programId: MEMO_PROGRAM, keys: [], data: Buffer.from(intent.memo, "utf8") }));
  return tx;
}

function friendlyError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (/reject|denied|cancel/i.test(msg)) return "You cancelled the transaction in your wallet.";
  if (/insufficient|0x1\b|debit an account/i.test(msg)) return "Your wallet doesn't have enough SOL for this payment and its fee.";
  if (/rent/i.test(msg)) return "A recipient wallet is empty and this amount is below Solana's minimum account balance.";
  if (/blockhash|expired/i.test(msg)) return "The transaction expired before it was confirmed. Please try again.";
  return msg || "The payment failed";
}

/**
 * Signs a payment intent from the API with the connected wallet, sends it to the configured
 * cluster and waits for confirmation. Returns the transaction signature.
 *
 * The wallet only signs. Sending through our own connection keeps the payment on the cluster the
 * API checks, whatever network the wallet itself is set to.
 */
export function usePay() {
  const { connection } = useConnection();
  const { publicKey, signTransaction } = useWallet();
  const [status, setStatus] = useState<"idle" | "signing" | "confirming">("idle");

  const pay = useCallback(
    async (intent: SolanaIntent) => {
      if (!publicKey || !signTransaction) throw new Error("Connect a wallet first.");
      try {
        const tx = buildTransaction(intent, publicKey);
        const latest = await connection.getLatestBlockhash("confirmed");
        tx.recentBlockhash = latest.blockhash;
        tx.feePayer = publicKey;
        setStatus("signing");
        const signed = await signTransaction(tx);
        setStatus("confirming");
        const signature = await connection.sendRawTransaction(signed.serialize());
        const res = await connection.confirmTransaction({ signature, ...latest }, "confirmed");
        if (res.value.err) throw new Error("The transaction failed on chain.");
        return signature;
      } catch (e) {
        throw new Error(friendlyError(e));
      } finally {
        setStatus("idle");
      }
    },
    [connection, publicKey, signTransaction],
  );

  return { pay, status, ready: !!publicKey && !!signTransaction };
}

/** SOL balance of the connected wallet, refreshed on demand. */
export function useBalance() {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const [lamports, setLamports] = useState<number | null>(null);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    if (!publicKey) return;
    let alive = true;
    connection.getBalance(publicKey).then((b) => alive && setLamports(b)).catch(() => alive && setLamports(null));
    return () => {
      alive = false;
    };
  }, [connection, publicKey, version]);
  return { sol: publicKey && lamports !== null ? lamports / 1e9 : null, refresh: () => setVersion((v) => v + 1) };
}

/** Connect / switch / disconnect a browser wallet, styled like the rest of the dashboard. */
export function WalletButton({ className = "" }: { className?: string }) {
  const { wallets, wallet, publicKey, select, disconnect, connecting } = useWallet();
  const { config } = useSolanaConfig();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const installed = wallets.filter((w) => w.readyState === WalletReadyState.Installed || w.readyState === WalletReadyState.Loadable);

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-medium transition ${
          publicKey ? "border-brand/40 bg-brand-soft text-brand-strong" : "border-border bg-white hover:border-brand hover:text-brand"
        }`}
      >
        <SolanaMark />
        {connecting ? "Connecting…" : publicKey ? shortAddress(publicKey.toBase58()) : "Connect wallet"}
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-64 rounded-xl border border-border bg-white p-2 text-sm shadow-lg">
          {publicKey ? (
            <>
              <p className="px-2 pb-1 pt-1 text-xs text-muted">{wallet?.adapter.name} · Solana {config.cluster}</p>
              <a
                href={explorerUrl("address", publicKey.toBase58(), config.cluster)}
                target="_blank"
                rel="noreferrer"
                className="block rounded-lg px-2 py-1.5 font-mono text-xs hover:bg-surface-muted"
              >
                {shortAddress(publicKey.toBase58())} ↗
              </a>
              <button
                onClick={() => { disconnect(); setOpen(false); }}
                className="mt-1 w-full rounded-lg px-2 py-1.5 text-left text-xs text-muted hover:bg-surface-muted hover:text-foreground"
              >
                Disconnect
              </button>
            </>
          ) : installed.length ? (
            <>
              <p className="px-2 pb-1 pt-1 text-xs text-muted">Choose a wallet</p>
              {installed.map((w) => (
                <button
                  key={w.adapter.name}
                  onClick={() => { select(w.adapter.name); setOpen(false); }}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left hover:bg-surface-muted"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={w.adapter.icon} alt="" className="h-5 w-5 rounded" />
                  {w.adapter.name}
                </button>
              ))}
            </>
          ) : (
            <p className="p-2 text-xs text-muted">
              No Solana wallet found in this browser. Install{" "}
              <a href="https://phantom.com/download" target="_blank" rel="noreferrer" className="font-medium text-brand">Phantom</a> or{" "}
              <a href="https://solflare.com/download" target="_blank" rel="noreferrer" className="font-medium text-brand">Solflare</a>, then reload.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/** Ask the devnet faucet for test SOL (rate-limited; https://faucet.solana.com is the fallback). */
export async function requestDevnetSol(rpcUrl: string, to: PublicKey) {
  const conn = new Connection(rpcUrl, "confirmed");
  const sig = await conn.requestAirdrop(to, 1e9);
  const latest = await conn.getLatestBlockhash();
  await conn.confirmTransaction({ signature: sig, ...latest }, "confirmed");
}

/** A transaction signature linked to Solana Explorer. Demo references (no signature) show as plain text. */
export function TxLink({ signature, className = "" }: { signature: string | null | undefined; className?: string }) {
  const { config } = useSolanaConfig();
  if (!signature) return null;
  if (!isSignature(signature)) return <span className={className}>ref {signature}</span>;
  return (
    <a href={explorerUrl("tx", signature, config.cluster)} target="_blank" rel="noreferrer" className={`font-mono hover:underline ${className}`}>
      tx {shortAddress(signature)} ↗
    </a>
  );
}

export function AddressLink({ address, className = "" }: { address: string; className?: string }) {
  const { config } = useSolanaConfig();
  return (
    <a href={explorerUrl("address", address, config.cluster)} target="_blank" rel="noreferrer" className={`font-mono hover:underline ${className}`}>
      {shortAddress(address)} ↗
    </a>
  );
}
