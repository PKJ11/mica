import "server-only";
import { createHash, randomBytes, randomUUID } from "crypto";
import { headers } from "next/headers";
import { query, queryOne } from "@/lib/db";
import { SETTINGS } from "@/lib/settings";

export const SESSION_COOKIE_VNIT = "vnit_sid";

export type EndReason = "logout" | "timeout" | "taken_over" | "closed" | "admin";

export type SessionUser = {
  id: string;
  institutionId: string;
  cohortId: string | null;
  roll: string;
  name: string;
  role: "student" | "instructor" | "admin";
  guest: boolean;
};

export type SessionInfo = {
  id: string;
  user: SessionUser;
  endedAt: Date | null;
  endReason: EndReason | null;
  deviceType: string | null;
};

export type RequestMeta = { ip: string | null; city: string | null; userAgent: string; deviceType: string; browser: string };

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function parseUserAgent(ua: string): { deviceType: string; browser: string } {
  const deviceType = /iPad|Tablet|(Android(?!.*Mobile))/i.test(ua) ? "tablet" : /Mobi|iPhone|Android/i.test(ua) ? "phone" : "laptop";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\//.test(ua)
      ? "Opera"
      : /Firefox\//.test(ua)
        ? "Firefox"
        : /Chrome\//.test(ua)
          ? "Chrome"
          : /Safari\//.test(ua)
            ? "Safari"
            : "Other";
  return { deviceType, browser };
}

export async function requestMeta(): Promise<RequestMeta> {
  const h = await headers();
  const userAgent = h.get("user-agent") ?? "";
  const city = h.get("x-vercel-ip-city");
  return {
    ip: h.get("x-forwarded-for")?.split(",")[0].trim() ?? h.get("x-real-ip"),
    // City-level only (LG-9). Vercel sets this header; locally it is absent.
    city: city ? decodeURIComponent(city) : null,
    userAgent,
    ...parseUserAgent(userAgent),
  };
}

/** Server-side events: access log and anything the server itself observes. */
export async function recordServerEvent(e: {
  type: string;
  userId?: string | null;
  sessionId?: string | null;
  institutionId?: string | null;
  cohortId?: string | null;
  deviceType?: string | null;
  page?: string | null;
  details?: Record<string, unknown>;
}) {
  await query(
    `INSERT INTO events (id, user_id, session_id, institution_id, cohort_id, type, client_ts, page, device_type, details)
     VALUES ($1, $2, $3, $4, $5, $6, now(), $7, $8, $9)`,
    [
      randomUUID(),
      e.userId ?? null,
      e.sessionId ?? null,
      e.institutionId ?? null,
      e.cohortId ?? null,
      e.type,
      e.page ?? null,
      e.deviceType ?? null,
      e.details ? JSON.stringify(e.details) : null,
    ],
  );
}

/**
 * Starts a session and ends any older open session of the same user (LG-5: one active session).
 * Returns the raw cookie token.
 */
export async function startSession(user: SessionUser, meta: RequestMeta): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const id = randomUUID();

  // Older sessions end at their last input, so idle time is never counted (LG-8).
  const taken = await query<{ id: string; device_type: string | null }>(
    `UPDATE sessions SET ended_at = last_input_at, end_reason = 'taken_over'
     WHERE user_id = $1 AND ended_at IS NULL RETURNING id, device_type`,
    [user.id],
  );

  await query(
    `INSERT INTO sessions (id, token_hash, user_id, device_type, browser, user_agent, ip, city)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [id, hashToken(token), user.id, meta.deviceType, meta.browser, meta.userAgent, meta.ip, meta.city],
  );

  const base = { userId: user.id, institutionId: user.institutionId, cohortId: user.cohortId };
  for (const old of taken) {
    await recordServerEvent({
      ...base,
      type: "session_taken_over",
      sessionId: old.id,
      deviceType: old.device_type,
      details: { new_session: id, new_device: meta.deviceType, browser: meta.browser, city: meta.city },
    });
  }
  await recordServerEvent({
    ...base,
    type: "login_success",
    sessionId: id,
    deviceType: meta.deviceType,
    details: { method: "password", browser: meta.browser, city: meta.city, took_over: taken.length },
  });
  return token;
}

type SessionRow = {
  id: string;
  ended_at: Date | null;
  end_reason: EndReason | null;
  last_input_at: Date;
  last_seen_at: Date;
  device_type: string | null;
  user_id: string;
  institution_id: string;
  cohort_id: string | null;
  roll: string;
  name: string;
  role: SessionUser["role"];
  guest: boolean;
  status: string;
};

/**
 * Looks up a session by cookie token. A session left idle past the logout limit is ended here,
 * at its last input, even if no browser was open to send the timeout.
 */
export async function getSession(token: string | undefined): Promise<SessionInfo | null> {
  if (!token) return null;
  const row = await queryOne<SessionRow>(
    `SELECT s.id, s.ended_at, s.end_reason, s.last_input_at, s.last_seen_at, s.device_type,
            u.id AS user_id, u.institution_id, u.roll, u.name, u.role, u.guest, u.status,
            (SELECT cohort_id FROM enrolments e WHERE e.user_id = u.id ORDER BY cohort_id LIMIT 1) AS cohort_id
     FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = $1`,
    [hashToken(token)],
  );
  if (!row) return null;

  const user: SessionUser = {
    id: row.user_id,
    institutionId: row.institution_id,
    cohortId: row.cohort_id,
    roll: row.roll,
    name: row.name,
    role: row.role,
    guest: row.guest,
  };
  let { ended_at: endedAt, end_reason: endReason } = row;

  if (!endedAt && row.status !== "active") {
    await endSession(row.id, "admin");
    endedAt = new Date();
    endReason = "admin";
  } else if (!endedAt && Date.now() - new Date(row.last_input_at).getTime() > SETTINGS.idleLogoutMs + SETTINGS.serverGraceMs) {
    // Tabs still open at the 7-minute mark: a timeout. Otherwise the last tab was closed first.
    const seenAfterInput = new Date(row.last_seen_at).getTime() - new Date(row.last_input_at).getTime();
    endReason = seenAfterInput >= SETTINGS.idleLogoutMs ? "timeout" : "closed";
    await endSession(row.id, endReason, { atLastInput: true });
    await recordServerEvent({
      type: endReason === "timeout" ? "session_timeout" : "session_closed",
      userId: user.id,
      sessionId: row.id,
      institutionId: user.institutionId,
      cohortId: user.cohortId,
      deviceType: row.device_type,
      details: { detected: "server" },
    });
    endedAt = new Date(row.last_input_at);
  }

  return { id: row.id, user, endedAt, endReason, deviceType: row.device_type };
}

export async function endSession(sessionId: string, reason: EndReason, opts: { atLastInput?: boolean } = {}) {
  await query(
    `UPDATE sessions SET ended_at = ${opts.atLastInput ? "last_input_at" : "now()"}, end_reason = $2
     WHERE id = $1 AND ended_at IS NULL`,
    [sessionId, reason],
  );
}

/** Ends the session behind a cookie token. Returns the session it ended, if it was open. */
export async function endSessionByToken(token: string | undefined, reason: EndReason, atLastInput = false) {
  if (!token) return null;
  return queryOne<{ id: string; user_id: string; device_type: string | null }>(
    `UPDATE sessions SET ended_at = ${atLastInput ? "last_input_at" : "now()"}, end_reason = $2
     WHERE token_hash = $1 AND ended_at IS NULL RETURNING id, user_id, device_type`,
    [hashToken(token), reason],
  );
}
