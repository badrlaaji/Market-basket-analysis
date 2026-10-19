"use client"; // Recharts measures the page and handles hover

import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  Rectangle,
  Tooltip,
  XAxis,
  YAxis,
  type BarShapeProps,
  type TooltipContentProps,
} from "recharts";
import { formatInt, formatPercent, formatPounds } from "@/lib/format";
import type { HistogramBin } from "@/lib/types";

type Row = HistogramBin & { label: string; below: boolean };

/** Hover card: customers and net spend of one probability bin. */
function BinTooltip({ active, payload }: TooltipContentProps) {
  const row = payload?.[0]?.payload as Row | undefined;
  if (!active || !row) return null;
  return (
    <div className="chart-tooltip">
      <strong>{formatInt(row.n_customers)} customers</strong>
      Chance of buying again {formatPercent(row.start, 0)} to {formatPercent(row.end, 0)}
      <br />
      Net spend {formatPounds(row.monetary_net)}
    </div>
  );
}

/** Customers per repurchase probability; bins under the threshold are highlighted. */
export default function ProbaHistogram({
  bins,
  threshold,
}: {
  bins: HistogramBin[];
  threshold: number;
}) {
  // Bins start on multiples of 0.05, like the slider: a bin is either fully in or out
  const rows: Row[] = bins.map((bin) => ({
    ...bin,
    label: formatPercent(bin.start, 0),
    below: bin.end <= threshold + 1e-9,
  }));

  /** One bar; under the threshold = series colour, above = context grey (CSS). */
  function renderBar(props: BarShapeProps) {
    const row = props.payload as Row;
    return <Rectangle {...props} className={row.below ? "bar-series-2" : "bar-context"} />;
  }

  return (
    <BarChart
      responsive
      style={{ width: "100%", height: 260 }}
      data={rows}
      margin={{ top: 24, right: 16, bottom: 8, left: 0 }}
      barCategoryGap={1}
    >
      <CartesianGrid vertical={false} className="grid" />
      <XAxis dataKey="label" tickLine={false} interval={1} />
      <YAxis width={48} allowDecimals={false} tickLine={false} axisLine={false} />
      <Tooltip content={BinTooltip} cursor={{ className: "bar-cursor" }} />
      <Bar dataKey="n_customers" shape={renderBar} isAnimationActive={false} />
      <ReferenceLine
        x={formatPercent(threshold, 0)}
        position="start"
        className="threshold-line"
        label={{
          value: `Threshold ${formatPercent(threshold, 0)}`,
          position: "top",
          className: "threshold-label",
        }}
      />
    </BarChart>
  );
}
