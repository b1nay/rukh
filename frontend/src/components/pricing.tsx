"use client";

import Link from "next/link";
import { useState } from "react";
import { IMPACT_TYPES, ImpactType, PLANS } from "@/lib/content";

export function Pricing() {
  const [impact, setImpact] = useState<ImpactType>("plant");

  return (
    <div>
      <div className="mx-auto flex w-fit flex-col items-center gap-3">
        <div className="flex rounded-full border border-border bg-surface-muted p-1">
          {(Object.keys(IMPACT_TYPES) as ImpactType[]).map((k) => (
            <button
              key={k}
              onClick={() => setImpact(k)}
              className={`rounded-full px-5 py-1.5 text-sm font-medium transition ${
                impact === k ? "bg-white text-brand shadow-sm" : "text-muted hover:text-foreground"
              }`}
            >
              {IMPACT_TYPES[k].name} · {IMPACT_TYPES[k].pricePerTonne} SOL/t
            </button>
          ))}
        </div>
        <p className="text-xs text-muted">{IMPACT_TYPES[impact].tagline}</p>
      </div>

      <div className="mt-10 grid gap-6 md:grid-cols-3">
        {PLANS.map((plan) => (
          <div
            key={plan.id}
            className={`flex flex-col rounded-2xl border p-7 ${
              plan.highlight ? "card-tint border-brand/40 ring-1 ring-brand/20" : "border-border bg-white"
            }`}
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">{plan.name}</p>
              {plan.highlight && (
                <span className="rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-medium text-brand">Popular</span>
              )}
            </div>
            <p className="mt-4 text-3xl font-semibold">
              {plan.price}
              <span className="ml-1 text-sm font-normal text-muted">{plan.cadence}</span>
            </p>
            <p className="mt-1 text-xs text-muted">{plan.platformFee}</p>
            <ul className="mt-6 flex-1 space-y-2.5 text-sm">
              {plan.features.map((f) => (
                <li key={f} className="flex gap-2">
                  <Check /> {f}
                </li>
              ))}
            </ul>
            <Link
              href={`/signup?side=organization&plan=${plan.id}`}
              className={`mt-7 rounded-md px-5 py-2.5 text-center text-sm font-medium transition ${
                plan.highlight ? "bg-brand text-white hover:bg-brand-strong" : "border border-border hover:border-brand hover:text-brand"
              }`}
            >
              {plan.cta}
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Check() {
  return (
    <svg viewBox="0 0 20 20" className="mt-0.5 h-4 w-4 shrink-0 text-brand" fill="currentColor" aria-hidden>
      <path d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.7-9.3-4 4a1 1 0 0 1-1.4 0l-2-2a1 1 0 1 1 1.4-1.4L9 10.6l3.3-3.3a1 1 0 0 1 1.4 1.4Z" />
    </svg>
  );
}
