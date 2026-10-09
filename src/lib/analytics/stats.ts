/** Quantile with linear interpolation between closest ranks (the usual spreadsheet method). */
export function quantile(sorted: number[], q: number): number {
  if (!sorted.length) return 0;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

export function median(values: number[]): number | null {
  if (!values.length) return null;
  return quantile([...values].sort((a, b) => a - b), 0.5);
}

export type Spread = { n: number; min: number; q1: number; median: number; q3: number; max: number; zero: number; total: number };

/** Minimum, quartiles, maximum, the count of zeros ("not opened") and the total, for CA-1 tables. */
export function spread(values: number[]): Spread {
  const s = [...values].sort((a, b) => a - b);
  return {
    n: s.length,
    min: s[0] ?? 0,
    q1: quantile(s, 0.25),
    median: quantile(s, 0.5),
    q3: quantile(s, 0.75),
    max: s[s.length - 1] ?? 0,
    zero: s.filter((v) => v === 0).length,
    total: s.reduce((a, b) => a + b, 0),
  };
}

export type Bin = { key: string; label: string; from: number; to: number | null; count: number };

const STEPS_MIN = [1, 2, 5, 10, 15, 30, 60, 120, 240, 480, 960];

/**
 * Bins for "students by time" histograms (CA-1, CA-5). The first bin is exactly zero ("none"); the rest are
 * equal, round-numbered widths chosen so there are at most `maxBins` of them, the last open-ended.
 * Keys are "<from>-<to>" in seconds (to empty for the open bin), so a bin can be passed in a link.
 */
export function timeBins(seconds: number[], maxBins = 8): Bin[] {
  const max = Math.max(0, ...seconds);
  const stepMin = STEPS_MIN.find((m) => max <= m * 60 * maxBins) ?? STEPS_MIN[STEPS_MIN.length - 1];
  const step = stepMin * 60;
  const n = Math.max(1, Math.min(maxBins, Math.ceil(max / step)));
  const bins: Bin[] = [{ key: "0-0", label: "None", from: 0, to: 0, count: 0 }];
  for (let i = 0; i < n; i++) {
    const from = i * step;
    const last = i === n - 1 && n === maxBins;
    const to = last ? null : (i + 1) * step;
    bins.push({ key: `${from}-${to ?? ""}`, label: last ? `${minutesLabel(from)}+` : `${minutesLabel(from)}–${minutesLabel(to!)}`, from, to, count: 0 });
  }
  for (const v of seconds) {
    const b = v === 0 ? bins[0] : bins.find((x, i) => i > 0 && v > x.from && (x.to === null || v <= x.to)) ?? bins[bins.length - 1];
    b.count++;
  }
  return bins;
}

/** Does `seconds` fall in the bin with this key? (See timeBins.) */
export function inBin(key: string, seconds: number): boolean {
  const [a, b] = key.split("-");
  const from = Number(a);
  if (b === "0" && from === 0) return seconds === 0;
  const to = b === "" ? null : Number(b);
  return seconds > from && (to === null || seconds <= to);
}

function minutesLabel(seconds: number): string {
  const m = Math.round(seconds / 60);
  if (m === 0) return "0";
  if (m % 60 === 0) return `${m / 60} h`;
  return m > 60 ? `${Math.floor(m / 60)} h ${m % 60} m` : `${m} m`;
}

export type Band = "strong" | "developing" | "attention" | null;

/** Score band for a share right; null when there are too few questions to say (section 8). */
export function band(right: number, answered: number, cfg: { strongFrom: number; developingFrom: number; minQuestions: number }): Band {
  if (answered < cfg.minQuestions) return null;
  const pct = (right / answered) * 100;
  return pct >= cfg.strongFrom ? "strong" : pct >= cfg.developingFrom ? "developing" : "attention";
}

export const pct = (right: number, answered: number): number | null => (answered ? Math.round((right / answered) * 100) : null);
