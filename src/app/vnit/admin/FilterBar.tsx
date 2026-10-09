"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

type Props = {
  cohorts: { id: string; name: string; students: number }[];
  cohortId: string;
  range: string;
  from: string;
  to: string;
  label: string;
};

const PRESETS: [string, string][] = [
  ["7d", "Last 7 days"],
  ["30d", "Last 30 days"],
  ["term", "This term"],
  ["all", "All time"],
  ["custom", "Custom…"],
];

/**
 * Cohort and date range for every staff screen (I1): one row above the content it scopes.
 * The choice goes in the address and is remembered in a cookie for the next visit.
 */
export default function FilterBar({ cohorts, cohortId, range, from, to, label }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [custom, setCustom] = useState(range === "custom");
  const [dates, setDates] = useState({ from, to });

  // Remember what is on screen.
  useEffect(() => {
    const p = new URLSearchParams({ cohort: cohortId, range });
    if (range === "custom") {
      p.set("from", from);
      p.set("to", to);
    }
    document.cookie = `vnit_filters=${encodeURIComponent(p.toString())}; path=/vnit; max-age=${60 * 60 * 24 * 90}; samesite=lax`;
  }, [cohortId, range, from, to]);

  function go(next: { cohort?: string; range?: string; from?: string; to?: string }) {
    const p = new URLSearchParams(params.toString());
    p.set("cohort", next.cohort ?? cohortId);
    const r = next.range ?? range;
    p.set("range", r);
    if (r === "custom") {
      p.set("from", next.from ?? dates.from);
      p.set("to", next.to ?? dates.to);
    } else {
      p.delete("from");
      p.delete("to");
    }
    router.push(`${pathname}?${p.toString()}`);
  }

  return (
    <div className="filter-bar" role="group" aria-label="Cohort and period">
      <label>
        <span>Cohort</span>
        <select value={cohortId} onChange={(e) => go({ cohort: e.target.value })}>
          {cohorts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} · {c.students}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>Period</span>
        <select
          value={custom ? "custom" : range}
          onChange={(e) => {
            if (e.target.value === "custom") setCustom(true);
            else {
              setCustom(false);
              go({ range: e.target.value });
            }
          }}
        >
          {PRESETS.map(([k, t]) => (
            <option key={k} value={k}>
              {t}
            </option>
          ))}
        </select>
      </label>
      {custom ? (
        <form
          className="filter-dates"
          onSubmit={(e) => {
            e.preventDefault();
            if (dates.from && dates.to && dates.from <= dates.to) go({ range: "custom", ...dates });
          }}
        >
          <input type="date" aria-label="From" value={dates.from} max={dates.to} onChange={(e) => setDates({ ...dates, from: e.target.value })} />
          <span aria-hidden="true">–</span>
          <input type="date" aria-label="To" value={dates.to} min={dates.from} onChange={(e) => setDates({ ...dates, to: e.target.value })} />
          <button type="submit" className="btn-small">
            Apply
          </button>
        </form>
      ) : (
        <span className="muted small filter-label">{label}</span>
      )}
    </div>
  );
}
