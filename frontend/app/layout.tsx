import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Suspense } from "react";
import DataDate from "@/components/DataDate";
import Logo from "@/components/Logo";
import NavLinks from "@/components/NavLinks";
import "./globals.css";

export const metadata: Metadata = {
  title: "Market Basket Analysis",
  description:
    "Who to call this week, what to offer them and what sells together, for a UK online gift shop.",
};

// Browser bar in the shopfront green, light and dark (same values as --brand)
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#17453a" },
    { media: "(prefers-color-scheme: dark)", color: "#0f2e26" },
  ],
};

// Same size as the date while it loads: the header does not jump (CLS)
const DATE_PLACEHOLDER = (
  <p className="data-date is-placeholder" aria-hidden="true">
    Data as of 00 Mmm 0000
  </p>
);

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#content">
          Skip to content
        </a>
        <header className="site-header">
          <div className="site-header-inner">
            <Link href="/" className="brand" translate="no">
              <Logo />
              Market Basket Analysis
            </Link>
            <nav aria-label="Main">
              <NavLinks />
            </nav>
            <Suspense fallback={DATE_PLACEHOLDER}>
              <DataDate />
            </Suspense>
          </div>
        </header>
        <div id="content" tabIndex={-1}>
          {children}
        </div>
        <footer className="site-footer">
          <p className="trust-link">
            <Link href="/model">Can I trust these numbers? →</Link>
          </p>
          <p>
            Two years of orders from a UK online gift shop: the Online Retail II dataset, UCI
            Machine Learning Repository (CC BY 4.0). Customers appear only as a number.
          </p>
        </footer>
      </body>
    </html>
  );
}
