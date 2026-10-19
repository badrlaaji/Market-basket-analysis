import { connection } from "next/server";
import RulesExplorer from "@/components/RulesExplorer";
import { fetchApi } from "@/lib/fastapi";
import { DEFAULT_RULE_FILTERS, rulesQuery } from "@/lib/queries";
import type { RulesPage } from "@/lib/types";

export default async function RulesPageView() {
  await connection(); // render at request time: no FastAPI call during next build
  const page = await fetchApi<RulesPage>(`/rules${rulesQuery(DEFAULT_RULE_FILTERS)}`);

  return (
    <main>
      <div className="page-head">
        <h1>Which products sell together?</h1>
        <p className="lede">
          Each rule reads as a sentence: when a basket has these products, it also has the
          other one this often. A lift of 10× means ten times more often than chance.
        </p>
      </div>
      <RulesExplorer initialFilters={DEFAULT_RULE_FILTERS} initialPage={page} />
    </main>
  );
}
