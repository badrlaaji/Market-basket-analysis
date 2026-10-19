import Link from "next/link";
import { connection } from "next/server";
import RulesTable from "@/components/RulesTable";
import { fetchApi } from "@/lib/fastapi";
import { formatInt, formatPercent } from "@/lib/format";
import type { RulesPage, Stats } from "@/lib/types";

/** One model-vs-baseline line: label, meter, value. */
function Versus({ label, value, soft }: { label: string; value: number; soft?: boolean }) {
  return (
    <div className="versus-row">
      <span>{label}</span>
      <div className={soft ? "meter is-soft" : "meter"} aria-hidden="true">
        <span style={{ width: `${value * 100}%` }} />
      </div>
      <span className="value">{value.toFixed(3)}</span>
    </div>
  );
}

export default async function OverviewPage() {
  await connection(); // render at request time: no FastAPI call during next build
  const [stats, top] = await Promise.all([
    fetchApi<Stats>("/stats"),
    fetchApi<RulesPage>("/rules?limit=5"),
  ]);
  const model = stats.model;

  return (
    <main>
      <div className="page-head">
        <h1>
          What {formatInt(stats.customers)} customers of a UK online gift shop bought, and
          what they bought together.
        </h1>
        <p className="lede">
          Two years of invoices, from {stats.first_date} to {stats.last_date}, turned into
          product rules, customer segments and a 90-day repurchase score.
        </p>
      </div>

      <dl className="figures">
        <div>
          <dt>Invoices</dt>
          <dd>{formatInt(stats.invoices)}</dd>
        </div>
        <div>
          <dt>Products</dt>
          <dd>{formatInt(stats.products)}</dd>
        </div>
        <div>
          <dt>Association rules</dt>
          <dd>{formatInt(stats.rules)}</dd>
        </div>
        <div>
          <dt>Products in a rule</dt>
          <dd>{formatInt(stats.products_in_rules)}</dd>
        </div>
        <div>
          <dt>Clean rows kept</dt>
          <dd>{formatPercent(stats.clean_rows / stats.raw_rows)}</dd>
        </div>
      </dl>

      <section className="section" aria-labelledby="top-rules">
        <div className="section-head">
          <h2 id="top-rules">Strongest rules</h2>
          <Link href="/rules">Explore all {formatInt(stats.rules)} rules</Link>
        </div>
        <RulesTable rules={top.rules} caption="Five rules with the highest lift" />
      </section>

      <section className="section" aria-labelledby="model">
        <div className="section-head">
          <h2 id="model">Will a customer buy again within {model.horizon_days} days?</h2>
          <Link href="/win-back">See who to win back</Link>
        </div>
        <p className="note status">
          XGBoost trained on {model.train_date}, tested on {formatInt(model.n_test)} customers
          on {model.test_date}. Baseline: rank customers by days since their last purchase.
        </p>
        <div className="versus">
          <Versus label="PR-AUC, model" value={model.pr_auc_model} />
          <Versus label="PR-AUC, baseline" value={model.pr_auc_baseline} soft />
          <Versus label="ROC-AUC, model" value={model.roc_auc_model} />
          <Versus label="ROC-AUC, baseline" value={model.roc_auc_baseline} soft />
        </div>
      </section>
    </main>
  );
}
