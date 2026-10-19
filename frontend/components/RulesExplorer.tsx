"use client"; // sliders, search and sort update the table

import { useEffect, useState } from "react";
import RulesTable from "@/components/RulesTable";
import { formatInt } from "@/lib/format";
import { rulesQuery, type RuleFilters } from "@/lib/queries";
import type { RuleSort, RulesPage } from "@/lib/types";
import { useDebounce } from "@/lib/useDebounce";

const PAGE_SIZE = 50;
const MAX_LIMIT = 500; // FastAPI bound

type Shown = { query: string; page: RulesPage };

/** Filter bar + rules table; the page passes the first result from the server. */
export default function RulesExplorer({
  initialFilters,
  initialPage,
}: {
  initialFilters: RuleFilters;
  initialPage: RulesPage;
}) {
  const [filters, setFilters] = useState(initialFilters);
  const [shown, setShown] = useState<Shown>({
    query: rulesQuery(initialFilters),
    page: initialPage,
  });
  const [error, setError] = useState("");

  const query = useDebounce(rulesQuery(filters));
  const loading = query !== shown.query || query !== rulesQuery(filters);

  useEffect(() => {
    if (query === shown.query) return; // the table already shows this query
    const controller = new AbortController(); // cancels a reply that came too late
    fetch(`/api/rules${query}`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`status ${response.status}`);
        return response.json() as Promise<RulesPage>;
      })
      .then((page) => {
        setShown({ query, page });
        setError("");
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setError(`Could not load the rules (${err instanceof Error ? err.message : err}).`);
      });
    return () => controller.abort();
  }, [query, shown.query]);

  /** Change filters; back to the first page unless the change sets its own limit. */
  function update(change: Partial<RuleFilters>) {
    setFilters((current) => ({ ...current, limit: PAGE_SIZE, ...change }));
  }

  const { total, rules } = shown.page;

  return (
    <>
      <div className="controls" role="search">
        <label className="field">
          Product name or code
          <input
            type="search"
            value={filters.product}
            placeholder="e.g. cake stand, 22423"
            onChange={(e) => update({ product: e.target.value })}
          />
        </label>
        <label className="field">
          <span className="field-label">
            Minimum confidence <output>{Math.round(filters.minConfidence * 100)}%</output>
          </span>
          <input
            type="range"
            min={0.2}
            max={0.9}
            step={0.05}
            value={filters.minConfidence}
            onChange={(e) => update({ minConfidence: Number(e.target.value) })}
          />
        </label>
        <label className="field">
          <span className="field-label">
            Minimum lift <output>{filters.minLift.toFixed(1)}×</output>
          </span>
          <input
            type="range"
            min={1.5}
            max={30}
            step={0.5}
            value={filters.minLift}
            onChange={(e) => update({ minLift: Number(e.target.value) })}
          />
        </label>
        <label className="field">
          Sort by
          <select
            value={filters.sort}
            onChange={(e) => update({ sort: e.target.value as RuleSort })}
          >
            <option value="lift">Lift</option>
            <option value="confidence">Confidence</option>
            <option value="support">Support</option>
          </select>
        </label>
      </div>

      <p className="note status" aria-live="polite">
        {error ||
          `Showing ${formatInt(rules.length)} of ${formatInt(total)} rules${loading ? ", updating" : ""}.`}
      </p>

      <div className={loading ? "is-loading" : undefined}>
        {rules.length > 0 ? (
          <RulesTable rules={rules} caption="Association rules matching the filters" />
        ) : (
          <p className="empty">
            No rule matches these filters. Lower the thresholds or clear the search.
          </p>
        )}
      </div>

      {rules.length < total && filters.limit < MAX_LIMIT && (
        <p className="more">
          <button
            type="button"
            onClick={() => update({ limit: Math.min(filters.limit + PAGE_SIZE, MAX_LIMIT) })}
          >
            Show {PAGE_SIZE} more rules
          </button>
        </p>
      )}
    </>
  );
}
