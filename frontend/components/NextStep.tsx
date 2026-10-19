// No hooks and no "use client": rendered by the server pages.
import Link from "next/link";
import type { ReactNode } from "react";

/** "What to do": one piece of advice and, if given, the page that acts on it. */
export default function NextStep({
  children,
  href,
  action,
}: {
  children: ReactNode;
  href?: string;
  action?: string;
}) {
  return (
    <aside className="next-step" aria-label="What to do">
      <div>
        <h2>What to do</h2>
        <p>{children}</p>
      </div>
      {href && action && (
        <Link className="button button-primary" href={href}>
          {action}
        </Link>
      )}
    </aside>
  );
}
