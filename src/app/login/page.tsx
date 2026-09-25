import Image from "next/image";
import { redirect } from "next/navigation";
import { getCurrentStudent } from "@/lib/auth";
import LoginForm from "./LoginForm";

export default async function LoginPage() {
  if (await getCurrentStudent()) redirect("/dashboard");

  return (
    <main className="login-shell">
      <section className="login-brand">
        <Image src="/mica-logo.svg" alt="MICA – The School of Ideas" width={107} height={110} className="login-logo" priority />
        <p className="kicker">Business Analytics &amp; AI · 2026–27</p>
        <h1>Learning Portal</h1>
        <p className="lede">
          Sign in to access your course sessions, in-class activities and case practice.
        </p>
        <ul className="brand-points">
          <li>Session activities</li>
          <li>CRISP-DM case mapping</li>
          <li>Hands-on practice</li>
        </ul>
      </section>
      <section className="login-card-wrap">
        <div className="login-card">
          <h2>Student sign in</h2>
          <p className="muted">Use your roll number and portal password.</p>
          <LoginForm />
          <p className="hint">
            Password: first 2 letters of your first name + first 2 letters of your last name + last 4
            digits of your roll no.
          </p>
        </div>
      </section>
    </main>
  );
}
