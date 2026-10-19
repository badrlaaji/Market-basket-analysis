// Pure helpers for the /rules charts (shared by several client components).
import type { Rule } from "@/lib/types";

// Lift classes for the colour of the scatter points (lift goes from 1.5 to 51)
export const LIFT_CLASSES = [
  { min: 0, label: "under 5×" },
  { min: 5, label: "5 to 10×" },
  { min: 10, label: "10 to 20×" },
  { min: 20, label: "20 to 30×" },
  { min: 30, label: "30× and more" },
];

/** Stable id of a rule: "20724+22355>22356". */
export function ruleKey(rule: Rule): string {
  return `${rule.antecedent.join("+")}>${rule.consequent}`;
}

/** Index of the lift class of a value (0 to 4). */
export function liftClass(lift: number): number {
  return LIFT_CLASSES.findLastIndex((liftRange) => lift >= liftRange.min);
}

/** Drop B → A when A → B came first: the same pair is kept once. */
export function withoutMirrors(rules: Rule[]): Rule[] {
  const seen = new Set<string>();
  return rules.filter((rule) => {
    const pair = [...rule.antecedent, rule.consequent].sort().join("+");
    if (seen.has(pair)) return false;
    seen.add(pair);
    return true;
  });
}

export type Bin = { x: number; n: number };

/** Counts per bin [x, x + step) from start to end, for a step-shaped area chart. */
export function histogram(values: number[], start: number, end: number, step: number): Bin[] {
  const size = Math.round((end - start) / step);
  const counts = new Array<number>(size).fill(0);
  for (const value of values) {
    const index = Math.floor((value - start) / step);
    counts[Math.min(size - 1, Math.max(0, index))] += 1; // outliers in the edge bins
  }
  const bins = counts.map((n, i) => ({ x: start + i * step, n }));
  return [...bins, { x: end, n: counts[size - 1] }]; // closes the last step
}
