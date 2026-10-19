import type { Metadata } from "next";
import Link from "next/link";
import NavLinks from "@/components/NavLinks";
import "./globals.css";

export const metadata: Metadata = {
  title: "Market Basket Analysis",
  description:
    "Association rules, customer segments and repurchase scores for a UK online gift retailer.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <nav className="site-header-inner" aria-label="Main">
            <Link href="/" className="brand">
              Market Basket Analysis
            </Link>
            <NavLinks />
          </nav>
        </header>
        {children}
        <footer className="site-footer">
          <p>
            Data: Online Retail II, UCI Machine Learning Repository (CC BY 4.0). Customers
            are shown by their numeric ID only.
          </p>
        </footer>
      </body>
    </html>
  );
}
