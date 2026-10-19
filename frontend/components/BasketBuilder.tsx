"use client"; // search, add and remove products, then ask for recommendations

import { useEffect, useState } from "react";
import BeforeAfterChart from "@/components/BeforeAfterChart";
import Logo from "@/components/Logo";
import Term from "@/components/Term";
import { formatInt, formatLift, formatPercent, productName } from "@/lib/format";
import type { Product, Recommendations, Scenario } from "@/lib/types";
import { useDebounce } from "@/lib/useDebounce";

const MAX_BASKET = 50; // FastAPI bound
const K = 5;
const CHIPS = 10;
const BEST_SELLERS = 5; // rows listed before any search

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

/** Example baskets, popular products and search on the left; the basket as a receipt on the right. */
export default function BasketBuilder({
  popular,
  scenarios,
  patterns,
  orders,
}: {
  popular: Product[];
  scenarios: Scenario[];
  patterns: number;
  orders: number;
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
        if (!controller.signal.aborted) setError("Could not load the suggestions.");
      });
    return () => controller.abort();
  }, [basketKey, result.key]);

  const inBasket = new Set(basket.map((p) => p.stock_code));
  const names = new Map(basket.map((p) => [p.stock_code, p.description]));
  const searching = q.trim() !== search.q;
  const updating = basketKey !== result.key;
  const recommendations = basket.length > 0 ? result.data.recommendations : [];
  const silent = basket.filter((p) => !p.in_rules).length;
  const maxLift = Math.max(1, ...recommendations.map((r) => r.lift));
  const chips = popular.filter((p) => p.in_rules).slice(0, CHIPS);
  // Without a search, a short list: the chips above already show the best sellers
  const listed = search.q ? search.products : search.products.slice(0, BEST_SELLERS);

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
      <div className="basket-side">
        <section className="panel" aria-labelledby="start">
          <h2 id="start">Start with an example basket</h2>
          <p className="note">Pairs of products that lead to the most suggestions.</p>
          <ul className="scenarios">
            {scenarios.map((scenario) => (
              <li key={scenario.items.join("+")}>
                <button type="button" onClick={() => pickScenario(scenario)}>
                  <span className="name">{scenario.names.map(productName).join(" + ")}</span>
                  <span className="code">
                    {formatInt(scenario.n_rules)} buying patterns start here
                  </span>
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
            {search.q ? `Results for "${search.q}"` : "Best sellers"}
            {searching ? ", updating" : ""}.
          </p>
          <ul className={searching ? "product-list is-loading" : "product-list"}>
            {listed.map((product) => (
              <li key={product.stock_code}>
                <span>
                  <span className="name">{productName(product.description)}</span>
                  <span className="code">
                    {product.stock_code}
                    {product.in_rules ? ", leads to suggestions" : ", no suggestion yet"}
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
        <div className="receipt-wrap">
          <section className="receipt" aria-labelledby="basket">
            <div className="receipt-head">
              <Logo />
              <h2 id="basket">Your basket</h2>
              <span className="receipt-count">
                {basket.length} {basket.length === 1 ? "item" : "items"}
              </span>
            </div>

            {basket.length === 0 ? (
              <p className="empty">
                Empty for now. Pick an example basket or add a product to see what customers buy
                with it.
              </p>
            ) : (
              <>
                <ul className="receipt-lines">
                  {basket.map((product) => (
                    <li key={product.stock_code}>
                      <span className="name">{productName(product.description)}</span>
                      <span className="code">{product.stock_code}</span>
                      <button
                        type="button"
                        onClick={() => remove(product.stock_code)}
                        aria-label={`Remove ${productName(product.description)}`}
                        title="Remove"
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
                {silent > 0 && (
                  <p className="note">
                    {silent} of these {basket.length} products {silent === 1 ? "leads" : "lead"} to
                    no suggestion yet.
                  </p>
                )}
                <p className="more">
                  <button type="button" onClick={() => setBasket([])}>
                    Empty the basket
                  </button>
                </p>
              </>
            )}

            <div className="receipt-section" aria-live="polite">
              <h3 id="suggestions">Customers often add</h3>
              {error && <p className="error-text">{error}</p>}
              {basket.length === 0 && (
                <p className="empty">Suggestions appear here once the basket has a product.</p>
              )}
              {basket.length > 0 && !updating && recommendations.length === 0 && (
                <p className="empty">
                  No suggestion for this basket yet. Add a product that “leads to suggestions”.
                </p>
              )}
              <div className={updating ? "is-loading" : undefined}>
                {recommendations.map((item) => (
                  <article className="suggestion" key={item.stock_code}>
                    <div className="suggestion-head">
                      <h4>{productName(item.description)}</h4>
                      <button
                        type="button"
                        onClick={() =>
                          add({
                            stock_code: item.stock_code,
                            description: item.description,
                            in_rules: true,
                          })
                        }
                        aria-label={`Add ${productName(item.description)} to the basket`}
                      >
                        Add
                      </button>
                    </div>
                    <p>
                      In {formatPercent(item.confidence, 0)} of the baskets{" "}
                      {item.because.length === basket.length
                        ? "like yours"
                        : `with ${item.because.map((code) => productName(names.get(code) ?? code)).join(" + ")}`}
                      .
                    </p>
                    <div className="strength">
                      <div className="meter" aria-hidden="true">
                        <span style={{ width: `${(item.lift / maxLift) * 100}%` }} />
                      </div>
                      <span>
                        <strong>{formatLift(item.lift)}</strong> more often than{" "}
                        <Term id="baseRate">usual</Term>
                      </span>
                    </div>
                  </article>
                ))}
              </div>
            </div>

            <p className="receipt-foot">
              Suggestions from {formatInt(patterns)} buying patterns
              <br />
              found in {formatInt(orders)} orders
            </p>
          </section>
        </div>

        {recommendations.length > 0 && (
          <section className="panel before-after" aria-labelledby="odds">
            <h2 id="odds">How your basket changes the odds</h2>
            <p className="note">
              Grey: how often each product is in any basket. Colour: in baskets like yours.
            </p>
            <BeforeAfterChart items={recommendations} />
          </section>
        )}
      </div>
    </div>
  );
}
