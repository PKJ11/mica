"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { findVnitStudent, vnitPasswordFor } from "@/data/vnitStudents";
import { VNIT_COOKIE, createVnitToken } from "@/lib/vnitAuth";

export type VnitLoginState = { error?: string; roll?: string };

export async function vnitLogin(_prev: VnitLoginState, formData: FormData): Promise<VnitLoginState> {
  const roll = String(formData.get("roll") ?? "").trim();
  const password = String(formData.get("password") ?? "").trim();

  if (!roll) return { error: "Please select your name." };
  if (!password) return { error: "Please enter your password.", roll };

  const student = findVnitStudent(roll);
  // Case-insensitive, so "gaike062" and "GAIKE062" both work.
  if (!student || vnitPasswordFor(student).toLowerCase() !== password.toLowerCase()) {
    return { error: "Invalid name or password.", roll };
  }

  const store = await cookies();
  store.set(VNIT_COOKIE, createVnitToken(student.roll), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  redirect("/vnit");
}

export async function vnitLogout() {
  const store = await cookies();
  store.delete(VNIT_COOKIE);
  redirect("/home");
}
