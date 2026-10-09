import Link from "next/link";
import { BarList } from "@/components/charts";
import { assignedContent, cohortStudents, firstAttempts, questionDefs, type QuestionDef } from "@/lib/analytics/data";
import { filterQuery } from "@/lib/analytics/filters";
import { median, pct } from "@/lib/analytics/stats";
import { fmtClock } from "@/lib/format";
import StaffHeader from "../StaffHeader";
import { audit, staffPage, type SearchParams } from "../staff";

export const metadata = { title: "VNIT Nagpur · Questions" };

const KIND: Record<string, string> = { quick_check: "Quick check", final_quiz: "Final quiz" };
const LETTERS = "ABCDEFGH";

type Stat = {
  def: QuestionDef;
  attempted: number;
  right: number;
  pct: number | null;
  counts: Map<string, { n: number; users: string[] }>;
  topWrong: { option: string; share: number } | null;
  medianSeconds: number | null;
};

// I3: which questions the cohort gets right and wrong, first attempts only. CA-3, CA-4.
export default async function QuestionsPage({ searchParams }: { searchParams: SearchParams }) {
  const { user, filters: f, param } = await staffPage("/vnit/admin/questions", searchParams);
  const content = await assignedContent(f.cohortId);
  const withQuestions = (await Promise.all(content.modules.map(async (m) => ({ m, defs: await questionDefs(m.id) })))).filter((x) => x.defs.length);
  const current = withQuestions.find((x) => x.m.id === param("module")) ?? withQuestions[0];
  if (!current) return <StaffHeader title="Questions" filters={f} back={`/vnit/admin/questions?${filterQuery(f)}`} />;
  const chapterFilter = param("chapter") ?? "";
  const sort = param("sort") === "order" ? "order" : "pct";
  await audit(user.id, "view_question_analysis", f.cohortId, { module: current.m.id, from: f.from, to: f.to });

  const [attempts, students] = await Promise.all([firstAttempts(f, current.m.id), cohortStudents(f.cohortId)]);
  const names = new Map(students.map((s) => [s.id, s.name]));
  const chapterTitle = new Map(content.chapters.filter((c) => c.module === current.m.id).map((c) => [c.id, c.title]));

  const stats: Stat[] = current.defs.map((def) => {
    const mine = attempts.filter((a) => a.question === def.id);
    const counts = new Map<string, { n: number; users: string[] }>(def.options.map((o) => [o, { n: 0, users: [] }]));
    for (const a of mine) {
      const o = a.option ?? "(no answer recorded)";
      const c = counts.get(o) ?? { n: 0, users: [] };
      c.n++;
      c.users.push(names.get(a.user) ?? a.user);
      counts.set(o, c);
    }
    const right = mine.filter((a) => a.correct).length;
    const wrong = [...counts.entries()].filter(([o, c]) => !def.correct.includes(o) && c.n > 0).sort((a, b) => b[1].n - a[1].n)[0];
    return {
      def,
      attempted: mine.length,
      right,
      pct: pct(right, mine.length),
      counts,
      topWrong: wrong ? { option: wrong[0], share: Math.round((wrong[1].n / mine.length) * 100) } : null,
      medianSeconds: median(mine.map((a) => a.seconds).filter((s): s is number => s != null)),
    };
  });

  const shown = stats
    .filter((s) => !chapterFilter || s.def.chapter === chapterFilter)
    .sort((a, b) => (sort === "order" ? a.def.position - b.def.position : (a.pct ?? 101) - (b.pct ?? 101) || a.def.position - b.def.position));
  const sel = stats.find((s) => s.def.id === param("sel"));
  const base = { module: current.m.id, chapter: chapterFilter, sort };
  const href = (extra: Record<string, string>) => `/vnit/admin/questions?${filterQuery(f, { ...base, ...extra })}`;

  // % right by chapter and by question type (CA-4).
  const agg = (key: (s: Stat) => string | null) => {
    const m = new Map<string, { right: number; n: number }>();
    for (const s of stats) {
      const k = key(s);
      if (!k || !s.attempted) continue;
      const a = m.get(k) ?? { right: 0, n: 0 };
      a.right += s.right;
      a.n += s.attempted;
      m.set(k, a);
    }
    return m;
  };
  const byChapter = agg((s) => s.def.chapter);
  const byKind = agg((s) => s.def.kind);
  const chapterOrder = content.chapters.filter((c) => c.module === current.m.id).map((c) => c.id);

  return (
    <>
      <StaffHeader title="Questions" filters={f} back={href(sel ? { sel: sel.def.id } : {})} />
      <div className="seg" aria-label="Module">
        <span className="muted small">Source</span>
        {withQuestions.map(({ m }) => (
          <Link key={m.id} href={`/vnit/admin/questions?${filterQuery(f, { module: m.id })}`} className={m.id === current.m.id ? "on" : undefined} aria-current={m.id === current.m.id ? "true" : undefined}>
            {m.title}
          </Link>
        ))}
      </div>
      <form className="inline-form" action="/vnit/admin/questions">
        {Object.entries({ cohort: f.cohortId, range: f.range, ...(f.range === "custom" ? { from: f.from, to: f.to } : {}), module: current.m.id }).map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}
        <label>
          <span className="muted small">Chapter</span>
          <select name="chapter" defaultValue={chapterFilter}>
            <option value="">All</option>
            {chapterOrder.filter((c) => stats.some((s) => s.def.chapter === c)).map((c) => (
              <option key={c} value={c}>
                {chapterTitle.get(c)}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="muted small">Sort</span>
          <select name="sort" defaultValue={sort}>
            <option value="pct">% right, lowest first</option>
            <option value="order">Module order</option>
          </select>
        </label>
        <button type="submit" className="btn-small">
          Show
        </button>
      </form>

      {sel && (
        <section className="panel">
          <h2 className="section-title">{sel.def.text}</h2>
          <p className="muted small">
            {sel.attempted} first attempts · options in answer-key order (students saw them shuffled) ·{" "}
            <Link href={href({})} scroll={false}>
              Close
            </Link>
          </p>
          <BarList
            wide
            max={sel.attempted}
            data={[...sel.counts.entries()].map(([o, c], i) => ({
              key: o,
              label: `${LETTERS[i] ?? "?"}  ${o}`,
              sub: sel.def.correct.includes(o) ? "✓ correct" : undefined,
              value: c.n,
              display: `${c.n}${sel.attempted ? ` · ${Math.round((c.n / sel.attempted) * 100)} %` : ""}`,
              selected: sel.def.correct.includes(o),
            }))}
          />
          {[...sel.counts.entries()].filter(([o, c]) => !sel.def.correct.includes(o) && c.n).map(([o, c]) => (
            <details key={o} className="who">
              <summary>
                {c.n} chose &quot;{o.slice(0, 60)}&quot;
              </summary>
              <p className="small">{c.users.sort().join(", ")}</p>
            </details>
          ))}
        </section>
      )}

      <section className="panel">
        <p className="muted small">
          Learning questions in {current.m.title}, first attempts by the cohort in the period. Select a question to see every option.
        </p>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Question</th>
                <th>Chapter</th>
                <th>Type</th>
                <th className="num">Attempted</th>
                <th className="num">% right</th>
                <th>Most common wrong answer</th>
                <th className="num">Median time</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((s) => (
                <tr key={s.def.id} className={s.def.id === sel?.def.id ? "selected" : undefined}>
                  <td className="wrap wide">
                    <Link href={href({ sel: s.def.id })} scroll={false}>
                      {s.def.text.length > 90 ? `${s.def.text.slice(0, 88)}…` : s.def.text}
                    </Link>
                  </td>
                  <td>
                    {s.def.chapter ? chapterTitle.get(s.def.chapter) : "—"}
                    {s.def.chapterSource === "proposed" && <span className="muted small" title="Chapter tag proposed, not set by the module"> *</span>}
                  </td>
                  <td>{KIND[s.def.kind] ?? s.def.kind}</td>
                  <td className="num">{s.attempted}</td>
                  <td className="num">{s.pct == null ? "—" : `${s.pct} %`}</td>
                  <td className="wrap small">{s.topWrong ? `${s.topWrong.option.slice(0, 50)} (${s.topWrong.share} %)` : "—"}</td>
                  <td className="num">{fmtClock(s.medianSeconds)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted small">* Chapter tag proposed from the question; the module itself does not tag it.</p>
      </section>

      <div className="grid two">
        <section className="panel">
          <h2 className="section-title">% right by chapter</h2>
          {byChapter.size ? (
            <BarList
              max={100}
              data={chapterOrder.filter((c) => byChapter.has(c)).map((c) => {
                const a = byChapter.get(c)!;
                return { key: c, label: chapterTitle.get(c) ?? c, value: pct(a.right, a.n)!, display: `${pct(a.right, a.n)} % · ${a.n} answers` };
              })}
            />
          ) : (
            <p className="muted">No answers in this period yet.</p>
          )}
        </section>
        <section className="panel">
          <h2 className="section-title">% right by question type</h2>
          {byKind.size ? (
            <BarList
              max={100}
              data={[...byKind.entries()].map(([k, a]) => ({ key: k, label: KIND[k] ?? k, value: pct(a.right, a.n)!, display: `${pct(a.right, a.n)} % · ${a.n} answers` }))}
            />
          ) : (
            <p className="muted">No answers in this period yet.</p>
          )}
        </section>
      </div>
    </>
  );
}
