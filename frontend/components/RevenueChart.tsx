"use client"; // Recharts measures the page and handles hover

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceDot,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";
import { formatCompactPounds, formatInt, formatMonth, formatPounds } from "@/lib/format";
import { peakMonths } from "@/lib/insights";
import type { Month } from "@/lib/types";

type Point = Month & {
  label: string; // "Nov 2011"
  solid: number | null; // complete months
  dashed: number | null; // partial months and the link to their neighbour
};

/** One point per month; a partial month is drawn dashed, joined to its neighbour. */
function toPoints(months: Month[]): Point[] {
  return months.map((month, i) => {
    const nextToPartial = !months[i - 1]?.complete || !months[i + 1]?.complete;
    const edge = i === 0 || i === months.length - 1;
    return {
      ...month,
      label: formatMonth(month.month),
      solid: month.complete ? month.revenue : null,
      dashed: !month.complete || (nextToPartial && !edge) ? month.revenue : null,
    };
  });
}

/** Hover card: revenue first, then invoices and customers. */
function MonthTooltip({ active, payload }: TooltipContentProps) {
  const point = payload?.[0]?.payload as Point | undefined;
  if (!active || !point) return null;
  return (
    <div className="chart-tooltip">
      <strong>{formatPounds(point.revenue)}</strong>
      {point.label}
      {point.complete ? "" : " (partial month)"}
      <br />
      {formatInt(point.n_invoices)} invoices, {formatInt(point.n_customers)} identified customers
    </div>
  );
}

/** Monthly revenue with the two best complete months labelled. */
export default function RevenueChart({ months }: { months: Month[] }) {
  const points = toPoints(months);
  const peaks = peakMonths(months);

  return (
    <LineChart
      responsive
      style={{ width: "100%", height: 320 }}
      data={points}
      margin={{ top: 28, right: 16, bottom: 0, left: 8 }}
      accessibilityLayer
    >
      <CartesianGrid vertical={false} className="grid" />
      <XAxis dataKey="label" tickLine={false} minTickGap={24} />
      <YAxis
        width={64}
        tickLine={false}
        axisLine={false}
        tickFormatter={(value: number) => formatCompactPounds(value)}
        domain={[0, "auto"]}
      />
      <Tooltip content={MonthTooltip} cursor={{ className: "line-cursor" }} />
      <Line
        dataKey="solid"
        className="series-1"
        strokeWidth={2}
        dot={false}
        isAnimationActive={false}
      />
      <Line
        dataKey="dashed"
        className="series-1 is-partial"
        strokeWidth={2}
        strokeDasharray="5 5"
        dot={false}
        isAnimationActive={false}
      />
      {peaks.map((peak) => (
        <ReferenceDot
          key={peak.month}
          x={formatMonth(peak.month)}
          y={peak.revenue}
          r={4}
          className="peak-dot"
          label={{
            value: `${formatMonth(peak.month)}: ${formatCompactPounds(peak.revenue)}`,
            position: "top",
            className: "peak-label",
          }}
        />
      ))}
    </LineChart>
  );
}
