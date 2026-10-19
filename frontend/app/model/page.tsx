import { connection } from "next/server";
import ModelCharts from "@/components/ModelCharts";
import { fetchApi } from "@/lib/fastapi";
import { formatDate, formatInt } from "@/lib/format";
import { modelAnswer, seasonNote } from "@/lib/insights";
import type { ModelReport, Month } from "@/lib/types";

export default async function ModelPage() {
  await connection(); // render at request time: no FastAPI call during next build
  const [report, months] = await Promise.all([
    fetchApi<ModelReport>("/model"),
    fetchApi<Month[]>("/timeline"),
  ]);
  const m = report.metrics;

  return (
    <main>
      <header className="page-head">
        <h1 className="question">Can we tell who will buy again?</h1>
        <p className="answer">{modelAnswer(m)}</p>
        <p className="lede">
          XGBoost trained on {formatInt(m.n_train)} customers with features before{" "}
          {formatDate(m.train_date)}, tested on {formatInt(m.n_test)} customers with features
          before {formatDate(m.test_date)}: will each one order in the next {m.horizon_days}{" "}
          days? The baseline ranks customers by days since their last purchase.
        </p>
      </header>
      <p className="callout">{seasonNote(m, months)}</p>
      <ModelCharts report={report} />
    </main>
  );
}
