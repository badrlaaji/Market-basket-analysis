// No hooks and no "use client": rendered by the overview (server) and RulesExplorer (client).
import { formatPercent, productName } from "@/lib/format";
import { ruleKey } from "@/lib/rules";
import type { Rule } from "@/lib/types";

/** One product: readable name, stock code below. */
function ProductCell({ code, name }: { code: string; name: string }) {
  return (
    <>
      {productName(name)} <span className="code">{code}</span>
    </>
  );
}

/** Association rules as "basket → also bought", with confidence, lift and support. */
export default function RulesTable({
  rules,
  caption,
  selectedKey,
  onSelect,
}: {
  rules: Rule[];
  caption: string;
  selectedKey?: string | null;
  onSelect?: (key: string) => void; // adds an "Explain" button per row
}) {
  return (
    <div className="table-wrap">
      <table>
        <caption className="visually-hidden">{caption}</caption>
        <thead>
          <tr>
            <th scope="col">If the basket has</th>
            <th scope="col">Customers also buy</th>
            <th scope="col" title="Share of these baskets that also contain the product">
              Confidence
            </th>
            <th scope="col" className="num" title="How many times more often than chance">
              Lift
            </th>
            <th scope="col" className="num" title="Share of all invoices with the whole rule">
              Support
            </th>
            {onSelect && (
              <th scope="col">
                <span className="visually-hidden">Explain</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {rules.map((rule) => (
            <tr
              key={ruleKey(rule)}
              className={ruleKey(rule) === selectedKey ? "is-selected" : undefined}
            >
              <td>
                <ul className="items">
                  {rule.antecedent.map((code, i) => (
                    <li key={code}>
                      <ProductCell code={code} name={rule.antecedent_names[i]} />
                    </li>
                  ))}
                </ul>
              </td>
              <td>
                <ProductCell code={rule.consequent} name={rule.consequent_name} />
              </td>
              <td>
                <div className="cell-meter">
                  <span>{formatPercent(rule.confidence, 0)}</span>
                  <div className="meter" aria-hidden="true">
                    <span style={{ width: `${rule.confidence * 100}%` }} />
                  </div>
                </div>
              </td>
              <td className="num">
                <span className="lift">{rule.lift.toFixed(1)}×</span>
              </td>
              <td className="num">{formatPercent(rule.support)}</td>
              {onSelect && (
                <td>
                  <button
                    type="button"
                    onClick={() => onSelect(ruleKey(rule))}
                    aria-pressed={ruleKey(rule) === selectedKey}
                  >
                    Explain
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
