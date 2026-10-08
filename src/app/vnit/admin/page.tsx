import Link from "next/link";
import { randomUUID } from "crypto";
import { query } from "@/lib/db";
import { fmtDateTime, fmtDuration } from "@/lib/format";
import { requireVnitStaff } from "@/lib/vnitAuth";

export const metadata = { title: "VNIT Nagpur · Student activity" };

type Row = {
  id: string;
  roll: string;
  name: string;
  guest: boolean;
  consent_at: Date | null;
  last_login: Date | null;
  sessions: number;
  active_seconds: number;
  events: number;
  open_now: boolean;
};

// Phase 1 staff view: who has signed in and how much they have used. The full analytics screens (I1–I4) come in phase 2.
export default async function VnitAdminPage() {
  const { user } = await requireVnitStaff("/vnit/admin");
  await query(`INSERT INTO audit_log (id, actor_id, action, target) VALUES ($1, $2, 'view_student_list', $3)`, [
    randomUUID(),
    user.id,
    user.cohortId,
  ]);

  const rows = await query<Row>(
    `SELECT u.id, u.roll, u.name, u.guest,
            (SELECT max(agreed_at) FROM consents c WHERE c.user_id = u.id) AS consent_at,
            (SELECT max(started_at) FROM sessions s WHERE s.user_id = u.id) AS last_login,
            (SELECT count(*)::int FROM sessions s WHERE s.user_id = u.id) AS sessions,
            (SELECT coalesce(sum(active_seconds), 0)::int FROM sessions s WHERE s.user_id = u.id) AS active_seconds,
            (SELECT count(*)::int FROM events e WHERE e.user_id = u.id) AS events,
            EXISTS (SELECT 1 FROM sessions s WHERE s.user_id = u.id AND s.ended_at IS NULL) AS open_now
     FROM users u WHERE u.institution_id = $1
     ORDER BY last_login DESC NULLS LAST, u.name`,
    [user.institutionId],
  );
  const signedIn = rows.filter((r) => r.sessions > 0).length;

  return (
    <div className="theme-vnit">
      <main className="page">
        <nav className="crumbs">
          <Link href="/vnit">VNIT Nagpur</Link> <span>/</span> Student activity
        </nav>
        <h1 className="page-title">Student activity</h1>
        <p className="muted">
          {rows.length} accounts · {signedIn} have signed in. Active time counts 15-second intervals with the tab visible and an
          input in the last minute.
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
                <th className="num">Events</th>
                <th>Consent</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <Link href={`/vnit/admin/${encodeURIComponent(r.id)}`}>{r.name}</Link>
                    {r.open_now && <span className="dot-live" title="Signed in now" />}
                  </td>
                  <td className="mono">{r.guest ? "guest" : r.roll}</td>
                  <td>{fmtDateTime(r.last_login)}</td>
                  <td className="num">{r.sessions}</td>
                  <td className="num">{fmtDuration(r.active_seconds)}</td>
                  <td className="num">{r.events}</td>
                  <td>{r.consent_at ? fmtDateTime(r.consent_at) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
