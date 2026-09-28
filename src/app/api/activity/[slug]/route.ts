import { readFile } from "fs/promises";
import path from "path";
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { ACTIVITIES } from "@/lib/activities";

// Activity HTML lives outside /public so only signed-in students can load it.
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const store = await cookies();
  if (!verifySessionToken(store.get(SESSION_COOKIE)?.value)) {
    return new Response("Unauthorized — please sign in.", { status: 401 });
  }

  const { slug } = await params;
  const activity = ACTIVITIES[slug];
  if (!activity || activity.hidden) return new Response("Not found", { status: 404 });

  const data = await readFile(path.join(process.cwd(), "content", activity.file));
  const isPdf = activity.file.toLowerCase().endsWith(".pdf");
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
