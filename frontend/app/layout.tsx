import type { Metadata } from "next";
import Link from "next/link";
import Logo from "@/components/Logo";
import NavLinks from "@/components/NavLinks";
import "./globals.css";

export const metadata: Metadata = {
  title: "Gift Shop Insights",
  description:
    "What sells together, who the customers are and who may stop buying, for a UK online gift shop.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <nav className="site-header-inner" aria-label="Main">
            <Link href="/" className="brand">
              <Logo />
              Gift Shop Insights
            </Link>
            <NavLinks />
          </nav>
        </header>
        {children}
        <footer className="site-footer">
          <p>
            Two years of orders from a UK online gift shop: the Online Retail II dataset, UCI
            Machine Learning Repository (CC BY 4.0). Customers appear only as a number.
          </p>
        </footer>
      </body>
    </html>
  );
}
