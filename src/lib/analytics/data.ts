import "server-only";
import { query } from "@/lib/db";
import { BANDS } from "@/lib/settings";
import type { Filters } from "./filters";
import { band, pct, type Band } from "./stats";

/**
 * Instructor-screen queries. Everything reads the summaries (activity_summary, question_results, chapter_status),
 * never raw events, and is scoped to the filters' cohort and IST date range:
 * time by activity day, questions by the day they were answered, sessions by the day they started.
 * Completion is cumulative: chapters completed up to the end of the range.
 */

const TZ = "Asia/Kolkata";
/** SQL: is timestamptz `col` on an IST day between $from and $to? (Parameter numbers are given.) */
const onDays = (col: string, from: number, to: number) => `(${col} AT TIME ZONE '${TZ}')::date BETWEEN $${from}::date AND $${to}::date`;
const endOf = (to: number) => `(($${to}::date + 1)::timestamp AT TIME ZONE '${TZ}')`;

export type Student = { id: string; name: string; roll: string; guest: boolean };

export async function cohortStudents(cohortId: string): Promise<Student[]> {
  return query<Student>(
    `SELECT u.id, u.name, u.roll, u.guest FROM enrolments e JOIN users u ON u.id = e.user_id
     WHERE e.cohort_id = $1 AND e.role = 'student' AND u.status = 'active' ORDER BY u.name`,
    [cohortId],
  );
}

export type CatalogueModule = { id: string; title: string; type: string; position: number };
export type CatalogueChapter = { module: string; moduleTitle: string; moduleType: string; id: string; title: string; kind: string; position: number };

/** Modules assigned to the cohort, and their chapters, in catalogue order. */
export async function assignedContent(cohortId: string): Promise<{ modules: CatalogueModule[]; chapters: CatalogueChapter[] }> {
  const modules = await query<CatalogueModule>(
    `SELECT m.id, m.title, m.type, m.position FROM modules m JOIN assignments a ON a.module_id = m.id
     WHERE a.cohort_id = $1 ORDER BY m.position`,
    [cohortId],
  );
  const chapters = await query<CatalogueChapter>(
    `SELECT c.module_id AS module, m.title AS "moduleTitle", m.type AS "moduleType", c.id, c.title, c.kind, c.position
     FROM chapters c JOIN modules m ON m.id = c.module_id JOIN assignments a ON a.module_id = c.module_id
     WHERE a.cohort_id = $1 AND NOT c.retired ORDER BY m.position, c.position`,
    [cohortId],
  );
  return { modules, chapters };
}

export type StudentTotals = Student & {
  lastLogin: Date | null;
  sessions: number;
  activeSeconds: number;
  learningSeconds: number;
  chaptersDone: number;
  answered: number;
  right: number;
  score: number | null;
  band: Band;
};

/** One row per student of the cohort, for the range (I1, I4). */
export async function studentTotals(f: Filters): Promise<StudentTotals[]> {
  const rows = await query<{
    id: string;
    name: string;
    roll: string;
    guest: boolean;
    last_login: Date | null;
    sessions: number;
    active: number;
    learning: number;
    done: number;
    answered: number;
    right: number;
  }>(
    `WITH st AS (
       SELECT u.id, u.name, u.roll, u.guest FROM enrolments e JOIN users u ON u.id = e.user_id
       WHERE e.cohort_id = $1 AND e.role = 'student' AND u.status = 'active'
     )
     SELECT st.*,
       (SELECT max(started_at) FROM sessions s WHERE s.user_id = st.id) AS last_login,
       (SELECT count(*)::int FROM sessions s WHERE s.user_id = st.id AND ${onDays("s.started_at", 2, 3)}) AS sessions,
       (SELECT coalesce(sum(a.active_seconds), 0)::int FROM activity_summary a
        WHERE a.user_id = st.id AND a.day BETWEEN $2::date AND $3::date) AS active,
       (SELECT coalesce(sum(a.active_seconds), 0)::int FROM activity_summary a
        WHERE a.user_id = st.id AND a.module <> '' AND a.day BETWEEN $2::date AND $3::date) AS learning,
       (SELECT count(*)::int FROM chapter_status cs
          JOIN chapters c ON c.module_id = cs.module AND c.id = cs.chapter AND c.kind = 'chapter' AND NOT c.retired
          JOIN assignments asg ON asg.module_id = cs.module AND asg.cohort_id = $1
        WHERE cs.user_id = st.id AND cs.completed_at < ${endOf(3)}) AS done,
       (SELECT count(*)::int FROM question_results q WHERE q.user_id = st.id AND q.attempt = 1 AND ${onDays("q.answered_at", 2, 3)}) AS answered,
       (SELECT count(*)::int FROM question_results q
        WHERE q.user_id = st.id AND q.attempt = 1 AND q.correct AND ${onDays("q.answered_at", 2, 3)}) AS right
     FROM st ORDER BY st.name`,
    [f.cohortId, f.from, f.to],
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    roll: r.roll,
    guest: r.guest,
    lastLogin: r.last_login,
    sessions: r.sessions,
    activeSeconds: r.active,
    learningSeconds: r.learning,
    chaptersDone: r.done,
    answered: r.answered,
    right: r.right,
    score: pct(r.right, r.answered),
    band: band(r.right, r.answered, BANDS),
  }));
}

/** Number of "chapter" chapters in the cohort's modules: the denominator of "chapters done". */
export async function chapterCount(cohortId: string): Promise<number> {
  const [r] = await query<{ n: number }>(
    `SELECT count(*)::int AS n FROM chapters c JOIN assignments a ON a.module_id = c.module_id
     WHERE a.cohort_id = $1 AND c.kind = 'chapter' AND NOT c.retired`,
    [cohortId],
  );
  return r.n;
}

export type TimeRow = { module: string; chapter: string; user: string; seconds: number };

/** Active seconds per module, chapter and student of the cohort, for the range (learning time only). */
export async function timeRows(f: Filters): Promise<TimeRow[]> {
  return query<TimeRow>(
    `SELECT a.module, a.chapter, a.user_id AS user, sum(a.active_seconds)::int AS seconds
     FROM activity_summary a JOIN enrolments e ON e.user_id = a.user_id AND e.cohort_id = $1 AND e.role = 'student'
     WHERE a.module <> '' AND a.day BETWEEN $2::date AND $3::date
     GROUP BY 1, 2, 3`,
    [f.cohortId, f.from, f.to],
  );
}

/** Students active in the last 7 days up to the end of the range. */
export async function activeLastWeek(f: Filters): Promise<number> {
  const [r] = await query<{ n: number }>(
    `SELECT count(DISTINCT a.user_id)::int AS n FROM activity_summary a
     JOIN enrolments e ON e.user_id = a.user_id AND e.cohort_id = $1 AND e.role = 'student'
     WHERE a.day BETWEEN ($2::date - 6) AND $2::date`,
    [f.cohortId, f.to],
  );
  return r.n;
}

export type QuestionDef = {
  module: string;
  id: string;
  chapter: string | null;
  kind: string;
  position: number;
  text: string;
  options: string[];
  correct: string[];
  chapterSource: string | null;
};

export async function questionDefs(moduleId: string): Promise<QuestionDef[]> {
  const rows = await query<{ module_id: string; id: string; chapter_id: string | null; type: string; position: number; data: Record<string, unknown> }>(
    `SELECT module_id, id, chapter_id, type, position, data FROM elements
     WHERE module_id = $1 AND type IN ('quick_check', 'final_quiz') AND NOT retired ORDER BY position`,
    [moduleId],
  );
  return rows.map((r) => ({
    module: r.module_id,
    id: r.id,
    chapter: r.chapter_id,
    kind: r.type,
    position: r.position,
    text: String(r.data.text ?? ""),
    options: (r.data.options as string[]) ?? [],
    correct: (r.data.correct as string[]) ?? [],
    chapterSource: (r.data.chapter_source as string) ?? null,
  }));
}

export type FirstAttempt = { question: string; user: string; option: string | null; correct: boolean; seconds: number | null };

/** First attempts at a module's questions by the cohort's students, answered in the range (question statistics). */
export async function firstAttempts(f: Filters, moduleId?: string): Promise<(FirstAttempt & { module: string; chapter: string | null; kind: string | null })[]> {
  return query(
    `SELECT q.module, q.question_id AS question, q.chapter, q.kind, q.user_id AS user, q.option, q.correct, q.seconds
     FROM question_results q JOIN enrolments e ON e.user_id = q.user_id AND e.cohort_id = $1 AND e.role = 'student'
     WHERE q.attempt = 1 AND ${onDays("q.answered_at", 2, 3)} ${moduleId ? "AND q.module = $4" : ""}`,
    moduleId ? [f.cohortId, f.from, f.to, moduleId] : [f.cohortId, f.from, f.to],
  );
}
