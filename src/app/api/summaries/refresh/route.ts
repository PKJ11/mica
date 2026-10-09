import { refreshSummaries, verifySummaries } from "@/lib/summaries";

/**
 * For a scheduled job (e.g. a Vercel cron on a plan that allows one every 15 minutes, or any external
 * scheduler). Needs CRON_SECRET; Vercel cron sends it as "Authorization: Bearer <secret>".
 * ?full=1 rebuilds every summary from all events; ?verify=1 compares the summaries with a full rebuild without
 * changing anything; otherwise it refreshes the summaries now.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const params = new URL(req.url).searchParams;
  if (params.has("verify")) return Response.json(await verifySummaries());
  const result = await refreshSummaries({ full: params.has("full"), wait: true });
  return Response.json(result);
}
