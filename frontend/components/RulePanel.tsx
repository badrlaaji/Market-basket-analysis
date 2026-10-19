// No hooks and no "use client": rendered inside RulesExplorer (client).
import Term from "@/components/Term";
import { formatInt, formatLift, formatPercent, productName } from "@/lib/format";
import { productList } from "@/lib/insights";
import type { Rule } from "@/lib/types";

/** The selected pattern in plain words, with an action on its product. */
export default function RulePanel({
  rule,
  invoices,
  onFilter,
}: {
  rule: Rule | null;
  invoices: number;
  onFilter: (code: string) => void;
}) {
  if (!rule) {
    return <p className="empty">Click “Explain” on a row to read the pattern in plain words.</p>;
  }
  const product = productName(rule.consequent_name);
  const baseRate = rule.confidence / rule.lift; // lift = P(B | A) / P(B)

  return (
    <div className="rule-panel" aria-live="polite">
      <h2>In plain words</h2>
      <p className="rule-claim">
        When a basket has {productList(rule.antecedent_names)}, it also has {product}{" "}
        {formatPercent(rule.confidence, 0)} of the time.
      </p>
      <dl className="rule-facts">
        <div>
          <dt>
            <Term id="baseRate">Usually</Term>
          </dt>
          <dd>
            {product} is in {formatPercent(baseRate)} of all baskets.
          </dd>
        </div>
        <div>
          <dt>
            <Term id="lift">Strength</Term>
          </dt>
          <dd>
            {formatLift(rule.lift)} more often than usual: {formatPercent(rule.confidence, 0)}{" "}
            instead of {formatPercent(baseRate)}.
          </dd>
        </div>
        <div>
          <dt>
            <Term id="support">How common</Term>
          </dt>
          <dd>
            All these products are together in {formatPercent(rule.support)} of the orders,
            about {formatInt(Math.round(rule.support * invoices))} of {formatInt(invoices)}.
          </dd>
        </div>
      </dl>
      <button type="button" onClick={() => onFilter(rule.consequent)}>
        Show every pattern with {product}
      </button>
    </div>
  );
}
