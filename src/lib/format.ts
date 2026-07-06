export function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString();
}

export function fmtDateTime(d: string | null | undefined) {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return d ?? "—";
  return dt.toLocaleString();
}

export function daysUntil(d: string | null | undefined): number | null {
  if (!d) return null;
  const dt = new Date(d).getTime();
  if (isNaN(dt)) return null;
  return Math.round((dt - Date.now()) / (1000 * 60 * 60 * 24));
}

export function labelize(v: string | null | undefined) {
  if (!v) return "—";
  return v.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}