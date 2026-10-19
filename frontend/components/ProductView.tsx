"use client"; // the product picker is local state

import { useState } from "react";
import { formatLift, formatPercent, productName } from "@/lib/format";
import type { Rule } from "@/lib/types";

const ROWS = 8;

type Row = { key: string; label: string; confidence: number; lift: number };

/** One side of the mirror: names and confidence bars. */
function Side({ title, note, rows, mirrored }: {
  title: string;
  note: string;
  rows: Row[];
  mirrored?: boolean;
}) {
  return (
    <section className={mirrored ? "mirror-side is-mirrored" : "mirror-side"}>
      <h3>{title}</h3>
      <p className="note">{note}</p>
      {rows.length === 0 ? (
        <p className="empty">No rule on this side.</p>
      ) : (
        <ul>
          {rows.map((row) => (
            <li key={row.key}>
              <span className="mirror-name">{row.label}</span>
              <span className="mirror-bar" aria-hidden="true">
                <span style={{ width: `${row.confidence * 100}%` }} />
              </span>
              <span className="mirror-value">
                {formatPercent(row.confidence, 0)}, {formatLift(row.lift)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Rules of one product, both ways: what brings it, what it brings. */
export default function ProductView({ rules, initialCode }: { rules: Rule[]; initialCode: string }) {
  const [code, setCode] = useState(initialCode);
  const names = new Map<string, string>();
  for (const rule of rules) {
    rule.antecedent.forEach((c, i) => names.set(c, rule.antecedent_names[i]));
    names.set(rule.consequent, rule.consequent_name);
  }
  const options = [...names].sort((a, b) => a[1].localeCompare(b[1]));
  const name = productName(names.get(code) ?? code);
  const byConfidence = (a: Rule, b: Rule) => b.confidence - a.confidence;
  const others = (rule: Rule) =>
    rule.antecedent_names.filter((_, i) => rule.antecedent[i] !== code).map(productName);

  // Rules ending with the product: label = what was in the basket
  const boughtWith: Row[] = rules
    .filter((rule) => rule.consequent === code)
    .sort(byConfidence)
    .slice(0, ROWS)
    .map((rule) => ({
      key: rule.antecedent.join("+"),
      label: rule.antecedent_names.map(productName).join(" + "),
      confidence: rule.confidence,
      lift: rule.lift,
    }));
  // Rules starting from the product: label = what it brings (and its partners)
  const leadsTo: Row[] = rules
    .filter((rule) => rule.antecedent.includes(code))
    .sort(byConfidence)
    .slice(0, ROWS)
    .map((rule) => {
      const partners = others(rule);
      const suffix = partners.length > 0 ? ` (with ${partners.join(" + ")})` : "";
      return {
        key: `${rule.antecedent.join("+")}>${rule.consequent}`,
        label: `${productName(rule.consequent_name)}${suffix}`,
        confidence: rule.confidence,
        lift: rule.lift,
      };
    });

  return (
    <>
      <label className="field">
        Product
        <select value={code} onChange={(e) => setCode(e.target.value)}>
          {options.map(([c, n]) => (
            <option key={c} value={c}>
              {productName(n)} ({c})
            </option>
          ))}
        </select>
      </label>
      <div className="mirror">
        <Side
          title="Bought with it"
          note={`Share of baskets with these products that also hold ${name}.`}
          rows={boughtWith}
          mirrored
        />
        <Side
          title="Leads to"
          note={`Share of baskets with ${name} that also hold these products.`}
          rows={leadsTo}
        />
      </div>
    </>
  );
}
