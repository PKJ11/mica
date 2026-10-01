import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { hasJitSession } from "@/lib/jitAuth";
import JitLoginForm from "./JitLoginForm";

export const metadata = { title: "JIT · Sign in" };

export default async function JitLoginPage() {
  if (await hasJitSession()) redirect("/jit");

  return (
    <main className="login-shell theme-jit">
      <section className="login-brand">
        <Image src="/home/jit.png" alt="JIT" width={176} height={148} className="login-logo" priority />
        <p className="kicker">JIT · Python &amp; Data Science</p>
        <h1>Portal</h1>
        <p className="lede">Sign in to access your Python labs and real-world data science problems.</p>
        <ul className="brand-points">
          <li>Guided practice</li>
          <li>Case problems</li>
          <li>Hands-on labs</li>
        </ul>
      </section>
      <section className="login-card-wrap">
        <div className="login-card">
          <Link href="/home" className="back-link">
            ← Back to home
          </Link>
          <h2>Student sign in</h2>
          <p className="muted">Enter the JIT ID and password shared with you in class.</p>
          <JitLoginForm />
        </div>
      </section>
    </main>
  );
}
