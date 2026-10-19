"use client"; // needs the current URL to mark the active page

import Link from "next/link";
import { usePathname } from "next/navigation";

// Named by what people want to know, not by the technique behind the page
const LINKS = [
  { href: "/", label: "Summary" },
  { href: "/rules", label: "Bought together" },
  { href: "/basket", label: "Basket helper" },
  { href: "/segments", label: "Customer groups" },
  { href: "/win-back", label: "Win back" },
  { href: "/model", label: "Score reliability" },
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
