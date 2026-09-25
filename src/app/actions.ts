"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { findStudent, passwordFor } from "@/data/students";
import { SESSION_COOKIE, createSessionToken } from "@/lib/auth";

export type LoginState = { error?: string; roll?: string };

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const roll = String(formData.get("roll") ?? "").trim();
  const password = String(formData.get("password") ?? "").trim();

  if (!roll) return { error: "Please select your roll number." };
  if (!password) return { error: "Please enter your password.", roll };

  const student = findStudent(roll);
  // Letters are compared case-insensitively so "aajo2001" and "AaJo2001" both work.
  if (!student || passwordFor(student).toLowerCase() !== password.toLowerCase()) {
    return { error: "Invalid roll number or password.", roll };
  }

  const store = await cookies();
  store.set(SESSION_COOKIE, createSessionToken(student.roll), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  redirect("/dashboard");
}

export async function logout() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  redirect("/login");
}
