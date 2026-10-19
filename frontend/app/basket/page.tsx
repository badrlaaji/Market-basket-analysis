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
  const best = scenarios[0];

  return (
    <main>
      <header className="page-head">
        <h1 className="question">What else goes in this basket?</h1>
        <p className="answer">
          {formatInt(stats.products_in_rules)} of the {formatInt(stats.products)} products can
          trigger a suggestion
          {best ? `, and the richest pair of products starts ${formatInt(best.n_rules)} rules.` : "."}
        </p>
        <p className="lede">
          Add products and see what other customers bought with them, ranked by lift. Only
          rules fully contained in your basket are used.
        </p>
      </header>
      <BasketBuilder popular={popular} scenarios={scenarios} />
    </main>
  );
}
