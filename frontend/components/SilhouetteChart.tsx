"use client"; // Recharts measures the page and handles hover

import { CartesianGrid, Line, LineChart, ReferenceLine, Tooltip, XAxis, YAxis } from "recharts";
import type { KReport } from "@/lib/types";

/** Silhouette for k = 2 to 8, with the k kept. */
export default function SilhouetteChart({ report }: { report: KReport }) {
  return (
    <>
      <p className="note status">
        Silhouette for each number of segments tried. Metric: {report.metric}. It falls
        slowly as k grows; k = {report.k} was kept because its {report.k} groups have a clear business
        meaning (recent or not, high or low value).
      </p>
      <LineChart
        responsive
        style={{ width: "100%", height: 260 }}
        data={report.scores}
        margin={{ top: 24, right: 24, bottom: 8, left: 0 }}
      >
        <CartesianGrid vertical={false} className="grid" />
        <XAxis dataKey="k" tickLine={false} />
        <YAxis width={48} domain={["auto", "auto"]} tickFormatter={(v: number) => v.toFixed(2)} />
        <Tooltip formatter={(value) => [Number(value).toFixed(3), "Silhouette"]} />
        <ReferenceLine
          x={report.k}
          className="threshold-line"
          label={{ value: `k = ${report.k} kept`, position: "top", className: "threshold-label" }}
        />
        <Line
          dataKey="silhouette"
          className="series-1"
          strokeWidth={2}
          dot={{ r: 4, className: "line-dot" }}
          isAnimationActive={false}
        />
      </LineChart>
    </>
  );
}
