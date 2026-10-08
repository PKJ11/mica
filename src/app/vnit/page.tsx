import Image from "next/image";
import Link from "next/link";
import { VNIT_MODULES, type Activity } from "@/lib/activities";
import TrackerBoot from "@/components/TrackerBoot";
import { SETTINGS } from "@/lib/settings";
import { requireVnitSession } from "@/lib/vnitAuth";
import { vnitLogout } from "./actions";

export const metadata = { title: "VNIT Nagpur · Course materials" };

function cta(a: Activity) {
  if (a.file.toLowerCase().endsWith(".pdf")) return "Read PDF →";
  return a.tag === "Dashboard" ? "Open dashboard →" : "Start module →";
}

// VNIT students sign in with their enrollment number (see /vnit/login).
export default async function VnitPage() {
  const session = await requireVnitSession("/vnit");
  const student = session.user;

  return (
    <div className="theme-vnit">
      <TrackerBoot config={{ sessionId: session.id, loginUrl: "/vnit/login", settings: SETTINGS, title: "Course materials" }} />
      <header className="topbar">
        <div className="topbar-inner">
          <Link href="/home" className="topbar-brand">
            <Image src="/home/vnit.png" alt="VNIT Nagpur" width={471} height={522} className="topbar-logo" priority />
            <span className="topbar-divider" aria-hidden="true" />
            <span>VNIT Nagpur</span>
          </Link>
          <div className="topbar-user">
            <span className="user-meta">
              <strong>{student.name}</strong>
              {!student.guest && <span className="mono">{student.roll}</span>}
            </span>
            {student.role !== "student" && (
              <Link href="/vnit/admin" className="btn-ghost">
                Activity
              </Link>
            )}
            <form action={vnitLogout}>
              <button className="btn-ghost" type="submit">
                Log out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="page">
        <nav className="crumbs">
          <Link href="/home">Home</Link> <span>/</span> VNIT Nagpur
        </nav>
        <p className="kicker dark">VNIT Nagpur</p>
        <h1 className="page-title">Course materials</h1>
        <p className="muted">Interactive learning modules and practice dashboards.</p>

        <div className="grid two">
          {VNIT_MODULES.map((a) => (
            <Link key={a.slug} href={`/activity/${a.slug}`} className="activity-card feature">
              <span className="tag">{a.tag}</span>
              <h3>{a.title}</h3>
              <p>{a.subtitle}</p>
              <span className="arrow">{cta(a)}</span>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
