import { connection } from "next/server";
import BasketBuilder from "@/components/BasketBuilder";
import { fetchApi } from "@/lib/fastapi";
import { formatInt } from "@/lib/format";
import type { Product, Scenario, Stats } from "@/lib/types";

export default async function BasketPage() {
  await connection(); // render at request time: no FastAPI call during next build
  const [popular, scenarios, stats] = await Promise.all([
    fetchApi<Product[]>("/products?limit=40"),
    fetchApi<Scenario[]>("/scenarios"),
    fetchApi<Stats>("/stats"),
  ]);

  return (
    <main>
      <header className="page-head">
        <h1 className="question">What else goes in this basket?</h1>
        <p className="answer">
          Fill a basket and see what other customers usually add to it.
        </p>
        <p className="lede">
          Suggestions come from the buying patterns of {formatInt(stats.invoices)} orders.{" "}
          {formatInt(stats.products_in_rules)} of the {formatInt(stats.products)} products can
          lead to one; the others appear in too few orders to show a clear pattern.
        </p>
      </header>
      <BasketBuilder
        popular={popular}
        scenarios={scenarios}
        patterns={stats.rules}
        orders={stats.invoices}
      />
    </main>
  );
}
