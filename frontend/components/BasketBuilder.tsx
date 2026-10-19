"use client"; // search, add and remove products, then ask for recommendations

import { useEffect, useState } from "react";
import { formatPercent, productName } from "@/lib/format";
import type { Product, Recommendations } from "@/lib/types";
import { useDebounce } from "@/lib/useDebounce";

const MAX_BASKET = 50; // FastAPI bound
const K = 5;

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

/** Product search on the left, basket and recommendations on the right. */
export default function BasketBuilder({ popular }: { popular: Product[] }) {
  const [q, setQ] = useState("");
  const [search, setSearch] = useState<Search>({ q: "", products: popular });
  const [basket, setBasket] = useState<Product[]>([]);
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

  function add(product: Product) {
    setBasket((current) =>
      current.length < MAX_BASKET && !current.some((p) => p.stock_code === product.stock_code)
        ? [...current, product]
        : current,
    );
  }

  function remove(code: string) {
    setBasket((current) => current.filter((p) => p.stock_code !== code));
  }

  return (
    <div className="basket-layout">
      <section className="panel" aria-labelledby="find">
        <h2 id="find">Find products</h2>
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
          recommendation.
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

      <div>
        <section className="panel" aria-labelledby="basket">
          <h2 id="basket">Your basket</h2>
          {basket.length === 0 ? (
            <p className="empty">
              Empty. Add a product on the left to see what customers buy with it.
            </p>
          ) : (
            <ul className="product-list">
              {basket.map((product) => (
                <li key={product.stock_code}>
                  <span>
                    <span className="name">{productName(product.description)}</span>
                    <span className="code">{product.stock_code}</span>
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
              recommendation.
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
                  <span className="lift">{item.lift.toFixed(1)}×</span>
                </div>
                <p>
                  In {formatPercent(item.confidence, 0)} of baskets with{" "}
                  {item.because.map((code) => productName(names.get(code) ?? code)).join(" + ")}.
                </p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
