import "server-only";
import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

// JIT uses one shared login for the whole class.
export const JIT_COOKIE = "jit_session";
export const JIT_ID = "JIT_IDS_STUDENTS";
export const JIT_PASSWORD = "KartikVyas@JIT";
const SECRET = process.env.AUTH_SECRET ?? "mica-portal-dev-secret-change-me";

function sign(value: string): string {
  return createHmac("sha256", SECRET).update(`jit:${value}`).digest("hex");
}

export function createJitToken(): string {
  return `${JIT_ID}.${sign(JIT_ID)}`;
}

export async function hasJitSession(): Promise<boolean> {
  const token = (await cookies()).get(JIT_COOKIE)?.value;
  if (!token) return false;
  const [id, sig] = token.split(".");
  if (id !== JIT_ID || !sig) return false;
  const expected = Buffer.from(sign(id));
  const given = Buffer.from(sig);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export async function requireJit(): Promise<void> {
  if (!(await hasJitSession())) redirect("/jit/login");
}
