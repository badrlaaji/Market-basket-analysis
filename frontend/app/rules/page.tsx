import { connection } from "next/server";
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
          Each rule reads as a sentence: when a basket has these products, it also has the
          other one this often. Click a point to read it in plain words.
        </p>
      </header>
      <RulesExplorer
        initialFilters={DEFAULT_RULE_FILTERS}
        initialPage={page}
        allRules={all.rules}
        invoices={stats.invoices}
      />
    </main>
  );
}
