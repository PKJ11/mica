import Image from "next/image";
import Link from "next/link";
import { logout } from "@/app/actions";
import type { Student } from "@/data/students";

export default function TopBar({ student }: { student: Student }) {
  const initials = student.name
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join("");

  return (
    <header className="topbar">
      <div className="topbar-inner">
        <Link href="/dashboard" className="topbar-brand">
          <Image src="/mica-logo.svg" alt="MICA – The School of Ideas" width={107} height={110} className="topbar-logo" priority />
          <span className="topbar-divider" aria-hidden="true" />
          <span>Portal</span>
        </Link>
        <div className="topbar-user">
          <span className="avatar">{initials}</span>
          <span className="user-meta">
            <strong>{student.name}</strong>
            {student.roll !== "others" && <span className="mono">{student.roll}</span>}
          </span>
          <form action={logout}>
            <button className="btn-ghost" type="submit">
              Log out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
