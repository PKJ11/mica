import { query } from "@/lib/db";
import { ACTIVITIES } from "@/lib/activities";
import { getVnitSession } from "@/lib/vnitAuth";

/** Saves a module's state for the signed-in student (LG-10). Values are the strings the module stored. */
export async function POST(req: Request) {
  const text = await req.text();
  if (text.length > 260_000) return Response.json({ error: "too large" }, { status: 413 });
  let body: { sessionId?: unknown; module?: unknown; data?: unknown };
  try {
    body = JSON.parse(text);
  } catch {
    return Response.json({ error: "bad json" }, { status: 400 });
  }

  const s = await getVnitSession();
  if (!s || s.endedAt || body.sessionId !== s.id) return Response.json({ error: "no session" }, { status: 401 });

  const module = typeof body.module === "string" ? body.module : "";
  if (!ACTIVITIES[module]) return Response.json({ error: "unknown module" }, { status: 400 });
  const data = body.data;
  if (!data || typeof data !== "object" || Array.isArray(data)) return Response.json({ error: "bad data" }, { status: 400 });
  const clean: Record<string, string> = {};
  for (const [k, v] of Object.entries(data)) if (typeof v === "string" && k.length <= 200) clean[k] = v;

  await query(
    `INSERT INTO progress (user_id, module, data, updated_at) VALUES ($1, $2, $3, now())
     ON CONFLICT (user_id, module) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`,
    [s.user.id, module, JSON.stringify(clean)],
  );
  return Response.json({ ok: true });
}
