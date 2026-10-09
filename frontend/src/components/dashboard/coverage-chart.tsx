"use client";

import { useState } from "react";
import { fmtMonth, fmtT } from "@/lib/format";

const COVERED = "#15803d";
const UNCOVERED = "#cfd8d2";

type Point = { month: string; co2_t: number; covered_t: number };

/** Stacked monthly bars: covered tonnes (green) on uncovered remainder (gray). */
export function CoverageChart({ data }: { data: Point[] }) {
  const [hover, setHover] = useState<number | null>(null);
  if (data.length === 0) return <p className="py-16 text-center text-sm text-muted">No trips yet.</p>;

  const max = Math.max(...data.map((d) => d.co2_t)) || 1;
  const ticks = [0, 0.5, 1].map((f) => f * max);
  const H = 180;

  return (
    <div>
      <div className="mb-4 flex items-center gap-4 text-xs text-muted">
        <Legend color={COVERED} label="Covered by trees" />
        <Legend color={UNCOVERED} label="Not yet covered" />
      </div>
      <div className="relative flex gap-3">
        {/* y axis */}
        <div className="relative w-10 shrink-0 text-right text-[11px] text-muted" style={{ height: H }}>
          {ticks.map((t) => (
            <span key={t} className="absolute right-0 -translate-y-1/2" style={{ top: H - (t / max) * H }}>
              {t.toFixed(t < 10 ? 1 : 0)}
            </span>
          ))}
        </div>
        <div className="relative flex-1">
          {ticks.map((t) => (
            <div key={t} className="absolute inset-x-0 border-t border-border" style={{ top: H - (t / max) * H }} />
          ))}
          <div className="relative flex items-end gap-2 sm:gap-4" style={{ height: H }}>
            {data.map((d, i) => {
              const covered = Math.min(d.covered_t, d.co2_t);
              const rest = d.co2_t - covered;
              return (
                <div
                  key={d.month}
                  className="relative flex h-full flex-1 cursor-default flex-col justify-end"
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                >
                  <div className="mx-auto flex w-full max-w-10 flex-col justify-end gap-[2px]" style={{ height: `${(d.co2_t / max) * 100}%` }}>
                    {rest > 0 && <div className="rounded-t-[4px]" style={{ flexGrow: rest, background: UNCOVERED, opacity: hover === null || hover === i ? 1 : 0.5 }} />}
                    {covered > 0 && (
                      <div
                        className={rest > 0 ? "" : "rounded-t-[4px]"}
                        style={{ flexGrow: covered, background: COVERED, opacity: hover === null || hover === i ? 1 : 0.5 }}
                      />
                    )}
                  </div>
                  {hover === i && (
                    <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 w-40 -translate-x-1/2 rounded-lg border border-border bg-white p-2.5 text-xs shadow-lg">
                      <p className="font-medium">{fmtMonth(d.month)} {d.month.slice(0, 4)}</p>
                      <p className="mt-1 flex justify-between text-muted"><span>Measured</span><span className="text-foreground">{fmtT(d.co2_t)}</span></p>
                      <p className="flex justify-between text-muted"><span>Covered</span><span className="text-foreground">{fmtT(covered)}</span></p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="mt-2 flex gap-2 sm:gap-4">
            {data.map((d) => (
              <span key={d.month} className="flex-1 text-center text-[11px] text-muted">
                {fmtMonth(d.month)}
              </span>
            ))}
          </div>
        </div>
      </div>
      <p className="sr-only">
        {data.map((d) => `${d.month}: ${d.co2_t} t measured, ${d.covered_t} t covered.`).join(" ")}
      </p>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-sm" style={{ background: color }} />
      {label}
    </span>
  );
}
