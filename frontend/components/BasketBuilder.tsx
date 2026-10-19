"use client"; // search, add and remove products, then ask for recommendations

import { useEffect, useState } from "react";
import BeforeAfterChart from "@/components/BeforeAfterChart";
import Term from "@/components/Term";
import { formatInt, formatLift, formatPercent, productName } from "@/lib/format";
import type { Product, Recommendations, Scenario } from "@/lib/types";
import { useDebounce } from "@/lib/useDebounce";

const MAX_BASKET = 50; // FastAPI bound
const K = 5;
const CHIPS = 10;

type Item = Pick<Product, "stock_code" | "description" | "in_rules">;
type Search = { q: string; products: Product[] };
type Result = { key: string; data: Recommendations };

/** GET /api/products?q= (popular products when q is empty). */
async function searchProducts(q: string, signal: AbortSignal): Promise<Product[]> {
  const response = await fetch(`/api/products?${new URLSearchParams({ q, limit: "12" })}`, {
    signal,
  });
  if (!response.ok) throw new Error(`status ${response.status}`);
  return response.json();
}

/** POST /api/recommend with the basket codes. */
async function recommend(items: string[], signal: AbortSignal): Promise<Recommendations> {
  const response = await fetch("/api/recommend", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ items, k: K }),
    signal,
  });
  if (!response.ok) throw new Error(`status ${response.status}`);
  return response.json();
}

/** Ready-made baskets, popular products and search on the left; basket and suggestions on the right. */
export default function BasketBuilder({
  popular,
  scenarios,
}: {
  popular: Product[];
  scenarios: Scenario[];
}) {
  const [q, setQ] = useState("");
  const [search, setSearch] = useState<Search>({ q: "", products: popular.slice(0, 12) });
  const [basket, setBasket] = useState<Item[]>([]);
  const [result, setResult] = useState<Result>({
    key: "",
    data: { recommendations: [], unknown_codes: [] },
  });
  const [error, setError] = useState("");

  const debouncedQ = useDebounce(q.trim());
  const basketKey = basket.map((p) => p.stock_code).join(",");

  // Search results follow the (debounced) text
  useEffect(() => {
    if (debouncedQ === search.q) return;
    const controller = new AbortController();
    searchProducts(debouncedQ, controller.signal)
      .then((products) => setSearch({ q: debouncedQ, products }))
      .catch(() => {
        if (!controller.signal.aborted) setError("Could not search the products.");
      });
    return () => controller.abort();
  }, [debouncedQ, search.q]);

  // Recommendations follow the basket
  useEffect(() => {
    if (basketKey === result.key) return;
    const controller = new AbortController();
    recommend(basketKey ? basketKey.split(",") : [], controller.signal)
      .then((data) => {
        setResult({ key: basketKey, data });
        setError("");
      })
      .catch(() => {
        if (!controller.signal.aborted) setError("Could not load the recommendations.");
      });
    return () => controller.abort();
  }, [basketKey, result.key]);

  const inBasket = new Set(basket.map((p) => p.stock_code));
  const names = new Map(basket.map((p) => [p.stock_code, p.description]));
  const searching = q.trim() !== search.q;
  const updating = basketKey !== result.key;
  const recommendations = basket.length > 0 ? result.data.recommendations : [];
  const covered = basket.filter((p) => p.in_rules).length;
  const maxLift = Math.max(1, ...recommendations.map((r) => r.lift));
  const chips = popular.filter((p) => p.in_rules).slice(0, CHIPS);

  function add(item: Item) {
    setBasket((current) =>
      current.length < MAX_BASKET && !current.some((p) => p.stock_code === item.stock_code)
        ? [...current, item]
        : current,
    );
  }

  function remove(code: string) {
    setBasket((current) => current.filter((p) => p.stock_code !== code));
  }

  /** Replace the basket with a ready-made one (its products all appear in rules). */
  function pickScenario(scenario: Scenario) {
    setBasket(
      scenario.items.map((code, i) => ({
        stock_code: code,
        description: scenario.names[i],
        in_rules: true,
      })),
    );
  }

  return (
    <div className="basket-layout">
      <div>
        <section className="panel" aria-labelledby="start">
          <h2 id="start">Start from a ready-made basket</h2>
          <p className="note">
            Built from the rules: the product pairs that start the most rules.
          </p>
          <ul className="scenarios">
            {scenarios.map((scenario) => (
              <li key={scenario.items.join("+")}>
                <button type="button" onClick={() => pickScenario(scenario)}>
                  <span className="name">{scenario.names.map(productName).join(" + ")}</span>
                  <span className="code">{formatInt(scenario.n_rules)} rules start here</span>
                </button>
              </li>
            ))}
          </ul>
          <h3 className="chips-title">Or add a popular product</h3>
          <ul className="chips">
            {chips.map((product) => (
              <li key={product.stock_code}>
                <button
                  type="button"
                  onClick={() => add(product)}
                  disabled={inBasket.has(product.stock_code)}
                  aria-pressed={inBasket.has(product.stock_code)}
                >
                  {productName(product.description)}
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="panel" aria-labelledby="find">
          <h2 id="find">Find a product</h2>
          <label className="field">
            Product name or code
            <input
              type="search"
              value={q}
              placeholder="e.g. lunch bag, 20725"
              onChange={(e) => setQ(e.target.value)}
            />
          </label>
          <p className="note search-status" aria-live="polite">
            {search.q ? `Results for "${search.q}"` : "Most bought products"}
            {searching ? ", updating" : ""}. Products marked “in rules” can trigger a
            suggestion.
          </p>
          <ul className={searching ? "product-list is-loading" : "product-list"}>
            {search.products.map((product) => (
              <li key={product.stock_code}>
                <span>
                  <span className="name">{productName(product.description)}</span>
                  <span className="code">
                    {product.stock_code}
                    {product.in_rules ? ", in rules" : ""}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => add(product)}
                  disabled={inBasket.has(product.stock_code)}
                  aria-label={`Add ${productName(product.description)} to the basket`}
                >
                  {inBasket.has(product.stock_code) ? "Added" : "Add"}
                </button>
              </li>
            ))}
          </ul>
          {search.products.length === 0 && (
            <p className="empty">No product matches “{search.q}”. Try another word or a code.</p>
          )}
        </section>
      </div>

      <div>
        <section className="panel" aria-labelledby="basket">
          <div className="section-head">
            <h2 id="basket">Your basket</h2>
            {basket.length > 0 && (
              <button type="button" onClick={() => setBasket([])}>
                Empty the basket
              </button>
            )}
          </div>
          {basket.length === 0 ? (
            <p className="empty">
              Empty. Pick a ready-made basket or add a product to see what customers buy with it.
            </p>
          ) : (
            <>
              <div className="coverage">
                <span>
                  {covered} of {basket.length} products can trigger a suggestion
                </span>
                <div className="meter" aria-hidden="true">
                  <span style={{ width: `${(covered / basket.length) * 100}%` }} />
                </div>
              </div>
              <ul className="product-list">
                {basket.map((product) => (
                  <li key={product.stock_code}>
                    <span>
                      <span className="name">{productName(product.description)}</span>
                      <span className="code">
                        {product.stock_code}
                        {product.in_rules ? "" : ", in no rule"}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => remove(product.stock_code)}
                      aria-label={`Remove ${productName(product.description)}`}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        <section className="panel" aria-labelledby="suggestions" aria-live="polite">
          <h2 id="suggestions">Customers also buy</h2>
          {error && <p className="error-text">{error}</p>}
          {basket.length === 0 && (
            <p className="empty">Suggestions appear here once the basket has a product.</p>
          )}
          {basket.length > 0 && !updating && recommendations.length === 0 && (
            <p className="empty">
              No rule starts from this basket yet. Only products marked “in rules” lead to a
              suggestion.
            </p>
          )}
          <div className={updating ? "is-loading" : undefined}>
            {recommendations.map((item) => (
              <article className="recommendation" key={item.stock_code}>
                <div className="recommendation-head">
                  <h3 className="name">
                    {productName(item.description)}{" "}
                    <span className="code">{item.stock_code}</span>
                  </h3>
                  <button
                    type="button"
                    onClick={() =>
                      add({ stock_code: item.stock_code, description: item.description, in_rules: true })
                    }
                    aria-label={`Add ${productName(item.description)} to the basket`}
                  >
                    Add
                  </button>
                </div>
                <p>
                  Because you added{" "}
                  {item.because.map((code) => productName(names.get(code) ?? code)).join(" + ")}:
                  in {formatPercent(item.confidence, 0)} of these baskets.
                </p>
                <div className="lift-row">
                  <span className="lift-name">
                    <Term id="lift">Lift</Term>
                  </span>
                  <div className="meter" aria-hidden="true">
                    <span style={{ width: `${(item.lift / maxLift) * 100}%` }} />
                  </div>
                  <span className="lift">{formatLift(item.lift)}</span>
                </div>
              </article>
            ))}
          </div>
          {recommendations.length > 0 && (
            <div className="before-after">
              <h3>
                How much the basket changes the odds (<Term id="baseRate">usual rate</Term> vs
                with your basket)
              </h3>
              <BeforeAfterChart items={recommendations} />
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
