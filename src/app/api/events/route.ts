import { after } from "next/server";
import { query, queryOne } from "@/lib/db";
import { SETTINGS } from "@/lib/settings";
import { refreshIfStale } from "@/lib/summaries";
import { getVnitSession } from "@/lib/vnitAuth";

const MAX_BODY = 256_000;
const MAX_EVENTS = 100;
const ID_RE = /^[0-9a-f-]{8,64}$/i;
const TYPE_RE = /^[a-z][a-z0-9_]{0,47}$/;

// Summaries stay fresh while students are active, with no scheduler needed: after a response, this
// instance checks at most once a minute whether they are older than 15 minutes, and refreshes them.
let lastSummaryCheck = 0;
function keepSummariesFresh() {
  if (Date.now() - lastSummaryCheck < 60_000) return;
  lastSummaryCheck = Date.now();
  after(() => refreshIfStale().catch((err) => console.error("summary refresh failed", err)));
}

type InEvent = {
  id?: unknown;
  type?: unknown;
  ts?: unknown;
  module?: unknown;
  chapter?: unknown;
  element?: unknown;
  page?: unknown;
  tab?: unknown;
  cv?: unknown;
  details?: unknown;
};

function str(v: unknown, max: number): string | null {
  return typeof v === "string" && v ? v.slice(0, max) : null;
}

function clientTime(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = Date.parse(v);
  // Client clocks are informational only (NF-7); drop wildly wrong ones.
  return Number.isFinite(t) && Math.abs(t - Date.now()) < 7 * 86_400_000 ? new Date(t).toISOString() : null;
}

function details(v: unknown): string | null {
  if (v == null || typeof v !== "object") return null;
  const s = JSON.stringify(v);
  return s.length <= 4000 ? s : JSON.stringify({ truncated: true });
}

/** Event endpoint (EV-7, EV-11): checks the session, stamps server time, drops duplicates by event ID. */
export async function POST(req: Request) {
  const text = await req.text();
  if (text.length > MAX_BODY) return Response.json({ error: "too large" }, { status: 413 });
  let body: { sessionId?: unknown; tabId?: unknown; role?: unknown; inputAgoMs?: unknown; events?: unknown };
  try {
    body = JSON.parse(text);
  } catch {
    return Response.json({ error: "bad json" }, { status: 400 });
  }

  const s = await getVnitSession();
  if (!s) return Response.json({ session: "ended", reason: "none" }, { status: 401 });
  if (s.endedAt) return Response.json({ session: "ended", reason: s.endReason });

  // Events are accepted only for the signed-in user's own, current session.
  if (body.sessionId !== s.id) {
    const old =
      typeof body.sessionId === "string"
        ? await queryOne<{ end_reason: string | null }>(`SELECT end_reason FROM sessions WHERE id = $1 AND user_id = $2`, [
            body.sessionId,
            s.user.id,
          ])
        : null;
    return Response.json({ session: "ended", reason: old?.end_reason ?? "closed" });
  }

  const events = (Array.isArray(body.events) ? body.events : []).slice(0, MAX_EVENTS) as InEvent[];
  const values: unknown[] = [];
  const rows: string[] = [];
  let heartbeats = 0;
  for (const e of events) {
    const id = str(e.id, 64);
    const type = str(e.type, 48);
    if (!id || !ID_RE.test(id) || !type || !TYPE_RE.test(type)) continue;
    if (type === "heartbeat" && body.role === "top") heartbeats++;
    const o = values.length;
    values.push(
      id,
      s.user.id,
      s.id,
      s.user.institutionId,
      s.user.cohortId,
      str(e.module, 80),
      str(e.chapter, 80),
      str(e.element, 200),
      type,
      clientTime(e.ts),
      str(e.page, 300),
      str(e.tab, 64),
      s.deviceType,
      str(e.cv, 40),
      details(e.details),
    );
    rows.push(`(${Array.from({ length: 15 }, (_, i) => `$${o + i + 1}`).join(", ")})`);
  }

  if (rows.length) {
    await query(
      `INSERT INTO events (id, user_id, session_id, institution_id, cohort_id, module, chapter, element, type,
                           client_ts, page, tab_id, device_type, content_version, details)
       VALUES ${rows.join(", ")} ON CONFLICT (id) DO NOTHING`,
      values,
    );
  }

  // Session bookkeeping. Active seconds here are a running figure; summaries recompute them from heartbeats.
  const inputAgoMs = Math.max(0, Math.min(Number(body.inputAgoMs) || 0, SETTINGS.idleLogoutMs * 2));
  const beatSeconds = SETTINGS.heartbeatMs / 1000;
  await query(
    `UPDATE sessions SET
       last_seen_at = now(),
       last_input_at = GREATEST(last_input_at, now() - ($2::int * interval '1 millisecond')),
       active_seconds = active_seconds + CASE
         WHEN $3::int > 1 THEN $3::int * $4::int
         WHEN $3::int = 1 AND (last_heartbeat_at IS NULL OR last_heartbeat_at < now() - interval '12 seconds') THEN $4::int
         ELSE 0 END,
       last_heartbeat_at = CASE WHEN $3::int > 0 THEN now() ELSE last_heartbeat_at END
     WHERE id = $1 AND ended_at IS NULL`,
    [s.id, Math.round(inputAgoMs), heartbeats, beatSeconds],
  );

  keepSummariesFresh();
  return Response.json({ session: "open", accepted: rows.length });
}
