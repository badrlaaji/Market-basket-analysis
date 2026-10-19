import { connection } from "next/server";
import ModelCharts from "@/components/ModelCharts";
import NextStep from "@/components/NextStep";
import { fetchApi } from "@/lib/fastapi";
import { formatDate } from "@/lib/format";
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
        <h1 className="question">Can we trust the score?</h1>
        <p className="answer">{modelAnswer(m, report.calibration)}</p>
        <p className="lede">
          The score was built with the orders up to {formatDate(m.test_date)}, then checked
          on the next {m.horizon_days} days, which it had never seen: did the customers it
          ranked first really order again?
        </p>
      </header>
      <NextStep href="/win-back" action="See who to win back">
        Use the score to decide who to contact first. It ranks customers well, but its
        chances are not an exact forecast.
      </NextStep>
      <ModelCharts
        report={report}
        note={
          <p className="callout">
            <strong>Good to know.</strong> {seasonNote(m, months)}
          </p>
        }
      />
    </main>
  );
}
