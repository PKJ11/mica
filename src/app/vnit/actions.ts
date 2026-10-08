"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { randomUUID } from "crypto";
import { findVnitStudent, vnitPasswordFor } from "@/data/vnitStudents";
import { query } from "@/lib/db";
import { vnitUserId } from "@/lib/db/seed";
import { NOTICE_VERSION } from "@/lib/settings";
import { endSessionByToken, recordServerEvent, requestMeta, startSession, type SessionUser } from "@/lib/session";
import { VNIT_COOKIE, getVnitSession, safeNext } from "@/lib/vnitAuth";

export type VnitLoginState = { error?: string; roll?: string };

async function loadUser(roll: string): Promise<SessionUser | null> {
  const rows = await query<{
    id: string;
    institution_id: string;
    roll: string;
    name: string;
    role: SessionUser["role"];
    guest: boolean;
    status: string;
    cohort_id: string | null;
  }>(
    `SELECT u.id, u.institution_id, u.roll, u.name, u.role, u.guest, u.status,
            (SELECT cohort_id FROM enrolments e WHERE e.user_id = u.id ORDER BY cohort_id LIMIT 1) AS cohort_id
     FROM users u WHERE u.id = $1`,
    [vnitUserId(roll)],
  );
  const u = rows[0];
  if (!u || u.status !== "active") return null;
  return {
    id: u.id,
    institutionId: u.institution_id,
    cohortId: u.cohort_id,
    roll: u.roll,
    name: u.name,
    role: u.role,
    guest: u.guest,
  };
}

export async function vnitLogin(_prev: VnitLoginState, formData: FormData): Promise<VnitLoginState> {
  const roll = String(formData.get("roll") ?? "").trim();
  const password = String(formData.get("password") ?? "").trim();
  const next = safeNext(String(formData.get("next") ?? ""));

  if (!roll) return { error: "Please select your name." };
  if (!password) return { error: "Please enter your password.", roll };

  const meta = await requestMeta();
  const student = findVnitStudent(roll);
  // Case-insensitive, so "gaike062" and "GAIKE062" both work.
  const ok = student && vnitPasswordFor(student).toLowerCase() === password.toLowerCase();
  const user = ok ? await loadUser(student.roll) : null;

  if (!user) {
    await recordServerEvent({
      type: "login_failed",
      userId: student ? vnitUserId(student.roll) : null,
      institutionId: "vnit",
      deviceType: meta.deviceType,
      details: { method: "password", reason: student ? "wrong_password" : "unknown_user", browser: meta.browser, city: meta.city },
    });
    return { error: "Invalid name or password.", roll };
  }

  const token = await startSession(user, meta);
  const store = await cookies();
  store.set(VNIT_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  redirect(next);
}

export async function vnitLogout() {
  const store = await cookies();
  const ended = await endSessionByToken(store.get(VNIT_COOKIE)?.value, "logout");
  if (ended) {
    await recordServerEvent({ type: "logout", userId: ended.user_id, sessionId: ended.id, deviceType: ended.device_type });
  }
  store.delete(VNIT_COOKIE);
  redirect("/home");
}

export async function vnitAgree(formData: FormData) {
  const next = safeNext(String(formData.get("next") ?? ""));
  if (formData.get("agree") !== "on") redirect(`/vnit/consent?next=${encodeURIComponent(next)}&missing=1`);

  const s = await getVnitSession();
  if (!s || s.endedAt) redirect("/vnit/login");
  const meta = await requestMeta();
  await query(`INSERT INTO consents (id, user_id, notice_version, ip, user_agent) VALUES ($1, $2, $3, $4, $5)`, [
    randomUUID(),
    s.user.id,
    NOTICE_VERSION,
    meta.ip,
    meta.userAgent,
  ]);
  await recordServerEvent({
    type: "consent_given",
    userId: s.user.id,
    sessionId: s.id,
    institutionId: s.user.institutionId,
    cohortId: s.user.cohortId,
    deviceType: meta.deviceType,
    details: { notice_version: NOTICE_VERSION },
  });
  redirect(next);
}
