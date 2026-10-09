import Link from "next/link";
import { BandBadge } from "@/components/charts";
import { chapterCount, studentTotals, timeRows } from "@/lib/analytics/data";
import { filterQuery } from "@/lib/analytics/filters";
import { inBin } from "@/lib/analytics/stats";
import { fmtDateTime, fmtHms, fmtSpan, todayIst } from "@/lib/format";
import StaffHeader from "../StaffHeader";
import { audit, staffPage, type SearchParams } from "../staff";

export const metadata = { title: "VNIT Nagpur · Students" };

const SORTS: Record<string, string> = { name: "Name", last: "Last sign-in", time: "Active time", score: "Learning score" };

/** "0-0" → "no time", "900-1800" → "15 m to 30 m", "3600-" → "over 1 h" (keys from timeBins). */
function bandText(key: string): string {
  const [a, b] = key.split("-");
  if (a === "0" && b === "0") return "no time";
  return b === "" ? `over ${fmtSpan(Number(a))}` : `${fmtSpan(Number(a))} to ${fmtSpan(Number(b))}`;
}

// I4: the cohort's students, with the filters behind "Needs attention" (CA-7) and the time bands (CA-5).
export default async function StudentsPage({ searchParams }: { searchParams: SearchParams }) {
  const { user, filters: f, param } = await staffPage("/vnit/admin/students", searchParams);
  await audit(user.id, "view_student_list", f.cohortId, { from: f.from, to: f.to });

  const q = (param("q") ?? "").trim().toLowerCase();
  const inactive = Number(param("inactive")) || 0;
  const timeBelow = Number(param("time_below")) || 0;
  const scoreBelow = Number(param("score_below")) || 0;
  const band = param("band") ?? "";
  const module = param("module") ?? "";
  const sort = param("sort") && SORTS[param("sort")!] ? param("sort")! : "name";

  const [all, total, rows] = await Promise.all([studentTotals(f), chapterCount(f.cohortId), band && module ? timeRows(f) : Promise.resolve([])]);
  const moduleTime = new Map<string, number>();
  for (const r of rows) if (r.module === module) moduleTime.set(r.user, (moduleTime.get(r.user) ?? 0) + r.seconds);
  const cutoff = new Date(`${todayIst()}T00:00:00+05:30`).getTime() - (inactive - 1) * 86_400_000;

  const students = all
    .filter((s) => !q || s.name.toLowerCase().includes(q) || s.roll.toLowerCase().includes(q))
    .filter((s) => !inactive || !s.lastLogin || new Date(s.lastLogin).getTime() < cutoff)
    .filter((s) => !timeBelow || s.activeSeconds < timeBelow)
    .filter((s) => !scoreBelow || (s.band !== null && s.score! < scoreBelow))
    .filter((s) => !band || inBin(band, module ? (moduleTime.get(s.id) ?? 0) : s.activeSeconds))
    .sort((a, b) =>
      sort === "last"
        ? (b.lastLogin ? +new Date(b.lastLogin) : 0) - (a.lastLogin ? +new Date(a.lastLogin) : 0)
        : sort === "time"
          ? b.activeSeconds - a.activeSeconds
          : sort === "score"
            ? (a.score ?? 101) - (b.score ?? 101)
            : a.name.localeCompare(b.name),
    );

  const active: string[] = [];
  if (inactive) active.push(`not signed in for ${inactive} days`);
  if (timeBelow) active.push(`under ${fmtSpan(timeBelow)} in the period`);
  if (scoreBelow) active.push(`learning score below ${scoreBelow} %`);
  if (band) active.push(`${bandText(band)}${module ? " in the selected module" : " in the period"}`);
  const keep = { cohort: f.cohortId, range: f.range, ...(f.range === "custom" ? { from: f.from, to: f.to } : {}) };

  return (
    <>
      <StaffHeader title="Students" filters={f} back={`/vnit/admin/students?${filterQuery(f)}`} />
      <form className="inline-form" action="/vnit/admin/students">
        {Object.entries(keep).map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}
        <label>
          <span className="muted small">Search</span>
          <input type="search" name="q" defaultValue={param("q") ?? ""} placeholder="Name or roll no." />
        </label>
        <label>
          <span className="muted small">Not signed in for</span>
          <select name="inactive" defaultValue={inactive || ""}>
            <option value="">Any</option>
            <option value="3">3 days</option>
            <option value="7">7 days</option>
            <option value="14">14 days</option>
          </select>
        </label>
        <label>
          <span className="muted small">Time below</span>
          <select name="time_below" defaultValue={timeBelow || ""}>
            <option value="">Any</option>
            <option value="900">15 m</option>
            <option value="3600">1 h</option>
            <option value="10800">3 h</option>
          </select>
        </label>
        <label>
          <span className="muted small">Score below</span>
          <select name="score_below" defaultValue={scoreBelow || ""}>
            <option value="">Any</option>
            <option value="50">50 %</option>
            <option value="80">80 %</option>
          </select>
        </label>
        <label>
          <span className="muted small">Sort</span>
          <select name="sort" defaultValue={sort}>
            {Object.entries(SORTS).map(([k, t]) => (
              <option key={k} value={k}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="btn-small">
          Show
        </button>
        {(active.length > 0 || q) && (
          <Link href={`/vnit/admin/students?${filterQuery(f)}`} className="btn-small">
            Clear
          </Link>
        )}
      </form>
      <p className="muted small">
        {students.length} of {all.length} students{active.length ? ` · ${active.join(" · ")}` : ""}. Learning score: share of
        questions right on the first attempt, in the period.
      </p>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Student</th>
              <th>Roll no.</th>
              <th>Last sign-in</th>
              <th className="num">Sessions</th>
              <th className="num">Active time</th>
              <th className="num">Chapters done</th>
              <th className="num">Learning score</th>
              <th className="num">Questions</th>
            </tr>
          </thead>
          <tbody>
            {students.map((s) => (
              <tr key={s.id}>
                <td>
                  <Link href={`/vnit/admin/students/${encodeURIComponent(s.id)}?${filterQuery(f)}`}>{s.name}</Link>
                </td>
                <td className="mono">{s.guest ? "guest" : s.roll}</td>
                <td>{s.lastLogin ? fmtDateTime(s.lastLogin) : "Never"}</td>
                <td className="num">{s.sessions}</td>
                <td className="num">{fmtHms(s.activeSeconds)}</td>
                <td className="num">
                  {s.chaptersDone}/{total}
                </td>
                <td className="num">
                  {s.score == null ? "—" : `${s.score} %`} {s.band && <BandBadge band={s.band} short />}
                </td>
                <td className="num">{s.answered}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
