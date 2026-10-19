// Query strings shared by a page (first render) and its client component (updates).
import type { RuleSort } from "@/lib/types";

export type RuleFilters = {
  minConfidence: number;
  minLift: number;
  product: string;
  sort: RuleSort;
  limit: number;
};

// Same floors as the pipeline export: every rule is shown at first
export const DEFAULT_RULE_FILTERS: RuleFilters = {
  minConfidence: 0.2,
  minLift: 1.5,
  product: "",
  sort: "lift",
  limit: 50,
};

export const DEFAULT_THRESHOLD = 0.3;
export const AT_RISK_TOP = 50;

/** Filters → "?min_confidence=0.2&min_lift=1.5&sort=lift&limit=50". */
export function rulesQuery(filters: RuleFilters): string {
  const params = new URLSearchParams({
    min_confidence: String(filters.minConfidence),
    min_lift: String(filters.minLift),
    sort: filters.sort,
    limit: String(filters.limit),
  });
  if (filters.product.trim()) {
    params.set("product", filters.product.trim());
  }
  return `?${params}`;
}

/** Same filters without the limit: every matching rule goes in the CSV file. */
export function rulesExportQuery(filters: RuleFilters): string {
  const params = new URLSearchParams(rulesQuery(filters).slice(1));
  params.delete("limit");
  return `?${params}`;
}

// The /rules charts need every rule once (1,166 today; FastAPI accepts up to 2,000)
export const ALL_RULES_QUERY = "?min_confidence=0&min_lift=0&sort=lift&limit=2000";

/** Threshold → "?threshold=0.3&top=50". */
export function atRiskQuery(threshold: number): string {
  return `?${new URLSearchParams({ threshold: String(threshold), top: String(AT_RISK_TOP) })}`;
}
