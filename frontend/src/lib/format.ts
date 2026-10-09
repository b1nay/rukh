export const USD_TO_NPR = 135;

export const fmtT = (t: number) => `${t.toLocaleString(undefined, { maximumFractionDigits: t < 10 ? 2 : 1 })} t`;
export const fmtUsd = (v: number) => `$${v.toLocaleString(undefined, { maximumFractionDigits: v < 100 ? 2 : 0 })}`;
export const fmtNpr = (usd: number) => `NPR ${Math.round(usd * USD_TO_NPR).toLocaleString()}`;
export const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
export const fmtMonth = (ym: string) =>
  new Date(`${ym}-01T00:00:00`).toLocaleDateString(undefined, { month: "short" });

export const osmLink = (lat: number, lon: number) =>
  `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=15/${lat}/${lon}`;
