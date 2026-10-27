// No hooks and no "use client": rendered by the /basket and /rules pages.
import Link from "next/link";

const TABS = [
  { href: "/basket", label: "Try a basket" },
  { href: "/rules", label: "All buying patterns" },
] as const;

/** Sell more = two views, each with its own address (a link, a Back, a bookmark work). */
export default function SellMoreTabs({ current }: { current: (typeof TABS)[number]["href"] }) {
  return (
    <nav className="page-tabs" aria-label="Sell more">
      {TABS.map((tab) => (
        <Link key={tab.href} href={tab.href} aria-current={tab.href === current ? "page" : undefined}>
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
