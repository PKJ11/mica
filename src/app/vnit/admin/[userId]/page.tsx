import Link from "next/link";
import { notFound } from "next/navigation";
import { randomUUID } from "crypto";
import { query, queryOne } from "@/lib/db";
import { fmtDateTime, fmtDuration, fmtTime } from "@/lib/format";
import { requireVnitStaff } from "@/lib/vnitAuth";

export const metadata = { title: "VNIT Nagpur · Student detail" };

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

type EventRow = {
  id: string;
  type: string;
  server_ts: Date;
  module: string | null;
  chapter: string | null;
  element: string | null;
  details: Record<string, unknown> | null;
};

const END_LABEL: Record<string, string> = {
  logout: "Sign-out",
  timeout: "Timeout",
  taken_over: "Other device",
  closed: "Tab closed",
  admin: "Admin",
};

function summary(e: EventRow): string {
  const d = e.details ?? {};
  if (e.type === "click") return String(d.label ?? "").trim() || e.element || "";
  if (e.type === "widget_interacted") return `${String(d.control || e.element || "")} = ${String(d.value ?? "")}`;
  if (e.type === "scroll_depth") return `${String(d.percent)}%`;
  if (e.type === "chapter_closed") return `${String(d.seconds_open)} s open`;
  if (e.type === "heartbeat") return "";
  return Object.keys(d).length ? JSON.stringify(d) : "";
}

export default async function StudentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ userId: string }>;
  searchParams: Promise<{ session?: string }>;
}) {
  const userId = decodeURIComponent((await params).userId);
  const { session: sessionId } = await searchParams;
  const { user: staff } = await requireVnitStaff(`/vnit/admin/${encodeURIComponent(userId)}`);

  const student = await queryOne<{ id: string; name: string; roll: string }>(
    `SELECT id, name, roll FROM users WHERE id = $1 AND institution_id = $2`,
    [userId, staff.institutionId],
  );
  if (!student) notFound();
  await query(`INSERT INTO audit_log (id, actor_id, action, target, details) VALUES ($1, $2, 'view_student', $3, $4)`, [
    randomUUID(),
    staff.id,
    student.id,
    JSON.stringify({ session: sessionId ?? null }),
  ]);

  const sessions = await query<SessionRow>(
    `SELECT s.id, s.started_at, s.ended_at, s.end_reason, s.last_input_at, s.active_seconds, s.device_type, s.browser, s.city,
            (SELECT array_agg(DISTINCT e.module) FROM events e WHERE e.session_id = s.id AND e.module IS NOT NULL) AS visited
     FROM sessions s WHERE s.user_id = $1 ORDER BY s.started_at DESC LIMIT 100`,
    [student.id],
  );
  const byModule = await query<{ module: string; seconds: number }>(
    `SELECT module, (count(*) * 15)::int AS seconds FROM events
     WHERE user_id = $1 AND type = 'heartbeat' AND module IS NOT NULL GROUP BY module ORDER BY seconds DESC`,
    [student.id],
  );
  const selected = sessions.find((s) => s.id === sessionId);
  const timeline = selected
    ? await query<EventRow>(
        `SELECT id, type, server_ts, module, chapter, element, details FROM events
         WHERE session_id = $1 ORDER BY server_ts, client_ts LIMIT 2000`,
        [selected.id],
      )
    : [];

  const totalActive = sessions.reduce((n, s) => n + s.active_seconds, 0);
  const lengths = sessions
    .filter((s) => s.ended_at)
    .map((s) => (new Date(s.ended_at!).getTime() - new Date(s.started_at).getTime()) / 1000)
    .sort((a, b) => a - b);
  const median = lengths.length ? lengths[Math.floor(lengths.length / 2)] : 0;

  return (
    <div className="theme-vnit">
      <main className="page">
        <nav className="crumbs">
          <Link href="/vnit">VNIT Nagpur</Link> <span>/</span> <Link href="/vnit/admin">Student activity</Link> <span>/</span>{" "}
          {student.name}
        </nav>
        <h1 className="page-title">{student.name}</h1>
        <p className="muted mono">{student.roll}</p>

        <div className="grid four stats">
          <div className="stat">
            <span>Sessions</span>
            <strong>{sessions.length}</strong>
          </div>
          <div className="stat">
            <span>Active time</span>
            <strong>{fmtDuration(totalActive)}</strong>
          </div>
          <div className="stat">
            <span>Median session</span>
            <strong>{fmtDuration(median)}</strong>
          </div>
          <div className="stat">
            <span>Modules used</span>
            <strong>{byModule.length}</strong>
          </div>
        </div>

        {byModule.length > 0 && (
          <>
            <h2 className="section-title">Active time by module</h2>
            <div className="table-wrap">
              <table className="data-table">
                <tbody>
                  {byModule.map((m) => (
                    <tr key={m.module}>
                      <td>{m.module}</td>
                      <td className="num">{fmtDuration(m.seconds)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        <h2 className="section-title">Sessions</h2>
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
              {sessions.map((s) => {
                const end = s.ended_at ? new Date(s.ended_at) : new Date(s.last_input_at);
                const len = (end.getTime() - new Date(s.started_at).getTime()) / 1000;
                return (
                  <tr key={s.id} className={s.id === sessionId ? "selected" : undefined}>
                    <td>
                      <Link href={`?session=${s.id}`}>{fmtDateTime(s.started_at)}</Link>
                    </td>
                    <td className="num">{fmtDuration(len)}</td>
                    <td className="num">{fmtDuration(s.active_seconds)}</td>
                    <td>{s.ended_at ? (END_LABEL[s.end_reason ?? ""] ?? s.end_reason) : "Open"}</td>
                    <td>
                      {s.device_type ?? "—"} · {s.browser ?? "—"}
                      {s.city ? ` · ${s.city}` : ""}
                    </td>
                    <td>{(s.visited ?? []).join(", ") || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {selected && (
          <>
            <h2 className="section-title">Session time line · {fmtDateTime(selected.started_at)}</h2>
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
                      <td className="small">{summary(e)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
