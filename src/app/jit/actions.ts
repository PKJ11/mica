"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { JIT_COOKIE, JIT_ID, JIT_PASSWORD, createJitToken } from "@/lib/jitAuth";

export type JitLoginState = { error?: string; id?: string };

export async function jitLogin(_prev: JitLoginState, formData: FormData): Promise<JitLoginState> {
  const id = String(formData.get("id") ?? "").trim();
  const password = String(formData.get("password") ?? "").trim();

  if (!id) return { error: "Please enter your JIT ID." };
  if (!password) return { error: "Please enter your password.", id };

  // The ID is matched case-insensitively; the password must match exactly.
  if (id.toUpperCase() !== JIT_ID || password !== JIT_PASSWORD) {
    return { error: "Invalid JIT ID or password.", id };
  }

  const store = await cookies();
  store.set(JIT_COOKIE, createJitToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  redirect("/jit");
}

export async function jitLogout() {
  const store = await cookies();
  store.delete(JIT_COOKIE);
  redirect("/home");
}
