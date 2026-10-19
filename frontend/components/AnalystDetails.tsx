"use client"; // open or closed is local state

import { useState, type ReactNode } from "react";

/**
 * Technical charts behind one disclosure, closed by default.
 * The content is rendered only once opened: the charts measure a visible box.
 */
export default function AnalystDetails({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <details className="analyst" onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>
        More detail for analysts <span>the charts and measures behind these answers</span>
      </summary>
      {open && <div className="analyst-body">{children}</div>}
    </details>
  );
}
