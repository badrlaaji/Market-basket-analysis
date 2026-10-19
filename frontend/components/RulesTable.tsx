// No hooks and no "use client": rendered by the overview (server) and RulesExplorer (client).
import { formatPercent, productName } from "@/lib/format";
import { ruleKey } from "@/lib/rules";
import type { Rule } from "@/lib/types";

/** One product: readable name; the stock code shows on hover. */
function ProductCell({ code, name }: { code: string; name: string }) {
  return <span title={`Code ${code}`}>{productName(name)}</span>;
}

/** Buying patterns as "basket → also has", with how often and how strong (lift). */
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
            <th scope="col">When a basket has</th>
            <th scope="col">It often also has</th>
            <th scope="col" title="Share of these baskets that also contain the product">
              How often
            </th>
            <th scope="col" className="num" title="How many times more often than by chance">
              Strength
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
