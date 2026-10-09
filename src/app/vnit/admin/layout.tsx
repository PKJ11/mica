import Image from "next/image";
import Link from "next/link";
import TrackerBoot from "@/components/TrackerBoot";
import { SETTINGS } from "@/lib/settings";
import { requireVnitStaff } from "@/lib/vnitAuth";
import { vnitLogout } from "../actions";
import NavLinks from "./NavLinks";

// Instructor and admin screens (I1–I4). Staff are tracked and signed out after inactivity like everyone else.
export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const session = await requireVnitStaff("/vnit/admin");
  return (
    <div className="theme-vnit staff">
      <TrackerBoot config={{ sessionId: session.id, loginUrl: "/vnit/login", settings: SETTINGS, title: "Staff" }} />
      <header className="topbar">
        <div className="topbar-inner">
          <Link href="/vnit/admin" className="topbar-brand">
            <Image src="/home/vnit.png" alt="VNIT Nagpur" width={471} height={522} className="topbar-logo" priority />
            <span className="topbar-divider" aria-hidden="true" />
            <span>VNIT Nagpur · Instructor</span>
          </Link>
          <div className="topbar-user">
            <span className="user-meta">
              <strong>{session.user.name}</strong>
            </span>
            <Link href="/vnit" className="btn-ghost">
              Course page
            </Link>
            <form action={vnitLogout}>
              <button className="btn-ghost" type="submit">
                Log out
              </button>
            </form>
          </div>
        </div>
      </header>
      <div className="staff-shell">
        <NavLinks />
        <main className="staff-main">{children}</main>
      </div>
    </div>
  );
}
