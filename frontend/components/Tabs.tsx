"use client"; // the selected tab is local state

import { useId, useState, type KeyboardEvent, type ReactNode } from "react";

export type Tab = { id: string; label: string; content: ReactNode };

/** Details under the main charts; only the open panel is rendered (charts get their size). */
export default function Tabs({ label, tabs }: { label: string; tabs: Tab[] }) {
  const [active, setActive] = useState(tabs[0]?.id ?? "");
  const base = useId();
  const current = tabs.find((tab) => tab.id === active) ?? tabs[0];

  /** Left and right arrows move to the previous or next tab (ARIA tabs pattern). */
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    const index = tabs.findIndex((tab) => tab.id === current?.id);
    const step = event.key === "ArrowRight" ? 1 : -1;
    const next = tabs[(index + step + tabs.length) % tabs.length];
    setActive(next.id);
    document.getElementById(`${base}-tab-${next.id}`)?.focus();
  }

  return (
    <div className="tabs">
      <div className="tab-list" role="tablist" aria-label={label} onKeyDown={onKeyDown}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            id={`${base}-tab-${tab.id}`}
            type="button"
            role="tab"
            aria-selected={tab.id === current?.id}
            aria-controls={`${base}-panel`}
            tabIndex={tab.id === current?.id ? 0 : -1}
            onClick={() => setActive(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {current && (
        <div
          className="tab-panel"
          id={`${base}-panel`}
          role="tabpanel"
          aria-labelledby={`${base}-tab-${current.id}`}
        >
          {current.content}
        </div>
      )}
    </div>
  );
}
