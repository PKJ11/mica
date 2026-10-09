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

/** Seconds as h:mm:ss, for columns of staff tables: short times stay visible and the column still aligns. */
export function fmtHms(seconds: number | null | undefined): string {
  const s = Math.max(0, Math.round(Number(seconds) || 0));
  return `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

/** Seconds for stat tiles and sentences: "1 h 12 m", "17 m", "45 s". */
export function fmtSpan(seconds: number | null | undefined): string {
  const s = Math.max(0, Math.round(Number(seconds) || 0));
  if (s < 60) return `${s} s`;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h ? `${h} h ${String(m).padStart(2, "0")} m` : `${m} m`;
}

/** Seconds as m:ss, for time spent on a question. */
export function fmtClock(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(Number(seconds))) return "—";
  const s = Math.max(0, Math.round(Number(seconds)));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** "2 Oct" from a Date or a "YYYY-MM-DD" day. */
export function fmtDay(d: Date | string | null): string {
  if (!d) return "—";
  const date = typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(`${d}T12:00:00+05:30`) : new Date(d);
  return date.toLocaleDateString("en-IN", { ...IST, day: "numeric", month: "short" });
}

/** Today's date in IST as "YYYY-MM-DD". */
export function todayIst(): string {
  return new Date().toLocaleDateString("en-CA", IST);
}
