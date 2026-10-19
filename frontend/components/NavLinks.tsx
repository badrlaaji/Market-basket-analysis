"use client"; // needs the current URL to mark the active page

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Overview" },
  { href: "/rules", label: "Rules" },
  { href: "/basket", label: "Basket" },
  { href: "/segments", label: "Segments" },
  { href: "/win-back", label: "Win-back" },
  { href: "/model", label: "Model" },
];

/** Main navigation; the current page gets aria-current. */
export default function NavLinks() {
  const pathname = usePathname();

  return (
    <ul className="nav">
      {LINKS.map((link) => (
        <li key={link.href}>
          <Link href={link.href} aria-current={pathname === link.href ? "page" : undefined}>
            {link.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}
