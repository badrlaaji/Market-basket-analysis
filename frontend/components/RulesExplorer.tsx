"use client"; // sliders, search and sort update the charts and the table

import { useEffect, useState } from "react";
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
 * Filters, scatter of every rule, rule panel, table and detail tabs.
 * The table, the flows and the CSV follow the API filters; the scatter and the
 * histograms show every rule (loaded once) with the thresholds drawn on them.
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
            <span>
              Minimum <Term id="confidence">confidence</Term>
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
              Minimum <Term id="lift">lift</Term>
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
            <option value="lift">Lift</option>
            <option value="confidence">Confidence</option>
            <option value="support">Support</option>
          </select>
        </label>
        <a className="button" href={`/api/rules/export${rulesExportQuery(filters)}`} download>
          Export CSV
        </a>
      </div>

      <div className="split">
        <section className="panel chart-panel" aria-labelledby="scatter-title">
          <h2 id="scatter-title">
            All {formatInt(allRules.length)} rules by <Term id="support">support</Term> and
            confidence
          </h2>
          <RulesScatter
            rules={allRules}
            minConfidence={filters.minConfidence}
            minLift={filters.minLift}
            selectedKey={selectedKey}
            onSelect={setSelectedKey}
          />
          <LiftLegend />
          <p className="note">
            Bigger and darker points have a higher lift. Grey points are below the thresholds.
          </p>
        </section>
        <aside className="panel">
          <RulePanel
            rule={selected}
            invoices={invoices}
            onFilter={(code) => update({ product: code })}
          />
        </aside>
      </div>

      <section className="section" aria-labelledby="table-title">
        <div className="section-head">
          <h2 id="table-title">Rules matching the filters</h2>
          <p className="note" aria-live="polite">
            {error ||
              `Showing ${formatInt(visible.length)} of ${formatInt(total)} rules${loading ? ", updating" : ""}.`}
          </p>
        </div>
        <div className={loading ? "is-loading" : undefined}>
          {rules.length > 0 ? (
            <RulesTable
              rules={visible}
              caption="Association rules matching the filters"
              selectedKey={selectedKey}
              onSelect={setSelectedKey}
            />
          ) : (
            <p className="empty">
              No rule matches these filters. Lower the thresholds or clear the search.
            </p>
          )}
        </div>
        {!unfolded && rules.length > FOLDED_ROWS && (
          <p className="more">
            <button type="button" onClick={() => setUnfolded(true)}>
              Show all {formatInt(rules.length)} loaded rules
            </button>
          </p>
        )}
        {unfolded && rules.length < total && filters.limit < MAX_LIMIT && (
          <p className="more">
            <button
              type="button"
              onClick={() => update({ limit: Math.min(filters.limit + PAGE_SIZE, MAX_LIMIT) })}
            >
              Show {PAGE_SIZE} more rules
            </button>
          </p>
        )}
      </section>

      <section className="section" aria-labelledby="details-title">
        <h2 id="details-title">Look closer</h2>
        <Tabs
          label="Rule details"
          tabs={[
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
      </section>
    </>
  );
}
