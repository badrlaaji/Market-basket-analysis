"use client"; // needs the current URL to mark the active page

import Link from "next/link";
import { usePathname } from "next/navigation";

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
            {link.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}
