export const fmtT = (t: number) => `${t.toLocaleString(undefined, { maximumFractionDigits: t < 10 ? 2 : 1 })} t`;
/** SOL amounts: 4 decimals normally, down to one lamport for tiny amounts. */
export const fmtSol = (v: number) =>
  `${v.toLocaleString(undefined, { maximumFractionDigits: v === 0 || Math.abs(v) >= 0.0001 ? (Math.abs(v) >= 100 ? 2 : 4) : 9 })} SOL`;
export const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
export const fmtMonth = (ym: string) =>
  new Date(`${ym}-01T00:00:00`).toLocaleDateString(undefined, { month: "short" });

export const osmLink = (lat: number, lon: number) =>
  `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=15/${lat}/${lon}`;
