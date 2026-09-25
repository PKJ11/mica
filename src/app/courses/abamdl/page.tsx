import Link from "next/link";
import TopBar from "@/components/TopBar";
import { requireStudent } from "@/lib/auth";
import { ACTIVITIES, CRISP_DM_CASES } from "@/lib/activities";

export default async function AbamdlCourse() {
  const student = await requireStudent();
  const s1 = ACTIVITIES["session1-activity"];
  const zillow = ACTIVITIES["session1-zillow"];

  return (
    <>
      <TopBar student={student} />
      <main className="page">
        <nav className="crumbs">
          <Link href="/dashboard">Dashboard</Link> <span>/</span> ABAMDL
        </nav>
        <p className="kicker dark">Course · ABAMDL</p>
        <h1 className="page-title">Applied Business Analytics &amp; ML</h1>

        <section className="session">
          <div className="session-head">
            <span className="session-no">01</span>
            <div>
              <h2>Session 1</h2>
              <p className="muted">The analytics continuum</p>
            </div>
          </div>
          <div className="grid two">
            <Link href={`/activity/${zillow.slug}`} className="activity-card feature">
              <span className="tag">{zillow.tag}</span>
              <h3>{zillow.title}</h3>
              <p>{zillow.subtitle}</p>
              <span className="arrow">Read PDF →</span>
            </Link>
            <Link href={`/activity/${s1.slug}`} className="activity-card feature">
              <span className="tag">Session 1 Activity</span>
              <h3>{s1.title}</h3>
              <p>{s1.subtitle}</p>
              <span className="arrow">Start activity →</span>
            </Link>
          </div>
        </section>

        <section className="session">
          <div className="session-head">
            <span className="session-no">02</span>
            <div>
              <h2>Session 2</h2>
              <p className="muted">CRISP-DM in practice</p>
            </div>
          </div>

          <div className="banner-card">
            <div>
              <span className="tag light">Session 2 Activity</span>
              <h3>CRISP-DM Phase Mapping Activity</h3>
              <p>
                Map each real Indian business case to the six CRISP-DM phases.
              </p>
            </div>
          </div>

          <div className="grid four">
            {CRISP_DM_CASES.map((a, i) => (
              <Link key={a.slug} href={`/activity/${a.slug}`} className="activity-card">
                <div className="card-row">
                  {/* <span className="case-no">Index {i + 1}</span> */}
                  <span className="tag">{a.tag}</span>
                </div>
                <h3>{a.title}</h3>
                <p>{a.subtitle}</p>
                <span className="arrow">Open case →</span>
              </Link>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
