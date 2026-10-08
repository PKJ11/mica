import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentVnitStudent, safeNext } from "@/lib/vnitAuth";
import { VNIT_GUESTS, VNIT_STUDENTS } from "@/data/vnitStudents";
import VnitLoginForm from "./VnitLoginForm";

export const metadata = { title: "VNIT Nagpur · Sign in" };

const REASONS: Record<string, string> = {
  taken_over: "You were signed out because your account was used on another device.",
  timeout: "You were signed out after 7 minutes without activity. Your place is saved.",
  closed: "Your previous session has ended. Please sign in again.",
  admin: "Your session was ended by an administrator.",
};

export default async function VnitLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; reason?: string }>;
}) {
  const { next: rawNext, reason } = await searchParams;
  const next = safeNext(rawNext);
  if (await getCurrentVnitStudent()) redirect(next);

  const options = [...VNIT_STUDENTS, ...VNIT_GUESTS].map(({ roll, name, guest }) => ({ roll, name, guest }));
  const notice = reason ? REASONS[reason] : undefined;

  return (
    <main className="login-shell theme-vnit">
      <section className="login-brand">
        <Image src="/home/vnit.png" alt="VNIT Nagpur" width={471} height={522} className="login-logo" priority />
        <p className="kicker">VNIT Nagpur</p>
        <h1>Portal</h1>
        <p className="lede">Sign in to access your interactive learning modules and practice dashboards.</p>
        <ul className="brand-points">
          <li>Learning modules</li>
          <li>Practice dashboards</li>
          <li>Course PDFs</li>
        </ul>
      </section>
      <section className="login-card-wrap">
        <div className="login-card">
          <Link href="/home" className="back-link">
            ← Back to home
          </Link>
          {notice && (
            <p className="notice" role="status">
              {notice}
            </p>
          )}
          <h2>Student sign in</h2>
          <p className="muted">Search for your name (or roll no.) and enter your password.</p>
          <VnitLoginForm options={options} next={next} />
          <p className="hint">
            Password: first 4 letters of your first name as it appears on the college record + last 4 characters of your
            roll no. e.g. GAIKWAD ARJUN AMBADASRAO with a roll no. ending in Z786 → GAIKZ786
          </p>
        </div>
      </section>
    </main>
  );
}
