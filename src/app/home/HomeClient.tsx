"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

type Mode = "Dark" | "Light";
type Institution = { id: "vnit" | "mica" | "jit"; name: string; logo: string; w: number; h: number };

const MODE_KEY = "kv-home-mode";
const EMAIL = "kartikgvyas@outlook.com";

const INSTITUTIONS: Institution[] = [
  { id: "vnit", name: "VNIT Nagpur", logo: "/home/vnit.png", w: 471, h: 522 },
  { id: "mica", name: "MICA", logo: "/home/mica.png", w: 185, h: 148 },
  { id: "jit", name: "JIT", logo: "/home/jit.png", w: 176, h: 148 },
];

const ORGS = ["HSBC", "Persistent Systems", "Reckitt Benckiser", "Maersk", "Accelerite", "InfoCepts", "Konverge.AI", "Foldax", "STS Tech LLC", "Swasen", "Logicology"];

const STATS = [
  { value: "1,000+", label: "Students taught" },
  { value: "12+ years", label: "In the classroom" },
  { value: "20+ years", label: "In data & analytics" },
  { value: "Since 2014", label: "Teaching at VNIT Nagpur" },
];

const PROJECT_AREAS = ["Analytics & Business Intelligence", "Data Science, Machine Learning & AI", "Strategic & Digital Marketing"];
const TOPICS = ["Marketing", "Consulting", "AI", "Data Science", "Machine Learning", "Prompt Engineering", "Business Intelligence", "Analytics"];
const COMMUNITY = [
  { title: "A network of peers", text: "Connect with students I have taught over the years." },
  { title: "Learnings & readings", text: "I share what I am learning and reading from time to time." },
  { title: "No promotions", text: "No promotional offers. The goal is simply to stay in touch." },
];

export default function HomeClient({ fontClass }: { fontClass: string }) {
  const [mode, setMode] = useState<Mode>("Dark");
  const [notice, setNotice] = useState<Institution | null>(null);
  const [formMsg, setFormMsg] = useState<string | null>(null);
  const nextMode: Mode = mode === "Dark" ? "Light" : "Dark";

  useEffect(() => {
    try {
      const saved = localStorage.getItem(MODE_KEY);
      if (saved === "Dark" || saved === "Light") setMode(saved);
    } catch {}
  }, []);

  useEffect(() => {
    if (!notice) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setNotice(null);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [notice]);

  function toggleMode() {
    setMode(nextMode);
    try {
      localStorage.setItem(MODE_KEY, nextMode);
    } catch {}
  }

  // No backend for applications: open a pre-filled email instead.
  function submitApplication(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const get = (k: string) => String(f.get(k) ?? "").trim();
    const body = [
      `Full name: ${get("name")}`,
      `Email: ${get("email")}`,
      `Institution: ${get("inst")}`,
      `Programme & year: ${get("prog")}`,
      `Area of interest: ${get("area")}`,
      `LinkedIn: ${get("linkedin")}`,
      "",
      "What I would like to work on:",
      get("note"),
      "",
      "(Résumé attached)",
    ].join("\n");
    const url = `mailto:${EMAIL}?subject=${encodeURIComponent(`Live project application — ${get("name")}`)}&body=${encodeURIComponent(body)}`;
    window.location.href = url;
    setFormMsg("Your email app should now open with your details filled in. Please attach your résumé there and send it.");
  }

  return (
    <div className={`kv ${fontClass}`} data-mode={mode}>
      <header className="kv-header kv-wrap">
        <div className="kv-id">
          <div className="kv-name">Kartik Girish Vyas</div>
          <div className="kv-creds">B.E. VNIT · MBA IIM Mumbai (erstwhile NITIE)</div>
        </div>
        <div className="kv-header-right">
          <div className="kv-tagline">Business Analytics · Data · AI</div>
          <button className="kv-mode" type="button" onClick={toggleMode} aria-label={`Switch to ${nextMode} mode`}>
            {mode === "Dark" ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
              </svg>
            )}
            <span>{nextMode} mode</span>
          </button>
        </div>
      </header>

      <main className="kv-main">
        <section className="kv-stats kv-wrap o-stats">
          {STATS.map((s) => (
            <div key={s.label} className="kv-stat">
              <div className="kv-stat-value">{s.value}</div>
              <div className="kv-label">{s.label}</div>
            </div>
          ))}
        </section>

        <section className="kv-hero kv-wrap o-hero">
          <div className="kv-profile">
            <Image src="/home/portrait.jpg" alt="Portrait of Kartik Girish Vyas" width={340} height={340} className="kv-portrait" priority />
            <div className="kv-profile-name">Kartik Girish Vyas</div>
            <div className="kv-rule" />
            <div className="kv-degrees">
              <div>B.E. — VNIT Nagpur</div>
              <div>MBA — IIM Mumbai</div>
              <div className="kv-muted-sm">(erstwhile NITIE)</div>
            </div>
            <p className="kv-bio">
              I work with organizations as a Fractional CMO and have spent 20+ years in data and analytics — at HSBC,
              Persistent Systems and InfoCepts, among others. In class, I try to bring that practice into every concept we
              cover: Business Intelligence, Analytics, Data Science, Machine Learning and AI.
            </p>
          </div>
          <div className="kv-welcome">
            <Eyebrow>Welcome</Eyebrow>
            <h1>
              Your course, your materials, <strong>all in one place.</strong>
            </h1>
            <p>
              Use this website to access all your notes, practice activities, session presentations and more. You will
              need to log in using the credentials I have provided to you.
            </p>
          </div>
        </section>

        <section className="kv-institutions kv-wrap o-inst" id="institutions">
          <div className="kv-center-head">
            <div className="kv-eyebrow-text">Your course</div>
            <h2>Choose your institution</h2>
            <p>Select your college’s logo to enter.</p>
          </div>
          <div className="kv-inst-grid">
            {INSTITUTIONS.map((inst) =>
              inst.id === "mica" ? (
                <Link key={inst.id} href="/login" className="kv-inst-card" aria-label={`${inst.name} — enter your course`}>
                  <Image src={inst.logo} alt={`${inst.name} logo`} width={inst.w} height={inst.h} />
                </Link>
              ) : (
                <button key={inst.id} type="button" className="kv-inst-card" aria-label={`${inst.name} — enter your course`} onClick={() => setNotice(inst)}>
                  <Image src={inst.logo} alt={`${inst.name} logo`} width={inst.w} height={inst.h} />
                </button>
              ),
            )}
          </div>
        </section>

        <section className="kv-orgs o-orgs" aria-label="Organisations I have worked with">
          <div className="kv-wrap">
            <Eyebrow large>Organisations I’ve worked with</Eyebrow>
          </div>
          <div className="kv-marquee">
            <div className="kv-marquee-track">
              {[...ORGS, ...ORGS].map((n, i) => (
                <div key={i} className="kv-org" aria-hidden={i >= ORGS.length}>
                  <span>{n}</span>
                  <i />
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="kv-split kv-wrap kv-bordered o-live" id="live-projects">
          <div className="kv-split-text">
            <Eyebrow>Live projects</Eyebrow>
            <h2>
              Work with me on <strong>live projects</strong>
            </h2>
            <p>
              Alongside teaching, I consult with organisations on analytics, AI and strategic marketing. From time to time,
              these engagements have room for students who want hands-on, real-world experience. Share your details and
              résumé, and I’ll reach out when a suitable project comes up.
            </p>
            <div className="kv-list">
              <div className="kv-label">Project areas</div>
              {PROJECT_AREAS.map((a) => (
                <div key={a} className="kv-list-item">
                  {a}
                </div>
              ))}
            </div>
          </div>

          <form className="kv-form" aria-label="Live project application" onSubmit={submitApplication}>
            <Field id="ap-name" label="Full name">
              <input className="kv-field" id="ap-name" name="name" type="text" placeholder="Your name" required />
            </Field>
            <Field id="ap-email" label="Email">
              <input className="kv-field" id="ap-email" name="email" type="email" placeholder="you@example.com" required />
            </Field>
            <Field id="ap-inst" label="Institution">
              <select className="kv-field" id="ap-inst" name="inst" defaultValue="">
                <option value="" disabled>
                  Select your institution
                </option>
                <option>VNIT Nagpur</option>
                <option>MICA</option>
                <option>JIT</option>
                <option>Other</option>
              </select>
            </Field>
            <Field id="ap-prog" label="Programme & year">
              <input className="kv-field" id="ap-prog" name="prog" type="text" placeholder="e.g. B.Tech CSE, final year" />
            </Field>
            <Field id="ap-area" label="Area of interest">
              <select className="kv-field" id="ap-area" name="area" defaultValue="">
                <option value="" disabled>
                  Select an area
                </option>
                <option>Analytics &amp; BI</option>
                <option>Data Science, ML &amp; AI</option>
                <option>Strategic &amp; Digital Marketing</option>
              </select>
            </Field>
            <Field id="ap-li" label="LinkedIn profile">
              <input className="kv-field" id="ap-li" name="linkedin" type="text" placeholder="linkedin.com/in/…" />
            </Field>
            <Field id="ap-cv" label="Résumé (PDF or Word)" wide>
              <input className="kv-file" id="ap-cv" name="cv" type="file" accept=".pdf,.doc,.docx" />
            </Field>
            <Field id="ap-note" label="What would you like to work on?" wide>
              <textarea className="kv-field" id="ap-note" name="note" rows={3} placeholder="A few lines about your interests and skills" />
            </Field>
            <div className="kv-form-foot">
              <button className="kv-btn" type="submit">
                Submit application
              </button>
              {formMsg && (
                <p className="kv-form-msg" role="status">
                  {formMsg}
                </p>
              )}
            </div>
          </form>
        </section>

        <section className="kv-split kv-wrap kv-bordered o-enq" id="institutional-enquiries">
          <div className="kv-split-text kv-enq-text">
            <Eyebrow>Institutional enquiries</Eyebrow>
            <h2>
              Engage me as an <strong>industry expert</strong>
            </h2>
            <p>
              As an experienced industry expert with 12+ years of teaching experience as a visiting faculty, I do take up
              industry expert engagements. These engagements are high value, high impact and long term.
            </p>
            <div className="kv-pills">
              <span>High value</span>
              <span>High impact</span>
              <span>Long term</span>
            </div>
            <p>
              To engage me for your institution, send an email to{" "}
              <a href={`mailto:${EMAIL}?subject=Industry%20expert%20teaching%20opportunity`}>{EMAIL}</a> with the subject
              line:
            </p>
            <div className="kv-subject">Industry expert teaching opportunity</div>
            <a className="kv-btn kv-cta" href={`mailto:${EMAIL}?subject=Industry%20expert%20teaching%20opportunity`}>
              Write to me
            </a>
          </div>
          <div className="kv-topics">
            <div className="kv-label">Topics I typically cover</div>
            <div className="kv-topic-grid">
              {TOPICS.map((t) => (
                <div key={t} className="kv-list-item">
                  {t}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="kv-community kv-wrap kv-bordered o-comm" id="community">
          <div className="kv-eyebrow-center">
            <i />
            <span className="kv-eyebrow-text">Community</span>
            <i />
          </div>
          <h2>
            Join my <strong>community of students</strong>
          </h2>
          <p>
            If you were a student in one of my classes, I invite you to join my community of students. As part of the
            community, you will have access to a network of the students I have taught earlier, and I share my learnings and
            readings from time to time. You will not be targeted with promotional offers — the goal of the community is
            simply to stay in touch.
          </p>
          <div className="kv-comm-grid">
            {COMMUNITY.map((c, i) => (
              <div key={c.title} className="kv-comm-item">
                <div className="kv-comm-no">{String(i + 1).padStart(2, "0")}</div>
                <div className="kv-comm-title">{c.title}</div>
                <div className="kv-comm-text">{c.text}</div>
              </div>
            ))}
          </div>
          <a className="kv-btn kv-cta" href={`mailto:${EMAIL}?subject=Join%20the%20community`}>
            Join the community
          </a>
        </section>
      </main>

      <footer className="kv-footer kv-wrap">
        <div>
          Questions about your course? <a href={`mailto:${EMAIL}`}>{EMAIL}</a>
        </div>
        <div>
          Co-founder, <a href="https://www.logicology.in">Logicology</a>
        </div>
      </footer>

      {notice && (
        <div className="kv-modal-backdrop" onClick={() => setNotice(null)}>
          <div className="kv-modal" role="dialog" aria-modal="true" aria-labelledby="kv-modal-title" onClick={(e) => e.stopPropagation()}>
            <Image src={notice.logo} alt="" width={notice.w} height={notice.h} className="kv-modal-logo" />
            <h3 id="kv-modal-title">{notice.name}</h3>
            <p>This page will be available on 1st October 2026.</p>
            <button type="button" className="kv-btn" onClick={() => setNotice(null)} autoFocus>
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Eyebrow({ children, large }: { children: React.ReactNode; large?: boolean }) {
  return (
    <div className={`kv-eyebrow${large ? " large" : ""}`}>
      <i />
      <span className="kv-eyebrow-text">{children}</span>
    </div>
  );
}

function Field({ id, label, wide, children }: { id: string; label: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <div className={`kv-form-field${wide ? " wide" : ""}`}>
      <label htmlFor={id} className="kv-label">
        {label}
      </label>
      {children}
    </div>
  );
}
