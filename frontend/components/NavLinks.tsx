"use client"; // needs the current URL to mark the active page

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

// 24 × 24 line icons, shown only in the phone's bottom bar (decorative: the label says it)
const ICONS: Record<string, ReactNode> = {
  "/": (
    <>
      <rect x="4" y="5" width="16" height="15" rx="2" />
      <path d="M4 10h16M9 3v4M15 3v4" />
    </>
  ),
  "/win-back": (
    <path d="M6 4h3l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 4 6a2 2 0 0 1 2-2z" />
  ),
  "/basket": (
    <>
      <path d="M5 8h14l-1.5 12h-11z" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" />
    </>
  ),
  "/segments": (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20a6 6 0 0 1 12 0M16 11a3 3 0 1 0-1-5.8M17 14a5 5 0 0 1 4 6" />
    </>
  ),
};

// Named by the task of the week; every older route stays reachable from its page
const LINKS = [
  { href: "/", label: "This week", paths: ["/"] },
  { href: "/win-back", label: "Win back", paths: ["/win-back"] },
  { href: "/basket", label: "Sell more", paths: ["/basket", "/rules"] },
  { href: "/segments", label: "Customers", paths: ["/segments"] },
];

/** "page" on the link to this page, "true" on its section (/rules is in Sell more). */
function current(link: (typeof LINKS)[number], pathname: string) {
  if (pathname === link.href) return "page";
  return link.paths.includes(pathname) ? "true" : undefined;
}

/** Main navigation; the current task gets aria-current. */
export default function NavLinks() {
  const pathname = usePathname();

  return (
    <ul className="nav">
      {LINKS.map((link) => (
        <li key={link.href}>
          <Link href={link.href} aria-current={current(link, pathname)}>
            <svg className="nav-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              {ICONS[link.href]}
            </svg>
            {link.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}
