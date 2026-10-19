import { connection } from "next/server";
import BasketBuilder from "@/components/BasketBuilder";
import { fetchApi } from "@/lib/fastapi";
import type { Product } from "@/lib/types";

export default async function BasketPage() {
  await connection(); // render at request time: no FastAPI call during next build
  const popular = await fetchApi<Product[]>("/products?limit=12");

  return (
    <main>
      <div className="page-head">
        <h1>What else goes in this basket?</h1>
        <p className="lede">
          Add products and see what other customers bought with them, ranked by lift. Only
          rules fully contained in your basket are used.
        </p>
      </div>
      <BasketBuilder popular={popular} />
    </main>
  );
}
