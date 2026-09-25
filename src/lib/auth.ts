import "server-only";
import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { findStudent, type Student } from "@/data/students";

export const SESSION_COOKIE = "mica_session";
const SECRET = process.env.AUTH_SECRET ?? "mica-portal-dev-secret-change-me";

function sign(value: string): string {
  return createHmac("sha256", SECRET).update(value).digest("hex");
}

export function createSessionToken(roll: string): string {
  return `${roll}.${sign(roll)}`;
}

export function verifySessionToken(token: string | undefined): Student | null {
  if (!token) return null;
  const [roll, sig] = token.split(".");
  if (!roll || !sig) return null;
  const expected = Buffer.from(sign(roll));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  return findStudent(roll) ?? null;
}

export async function getCurrentStudent(): Promise<Student | null> {
  const store = await cookies();
  return verifySessionToken(store.get(SESSION_COOKIE)?.value);
}

export async function requireStudent(): Promise<Student> {
  const student = await getCurrentStudent();
  if (!student) redirect("/login");
  return student;
}
