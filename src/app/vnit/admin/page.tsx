import Link from "next/link";
import { BarList, Columns, Stat } from "@/components/charts";
import { activeLastWeek, assignedContent, studentTotals, timeRows } from "@/lib/analytics/data";
import { filterQuery } from "@/lib/analytics/filters";
import { median, timeBins } from "@/lib/analytics/stats";
import { fmtDay, fmtSpan, todayIst } from "@/lib/format";
import { BANDS } from "@/lib/settings";
import StaffHeader from "./StaffHeader";
import { audit, staffPage, type SearchParams } from "./staff";

export const metadata = { title: "VNIT Nagpur · Cohort overview" };

const INACTIVE_DAYS = 7;

// I1: the cohort at a glance. CA-1, CA-2, CA-5, CA-7.
export default async function OverviewPage({ searchParams }: { searchParams: SearchParams }) {
  const { user, filters: f } = await staffPage("/vnit/admin", searchParams);
  await audit(user.id, "view_cohort_overview", f.cohortId, { from: f.from, to: f.to });

  const [students, active, rows, content] = await Promise.all([studentTotals(f), activeLastWeek(f), timeRows(f), assignedContent(f.cohortId)]);
  const totals = students.map((s) => s.activeSeconds);
  const medTime = median(totals);
  const scored = students.filter((s) => s.band);
  const medScore = median(scored.map((s) => s.score!));
  const bins = timeBins(totals);

  const byModule = new Map<string, number>();
  for (const r of rows) byModule.set(r.module, (byModule.get(r.module) ?? 0) + r.seconds);
  const classTotal = [...byModule.values()].reduce((a, b) => a + b, 0);

  const cutoff = new Date(`${todayIst()}T00:00:00+05:30`).getTime() - (INACTIVE_DAYS - 1) * 86_400_000;
  const inactive = students.filter((s) => !s.lastLogin || new Date(s.lastLogin).getTime() < cutoff).length;
  const lowTime = students.filter((s) => s.activeSeconds < 3600).length;
  const lowScore = students.filter((s) => s.band === "attention").length;
  const list = (extra: Record<string, string | number>) => `/vnit/admin/students?${filterQuery(f, extra)}`;

  return (
    <>
      <StaffHeader title="Cohort overview" filters={f} back={`/vnit/admin?${filterQuery(f)}`} />

      <div className="grid four stats">
        <Stat label="Students" value={String(students.length)} />
        <Stat label="Active in the last 7 days" value={String(active)} note={f.to === todayIst() ? "up to today" : `up to ${fmtDay(f.to)}`} />
        <Stat label="Median time" value={medTime == null ? "—" : fmtSpan(medTime)} note="per student, in the period" />
        <Stat
          label="Median learning score"
          value={medScore == null ? "—" : `${Math.round(medScore)} %`}
          note={`${scored.length} with ${BANDS.minQuestions}+ questions`}
        />
      </div>

      <section className="panel">
        <h2 className="section-title">Students by total time</h2>
        <p className="muted small">Active time in the period. Select a bar to list the students in it.</p>
        <Columns
          caption="Number of students in each band of total active time"
          unit="students"
          data={bins.map((b) => ({ key: b.key, label: b.label, value: b.count, href: list({ band: b.key }) }))}
        />
      </section>

      <div className="grid two">
        <section className="panel">
          <h2 className="section-title">Time by module</h2>
          <p className="muted small">Share of the cohort&apos;s active time in the period.</p>
          {classTotal ? (
            <BarList
              data={content.modules.map((m) => {
                const s = byModule.get(m.id) ?? 0;
                return {
                  key: m.id,
                  label: m.title,
                  value: s,
                  display: `${Math.round((s / classTotal) * 100)} %`,
                  href: `/vnit/admin/time?${filterQuery(f, { group: "module", sel: m.id })}`,
                };
              })}
            />
          ) : (
            <p className="muted">No activity in this period yet.</p>
          )}
        </section>

        <section className="panel">
          <h2 className="section-title">Needs attention</h2>
          <ul className="chips">
            <li>
              <Link href={list({ inactive: INACTIVE_DAYS })}>
                <strong>{inactive}</strong> not signed in for {INACTIVE_DAYS} days
              </Link>
            </li>
            <li>
              <Link href={list({ time_below: 3600 })}>
                <strong>{lowTime}</strong> under 1 hour in the period
              </Link>
            </li>
            <li>
              <Link href={list({ score_below: BANDS.developingFrom })}>
                <strong>{lowScore}</strong> below {BANDS.developingFrom} % on learning questions
              </Link>
            </li>
          </ul>
        </section>
      </div>
    </>
  );
}
