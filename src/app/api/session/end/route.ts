import { cookies } from "next/headers";
import { query } from "@/lib/db";
import { SETTINGS } from "@/lib/settings";
import { endSession, recordServerEvent } from "@/lib/session";
import { VNIT_COOKIE, getVnitSession } from "@/lib/vnitAuth";

/** Called by the tracker at the inactivity limit. The session ends at the last input, not now (LG-8). */
export async function POST(req: Request) {
  let body: { sessionId?: unknown; reason?: unknown; inputAgoMs?: unknown } = {};
  try {
    body = await req.json();
  } catch {}

  const s = await getVnitSession();
  if (s && !s.endedAt && body.sessionId === s.id && body.reason === "timeout") {
    const inputAgoMs = Math.max(0, Math.min(Number(body.inputAgoMs) || 0, SETTINGS.idleLogoutMs * 2));
    await query(
      `UPDATE sessions SET last_input_at = GREATEST(last_input_at, now() - ($2::int * interval '1 millisecond')), last_seen_at = now()
       WHERE id = $1`,
      [s.id, Math.round(inputAgoMs)],
    );
    await endSession(s.id, "timeout", { atLastInput: true });
    await recordServerEvent({
      type: "logout",
      userId: s.user.id,
      sessionId: s.id,
      institutionId: s.user.institutionId,
      cohortId: s.user.cohortId,
      deviceType: s.deviceType,
      details: { reason: "timeout" },
    });
  }
  (await cookies()).delete(VNIT_COOKIE);
  return Response.json({ ok: true });
}
