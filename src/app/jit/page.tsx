import Image from "next/image";
import Link from "next/link";
import { requireJit } from "@/lib/jitAuth";
import { jitLogout } from "./actions";

export const metadata = { title: "JIT · Course materials" };

// Hosted separately on logicology.in; this page needs the shared JIT login.
const LINKS = [
  {
    href: "https://python-jit.logicology.in/",
    tag: "Guided Practice",
    title: "Python Fundamentals",
    subtitle: "30 interactive Python data-science labs",
  },
  {
    href: "https://real-world-jit.logicology.in/",
    tag: "Case Problems",
    title: "Real Life Problem Solving using Data Science",
    subtitle: "Twelve real world problems that take you from an untidy spreadsheet to a final report.",
  },
];

export default async function JitPage() {
  await requireJit();

  return (
    <div className="theme-jit">
      <header className="topbar">
        <div className="topbar-inner">
          <Link href="/home" className="topbar-brand">
            <Image src="/home/jit.png" alt="JIT" width={176} height={148} className="topbar-logo" priority />
            <span className="topbar-divider" aria-hidden="true" />
            <span>JIT</span>
          </Link>
          <form action={jitLogout}>
            <button className="btn-ghost" type="submit">
              Log out
            </button>
          </form>
        </div>
      </header>
      <main className="page">
        <nav className="crumbs">
          <Link href="/home">Home</Link> <span>/</span> JIT
        </nav>
        <p className="kicker dark">JIT</p>
        <h1 className="page-title">Course materials</h1>
        <p className="muted">Hands-on Python labs and real-world data science problems.</p>

        <div className="grid two">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} target="_blank" rel="noopener noreferrer" className="activity-card feature">
              <span className="tag">{l.tag}</span>
              <h3>{l.title}</h3>
              <p>{l.subtitle}</p>
              <span className="arrow">Open site ↗</span>
            </a>
          ))}
        </div>
      </main>
    </div>
  );
}
