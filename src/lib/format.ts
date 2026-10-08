const IST: Intl.DateTimeFormatOptions = { timeZone: "Asia/Kolkata" };

/** All times are shown in IST (NF-7). */
export function fmtDateTime(d: Date | string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-IN", { ...IST, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false });
}

export function fmtTime(d: Date | string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleTimeString("en-IN", { ...IST, hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
}

/** Seconds as h:mm. */
export function fmtDuration(seconds: number | null | undefined): string {
  const s = Math.max(0, Math.round(Number(seconds) || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h}:${String(m).padStart(2, "0")}`;
}
