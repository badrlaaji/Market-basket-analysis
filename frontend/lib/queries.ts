// Query strings shared by a page (first render) and its client component (updates).
import type { AtRiskSort, RuleSort } from "@/lib/types";

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
export const DEFAULT_AT_RISK_SORT: AtRiskSort = "stake"; // call first who has the most to lose
// Bounds and step of the threshold slider: a value from the URL is snapped to them
export const THRESHOLD_MIN = 0.05;
export const THRESHOLD_MAX = 0.9;
export const THRESHOLD_STEP = 0.05;

export type WinBackState = { threshold: number; segment: number | null; sort: AtRiskSort };
type Param = string | string[] | undefined;

/** First value of a search parameter ("?a=1&a=2" → "1"). */
function first(value: Param): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** "0.42" → 0.4 (snapped to the slider); missing or not a number → the default. */
export function parseThreshold(value: Param): number {
  const number = Number(first(value));
  if (first(value) === undefined || !Number.isFinite(number)) return DEFAULT_THRESHOLD;
  const clamped = Math.min(THRESHOLD_MAX, Math.max(THRESHOLD_MIN, number));
  // toFixed: 6 × 0.05 is 0.30000000000000004, not the default 0.3
  return Number((Math.round(clamped / THRESHOLD_STEP) * THRESHOLD_STEP).toFixed(2));
}

/** "2" → 2; "", "-1", "1.5" or "abc" → null (every segment). */
export function parseSegment(value: Param): number | null {
  const text = first(value);
  return text !== undefined && /^\d{1,3}$/.test(text) ? Number(text) : null;
}

/** "spend" or "stake"; anything else → the default sort. */
export function parseSort(value: Param): AtRiskSort {
  const text = first(value);
  return text === "spend" || text === "stake" ? text : DEFAULT_AT_RISK_SORT;
}

/** Search parameters of /win-back → its state, every value checked. */
export function parseWinBack(params: Record<string, Param>): WinBackState {
  return {
    threshold: parseThreshold(params.threshold),
    segment: parseSegment(params.segment),
    sort: parseSort(params.sort),
  };
}

/** State → "?threshold=0.4&segment=2" for the address bar; defaults are left out. */
export function winBackSearch(state: WinBackState): string {
  const params = new URLSearchParams();
  if (state.threshold !== DEFAULT_THRESHOLD) params.set("threshold", state.threshold.toFixed(2));
  if (state.segment !== null) params.set("segment", String(state.segment));
  if (state.sort !== DEFAULT_AT_RISK_SORT) params.set("sort", state.sort);
  const text = params.toString();
  return text ? `?${text}` : "";
}

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

/** Threshold, segment and sort → "?threshold=0.3&top=50&sort=stake&segment=2". */
export function atRiskQuery(
  threshold: number,
  segment: number | null = null,
  sort: AtRiskSort = DEFAULT_AT_RISK_SORT,
): string {
  const params = new URLSearchParams({
    threshold: threshold.toFixed(2),
    top: String(AT_RISK_TOP),
    sort,
  });
  if (segment !== null) params.set("segment", String(segment));
  return `?${params}`;
}

/** Same filters without the limit: every matching customer goes in the CSV file. */
export function atRiskExportQuery(state: WinBackState): string {
  const params = new URLSearchParams(atRiskQuery(state.threshold, state.segment, state.sort));
  params.delete("top");
  return `?${params}`;
}

/** Segment → "?segment=2", or "" for every segment. */
export function segmentQuery(segment: number | null): string {
  return segment === null ? "" : `?segment=${segment}`;
}
