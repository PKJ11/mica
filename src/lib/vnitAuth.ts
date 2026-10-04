import "server-only";
import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { findVnitStudent, type VnitStudent } from "@/data/vnitStudents";

export const VNIT_COOKIE = "vnit_session";
const SECRET = process.env.AUTH_SECRET ?? "mica-portal-dev-secret-change-me";

function sign(value: string): string {
  return createHmac("sha256", SECRET).update(`vnit:${value}`).digest("hex");
}

export function createVnitToken(roll: string): string {
  return `${roll}.${sign(roll)}`;
}

export function verifyVnitToken(token: string | undefined): VnitStudent | null {
  if (!token) return null;
  const [roll, sig] = token.split(".");
  if (!roll || !sig) return null;
  const expected = Buffer.from(sign(roll));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  return findVnitStudent(roll) ?? null;
}

export async function getCurrentVnitStudent(): Promise<VnitStudent | null> {
  return verifyVnitToken((await cookies()).get(VNIT_COOKIE)?.value);
}

export async function requireVnitStudent(): Promise<VnitStudent> {
  const student = await getCurrentVnitStudent();
  if (!student) redirect("/vnit/login");
  return student;
}
