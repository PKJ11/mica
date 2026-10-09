import "server-only";
import { queryOne, transaction, type Querier } from "@/lib/db";
import { SETTINGS } from "@/lib/settings";

/**
 * Summaries (section 5): activity_summary, question_results and chapter_status, rebuilt from the
 * append-only events. Each refresh recomputes only the students touched by events since the last one,
 * inside one transaction, so screens never see half-built figures.
 */

/** Screens may show figures up to this old (NF-6). */
export const SUMMARY_MAX_AGE_MS = 15 * 60_000;
/** Events can commit a little after their server_ts; re-read this much before the watermark. */
const OVERLAP = "5 minutes";
const LOCK_KEY = 815_001;
const TZ = "Asia/Kolkata";

export type SummaryState = { watermark: Date | null; refreshed_at: Date | null; duration_ms: number | null; students: number | null };
export type RefreshResult = { ran: boolean; reason?: string; students?: number; durationMs?: number };

export async function summaryState(): Promise<SummaryState | null> {
  return queryOne<SummaryState>(`SELECT watermark, refreshed_at, duration_ms, students FROM summary_state WHERE id = 'main'`);
}

/**
 * Refreshes the summaries. `full` rebuilds everything from all events (after a change to how a measure is defined).
 * `wait` (for someone who asked for fresh figures) waits for a refresh already running and then catches up;
 * without it a refresh that finds another one running skips.
 */
export async function refreshSummaries(opts: { full?: boolean; wait?: boolean } = {}): Promise<RefreshResult> {
  const started = Date.now();
  return transaction(async (tx) => {
    // One refresh at a time across all server instances.
    if (opts.wait) await tx.query(`SELECT pg_advisory_xact_lock($1)`, [LOCK_KEY]);
    else {
      const [lock] = await tx.query<{ ok: boolean }>(`SELECT pg_try_advisory_xact_lock($1) AS ok`, [LOCK_KEY]);
      if (!lock.ok) return { ran: false, reason: "busy" };
    }

    const [state] = await tx.query<{ watermark: Date | null }>(`SELECT watermark FROM summary_state WHERE id = 'main'`);
    const students = await rebuild(tx, opts.full ? null : (state?.watermark ?? null));

    // Sessions show the same active time as the summaries.
    if (students.size) {
      await tx.query(
        `UPDATE sessions s
         SET active_seconds = coalesce((SELECT sum(a.active_seconds) FROM activity_summary a WHERE a.session_id = s.id), 0)::int
         WHERE s.user_id = ANY($1)`,
        [[...students]],
      );
    }

    // The watermark is the transaction's start time: anything committed later is picked up next time.
    const durationMs = Date.now() - started;
    await tx.query(
      `INSERT INTO summary_state (id, watermark, refreshed_at, duration_ms, students) VALUES ('main', now(), clock_timestamp(), $1, $2)
       ON CONFLICT (id) DO UPDATE SET watermark = EXCLUDED.watermark, refreshed_at = EXCLUDED.refreshed_at,
         duration_ms = EXCLUDED.duration_ms, students = EXCLUDED.students`,
      [durationMs, students.size],
    );
    return { ran: true, students: students.size, durationMs };
  });
}

/** Recomputes the summaries touched since `since`, or all of them when it is null. */
async function rebuild(tx: Querier, since: Date | null): Promise<Set<string>> {
  if (!since) await tx.query(`TRUNCATE activity_summary, question_results, chapter_status`);
  const students = new Set<string>();
  for (const u of await refreshActivity(tx, since)) students.add(u);
  for (const u of await refreshQuestions(tx, since)) students.add(u);
  for (const u of await refreshChapters(tx, since)) students.add(u);
  return students;
}

const SUMMARY_TABLES = ["activity_summary", "question_results", "chapter_status"] as const;
export type VerifyResult = Record<
  (typeof SUMMARY_TABLES)[number],
  { rows: number; differing: number; onlyRebuilt?: unknown[]; onlyStored?: unknown[] }
>;

/**
 * Checks the incrementally maintained summaries against a full rebuild from all events (NF-8).
 * Applies any pending incremental refresh, then a full rebuild, and compares the two. Runs in a transaction that is
 * always rolled back, so it changes nothing. 0 differing rows everywhere = consistent.
 */
export async function verifySummaries(): Promise<VerifyResult> {
  const rollback = new Error("rollback");
  let result: VerifyResult | null = null;
  try {
    await transaction(async (tx) => {
      await tx.query(`SELECT pg_advisory_xact_lock($1)`, [LOCK_KEY]);
      // Bring the stored figures up to date the normal, incremental way first, so only the method differs.
      const [state] = await tx.query<{ watermark: Date | null }>(`SELECT watermark FROM summary_state WHERE id = 'main'`);
      if (state?.watermark) await rebuild(tx, state.watermark);
      for (const t of SUMMARY_TABLES) await tx.query(`CREATE TEMP TABLE v_${t} ON COMMIT DROP AS SELECT * FROM ${t}`);
      await rebuild(tx, null);
      const out: Partial<VerifyResult> = {};
      for (const t of SUMMARY_TABLES) {
        const [r] = await tx.query<{ rows: number; differing: number }>(
          `SELECT (SELECT count(*) FROM ${t})::int AS rows,
                  ((SELECT count(*) FROM (SELECT * FROM ${t} EXCEPT SELECT * FROM v_${t}) a) +
                   (SELECT count(*) FROM (SELECT * FROM v_${t} EXCEPT SELECT * FROM ${t}) b))::int AS differing`,
        );
        if (r.differing) {
          // A few examples from each side, to show what disagrees.
          const onlyRebuilt = await tx.query(`SELECT * FROM (SELECT * FROM ${t} EXCEPT SELECT * FROM v_${t}) a LIMIT 5`);
          const onlyStored = await tx.query(`SELECT * FROM (SELECT * FROM v_${t} EXCEPT SELECT * FROM ${t}) b LIMIT 5`);
          out[t] = { ...r, onlyRebuilt, onlyStored };
        } else out[t] = r;
      }
      result = out as VerifyResult;
      throw rollback;
    });
  } catch (err) {
    if (err !== rollback) throw err;
  }
  return result!;
}

/** Refreshes only if the last refresh is older than maxAgeMs. */
export async function refreshIfStale(maxAgeMs = SUMMARY_MAX_AGE_MS): Promise<RefreshResult> {
  const st = await summaryState();
  if (st?.refreshed_at && Date.now() - new Date(st.refreshed_at).getTime() < maxAgeMs) return { ran: false, reason: "fresh" };
  return refreshSummaries();
}

const sinceClause = (since: Date | null) => (since ? `AND server_ts > $1::timestamptz - interval '${OVERLAP}'` : "");
const sinceParams = (since: Date | null) => (since ? [since] : []);

/**
 * Active time per student, IST day, session, module and chapter (the "daily summary").
 * Each heartbeat stands for the 15 s before it. Active time is the length of the union of those windows,
 * so two visible tabs in one session never count the same moment twice. Client clocks order beats within
 * a session; server time decides the day.
 */
async function refreshActivity(tx: Querier, since: Date | null): Promise<string[]> {
  const keys = await tx.query<{ user_id: string; day: string }>(
    `SELECT DISTINCT user_id, to_char(server_ts AT TIME ZONE '${TZ}', 'YYYY-MM-DD') AS day
     FROM events WHERE type = 'heartbeat' AND user_id IS NOT NULL AND session_id IS NOT NULL ${sinceClause(since)}`,
    sinceParams(since),
  );
  if (!keys.length) return [];
  const users = keys.map((k) => k.user_id);
  const days = keys.map((k) => k.day);

  await tx.query(
    `DELETE FROM activity_summary a USING unnest($1::text[], $2::date[]) AS k(user_id, day)
     WHERE a.user_id = k.user_id AND a.day = k.day`,
    [users, days],
  );
  await tx.query(
    `INSERT INTO activity_summary (user_id, day, session_id, module, chapter, active_seconds, first_at, last_at)
     SELECT user_id, day, session_id, module, chapter, round(sum(contrib))::int, min(server_ts), max(server_ts)
     FROM (
       SELECT iv.*,
              greatest(0, iv.t_end - greatest(iv.t_start, coalesce(max(iv.t_end) OVER w, iv.t_start))) AS contrib
       FROM (
         SELECT e.user_id, k.day, e.session_id, coalesce(e.module, '') AS module, coalesce(e.chapter, '') AS chapter,
                e.server_ts,
                extract(epoch FROM coalesce(e.client_ts, e.server_ts)) - $3::int AS t_start,
                extract(epoch FROM coalesce(e.client_ts, e.server_ts)) AS t_end
         FROM unnest($1::text[], $2::date[]) AS k(user_id, day)
         JOIN events e ON e.user_id = k.user_id
          AND e.server_ts >= (k.day::timestamp AT TIME ZONE '${TZ}')
          AND e.server_ts < ((k.day + 1)::timestamp AT TIME ZONE '${TZ}')
         WHERE e.type = 'heartbeat' AND e.session_id IS NOT NULL
       ) iv
       WINDOW w AS (PARTITION BY iv.session_id ORDER BY iv.t_start, iv.t_end ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING)
     ) x
     GROUP BY user_id, day, session_id, module, chapter
     HAVING round(sum(contrib)) > 0`,
    [users, days, SETTINGS.heartbeatMs / 1000],
  );
  return [...new Set(users)];
}

/** One row per learning answer, numbered by attempt (IA-6). Chapter and kind come from the catalogue. */
async function refreshQuestions(tx: Querier, since: Date | null): Promise<string[]> {
  const keys = await tx.query<{ user_id: string; module: string; element: string }>(
    `SELECT DISTINCT user_id, module, element FROM events
     WHERE type = 'answer_submitted' AND user_id IS NOT NULL AND module IS NOT NULL AND element IS NOT NULL ${sinceClause(since)}`,
    sinceParams(since),
  );
  if (!keys.length) return [];
  const cols = [keys.map((k) => k.user_id), keys.map((k) => k.module), keys.map((k) => k.element)];

  await tx.query(
    `DELETE FROM question_results q USING unnest($1::text[], $2::text[], $3::text[]) AS k(user_id, module, question_id)
     WHERE q.user_id = k.user_id AND q.module = k.module AND q.question_id = k.question_id`,
    cols,
  );
  await tx.query(
    `INSERT INTO question_results (event_id, user_id, session_id, module, question_id, chapter, kind, option, correct, seconds, attempt, answered_at)
     SELECT e.id, e.user_id, e.session_id, e.module, e.element, el.chapter_id, el.type,
            e.details->>'option', coalesce((e.details->>'correct')::boolean, false), (e.details->>'seconds')::int,
            row_number() OVER (PARTITION BY e.user_id, e.module, e.element ORDER BY coalesce(e.client_ts, e.server_ts), e.server_ts, e.id),
            e.server_ts
     FROM unnest($1::text[], $2::text[], $3::text[]) AS k(user_id, module, question_id)
     JOIN events e ON e.user_id = k.user_id AND e.module = k.module AND e.element = k.question_id AND e.type = 'answer_submitted'
     LEFT JOIN elements el ON el.module_id = e.module AND el.id = e.element`,
    cols,
  );
  return [...new Set(cols[0])];
}

/**
 * Per student per chapter: times opened, deepest scroll, and completion (IA-8).
 * A chapter with quick-check questions is complete once every one has been answered; a quiz chapter once
 * every final-quiz question has; any other chapter once it has been scrolled to the end.
 */
async function refreshChapters(tx: Querier, since: Date | null): Promise<string[]> {
  const keys = await tx.query<{ user_id: string; module: string }>(
    `SELECT DISTINCT user_id, module FROM events
     WHERE type IN ('chapter_opened', 'scroll_depth', 'answer_submitted') AND user_id IS NOT NULL AND module IS NOT NULL
     ${sinceClause(since)}`,
    sinceParams(since),
  );
  if (!keys.length) return [];
  const cols = [keys.map((k) => k.user_id), keys.map((k) => k.module)];

  await tx.query(
    `DELETE FROM chapter_status c USING unnest($1::text[], $2::text[]) AS k(user_id, module)
     WHERE c.user_id = k.user_id AND c.module = k.module`,
    cols,
  );
  await tx.query(
    `WITH k AS (SELECT * FROM unnest($1::text[], $2::text[]) AS k(user_id, module)),
     opened AS (
       SELECT e.user_id, e.module, e.chapter,
              count(*) FILTER (WHERE e.type = 'chapter_opened')::int AS opens,
              min(e.server_ts) FILTER (WHERE e.type = 'chapter_opened') AS first_opened_at,
              max(e.server_ts) FILTER (WHERE e.type = 'chapter_opened') AS last_opened_at,
              max((e.details->>'percent')::int) FILTER (WHERE e.type = 'scroll_depth') AS max_scroll,
              min(e.server_ts) FILTER (WHERE e.type = 'scroll_depth' AND (e.details->>'percent')::int >= 100) AS read_at
       FROM k JOIN events e ON e.user_id = k.user_id AND e.module = k.module
       WHERE e.type IN ('chapter_opened', 'scroll_depth') AND e.chapter IS NOT NULL
       GROUP BY 1, 2, 3
     ),
     required AS (
       SELECT c.module_id, c.id AS chapter, el.id AS question_id
       FROM chapters c
       JOIN elements el ON el.module_id = c.module_id AND NOT el.retired
        AND ((c.kind = 'quiz' AND el.type = 'final_quiz') OR (c.kind <> 'quiz' AND el.type = 'quick_check' AND el.chapter_id = c.id))
       WHERE NOT c.retired
     ),
     answered AS (
       SELECT k.user_id, r.module_id AS module, r.chapter, count(*) AS needed, count(f.first_at) AS got, max(f.first_at) AS done_at
       FROM k JOIN required r ON r.module_id = k.module
       LEFT JOIN (SELECT user_id, module, question_id, min(answered_at) AS first_at FROM question_results GROUP BY 1, 2, 3) f
         ON f.user_id = k.user_id AND f.module = r.module_id AND f.question_id = r.question_id
       GROUP BY 1, 2, 3
     )
     INSERT INTO chapter_status (user_id, module, chapter, opens, first_opened_at, last_opened_at, max_scroll, completed_at)
     SELECT coalesce(o.user_id, a.user_id), coalesce(o.module, a.module), coalesce(o.chapter, a.chapter),
            coalesce(o.opens, 0), o.first_opened_at, o.last_opened_at, o.max_scroll,
            CASE WHEN a.needed IS NOT NULL THEN CASE WHEN a.got = a.needed THEN a.done_at END ELSE o.read_at END
     FROM opened o
     FULL JOIN answered a ON a.user_id = o.user_id AND a.module = o.module AND a.chapter = o.chapter
     WHERE o.user_id IS NOT NULL OR a.got > 0`,
    cols,
  );
  return [...new Set(cols[0])];
}
