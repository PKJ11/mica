import "server-only";
import { randomUUID } from "crypto";
import { query } from "@/lib/db";
import { loadFilters } from "@/lib/analytics/filters";
import { refreshIfStale } from "@/lib/summaries";
import { requireVnitStaff } from "@/lib/vnitAuth";

export type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** Every staff page: staff only, the remembered cohort and period, and figures no older than 15 minutes. */
export async function staffPage(path: string, searchParams: SearchParams) {
  const session = await requireVnitStaff(path);
  const sp = await searchParams;
  const filters = await loadFilters(session.user, sp);
  await refreshIfStale();
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k]![0] : (sp[k] as string | undefined));
  return { session, user: session.user, filters, param: one };
}

/** Staff views of student data are logged (LG-13, AD-6). */
export async function audit(actorId: string, action: string, target: string | null, details?: Record<string, unknown>) {
  await query(`INSERT INTO audit_log (id, actor_id, action, target, details) VALUES ($1, $2, $3, $4, $5)`, [
    randomUUID(),
    actorId,
    action,
    target,
    details ? JSON.stringify(details) : null,
  ]);
}
