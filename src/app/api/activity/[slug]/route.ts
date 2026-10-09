import { createHash } from "crypto";
import { readFile } from "fs/promises";
import path from "path";
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { queryOne } from "@/lib/db";
import { SETTINGS } from "@/lib/settings";
import { getVnitSession, hasConsented, loginUrl } from "@/lib/vnitAuth";
import { ACTIVITIES, isVnitActivity, type Activity } from "@/lib/activities";

const versions = new Map<string, string>();

/** Adds the shared tracker to the top of <head>, before the content's own scripts run (EV-1). */
function injectTracker(html: string, cfg: Record<string, unknown>): string {
  // JSON inside <script>: escape "<" so "</script>" in data cannot end the tag.
  const json = JSON.stringify(cfg).replace(/</g, "\\u003c");
  const tags = `<script>window.__TRK_CFG=${json};</script><script src="/tracker.js?v=2"></script>`;
  const m = html.match(/<head[^>]*>/i);
  if (m && m.index !== undefined) {
    const at = m.index + m[0].length;
    return html.slice(0, at) + tags + html.slice(at);
  }
  return tags + html;
}

async function vnitTrackerConfig(activity: Activity, data: Buffer, userId: string, sessionId: string) {
  let cv = versions.get(activity.file);
  if (!cv) {
    cv = createHash("sha1").update(data).digest("hex").slice(0, 10);
    versions.set(activity.file, cv);
  }
  const progress = await queryOne<{ data: Record<string, string> }>(
    `SELECT data FROM progress WHERE user_id = $1 AND module = $2`,
    [userId, activity.slug],
  );
  return {
    kind: "content",
    endpoint: "/api/events",
    progressEndpoint: "/api/progress",
    endEndpoint: "/api/session/end",
    loginUrl: "/vnit/login",
    sessionId,
    module: activity.slug,
    title: activity.title,
    defaultChapter: activity.defaultChapter ?? null,
    contentVersion: cv,
    settings: SETTINGS,
    storage: progress?.data ?? {},
  };
}

// Activity HTML lives outside /public so only signed-in students can load it (VNIT uses its own login).
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const activity = ACTIVITIES[slug];
  if (!activity || activity.hidden) return new Response("Not found", { status: 404 });

  let vnit: { userId: string; sessionId: string } | null = null;
  if (isVnitActivity(activity)) {
    // A direct link without a session goes to sign in and comes back to the activity (LG-1).
    const s = await getVnitSession();
    const back = `/activity/${slug}`;
    if (!s || s.endedAt) return Response.redirect(new URL(loginUrl(back, s?.endReason), req.url), 303);
    if (!(await hasConsented(s.user.id))) {
      return Response.redirect(new URL(`/vnit/consent?next=${encodeURIComponent(back)}`, req.url), 303);
    }
    vnit = { userId: s.user.id, sessionId: s.id };
  } else {
    const store = await cookies();
    if (!verifySessionToken(store.get(SESSION_COOKIE)?.value)) {
      return new Response("Unauthorized — please sign in.", { status: 401 });
    }
  }

  const data = await readFile(path.join(process.cwd(), "content", activity.file));
  const isPdf = activity.file.toLowerCase().endsWith(".pdf");
  if (!isPdf && vnit) {
    const cfg = await vnitTrackerConfig(activity, data, vnit.userId, vnit.sessionId);
    return new Response(injectTracker(data.toString("utf8"), cfg), {
      headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-store" },
    });
  }

  // ?download=1 saves the file instead of opening it.
  const disposition = new URL(req.url).searchParams.has("download") ? "attachment" : "inline";
  const name = path.basename(activity.file);
  const asciiName = name.replace(/[^\x20-\x7e]|"/g, "_");
  return new Response(data, {
    headers: {
      "Content-Type": isPdf ? "application/pdf" : "text/html; charset=utf-8",
      ...(isPdf && {
        "Content-Disposition": `${disposition}; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(name)}`,
      }),
      "Cache-Control": "private, no-store",
    },
  });
}
