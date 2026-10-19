"use client"; // the PR / ROC switch is local state; Recharts handles hover

import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ErrorBar,
  LabelList,
  Line,
  LineChart,
  ReferenceLine,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import Term from "@/components/Term";
import { formatInt, formatPercent } from "@/lib/format";
import type { ModelReport } from "@/lib/types";

// Names of the 7 features of ml/repurchase.py, for people
const FEATURE_LABELS: Record<string, string> = {
  recency: "Days since the last purchase",
  frequency: "Number of invoices",
  monetary: "Total spend",
  tenure: "Days since the first purchase",
  avg_basket: "Average invoice value",
  n_products: "Distinct products bought",
  invoices_90d: "Invoices in the last 90 days",
};

const pct = (value: number) => formatPercent(value, 0);

/** PR or ROC curves of the model and the baseline, with the random level. */
function Curves({ report }: { report: ModelReport }) {
  const [kind, setKind] = useState<"pr" | "roc">("pr");
  const m = report.metrics;
  const pr = kind === "pr";
  const curves = report[kind];

  return (
    <>
      <div className="segment-picker" role="group" aria-label="Curve">
        <button type="button" aria-pressed={pr} onClick={() => setKind("pr")}>
          Precision-recall
        </button>
        <button type="button" aria-pressed={!pr} onClick={() => setKind("roc")}>
          ROC
        </button>
      </div>
      <ul className="legend" aria-label="Lines">
        <li>
          <span className="swatch series-1" aria-hidden="true" />
          XGBoost, {pr ? "PR-AUC" : "ROC-AUC"}{" "}
          {(pr ? m.pr_auc_model : m.roc_auc_model).toFixed(3)}
        </li>
        <li>
          <span className="swatch series-2" aria-hidden="true" />
          Recency baseline {(pr ? m.pr_auc_baseline : m.roc_auc_baseline).toFixed(3)}
        </li>
      </ul>
      <LineChart
        responsive
        style={{ width: "100%", maxWidth: 520, aspectRatio: 1.15 }}
        margin={{ top: 8, right: 16, bottom: 24, left: 0 }}
      >
        <CartesianGrid className="grid" />
        <XAxis
          type="number"
          dataKey="x"
          domain={[0, 1]}
          ticks={[0, 0.25, 0.5, 0.75, 1]}
          tickFormatter={pct}
          label={{
            value: pr ? "Recall: share of real buyers found" : "False positive rate",
            position: "insideBottom",
            offset: -16,
          }}
        />
        <YAxis
          type="number"
          domain={[0, 1]}
          ticks={[0, 0.25, 0.5, 0.75, 1]}
          tickFormatter={pct}
          width={64}
          label={{
            value: pr ? "Precision" : "True positive rate",
            angle: -90,
            position: "insideLeft",
            offset: 12,
          }}
        />
        {pr ? (
          <ReferenceLine
            y={m.positive_rate_test}
            className="threshold-line"
            label={{ value: "Random", position: "insideBottomLeft", className: "threshold-label" }}
          />
        ) : (
          <ReferenceLine
            segment={[
              { x: 0, y: 0 },
              { x: 1, y: 1 },
            ]}
            className="threshold-line"
            label={{ value: "Random", position: "insideTop", className: "threshold-label" }}
          />
        )}
        <Line
          data={curves.baseline}
          dataKey="y"
          className="series-2"
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
        />
        <Line
          data={curves.model}
          dataKey="y"
          className="series-1"
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </>
  );
}

/** Gain of each feature, largest first. */
function Importances({ report }: { report: ModelReport }) {
  const rows = report.importances.map((row) => ({
    name: FEATURE_LABELS[row.feature] ?? row.feature,
    importance: row.importance,
  }));
  return (
    <BarChart
      responsive
      style={{ width: "100%", height: rows.length * 40 + 16 }}
      data={rows}
      layout="vertical"
      margin={{ top: 0, right: 48, bottom: 0, left: 8 }}
    >
      <XAxis type="number" hide domain={[0, "dataMax"]} />
      <YAxis type="category" dataKey="name" width={190} tickLine={false} axisLine={false} />
      <Tooltip formatter={(value) => [pct(Number(value)), "Share of the gain"]} cursor={{ className: "bar-cursor" }} />
      <Bar dataKey="importance" className="bar-series-1" maxBarSize={18} isAnimationActive={false}>
        <LabelList
          dataKey="importance"
          position="right"
          className="bar-label"
          formatter={(value) => pct(Number(value))}
        />
      </Bar>
    </BarChart>
  );
}

/** Mean predicted probability against the observed rate, per decile, with 95 % intervals. */
function Calibration({ report }: { report: ModelReport }) {
  return (
    <ScatterChart
      responsive
      style={{ width: "100%", maxWidth: 520, aspectRatio: 1.15 }}
      margin={{ top: 8, right: 16, bottom: 24, left: 0 }}
    >
      <CartesianGrid className="grid" />
      <XAxis
        type="number"
        dataKey="proba_mean"
        domain={[0, 1]}
        ticks={[0, 0.25, 0.5, 0.75, 1]}
        tickFormatter={pct}
        label={{ value: "Predicted probability (mean)", position: "insideBottom", offset: -16 }}
      />
      <YAxis
        type="number"
        dataKey="rate"
        domain={[0, 1]}
        ticks={[0, 0.25, 0.5, 0.75, 1]}
        tickFormatter={pct}
        width={64}
        label={{ value: "Really bought again", angle: -90, position: "insideLeft", offset: 12 }}
      />
      <ZAxis range={[60, 60]} />
      <ReferenceLine
        segment={[
          { x: 0, y: 0 },
          { x: 1, y: 1 },
        ]}
        className="threshold-line"
        label={{ value: "Perfect calibration", position: "insideTop", className: "threshold-label" }}
      />
      <Tooltip
        formatter={(value, name) => [pct(Number(value)), name === "rate" ? "Observed" : "Predicted"]}
        cursor={false}
      />
      <Scatter
        data={report.calibration}
        className="dot-series-1"
        line
        isAnimationActive={false}
      >
        <ErrorBar dataKey="ci95" direction="y" width={4} className="error-bar" />
      </Scatter>
    </ScatterChart>
  );
}

/** The three model charts; at most three visuals on the page. */
export default function ModelCharts({ report }: { report: ModelReport }) {
  const above = report.calibration.filter((b) => b.rate - b.ci95 > b.proba_mean).length;
  return (
    <>
      <div className="pair">
        <section className="panel chart-panel" aria-labelledby="curves-title">
          <h2 id="curves-title">
            Finding the future buyers (<Term id="prAuc">PR-AUC</Term>,{" "}
            <Term id="rocAuc">ROC-AUC</Term>)
          </h2>
          <Curves report={report} />
        </section>
        <section className="panel chart-panel" aria-labelledby="calibration-title">
          <h2 id="calibration-title">
            Are the probabilities right? (<Term id="calibration">calibration</Term>)
          </h2>
          <Calibration report={report} />
          <p className="note">
            Each point is a tenth of the{" "}
            {formatInt(report.calibration.reduce((sum, b) => sum + b.n, 0))} test customers. In {above} of {report.calibration.length} tenths the real rate is above
            the prediction, beyond the 95% interval.
          </p>
        </section>
      </div>
      <section className="section figure-block" aria-labelledby="importance-title">
        <h2 id="importance-title">What the model looks at</h2>
        <Importances report={report} />
        <p className="note">Share of the total gain of the trees, per feature.</p>
      </section>
    </>
  );
}
