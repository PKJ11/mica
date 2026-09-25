import Link from "next/link";
import TopBar from "@/components/TopBar";
import { requireStudent } from "@/lib/auth";

export default async function Dashboard() {
  const student = await requireStudent();
  const greeting = student.roll === "others" ? "Welcome" : `Welcome, ${student.name.split(/\s+/)[0]}`;

  return (
    <>
      <TopBar student={student} />
      <main className="page">
        <p className="kicker dark">Dashboard</p>
        <h1 className="page-title">{greeting}</h1>
        <p className="muted">Pick a course to continue.</p>

        <div className="grid two">
          <Link href="/courses/abamdl" className="course-card">
            <div className="course-top">
              <span className="course-code">ABAMDL</span>
              <span className="pill">Active</span>
            </div>
            <h2>Applied Business Analytics &amp; ML</h2>
            <p>Session activities, the analytics continuum and CRISP-DM phase mapping cases.</p>
            <div className="course-foot">
              <span>2 sessions · 6 activities</span>
              <span className="arrow">Open →</span>
            </div>
          </Link>

          <div className="course-card disabled" aria-disabled="true">
            <div className="course-top">
              <span className="course-code">GENAILLM</span>
              <span className="pill soon">Coming soon</span>
            </div>
            <h2>Generative AI &amp; LLMs</h2>
            <p>Content for this course will be published here soon. Stay tuned!</p>
            <div className="course-foot">
              <span>Not yet available</span>
              <span className="arrow">Coming soon</span>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
