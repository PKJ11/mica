import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentVnitStudent } from "@/lib/vnitAuth";
import { VNIT_GUESTS, VNIT_STUDENTS } from "@/data/vnitStudents";
import VnitLoginForm from "./VnitLoginForm";

export const metadata = { title: "VNIT Nagpur · Sign in" };

export default async function VnitLoginPage() {
  if (await getCurrentVnitStudent()) redirect("/vnit");

  const options = [...VNIT_STUDENTS, ...VNIT_GUESTS].map(({ roll, name, guest }) => ({ roll, name, guest }));

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
          <h2>Student sign in</h2>
          <p className="muted">Select your enrollment number and enter your password.</p>
          <VnitLoginForm options={options} />
          <p className="hint">
            Password: first 4 letters of your first name as it appears on the college record + last 4 characters of your
            roll no. e.g. GAIKWAD ARJUN AMBADASRAO with a roll no. ending in Z786 → GAIKZ786
          </p>
        </div>
      </section>
    </main>
  );
}
