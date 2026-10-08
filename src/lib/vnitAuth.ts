import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { queryOne } from "@/lib/db";
import { NOTICE_VERSION } from "@/lib/settings";
import { SESSION_COOKIE_VNIT, getSession, type SessionInfo, type SessionUser } from "@/lib/session";

export const VNIT_COOKIE = SESSION_COOKIE_VNIT;

export async function getVnitSession(): Promise<SessionInfo | null> {
  return getSession((await cookies()).get(VNIT_COOKIE)?.value);
}

/** The signed-in VNIT user, or null if there is no open session. */
export async function getCurrentVnitStudent(): Promise<SessionUser | null> {
  const s = await getVnitSession();
  return s && !s.endedAt ? s.user : null;
}

export async function hasConsented(userId: string): Promise<boolean> {
  return Boolean(
    await queryOne(`SELECT 1 FROM consents WHERE user_id = $1 AND notice_version = $2 LIMIT 1`, [userId, NOTICE_VERSION]),
  );
}

/** Only same-site paths, so ?next= cannot send people to another site. */
export function safeNext(next: string | null | undefined, fallback = "/vnit"): string {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : fallback;
}

export function loginUrl(next?: string, reason?: string | null): string {
  const p = new URLSearchParams();
  if (next && next !== "/vnit") p.set("next", next);
  if (reason) p.set("reason", reason);
  const qs = p.toString();
  return `/vnit/login${qs ? `?${qs}` : ""}`;
}

/**
 * Every VNIT page calls this (LG-1). No session → sign in, then back to `next`.
 * A session ended elsewhere (takeover, timeout) → sign in with the reason shown.
 * No agreement to the current notice → the consent step (LG-11).
 */
export async function requireVnitSession(next = "/vnit", opts: { skipConsent?: boolean } = {}): Promise<SessionInfo> {
  const s = await getVnitSession();
  if (!s) redirect(loginUrl(next));
  if (s.endedAt) redirect(loginUrl(next, s.endReason));
  if (!opts.skipConsent && !(await hasConsented(s.user.id))) {
    redirect(`/vnit/consent?next=${encodeURIComponent(next)}`);
  }
  return s;
}

export async function requireVnitStudent(next = "/vnit"): Promise<SessionUser> {
  return (await requireVnitSession(next)).user;
}

export async function requireVnitStaff(next = "/vnit/admin"): Promise<SessionInfo> {
  const s = await requireVnitSession(next);
  if (s.user.role === "student") redirect("/vnit");
  return s;
}
