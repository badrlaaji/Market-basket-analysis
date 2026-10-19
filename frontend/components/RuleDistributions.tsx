"use client"; // Recharts measures the page and handles hover

import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceArea,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatInt, formatLift, formatPercent } from "@/lib/format";
import { histogram, type Bin } from "@/lib/rules";
import type { Rule } from "@/lib/types";

/** One histogram (step area) with the threshold line and the excluded zone. */
function Distribution({
  title,
  bins,
  start,
  end,
  threshold,
  format,
  tick,
  kept,
  total,
}: {
  title: string;
  bins: Bin[];
  start: number;
  end: number;
  threshold: number;
  format: (value: number) => string;
  tick: (value: number) => string;
  kept: number;
  total: number;
}) {
  return (
    <figure className="distribution">
      <figcaption>
        <strong>{title}</strong> {formatInt(kept)} of {formatInt(total)} rules at{" "}
        {format(threshold)} or more.
      </figcaption>
      <AreaChart
        responsive
        style={{ width: "100%", height: 200 }}
        data={bins}
        margin={{ top: 8, right: 16, bottom: 0, left: 0 }}
      >
        <CartesianGrid vertical={false} className="grid" />
        <XAxis type="number" dataKey="x" domain={[start, end]} tickFormatter={tick} />
        <YAxis width={40} allowDecimals={false} tickLine={false} axisLine={false} />
        <ReferenceArea x1={start} x2={threshold} className="excluded-area" />
        <Area
          type="stepAfter"
          dataKey="n"
          name="Rules"
          className="series-1"
          isAnimationActive={false}
        />
        <ReferenceLine x={threshold} className="threshold-line" />
        <Tooltip
          labelFormatter={(value) => `From ${format(Number(value))}`}
          formatter={(value) => [formatInt(Number(value)), "Rules"]}
        />
      </AreaChart>
    </figure>
  );
}

/** Lift and confidence of every rule, with the current slider values. */
export default function RuleDistributions({
  rules,
  minConfidence,
  minLift,
}: {
  rules: Rule[];
  minConfidence: number;
  minLift: number;
}) {
  return (
    <div className="pair">
      <Distribution
        title="Lift."
        bins={histogram(rules.map((r) => r.lift), 0, 52, 2)}
        start={0}
        end={52}
        threshold={minLift}
        format={formatLift}
        tick={(value) => `${value}×`}
        kept={rules.filter((r) => r.lift >= minLift).length}
        total={rules.length}
      />
      <Distribution
        title="Confidence."
        bins={histogram(rules.map((r) => r.confidence), 0.2, 0.95, 0.05)}
        start={0.2}
        end={0.95}
        threshold={minConfidence}
        format={(value) => formatPercent(value, 0)}
        tick={(value) => formatPercent(value, 0)}
        kept={rules.filter((r) => r.confidence >= minConfidence).length}
        total={rules.length}
      />
    </div>
  );
}
