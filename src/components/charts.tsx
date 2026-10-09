import Link from "next/link";
import type { Band } from "@/lib/analytics/stats";

/*
 * Single-series charts for the staff screens, in plain HTML so they work at phone width and with a keyboard.
 * One colour per chart (--chart-1); the selected mark uses --chart-strong. Every mark has a hover and focus
 * label (title), values are direct-labelled, and each chart sits next to a table with the same numbers.
 */

export type ColumnDatum = { key: string; label: string; value: number; display?: string; href?: string; selected?: boolean; title?: string };

/** Vertical columns over ordered categories: histograms and per-week counts. */
export function Columns({ data, caption, unit }: { data: ColumnDatum[]; caption: string; unit?: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <figure className="chart-columns" aria-label={caption}>
      <div className="cols" role="list">
        {data.map((d) => {
          const title = d.title ?? `${d.label}: ${d.display ?? d.value}${unit ? ` ${unit}` : ""}`;
          const bar = (
            <>
              <span className="col-value">{d.display ?? d.value}</span>
              <span className={`col-bar${d.selected ? " selected" : ""}`} style={{ height: `${(d.value / max) * 100}%` }} />
            </>
          );
          return (
            <div className="col" role="listitem" key={d.key}>
              {d.href ? (
                <Link href={d.href} className="col-hit" title={title} aria-label={title} scroll={false}>
                  {bar}
                </Link>
              ) : (
                <span className="col-hit" title={title} tabIndex={0} aria-label={title}>
                  {bar}
                </span>
              )}
              <span className="col-label">{d.label}</span>
            </div>
          );
        })}
      </div>
      <figcaption className="muted small">{caption}</figcaption>
    </figure>
  );
}

export type BarDatum = {
  key: string;
  label: string;
  sub?: string;
  value: number;
  display: string;
  href?: string;
  selected?: boolean;
  /** Reference value on the same scale, drawn as a thin marker (e.g. the class median). */
  marker?: number;
  markerLabel?: string;
};

/** Horizontal bars for comparing named items (modules, chapters). */
export function BarList({ data, caption, max: fixedMax, wide }: { data: BarDatum[]; caption?: string; max?: number; wide?: boolean }) {
  const max = Math.max(1, fixedMax ?? 0, ...data.map((d) => Math.max(d.value, d.marker ?? 0)));
  return (
    <figure className={`chart-bars${wide ? " wide" : ""}`} aria-label={caption}>
      <ul>
        {data.map((d) => {
          const title = `${d.label}: ${d.display}${d.marker != null && d.markerLabel ? ` · ${d.markerLabel}` : ""}`;
          const inner = (
            <>
              <span className="bar-label">
                {d.label}
                {d.sub && <span className="muted small"> {d.sub}</span>}
              </span>
              <span className="bar-track">
                <span className={`bar-fill${d.selected ? " selected" : ""}`} style={{ width: `${(d.value / max) * 100}%` }} />
                {d.marker != null && <span className="bar-marker" style={{ left: `${(d.marker / max) * 100}%` }} />}
              </span>
              <span className="bar-value">{d.display}</span>
            </>
          );
          return (
            <li key={d.key}>
              {d.href ? (
                <Link href={d.href} className="bar-row" title={title} scroll={false}>
                  {inner}
                </Link>
              ) : (
                <span className="bar-row" title={title} tabIndex={0}>
                  {inner}
                </span>
              )}
            </li>
          );
        })}
      </ul>
      {caption && <figcaption className="muted small">{caption}</figcaption>}
    </figure>
  );
}

const BAND_TEXT: Record<Exclude<Band, null>, [string, string]> = {
  strong: ["✓", "Strong"],
  developing: ["◐", "Developing"],
  attention: ["!", "Needs attention"],
};

/** Score band: an icon and a label beside the status colour, never colour alone. */
export function BandBadge({ band, short }: { band: Band; short?: boolean }) {
  if (!band) return <span className="muted small">Not enough questions</span>;
  const [icon, label] = BAND_TEXT[band];
  return (
    <span className={`band band-${band}`}>
      <span className="band-icon" aria-hidden="true">
        {icon}
      </span>
      {short ? <span className="sr-only">{label}</span> : label}
    </span>
  );
}

/** Stat tile: label, value and an optional note. */
export function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="stat">
      <span>{label}</span>
      <strong>{value}</strong>
      {note && <em className="muted small">{note}</em>}
    </div>
  );
}
