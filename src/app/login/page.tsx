import Image from "next/image";
import { redirect } from "next/navigation";
import { getCurrentStudent } from "@/lib/auth";
import { OTHERS, STUDENTS } from "@/data/students";
import LoginForm from "./LoginForm";

export default async function LoginPage() {
  if (await getCurrentStudent()) redirect("/dashboard");

  const options = [...STUDENTS, OTHERS].map(({ roll, name }) => ({ roll, name }));

  return (
    <main className="login-shell">
      <section className="login-brand">
        <Image src="/mica-logo.svg" alt="MICA – The School of Ideas" width={107} height={110} className="login-logo" priority />
        <p className="kicker">Business Analytics &amp; AI · 2026–27</p>
        <h1>Portal</h1>
        <p className="lede">
          Sign in to access your course sessions, in-class activities and case practice.
        </p>
        <ul className="brand-points">
          <li>Session activities</li>
          <li>Concept Notes</li>
          <li>Hands-on practice</li>
        </ul>
      </section>
      <section className="login-card-wrap">
        <div className="login-card">
          <h2>Student sign in</h2>
          <p className="muted">Select your roll number and enter your portal password.</p>
          <LoginForm options={options} />
          <p className="hint">
            Password: first 2 letters of your first name + first 2 letters of your last name + last 4
            digits of your roll no.
          </p>
        </div>
      </section>
    </main>
  );
}
