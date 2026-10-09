import Link from "next/link";
import { notFound } from "next/navigation";
import { BandBadge, BarList, Columns, Stat } from "@/components/charts";
import { assignedContent, chapterCount, studentTotals, timeRows } from "@/lib/analytics/data";
import { filterQuery } from "@/lib/analytics/filters";
import { band, median, pct } from "@/lib/analytics/stats";
import { query, queryOne } from "@/lib/db";
import { fmtClock, fmtDateTime, fmtDay, fmtHms, fmtSpan, fmtTime } from "@/lib/format";
import { BANDS } from "@/lib/settings";
import StaffHeader from "../../StaffHeader";
import { audit, staffPage, type SearchParams } from "../../staff";

export const metadata = { title: "VNIT Nagpur · Student" };

const TABS = [
  ["summary", "Summary"],
  ["time", "Time"],
  ["sessions", "Sessions"],
  ["questions", "Questions"],
] as const;
type Tab = (typeof TABS)[number][0];
const TZ = "Asia/Kolkata";
const END_LABEL: Record<string, string> = { logout: "Sign-out", timeout: "Timeout", taken_over: "Other device", closed: "Tab closed", admin: "Admin" };
const KIND: Record<string, string> = { quick_check: "Quick check", final_quiz: "Final quiz" };

type SessionRow = {
  id: string;
  started_at: Date;
  ended_at: Date | null;
  end_reason: string | null;
  last_input_at: Date;
  active_seconds: number;
  device_type: string | null;
  browser: string | null;
  city: string | null;
  visited: string[] | null;
};
type AnswerRow = {
  id: string;
  answered_at: Date;
  module_title: string | null;
  chapter_title: string | null;
  kind: string | null;
  text: string | null;
  option: string | null;
  correct_answer: string | null;
  correct: boolean;
  seconds: number | null;
  attempt: number;
};
type EventRow = { id: string; type: string; server_ts: Date; module: string | null; chapter: string | null; element: string | null; details: Record<string, unknown> | null };

function eventSummary(e: EventRow): string {
  const d = e.details ?? {};
  if (e.type === "click") return String(d.label ?? "").trim() || e.element || "";
  if (e.type === "widget_interacted") return `${String(d.control || e.element || "")} = ${String(d.value ?? "")}`;
  if (e.type === "scroll_depth") return `${String(d.percent)}%`;
  if (e.type === "chapter_closed") return `${String(d.seconds_open)} s open`;
  if (e.type === "answer_submitted") return `${d.correct ? "✓" : "✗"} ${String(d.option ?? "")}${d.seconds != null ? ` · ${String(d.seconds)} s` : ""}`;
  if (e.type === "heartbeat") return "";
  return Object.keys(d).length ? JSON.stringify(d) : "";
}

const sessionSeconds = (s: SessionRow) => (+new Date(s.ended_at ?? s.last_input_at) - +new Date(s.started_at)) / 1000;

// I4 detail: one student, everything behind IA-1 to IA-11.
export default async function StudentPage({ params, searchParams }: { params: Promise<{ userId: string }>; searchParams: SearchParams }) {
  const userId = decodeURIComponent((await params).userId);
  const path = `/vnit/admin/students/${encodeURIComponent(userId)}`;
  const { user, filters: f, param } = await staffPage(path, searchParams);
  const tab = (TABS.some(([t]) => t === param("tab")) ? param("tab") : "summary") as Tab;
  const sessionId = param("session");

  // Named data only for staff of the student's cohort (CA-10): the student must be in the selected cohort.
  const student = await queryOne<{ id: string; name: string; roll: string }>(
    `SELECT u.id, u.name, u.roll FROM users u JOIN enrolments e ON e.user_id = u.id AND e.cohort_id = $2 AND e.role = 'student'
     WHERE u.id = $1`,
    [userId, f.cohortId],
  );
  if (!student) notFound();
  await audit(user.id, "view_student", student.id, { tab, session: sessionId ?? null, from: f.from, to: f.to });

  const [cohort, rows, content, totalChapters] = await Promise.all([studentTotals(f), timeRows(f), assignedContent(f.cohortId), chapterCount(f.cohortId)]);
  const me = cohort.find((s) => s.id === student.id)!;
  const cohortIds = cohort.map((s) => s.id);

  // Time per chapter: this student, and the class median over all students (IA-1, IA-10).
  const perChapter = new Map<string, Map<string, number>>();
  for (const r of rows) {
    const k = `${r.module}/${r.chapter}`;
    const m = perChapter.get(k) ?? new Map<string, number>();
    m.set(r.user, (m.get(r.user) ?? 0) + r.seconds);
    perChapter.set(k, m);
  }
  const classMedian = (k: string) => median(cohortIds.map((id) => perChapter.get(k)?.get(id) ?? 0)) ?? 0;
  const status = await query<{ module: string; chapter: string; opens: number; max_scroll: number | null; completed_at: Date | null }>(
    `SELECT module, chapter, opens, max_scroll, completed_at FROM chapter_status WHERE user_id = $1`,
    [student.id],
  );
  const statusOf = new Map(status.map((s) => [`${s.module}/${s.chapter}`, s]));
  const scores = await query<{ module: string; chapter: string; n: number; right: number }>(
    `SELECT module, chapter, count(*)::int AS n, count(*) FILTER (WHERE correct)::int AS right FROM question_results
     WHERE user_id = $1 AND attempt = 1 AND chapter IS NOT NULL AND (answered_at AT TIME ZONE '${TZ}')::date BETWEEN $2::date AND $3::date
     GROUP BY 1, 2`,
    [student.id, f.from, f.to],
  );
  const scoreOf = new Map(scores.map((s) => [`${s.module}/${s.chapter}`, s]));
  const chapters = content.chapters.map((c) => {
    const k = `${c.module}/${c.id}`;
    const sc = scoreOf.get(k);
    return {
      ...c,
      key: k,
      seconds: perChapter.get(k)?.get(student.id) ?? 0,
      median: classMedian(k),
      status: statusOf.get(k),
      n: sc?.n ?? 0,
      right: sc?.right ?? 0,
      band: sc ? band(sc.right, sc.n, BANDS) : null,
    };
  });

  const sessions = await query<SessionRow>(
    `SELECT s.id, s.started_at, s.ended_at, s.end_reason, s.last_input_at, s.active_seconds, s.device_type, s.browser, s.city,
            (SELECT array_agg(DISTINCT m.title) FROM activity_summary a JOIN modules m ON m.id = a.module WHERE a.session_id = s.id) AS visited
     FROM sessions s WHERE s.user_id = $1 AND (s.started_at AT TIME ZONE '${TZ}')::date BETWEEN $2::date AND $3::date
     ORDER BY s.started_at DESC LIMIT 200`,
    [student.id, f.from, f.to],
  );
  const lengths = sessions.map(sessionSeconds);
  const avgSession = lengths.length ? lengths.reduce((a, b) => a + b, 0) / lengths.length : null;
  const tabHref = (t: Tab, extra: Record<string, string> = {}) => `${path}?${filterQuery(f, { tab: t, ...extra })}`;

  return (
    <>
      <StaffHeader title={student.name} filters={f} back={tabHref(tab, sessionId ? { session: sessionId } : {})}>
        <nav className="crumbs">
          <Link href={`/vnit/admin/students?${filterQuery(f)}`}>Students</Link> <span>/</span> <span className="mono">{student.roll}</span>
        </nav>
      </StaffHeader>
      <div className="seg" role="tablist">
        {TABS.map(([t, label]) => (
          <Link key={t} href={tabHref(t)} className={t === tab ? "on" : undefined} aria-current={t === tab ? "true" : undefined}>
            {label}
          </Link>
        ))}
      </div>

      {tab === "summary" && (
        <>
          <div className="grid four stats">
            <Stat label="Sign-ins" value={String(me.sessions)} note={`last ${me.lastLogin ? fmtDateTime(me.lastLogin) : "never"}`} />
            <Stat label="Average session" value={avgSession == null ? "—" : fmtSpan(avgSession)} note={lengths.length ? `median ${fmtSpan(median(lengths)!)}` : undefined} />
            <Stat label="Learning time" value={fmtSpan(me.learningSeconds)} note={`class median ${fmtSpan(median(cohort.map((s) => s.learningSeconds)) ?? 0)}`} />
            <Stat label="Chapters done" value={`${me.chaptersDone} / ${totalChapters}`} note={me.score == null ? "no questions answered" : `learning score ${me.score} %`} />
          </div>
          <div className="grid two">
            <section className="panel">
              <h2 className="section-title">Time by chapter</h2>
              <p className="muted small">Bars: this student. Marker: class median for the chapter.</p>
              {chapters.some((c) => c.seconds) ? (
                <BarList
                  data={chapters
                    .filter((c) => c.seconds || c.median)
                    .sort((a, b) => b.seconds - a.seconds)
                    .slice(0, 10)
                    .map((c) => ({ key: c.key, label: c.title, sub: c.moduleTitle, value: c.seconds, display: fmtSpan(c.seconds), marker: c.median, markerLabel: `class median ${fmtSpan(c.median)}` }))}
                />
              ) : (
                <p className="muted">No time recorded in this period.</p>
              )}
            </section>
            <section className="panel">
              <h2 className="section-title">Score by chapter</h2>
              <p className="muted small">
                First attempts in the period. Strong from {BANDS.strongFrom} %, developing from {BANDS.developingFrom} %; no band under {BANDS.minQuestions} questions.
              </p>
              {(["strong", "developing", "attention"] as const).map((b) => {
                const list = chapters.filter((c) => c.band === b);
                return (
                  <div key={b} className="band-row">
                    <BandBadge band={b} /> <span className="muted small">({list.length})</span>
                    <p className="small">{list.length ? list.map((c) => `${c.title} (${pct(c.right, c.n)} %)`).join(", ") : "—"}</p>
                  </div>
                );
              })}
              <p className="muted small">
                Not enough questions yet: {chapters.filter((c) => c.n > 0 && !c.band).length} chapters with answers, {chapters.filter((c) => c.n === 0).length} without.
              </p>
            </section>
          </div>
        </>
      )}

      {tab === "time" && <TimeTab chapters={chapters} modules={content.modules} />}

      {tab === "sessions" && (
        <SessionsTab sessions={sessions} from={f.from} to={f.to} selected={sessionId} hrefFor={(id) => tabHref("sessions", { session: id })} lengths={lengths} />
      )}

      {tab === "questions" && <QuestionsTab studentId={student.id} from={f.from} to={f.to} chapters={chapters} />}
    </>
  );
}

type ChapterInfo = {
  key: string;
  module: string;
  moduleTitle: string;
  title: string;
  kind: string;
  seconds: number;
  median: number;
  status?: { opens: number; max_scroll: number | null; completed_at: Date | null };
  n: number;
  right: number;
  band: ReturnType<typeof band>;
};

function TimeTab({ chapters, modules }: { chapters: ChapterInfo[]; modules: { id: string; title: string }[] }) {
  const byModule = modules.map((m) => {
    const cs = chapters.filter((c) => c.module === m.id);
    return { ...m, seconds: cs.reduce((a, c) => a + c.seconds, 0) };
  });
  const real = chapters.filter((c) => c.kind === "chapter");
  const ranked = [...real].sort((a, b) => b.seconds - a.seconds);
  return (
    <>
      <div className="grid two">
        <section className="panel">
          <h2 className="section-title">Active time by module</h2>
          <BarList data={byModule.map((m) => ({ key: m.id, label: m.title, value: m.seconds, display: fmtSpan(m.seconds) }))} />
        </section>
        <section className="panel">
          <h2 className="section-title">Most and least time</h2>
          <p className="muted small">Chapters, top five and bottom five.</p>
          <ol className="rank">
            {ranked.slice(0, 5).map((c) => (
              <li key={c.key}>
                {c.title} <span className="muted small">· {c.moduleTitle} · {fmtSpan(c.seconds)}</span>
              </li>
            ))}
          </ol>
          <h3 className="small muted">Least</h3>
          <ol className="rank">
            {ranked.slice(-5).reverse().map((c) => (
              <li key={c.key}>
                {c.title} <span className="muted small">· {c.moduleTitle} · {fmtSpan(c.seconds)}</span>
              </li>
            ))}
          </ol>
        </section>
      </div>
      <section className="panel">
        <h2 className="section-title">Chapters: time against score</h2>
        <p className="muted small">
          Lots of time with a low score suggests struggling; little time with a high score suggests the student already knew it.
        </p>
        <div className="table-wrap">
          <table className="data-table compact">
            <thead>
              <tr>
                <th>Module</th>
                <th>Chapter</th>
                <th className="num">Time</th>
                <th className="num">Class median</th>
                <th className="num">Opened</th>
                <th className="num">Read to</th>
                <th>Completed</th>
                <th className="num">Score</th>
                <th>Band</th>
              </tr>
            </thead>
            <tbody>
              {chapters.map((c) => (
                <tr key={c.key}>
                  <td>{c.moduleTitle}</td>
                  <td>{c.title}</td>
                  <td className="num">{fmtHms(c.seconds)}</td>
                  <td className="num">{fmtHms(c.median)}</td>
                  <td className="num">{c.status?.opens ? `${c.status.opens}×` : "—"}</td>
                  <td className="num">{c.status?.max_scroll == null ? "—" : `${c.status.max_scroll}%`}</td>
                  <td>{c.status?.completed_at ? fmtDay(c.status.completed_at) : "—"}</td>
                  <td className="num">{c.n ? `${c.right}/${c.n}` : "—"}</td>
                  <td>{c.n ? <BandBadge band={c.band} /> : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

async function SessionsTab({
  sessions,
  from,
  to,
  selected,
  hrefFor,
  lengths,
}: {
  sessions: SessionRow[];
  from: string;
  to: string;
  selected?: string;
  hrefFor: (id: string) => string;
  lengths: number[];
}) {
  // Sign-ins per week, Monday to Sunday, from the first week with a session (IA-2).
  const week = (d: Date) => {
    const day = new Date(new Date(d).toLocaleDateString("en-CA", { timeZone: TZ }) + "T00:00:00Z");
    day.setUTCDate(day.getUTCDate() - ((day.getUTCDay() + 6) % 7));
    return day.toISOString().slice(0, 10);
  };
  const counts = new Map<string, number>();
  for (const s of sessions) counts.set(week(s.started_at), (counts.get(week(s.started_at)) ?? 0) + 1);
  const weeks: string[] = [];
  const start = sessions.length ? week(new Date(Math.min(...sessions.map((s) => +new Date(s.started_at))))) : week(new Date(`${from < "2001" ? to : from}T12:00:00+05:30`));
  for (let d = new Date(`${start}T00:00:00Z`); d.toISOString().slice(0, 10) <= to; d.setUTCDate(d.getUTCDate() + 7)) weeks.push(d.toISOString().slice(0, 10));
  const sel = sessions.find((s) => s.id === selected);
  const timeline = sel
    ? await query<EventRow>(
        `SELECT id, type, server_ts, module, chapter, element, details FROM events WHERE session_id = $1 ORDER BY server_ts, client_ts LIMIT 2000`,
        [sel.id],
      )
    : [];

  return (
    <>
      <section className="panel">
        <h2 className="section-title">Sign-ins per week</h2>
        <Columns caption="Sign-ins in each week (Monday start)" unit="sign-ins" data={weeks.slice(-26).map((w) => ({ key: w, label: fmtDay(w), value: counts.get(w) ?? 0 }))} />
      </section>
      <section className="panel">
        <h2 className="section-title">Sessions</h2>
        <p className="muted small">
          {sessions.length} in the period
          {lengths.length ? ` · average ${fmtSpan(lengths.reduce((a, b) => a + b, 0) / lengths.length)} · median ${fmtSpan(median(lengths)!)}` : ""}. A
          session ends at the last input before a timeout or a closed tab. Select one for its time line.
        </p>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Start</th>
                <th className="num">Length</th>
                <th className="num">Active</th>
                <th>Ended by</th>
                <th>Device</th>
                <th>Visited</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.id} className={s.id === selected ? "selected" : undefined}>
                  <td>
                    <Link href={hrefFor(s.id)} scroll={false}>
                      {fmtDateTime(s.started_at)}
                    </Link>
                  </td>
                  <td className="num">{fmtHms(sessionSeconds(s))}</td>
                  <td className="num">{fmtHms(s.active_seconds)}</td>
                  <td>{s.ended_at ? (END_LABEL[s.end_reason ?? ""] ?? s.end_reason) : "Open"}</td>
                  <td>
                    {s.device_type ?? "—"} · {s.browser ?? "—"}
                    {s.city ? ` · ${s.city}` : ""}
                  </td>
                  <td className="wrap">{(s.visited ?? []).join(", ") || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      {sel && (
        <section className="panel">
          <h2 className="section-title">Session time line · {fmtDateTime(sel.started_at)}</h2>
          <p className="muted small">{timeline.length} events, in order (IST).</p>
          <div className="table-wrap">
            <table className="data-table compact">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Event</th>
                  <th>Module</th>
                  <th>Chapter</th>
                  <th>Element</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {timeline.map((e) => (
                  <tr key={e.id}>
                    <td className="mono">{fmtTime(e.server_ts)}</td>
                    <td>{e.type}</td>
                    <td>{e.module ?? ""}</td>
                    <td>{e.chapter ?? ""}</td>
                    <td className="mono small">{e.element ?? ""}</td>
                    <td className="small wrap">{eventSummary(e)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}

async function QuestionsTab({ studentId, from, to, chapters }: { studentId: string; from: string; to: string; chapters: ChapterInfo[] }) {
  const answers = await query<AnswerRow>(
    `SELECT q.event_id AS id, q.answered_at, m.title AS module_title, c.title AS chapter_title, q.kind,
            el.data->>'text' AS text, q.option, el.data->'correct'->>0 AS correct_answer, q.correct, q.seconds, q.attempt
     FROM question_results q
     LEFT JOIN elements el ON el.module_id = q.module AND el.id = q.question_id
     LEFT JOIN chapters c ON c.module_id = q.module AND c.id = q.chapter
     LEFT JOIN modules m ON m.id = q.module
     WHERE q.user_id = $1 AND (q.answered_at AT TIME ZONE '${TZ}')::date BETWEEN $2::date AND $3::date
     ORDER BY q.answered_at DESC LIMIT 1000`,
    [studentId, from, to],
  );
  const firsts = answers.filter((a) => a.attempt === 1);
  const timed = answers.map((a) => a.seconds).filter((s): s is number => s != null);
  // Learning assessments are the quiz chapters; practice chapters are the practice studio and problems (IA-5).
  const quizTime = chapters.filter((c) => c.kind === "quiz").reduce((a, c) => a + c.seconds, 0);
  const practiceTime = chapters.filter((c) => c.kind === "practice").reduce((a, c) => a + c.seconds, 0);
  return (
    <>
      <div className="grid four stats">
        <Stat label="Questions answered" value={String(firsts.length)} note={`${answers.length - firsts.length} retries`} />
        <Stat label="Right first time" value={firsts.length ? `${pct(firsts.filter((a) => a.correct).length, firsts.length)} %` : "—"} />
        <Stat label="Time per question" value={timed.length ? fmtClock(median(timed)) : "—"} note="median, from shown to answered" />
        <Stat label="Quiz and practice time" value={fmtSpan(quizTime + practiceTime)} note={`quizzes ${fmtSpan(quizTime)} · practice ${fmtSpan(practiceTime)}`} />
      </div>
      <section className="panel">
        <h2 className="section-title">Every answer</h2>
        {answers.length ? (
          <div className="table-wrap">
            <table className="data-table compact">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Module</th>
                  <th>Chapter</th>
                  <th>Type</th>
                  <th>Question</th>
                  <th>Answer given</th>
                  <th>Result</th>
                  <th className="num">Time</th>
                  <th className="num">Attempt</th>
                </tr>
              </thead>
              <tbody>
                {answers.map((a) => (
                  <tr key={a.id}>
                    <td>{fmtDateTime(a.answered_at)}</td>
                    <td>{a.module_title ?? "—"}</td>
                    <td>{a.chapter_title ?? "—"}</td>
                    <td>{KIND[a.kind ?? ""] ?? "—"}</td>
                    <td className="small wrap">{a.text ?? "Not in catalogue"}</td>
                    <td className="small wrap">{a.option}</td>
                    <td title={a.correct ? undefined : `Right answer: ${a.correct_answer ?? "?"}`}>{a.correct ? "✓ Right" : "✗ Wrong"}</td>
                    <td className="num">{fmtClock(a.seconds)}</td>
                    <td className="num">{a.attempt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted">No questions answered in this period.</p>
        )}
      </section>
    </>
  );
}
