import Link from "next/link";
import TopBar from "@/components/TopBar";
import { requireStudent } from "@/lib/auth";
import {
  GENAI_SESSION_1,
  GENAI_SESSION_2,
  GENAI_SESSION_3,
  GENAI_SESSION_4,
  GENAI_SESSION_5,
  GENAI_SESSION_6,
  type Activity,
} from "@/lib/activities";

const SESSIONS: { no: string; title: string; blurb: string; items: Activity[] }[] = [
  { no: "01", title: "Session 1", blurb: "Gen AI & LLMs for Marketing", items: GENAI_SESSION_1 },
  { no: "02", title: "Session 2", blurb: "Anatomy of Applications & Workflow Design", items: GENAI_SESSION_2 },
  { no: "03", title: "Session 3", blurb: "From Manual Process to Conceptual Architecture", items: GENAI_SESSION_3 },
  { no: "04", title: "Session 4", blurb: "The First Build", items: GENAI_SESSION_4 },
  { no: "05", title: "Session 5", blurb: "Agentic AI", items: GENAI_SESSION_5 },
  { no: "06", title: "Session 6", blurb: "Building & Testing Skills", items: GENAI_SESSION_6 },
];

const LOCKED_SESSIONS: number[] = [];

function cta(a: Activity) {
  if (a.file.toLowerCase().endsWith(".pdf")) return "Read PDF →";
  return a.tag.includes("Deck") ? "Open slides →" : "Start activity →";
}

export default async function GenaillmCourse() {
  const student = await requireStudent();

  return (
    <>
      <TopBar student={student} />
      <main className="page">
        <nav className="crumbs">
          <Link href="/dashboard">Dashboard</Link> <span>/</span> GENAILLM
        </nav>
        <p className="kicker dark">Course · GENAILLM</p>
        <h1 className="page-title">Generative AI &amp; LLMs</h1>

        {SESSIONS.map((sec) => (
          <section className="session" key={sec.no}>
            <div className="session-head">
              <span className="session-no">{sec.no}</span>
              <div>
                <h2>{sec.title}</h2>
                <p className="muted">{sec.blurb}</p>
              </div>
            </div>
            <div className="grid two">
              {sec.items.map((a) => (
                <Link key={a.slug} href={`/activity/${a.slug}`} className="activity-card feature">
                  <span className="tag">{a.tag}</span>
                  <h3>{a.title}</h3>
                  <p>{a.subtitle}</p>
                  <span className="arrow">{cta(a)}</span>
                </Link>
              ))}
            </div>
          </section>
        ))}

        {LOCKED_SESSIONS.map((n) => (
          <section className="session locked" key={n}>
            <div className="session-head">
              <span className="session-no">{String(n).padStart(2, "0")}</span>
              <div>
                <h2>Session {n}</h2>
              </div>
            </div>
            <div className="grid two">
              <div className="activity-card locked-card" aria-disabled="true">
                <span className="pill soon">Coming soon</span>
                <h3>Session {n} materials</h3>
                <p>This session isn’t open yet. It will appear here once it’s released.</p>
                <span className="arrow">Locked</span>
              </div>
            </div>
          </section>
        ))}
      </main>
    </>
  );
}
