"use client";

import "leaflet/dist/leaflet.css";
import type * as Leaflet from "leaflet";
import { useEffect, useRef, useState } from "react";
import type { MapField } from "@/lib/types";

export const DOT = {
  free: "#16a34a", // standing trees not yet allocated
  allocated: "#dc2626",
  barren: "#eab308", // planting land with no tree on it yet
  selected: "#2563eb", // picked for the request being allocated
} as const;

const NEPAL: [number, number] = [28.2, 84.1];
const DETAIL_ZOOM = 13; // from here on, each field is drawn as its own dots
const MAX_DOTS = 400;

type Counts = { allocated: number; selected: number; free: number; total: number };

/** How a field's trees split up, with `picked` trees taken from the free ones. */
export function treeCounts(f: MapField, picked = 0): Counts {
  const selected = Math.min(picked, f.trees_free);
  return { allocated: f.trees_allocated, selected, free: f.trees_free - selected, total: f.trees_total };
}

export function freeColor(f: MapField) {
  return f.kind === "planting" ? DOT.barren : DOT.free;
}

/** Colours of up to `max` dots, each standing for an equal share of the field's trees. */
export function dotColors(f: MapField, picked = 0, max = MAX_DOTS): string[] {
  const c = treeCounts(f, picked);
  const n = Math.max(1, Math.min(c.total, max));
  const per = c.total / n || 1;
  const red = Math.min(n, Math.round(c.allocated / per) || (c.allocated > 0 ? 1 : 0));
  const blue = Math.min(n - red, Math.round(c.selected / per) || (c.selected > 0 ? 1 : 0));
  return Array.from({ length: n }, (_, i) => (i < red ? DOT.allocated : i < red + blue ? DOT.selected : freeColor(f)));
}

function ring(f: MapField, picked: number, size: number, highlight: boolean) {
  const c = treeCounts(f, picked);
  const t = c.total || 1;
  const a = (c.allocated / t) * 100;
  const s = a + (c.selected / t) * 100;
  const bg = `conic-gradient(${DOT.allocated} 0 ${a}%, ${DOT.selected} ${a}% ${s}%, ${freeColor(f)} ${s}% 100%)`;
  const border = highlight ? `3px solid ${DOT.selected}` : "2px solid #fff";
  return `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${bg};border:${border};box-shadow:0 1px 4px rgba(0,0,0,.35)"></div>`;
}

export type MapLabels = { allocated: string; free: string; barren: string };

const DEFAULT_LABELS: MapLabels = { allocated: "allocated", free: "free trees", barren: "bare slots" };

const esc = (s: string) => s.replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]!);

function tooltip(f: MapField, picked: number, labels: MapLabels) {
  const c = treeCounts(f, picked);
  const free = f.kind === "planting" ? labels.barren : labels.free;
  return (
    `<b>${esc(f.name)}</b><br>${esc(f.landowner)} · ${esc(f.district)}${f.approximate ? " (approx.)" : ""}<br>` +
    `${c.allocated.toLocaleString()} ${labels.allocated} · ${c.free.toLocaleString()} ${free}` +
    (c.selected ? `<br><b style="color:${DOT.selected}">${c.selected.toLocaleString()} selected</b>` : "")
  );
}

/** Radius in metres of a round plot with the field's area. */
const plotRadius = (f: MapField) => Math.max(30, Math.sqrt((f.area_ha * 10_000) / Math.PI));

export function FieldMap({
  fields,
  selected = {},
  clickable,
  focusId,
  onFieldClick,
  labels = DEFAULT_LABELS,
  className = "h-[560px]",
}: {
  fields: MapField[];
  selected?: Record<number, number>; // field id -> trees picked
  clickable?: Set<number>; // only these respond to clicks (all when omitted)
  focusId?: number | null;
  onFieldClick?: (id: number) => void;
  labels?: MapLabels; // tooltip wording
  className?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<Leaflet.Map | null>(null);
  const layer = useRef<Leaflet.LayerGroup | null>(null);
  const lib = useRef<typeof Leaflet | null>(null);
  const fitted = useRef(false);
  const click = useRef(onFieldClick);
  const [view, setView] = useState(0); // bumps on pan/zoom so dots redraw for the new view

  useEffect(() => {
    click.current = onFieldClick;
  }, [onFieldClick]);

  useEffect(() => {
    let alive = true;
    import("leaflet").then((mod) => {
      if (!alive || !box.current || map.current) return;
      const L = (mod as unknown as { default?: typeof Leaflet }).default ?? (mod as typeof Leaflet);
      lib.current = L;
      const m = L.map(box.current, { center: NEPAL, zoom: 7, minZoom: 6, maxZoom: 18, preferCanvas: true, zoomSnap: 0.5 });
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(m);
      layer.current = L.layerGroup().addTo(m);
      m.on("moveend", () => setView((v) => v + 1));
      map.current = m;
      setView((v) => v + 1);
    });
    return () => {
      alive = false;
      map.current?.remove();
      map.current = null;
      fitted.current = false;
    };
  }, []);

  // fit to the fields once they arrive
  useEffect(() => {
    const m = map.current;
    const L = lib.current;
    if (!m || !L || fitted.current || fields.length === 0) return;
    fitted.current = true;
    if (fields.length === 1) m.setView([fields[0].latitude, fields[0].longitude], 15);
    else m.fitBounds(L.latLngBounds(fields.map((f) => [f.latitude, f.longitude])), { padding: [40, 40], maxZoom: 15 });
  }, [fields, view]);

  useEffect(() => {
    const m = map.current;
    const f = fields.find((x) => x.id === focusId);
    if (m && f) m.flyTo([f.latitude, f.longitude], Math.max(m.getZoom(), 15), { duration: 0.8 });
  }, [focusId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const m = map.current;
    const L = lib.current;
    const g = layer.current;
    if (!m || !L || !g) return;
    g.clearLayers();
    const detail = m.getZoom() >= DETAIL_ZOOM;
    const bounds = m.getBounds().pad(0.3);

    for (const f of fields) {
      const picked = selected[f.id] ?? 0;
      const canClick = !clickable || clickable.has(f.id);
      const dim = !!clickable && !canClick;
      const onClick = () => (canClick && click.current ? click.current(f.id) : m.flyTo([f.latitude, f.longitude], Math.max(m.getZoom() + 2, 15)));
      const center = L.latLng(f.latitude, f.longitude);

      if (!detail) {
        const size = Math.round(16 + 4 * Math.log10(f.trees_total + 1));
        const icon = L.divIcon({ html: ring(f, picked, size, picked > 0), className: "", iconSize: [size, size] });
        L.marker(center, { icon, opacity: dim ? 0.45 : 1, zIndexOffset: picked ? 1000 : 0 })
          .bindTooltip(tooltip(f, picked, labels), { direction: "top", offset: [0, -size / 2] })
          .on("click", onClick)
          .addTo(g);
        continue;
      }
      if (!bounds.contains(center)) continue;

      // Detail view: a round plot of the field's area with one dot per share of trees,
      // laid out on a sunflower spiral so they fill the plot evenly.
      const R = plotRadius(f);
      const colors = dotColors(f, picked);
      const n = colors.length;
      const dotR = Math.max(1.5, (0.62 * R) / Math.sqrt(n));
      const mPerLat = 111_320;
      const mPerLon = 111_320 * Math.cos((f.latitude * Math.PI) / 180);
      colors.forEach((color, i) => {
        const r = R * Math.sqrt((i + 0.5) / n);
        const a = i * 2.399963;
        L.circle([f.latitude + (r * Math.cos(a)) / mPerLat, f.longitude + (r * Math.sin(a)) / mPerLon], {
          radius: dotR,
          stroke: false,
          fillColor: color,
          fillOpacity: dim ? 0.35 : 0.9,
          interactive: false,
        }).addTo(g);
      });
      L.circle(center, {
        radius: R + dotR * 2,
        color: picked ? DOT.selected : "#334155",
        weight: picked ? 3 : 1.5,
        dashArray: picked ? undefined : "4 4",
        fillOpacity: 0,
        opacity: dim ? 0.4 : 0.9,
      })
        .bindTooltip(tooltip(f, picked, labels), { sticky: true })
        .on("click", onClick)
        .addTo(g);
      // name just above the plot
      L.marker([f.latitude + (R + dotR * 3) / mPerLat, f.longitude], {
        interactive: false,
        icon: L.divIcon({
          className: "",
          iconSize: [0, 0],
          html: `<div style="transform:translate(-50%,-100%);white-space:nowrap;font:600 11px/1.2 system-ui;color:#0f172a;text-shadow:0 0 3px #fff,0 0 3px #fff">${esc(f.name)}</div>`,
        }),
      }).addTo(g);
    }
  }, [fields, selected, clickable, view, labels]);

  return <div ref={box} id="field-map" className={`scroll-mt-20 isolate z-0 w-full overflow-hidden rounded-2xl border border-border bg-surface-muted ${className}`} />;
}

export function MapLegend({
  selecting,
  labels = { allocated: "Trees allocated", free: "Trees not allocated", barren: "Bare land (no trees yet)" },
}: {
  selecting?: boolean;
  labels?: MapLabels;
}) {
  const items: [string, string][] = [
    [DOT.free, labels.free],
    [DOT.allocated, labels.allocated],
    [DOT.barren, labels.barren],
  ];
  if (selecting) items.push([DOT.selected, "Selected for this request"]);
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted">
      {items.map(([color, label]) => (
        <span key={label} className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
          {label}
        </span>
      ))}
    </div>
  );
}

/** A field's trees as a small grid of dots, for lists next to the map. */
export function DotGrid({ field, picked = 0, max = 100 }: { field: MapField; picked?: number; max?: number }) {
  const colors = dotColors(field, picked, max);
  const per = field.trees_total / colors.length;
  return (
    <div>
      <div className="grid w-fit grid-cols-[repeat(20,minmax(0,1fr))] gap-[3px]">
        {colors.map((c, i) => (
          <span key={i} className="h-2 w-2 rounded-full" style={{ background: c }} />
        ))}
      </div>
      {per > 1.01 && <p className="mt-1.5 text-[10px] text-muted">1 dot ≈ {Math.round(per).toLocaleString()} trees</p>}
    </div>
  );
}
