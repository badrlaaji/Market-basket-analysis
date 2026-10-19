import { connection } from "next/server";
import NextStep from "@/components/NextStep";
import RulesExplorer from "@/components/RulesExplorer";
import { fetchApi } from "@/lib/fastapi";
import { rulesAnswer } from "@/lib/insights";
import { ALL_RULES_QUERY, DEFAULT_RULE_FILTERS, rulesQuery } from "@/lib/queries";
import type { RulesPage, Stats } from "@/lib/types";

export default async function RulesPageView() {
  await connection(); // render at request time: no FastAPI call during next build
  const [page, all, stats] = await Promise.all([
    fetchApi<RulesPage>(`/rules${rulesQuery(DEFAULT_RULE_FILTERS)}`),
    fetchApi<RulesPage>(`/rules${ALL_RULES_QUERY}`),
    fetchApi<Stats>("/stats"),
  ]);

  return (
    <main>
      <header className="page-head">
        <h1 className="question">Which products sell together?</h1>
        {all.rules[0] && <p className="answer">{rulesAnswer(stats, all.rules[0])}</p>}
        <p className="lede">
          A buying pattern reads like a sentence: when a basket has these products, it often
          has that one too. Click “Explain” on a row to read it in plain words.
        </p>
      </header>
      <NextStep href="/basket" action="Try the basket helper">
        Put the products of the strongest patterns side by side, in the shop and in the
        “customers also bought” block of each product page.
      </NextStep>
      <RulesExplorer
        initialFilters={DEFAULT_RULE_FILTERS}
        initialPage={page}
        allRules={all.rules}
        invoices={stats.invoices}
      />
    </main>
  );
}
