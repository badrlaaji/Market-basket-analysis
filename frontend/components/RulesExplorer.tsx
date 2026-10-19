"use client"; // sliders, search and sort update the charts and the table

import { useEffect, useState } from "react";
import AnalystDetails from "@/components/AnalystDetails";
import ProductView from "@/components/ProductView";
import RuleDistributions from "@/components/RuleDistributions";
import RuleFlows from "@/components/RuleFlows";
import RulePanel from "@/components/RulePanel";
import RulesScatter, { LiftLegend } from "@/components/RulesScatter";
import RulesTable from "@/components/RulesTable";
import Tabs from "@/components/Tabs";
import Term from "@/components/Term";
import { formatInt } from "@/lib/format";
import { rulesExportQuery, rulesQuery, type RuleFilters } from "@/lib/queries";
import { ruleKey } from "@/lib/rules";
import type { Rule, RuleSort, RulesPage } from "@/lib/types";
import { useDebounce } from "@/lib/useDebounce";

const PAGE_SIZE = 50;
const MAX_LIMIT = 500; // the table pages by 50, up to 500
const FOLDED_ROWS = 10; // rows shown before "Show all"; the flows use every loaded row

type Shown = { query: string; page: RulesPage };

/**
 * Filters, table of patterns with the selected one in plain words, then the
 * analyst tabs. The table, the flows and the CSV follow the API filters; the
 * scatter and the histograms show every rule (loaded once) with the thresholds.
 */
export default function RulesExplorer({
  initialFilters,
  initialPage,
  allRules,
  invoices,
}: {
  initialFilters: RuleFilters;
  initialPage: RulesPage;
  allRules: Rule[];
  invoices: number;
}) {
  const [filters, setFilters] = useState(initialFilters);
  const [shown, setShown] = useState<Shown>({
    query: rulesQuery(initialFilters),
    page: initialPage,
  });
  const [selectedKey, setSelectedKey] = useState<string | null>(
    initialPage.rules[0] ? ruleKey(initialPage.rules[0]) : null,
  );
  const [error, setError] = useState("");
  const [unfolded, setUnfolded] = useState(false);

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
  const visible = unfolded ? rules : rules.slice(0, FOLDED_ROWS);
  const selected = allRules.find((rule) => ruleKey(rule) === selectedKey) ?? null;
  const productCode = selected?.consequent ?? allRules[0]?.consequent ?? "";

  return (
    <>
      <div className="controls" role="search">
        <label className="field">
          Find a product
          <input
            type="search"
            value={filters.product}
            placeholder="e.g. cake stand, 22423"
            onChange={(e) => update({ product: e.target.value })}
          />
        </label>
        <label className="field">
          <span className="field-label">
            <span>
              <Term id="confidence">How often</Term>, at least
            </span>
            <output>{Math.round(filters.minConfidence * 100)}%</output>
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
            <span>
              <Term id="lift">Strength</Term>, at least
            </span>
            <output>{filters.minLift.toFixed(1)}×</output>
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
            <option value="lift">Strongest first</option>
            <option value="confidence">Most frequent first</option>
            <option value="support">Most common first</option>
          </select>
        </label>
        <a className="button" href={`/api/rules/export${rulesExportQuery(filters)}`} download>
          Download (CSV)
        </a>
      </div>

      <div className="split">
        <section aria-labelledby="table-title">
          <div className="section-head">
            <h2 id="table-title">Patterns that match</h2>
            <p className="note" aria-live="polite">
              {error ||
                `${formatInt(visible.length)} of ${formatInt(total)} shown${loading ? ", updating" : ""}.`}
            </p>
          </div>
          <div className={loading ? "is-loading" : undefined}>
            {rules.length > 0 ? (
              <RulesTable
                rules={visible}
                caption="Buying patterns matching the filters"
                selectedKey={selectedKey}
                onSelect={setSelectedKey}
              />
            ) : (
              <p className="empty">
                No pattern matches. Move the sliders to the left or clear the search.
              </p>
            )}
          </div>
          {!unfolded && rules.length > FOLDED_ROWS && (
            <p className="more">
              <button type="button" onClick={() => setUnfolded(true)}>
                Show all {formatInt(rules.length)} loaded patterns
              </button>
            </p>
          )}
          {unfolded && rules.length < total && filters.limit < MAX_LIMIT && (
            <p className="more">
              <button
                type="button"
                onClick={() => update({ limit: Math.min(filters.limit + PAGE_SIZE, MAX_LIMIT) })}
              >
                Show {PAGE_SIZE} more patterns
              </button>
            </p>
          )}
        </section>
        <aside className="panel">
          <RulePanel
            rule={selected}
            invoices={invoices}
            onFilter={(code) => update({ product: code })}
          />
        </aside>
      </div>

      <AnalystDetails>
        <Tabs
          label="Pattern details"
          tabs={[
            {
              id: "map",
              label: "Map of all patterns",
              content: (
                <>
                  <h3 className="tab-title">
                    All {formatInt(allRules.length)} patterns by <Term id="support">support</Term>{" "}
                    and <Term id="confidence">confidence</Term>
                  </h3>
                  <RulesScatter
                    rules={allRules}
                    minConfidence={filters.minConfidence}
                    minLift={filters.minLift}
                    selectedKey={selectedKey}
                    onSelect={setSelectedKey}
                  />
                  <LiftLegend />
                  <p className="note">
                    Higher = more often; further right = more common; bigger and darker =
                    stronger (<Term id="lift">lift</Term>). Grey points are outside the filters.
                    Click a point to explain it above.
                  </p>
                </>
              ),
            },
            { id: "flows", label: "Flows", content: <RuleFlows rules={rules} /> },
            {
              id: "product",
              label: "One product",
              content: <ProductView key={productCode} rules={allRules} initialCode={productCode} />,
            },
            {
              id: "distributions",
              label: "Distributions",
              content: (
                <RuleDistributions
                  rules={allRules}
                  minConfidence={filters.minConfidence}
                  minLift={filters.minLift}
                />
              ),
            },
          ]}
        />
      </AnalystDetails>
    </>
  );
}
