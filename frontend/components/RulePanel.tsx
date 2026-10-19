// No hooks and no "use client": rendered inside RulesExplorer (client).
import Term from "@/components/Term";
import { formatInt, formatLift, formatPercent, productName } from "@/lib/format";
import { basketWith } from "@/lib/insights";
import type { Rule } from "@/lib/types";

/** The selected rule in plain words, with an action on its product. */
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
    return (
      <p className="empty">Click a point or an “Explain” button to read a rule in plain words.</p>
    );
  }
  const product = productName(rule.consequent_name);
  const baseRate = rule.confidence / rule.lift; // lift = P(B | A) / P(B)

  return (
    <div className="rule-panel" aria-live="polite">
      <h2>Reading the rule</h2>
      <p className="rule-claim">
        In {basketWith(rule.antecedent_names)}, {product} is there{" "}
        {formatPercent(rule.confidence, 0)} of the time.
      </p>
      <dl className="rule-facts">
        <div>
          <dt>
            <Term id="baseRate">Usual rate</Term>
          </dt>
          <dd>
            {product} is in {formatPercent(baseRate)} of all baskets.
          </dd>
        </div>
        <div>
          <dt>
            <Term id="lift">Lift</Term>
          </dt>
          <dd>
            {formatLift(rule.lift)}: {formatPercent(rule.confidence, 0)} instead of{" "}
            {formatPercent(baseRate)}.
          </dd>
        </div>
        <div>
          <dt>
            <Term id="support">Support</Term>
          </dt>
          <dd>
            The whole set is in {formatPercent(rule.support)} of invoices, about{" "}
            {formatInt(Math.round(rule.support * invoices))} of {formatInt(invoices)}.
          </dd>
        </div>
      </dl>
      <button type="button" onClick={() => onFilter(rule.consequent)}>
        Show every rule with {product}
      </button>
    </div>
  );
}
