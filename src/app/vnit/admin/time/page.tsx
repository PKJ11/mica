import Link from "next/link";
import { BarList, Columns } from "@/components/charts";
import { assignedContent, cohortStudents, timeRows } from "@/lib/analytics/data";
import { filterQuery } from "@/lib/analytics/filters";
import { spread, timeBins, type Spread } from "@/lib/analytics/stats";
import { fmtHms, fmtSpan } from "@/lib/format";
import StaffHeader from "../StaffHeader";
import { audit, staffPage, type SearchParams } from "../staff";

export const metadata = { title: "VNIT Nagpur · Time" };

type Group = "module" | "chapter" | "type";
const GROUPS: [Group, string][] = [
  ["module", "Module"],
  ["chapter", "Chapter"],
  ["type", "Content type"],
];
const TYPE_LABEL: Record<string, string> = { module: "Learning modules", dashboard: "Dashboards", game_set: "Games" };

type Row = { key: string; name: string; sub?: string; perStudent: Map<string, number>; s: Spread };

// I2: how much time students spend, and where. CA-1, CA-2.
export default async function TimePage({ searchParams }: { searchParams: SearchParams }) {
  const { user, filters: f, param } = await staffPage("/vnit/admin/time", searchParams);
  const group = (GROUPS.some(([g]) => g === param("group")) ? param("group") : "module") as Group;
  await audit(user.id, "view_time_analysis", f.cohortId, { group, from: f.from, to: f.to });

  const [students, content, rows] = await Promise.all([cohortStudents(f.cohortId), assignedContent(f.cohortId), timeRows(f)]);
  const moduleType = new Map(content.modules.map((m) => [m.id, m.type]));

  // Seconds per group key per student; every assigned student counts, with zero if they never opened it.
  const keyOf = (r: { module: string; chapter: string }) =>
    group === "module" ? r.module : group === "chapter" ? `${r.module}/${r.chapter}` : (moduleType.get(r.module) ?? "module");
  const sums = new Map<string, Map<string, number>>();
  for (const r of rows) {
    const k = keyOf(r);
    const m = sums.get(k) ?? new Map<string, number>();
    m.set(r.user, (m.get(r.user) ?? 0) + r.seconds);
    sums.set(k, m);
  }
  const groups: { key: string; name: string; sub?: string }[] =
    group === "module"
      ? content.modules.map((m) => ({ key: m.id, name: m.title }))
      : group === "chapter"
        ? content.chapters.map((c) => ({ key: `${c.module}/${c.id}`, name: c.title, sub: c.moduleTitle }))
        : [...new Set(content.modules.map((m) => m.type))].map((t) => ({ key: t, name: TYPE_LABEL[t] ?? t }));
  const table: Row[] = groups
    .map((g) => {
      const per = sums.get(g.key) ?? new Map<string, number>();
      return { ...g, perStudent: per, s: spread(students.map((st) => per.get(st.id) ?? 0)) };
    })
    .sort((a, b) => b.s.total - a.s.total || b.s.median - a.s.median);

  const selKey = param("sel") ?? table[0]?.key;
  const sel = table.find((r) => r.key === selKey);
  const href = (extra: Record<string, string>) => `/vnit/admin/time?${filterQuery(f, { group, ...extra })}`;

  // For a selected module or content type: what it is made of, ranked by total time.
  let parts: { key: string; name: string; total: number; median: number }[] = [];
  if (sel && group !== "chapter") {
    const inSel = (r: { module: string }) => (group === "module" ? r.module === sel.key : moduleType.get(r.module) === sel.key);
    const partKey = (r: { module: string; chapter: string }) => (group === "module" ? r.chapter : r.module);
    const per = new Map<string, Map<string, number>>();
    for (const r of rows.filter(inSel)) {
      const k = partKey(r);
      const m = per.get(k) ?? new Map<string, number>();
      m.set(r.user, (m.get(r.user) ?? 0) + r.seconds);
      per.set(k, m);
    }
    const names =
      group === "module"
        ? content.chapters.filter((c) => c.module === sel.key).map((c) => ({ key: c.id, name: c.title }))
        : content.modules.filter((m) => m.type === sel.key).map((m) => ({ key: m.id, name: m.title }));
    parts = names
      .map((n) => {
        const s = spread(students.map((st) => per.get(n.key)?.get(st.id) ?? 0));
        return { key: n.key, name: n.name, total: s.total, median: s.median };
      })
      .sort((a, b) => b.total - a.total);
  }

  return (
    <>
      <StaffHeader title="Time" filters={f} back={href(selKey ? { sel: selKey } : {})} />
      <div className="seg" role="tablist" aria-label="Group by">
        <span className="muted small">Group by</span>
        {GROUPS.map(([g, label]) => (
          <Link key={g} href={`/vnit/admin/time?${filterQuery(f, { group: g })}`} aria-current={g === group ? "true" : undefined} className={g === group ? "on" : undefined}>
            {label}
          </Link>
        ))}
      </div>

      <section className="panel">
        <h2 className="section-title">Distribution of student time per {GROUPS.find(([g]) => g === group)![1].toLowerCase()}</h2>
        <p className="muted small">
          Active time (h:mm:ss) across all {students.length} students of the cohort. &quot;Not opened&quot; counts students with no time.
          Ranked by total time. Select a row to see its spread.
        </p>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>{GROUPS.find(([g]) => g === group)![1]}</th>
                <th className="num">Min</th>
                <th className="num">Lower quartile</th>
                <th className="num">Median</th>
                <th className="num">Upper quartile</th>
                <th className="num">Max</th>
                <th className="num">Total</th>
                <th className="num">Not opened</th>
              </tr>
            </thead>
            <tbody>
              {table.map((r) => (
                <tr key={r.key} className={r.key === sel?.key ? "selected" : undefined}>
                  <td>
                    <Link href={href({ sel: r.key })} scroll={false}>
                      {r.name}
                    </Link>
                    {r.sub && <span className="muted small"> · {r.sub}</span>}
                  </td>
                  <td className="num">{fmtHms(r.s.min)}</td>
                  <td className="num">{fmtHms(r.s.q1)}</td>
                  <td className="num">{fmtHms(r.s.median)}</td>
                  <td className="num">{fmtHms(r.s.q3)}</td>
                  <td className="num">{fmtHms(r.s.max)}</td>
                  <td className="num">{fmtHms(r.s.total)}</td>
                  <td className="num">{r.s.zero}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {sel && (
        <div className="grid two">
          <section className="panel">
            <h2 className="section-title">{sel.name} · students by time</h2>
            <Columns
              caption={`Number of students by active time in ${sel.name}`}
              unit="students"
              data={timeBins(students.map((st) => sel.perStudent.get(st.id) ?? 0)).map((b) => ({
                key: b.key,
                label: b.label,
                value: b.count,
                href:
                  group === "module"
                    ? `/vnit/admin/students?${filterQuery(f, { band: b.key, module: sel.key })}`
                    : undefined,
              }))}
            />
          </section>
          {parts.length > 0 && (
            <section className="panel">
              <h2 className="section-title">{group === "module" ? "Chapters" : "Items"}, most to least time</h2>
              <p className="muted small">Bar: total time of the cohort. Marker: median per student.</p>
              <BarList
                data={parts.map((p) => ({
                  key: p.key,
                  label: p.name,
                  value: p.total,
                  display: fmtSpan(p.total),
                  marker: p.median,
                  markerLabel: `median ${fmtSpan(p.median)}`,
                }))}
              />
            </section>
          )}
        </div>
      )}
    </>
  );
}
