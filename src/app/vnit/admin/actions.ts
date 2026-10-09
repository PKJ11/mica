"use server";

import { randomUUID } from "crypto";
import { redirect } from "next/navigation";
import { query } from "@/lib/db";
import { refreshSummaries } from "@/lib/summaries";
import { requireVnitStaff, safeNext } from "@/lib/vnitAuth";

export async function refreshNow(formData: FormData) {
  const back = safeNext(String(formData.get("back") ?? ""), "/vnit/admin");
  const { user } = await requireVnitStaff(back);
  const result = await refreshSummaries({ wait: true });
  await query(`INSERT INTO audit_log (id, actor_id, action, details) VALUES ($1, $2, 'refresh_summaries', $3)`, [
    randomUUID(),
    user.id,
    JSON.stringify(result),
  ]);
  redirect(back);
}
