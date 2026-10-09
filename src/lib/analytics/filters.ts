import "server-only";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { query } from "@/lib/db";
import { fmtDay, todayIst } from "@/lib/format";
import type { SessionUser } from "@/lib/session";

/** The instructor screens' cohort and date range, remembered between visits in this cookie (I1). */
export const FILTER_COOKIE = "vnit_filters";

export const RANGES = { "7d": "Last 7 days", "30d": "Last 30 days", term: "This term", all: "All time", custom: "Custom" } as const;
export type RangeKey = keyof typeof RANGES;

export type CohortOption = { id: string; name: string; students: number };
export type Filters = {
  cohortId: string;
  cohortName: string;
  cohorts: CohortOption[];
  range: RangeKey;
  /** Inclusive IST days, "YYYY-MM-DD". */
  from: string;
  to: string;
  label: string;
};

type Params = Record<string, string | string[] | undefined>;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** The academic year runs from 1 July. */
function termStart(today: string): string {
  const [y, m] = today.split("-").map(Number);
  return `${m >= 7 ? y : y - 1}-07-01`;
}

/** Cohorts a staff member may see (CA-10): every cohort of the institution for admins, their own for instructors. */
export async function staffCohorts(user: SessionUser): Promise<CohortOption[]> {
  const count = `(SELECT count(*)::int FROM enrolments s WHERE s.cohort_id = c.id AND s.role = 'student')`;
  return user.role === "admin"
    ? query<CohortOption>(`SELECT c.id, c.name, ${count} AS students FROM cohorts c WHERE c.institution_id = $1 ORDER BY c.name`, [
        user.institutionId,
      ])
    : query<CohortOption>(
        `SELECT c.id, c.name, ${count} AS students FROM cohorts c
         JOIN enrolments e ON e.cohort_id = c.id AND e.user_id = $1 AND e.role = 'instructor' ORDER BY c.name`,
        [user.id],
      );
}

/** Filters from the address, else the remembered cookie, else this term for the first cohort. */
export async function loadFilters(user: SessionUser, sp: Params): Promise<Filters> {
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k]![0] : (sp[k] as string | undefined));
  let p = new URLSearchParams();
  if (["cohort", "range", "from", "to"].some((k) => one(k))) {
    for (const k of ["cohort", "range", "from", "to"]) if (one(k)) p.set(k, one(k)!);
  } else {
    const raw = (await cookies()).get(FILTER_COOKIE)?.value ?? "";
    let saved = raw;
    try {
      saved = decodeURIComponent(raw);
    } catch {}
    p = new URLSearchParams(saved);
  }

  const cohorts = await staffCohorts(user);
  if (!cohorts.length) notFound();
  const cohort = cohorts.find((c) => c.id === p.get("cohort")) ?? cohorts[0];

  const today = todayIst();
  let range = (p.get("range") ?? "term") as RangeKey;
  if (!(range in RANGES)) range = "term";
  let from: string, to: string;
  const pf = p.get("from") ?? "", pt = p.get("to") ?? "";
  if (range === "custom" && DAY.test(pf) && DAY.test(pt) && pf <= pt) [from, to] = [pf, pt];
  else {
    if (range === "custom") range = "term";
    to = today;
    from = range === "7d" ? addDays(today, -6) : range === "30d" ? addDays(today, -29) : range === "all" ? "2000-01-01" : termStart(today);
  }
  const label = range === "all" ? "All time" : `${fmtDay(from)} – ${fmtDay(to)}`;
  return { cohortId: cohort.id, cohortName: cohort.name, cohorts, range, from, to, label };
}

/** The filters as query parameters, to carry them on links. */
export function filterQuery(f: Filters, extra: Record<string, string | number | null | undefined> = {}): string {
  const p = new URLSearchParams({ cohort: f.cohortId, range: f.range });
  if (f.range === "custom") {
    p.set("from", f.from);
    p.set("to", f.to);
  }
  for (const [k, v] of Object.entries(extra)) if (v != null && v !== "") p.set(k, String(v));
  return p.toString();
}
