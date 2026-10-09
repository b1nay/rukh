import type { Cabin, LegCategory, LegMode, TravelerInput } from "./types";

export const CATEGORIES: Record<LegCategory, { label: string; icon: string; hint: string }> = {
  flight: { label: "Flight", icon: "✈️", hint: "International, domestic or mountain flight" },
  helicopter: { label: "Helicopter", icon: "🚁", hint: "Charter, shuttle or rescue" },
  road: { label: "Road", icon: "🚕", hint: "Taxi, car, jeep, bus or motorbike" },
  stay: { label: "Stay", icon: "🏨", hint: "Hotel, teahouse, homestay or camping" },
  trail: { label: "Trail", icon: "🥾", hint: "Trek, walk or cycle (zero CO₂)" },
  activity: { label: "Activity", icon: "🎯", hint: "Rafting, safari, paragliding…" },
};

export const CATEGORY_ORDER: LegCategory[] = ["flight", "road", "stay", "trail", "activity", "helicopter"];

export const CABINS: [Cabin, string][] = [
  ["economy", "Economy"],
  ["premium_economy", "Premium economy"],
  ["business", "Business"],
  ["first", "First"],
];

export const SHARE_LABEL: Partial<Record<LegMode["basis"], string>> = {
  vkm: "People per vehicle",
  hour_shared: "Passengers",
  room_night: "People per room",
};

export const fmtHours = (h: number) => {
  const mins = Math.round(h * 60);
  return `${Math.floor(mins / 60)}h${mins % 60 ? ` ${String(mins % 60).padStart(2, "0")}m` : ""}`;
};

export const fmtKg = (kg: number) => (kg >= 1000 ? `${(kg / 1000).toFixed(2)} t` : `${kg.toFixed(kg < 10 ? 1 : 0)} kg`);

/* ---------- CSV ---------- */

export const CSV_COLUMNS = ["name", "email", "phone", "nationality", "home_airport", "cabin"] as const;

function csvCell(v: string) {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export function travelersToCsv(rows: TravelerInput[]) {
  const lines = [CSV_COLUMNS.join(",")];
  for (const r of rows) lines.push(CSV_COLUMNS.map((c) => csvCell(String(r[c] ?? ""))).join(","));
  return lines.join("\n");
}

export function downloadCsv(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Minimal RFC-4180 parser: quoted fields, escaped quotes, CRLF. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim()));
}

const HEADER_ALIASES: Record<string, (typeof CSV_COLUMNS)[number]> = {
  name: "name", "full name": "name", traveler: "name", traveller: "name",
  email: "email", "e-mail": "email",
  phone: "phone", mobile: "phone",
  nationality: "nationality", country: "nationality",
  home_airport: "home_airport", "home airport": "home_airport", airport: "home_airport", origin: "home_airport", from: "home_airport",
  cabin: "cabin", class: "cabin",
};

export type CsvResult = { rows: TravelerInput[]; errors: string[] };

export function csvToTravelers(text: string, airports: Set<string>): CsvResult {
  const table = parseCsv(text);
  if (table.length === 0) return { rows: [], errors: ["The file is empty."] };
  const header = table[0].map((h) => HEADER_ALIASES[h.trim().toLowerCase()]);
  if (!header.includes("name")) return { rows: [], errors: ['Add a header row with at least a "name" column.'] };

  const rows: TravelerInput[] = [];
  const errors: string[] = [];
  table.slice(1).forEach((cells, i) => {
    const line = i + 2;
    const r: Record<string, string> = {};
    header.forEach((col, j) => col && (r[col] = (cells[j] ?? "").trim()));
    if (!r.name) return errors.push(`Row ${line}: name is missing`);
    const airport = r.home_airport?.toUpperCase();
    if (airport && !airports.has(airport)) errors.push(`Row ${line}: unknown airport "${r.home_airport}"`);
    const cabin = (r.cabin?.toLowerCase().replace(/\s+/g, "_") || "economy") as Cabin;
    if (!CABINS.some(([c]) => c === cabin)) errors.push(`Row ${line}: unknown cabin "${r.cabin}"`);
    rows.push({ name: r.name, email: r.email, phone: r.phone, nationality: r.nationality, home_airport: airport, cabin });
  });
  return { rows, errors };
}
