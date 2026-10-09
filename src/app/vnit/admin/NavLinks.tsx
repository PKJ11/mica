"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS: [string, string][] = [
  ["/vnit/admin", "Overview"],
  ["/vnit/admin/time", "Time"],
  ["/vnit/admin/questions", "Questions"],
  ["/vnit/admin/students", "Students"],
];

/** Staff screen navigation: a side menu on laptops, a row of tabs on smaller screens. */
export default function NavLinks() {
  const path = usePathname();
  return (
    <nav className="staff-nav" aria-label="Staff screens">
      {LINKS.map(([href, label]) => {
        const active = href === "/vnit/admin" ? path === href : path.startsWith(href);
        return (
          <Link key={href} href={href} aria-current={active ? "page" : undefined} className={active ? "active" : undefined}>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
