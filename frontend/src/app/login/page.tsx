"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { FieldLabel, inputCls } from "@/components/dashboard/ui";
import { Logo } from "@/components/site-chrome";
import { api, setToken } from "@/lib/api";
import type { AuthResponse } from "@/lib/types";

export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function signIn(ident: string, pass: string) {
    setError(null);
    setBusy(true);
    try {
      const res = await api.post<AuthResponse>("/api/v1/auth/login", { identifier: ident, password: pass });
      setToken(res.token);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
      setBusy(false);
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    signIn(identifier, password);
  }

  return (
    <div className="flex min-h-screen flex-col bg-[radial-gradient(45%_35%_at_0%_0%,#dcfce7_0%,transparent_70%),radial-gradient(40%_30%_at_100%_0%,#ecfccb_0%,transparent_70%)]">
      <header className="mx-auto flex h-16 w-full max-w-5xl items-center px-4 sm:px-6">
        <Logo />
      </header>
      <main className="flex flex-1 items-start justify-center px-4 pt-10">
        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
          <p className="mt-1 text-sm text-muted">Log in to your Rukh account.</p>

          <form onSubmit={submit} className="mt-8 space-y-4 rounded-2xl border border-border bg-white p-6">
            <FieldLabel label="Email or mobile number">
              <input required value={identifier} onChange={(e) => setIdentifier(e.target.value)} autoComplete="username" className={inputCls} />
            </FieldLabel>
            <FieldLabel label="Password">
              <input required type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" className={inputCls} />
            </FieldLabel>
            {error && <p className="rounded-lg bg-red-50 p-2.5 text-sm text-red-700">{error}</p>}
            <button type="submit" disabled={busy} className="w-full rounded-md bg-brand py-2.5 text-sm font-medium text-white hover:bg-brand-strong disabled:opacity-60">
              {busy ? "Logging in…" : "Log in"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-muted">
            New to Rukh? <Link href="/signup" className="font-medium text-brand">Create an account</Link>
          </p>
        </div>
      </main>
    </div>
  );
}
