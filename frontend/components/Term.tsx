// No hooks and no "use client": usable in server and client components.
import type { ReactNode } from "react";
import { GLOSSARY, type GlossaryKey } from "@/lib/glossary";

/** A word with its definition, shown on hover and on keyboard focus (CSS only). */
export default function Term({ id, children }: { id: GlossaryKey; children: ReactNode }) {
  return (
    <span className="term" tabIndex={0}>
      {children}
      <span className="term-tip" role="tooltip">
        {GLOSSARY[id]}
      </span>
    </span>
  );
}
