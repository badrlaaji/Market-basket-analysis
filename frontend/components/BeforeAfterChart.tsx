"use client"; // Recharts measures the page and handles hover

import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";
import { formatPercent, productName } from "@/lib/format";
import type { Recommendation } from "@/lib/types";

const ROW_HEIGHT = 56;
const NAME_CHARS = 24;

type Row = { name: string; before: number; after: number };

/** Hover card: both rates of one product. */
function RateTooltip({ active, payload }: TooltipContentProps) {
  const row = payload?.[0]?.payload as Row | undefined;
  if (!active || !row) return null;
  return (
    <div className="chart-tooltip">
      <strong>{row.name}</strong>
      In {formatPercent(row.before)} of all baskets, {formatPercent(row.after, 0)} of baskets
      like yours
    </div>
  );
}

/** P(product) in all baskets against P(product | this basket), per suggestion. */
export default function BeforeAfterChart({ items }: { items: Recommendation[] }) {
  const rows: Row[] = items.map((item) => {
    const name = productName(item.description);
    return {
      name: name.length > NAME_CHARS ? `${name.slice(0, NAME_CHARS - 1)}…` : name,
      before: item.base_rate,
      after: item.confidence,
    };
  });

  return (
    <>
      <ul className="legend" aria-label="Bars">
        <li>
          <span className="swatch" aria-hidden="true" />
          In all baskets
        </li>
        <li>
          <span className="swatch series-1" aria-hidden="true" />
          In baskets like yours
        </li>
      </ul>
      <BarChart
        responsive
        style={{ width: "100%", height: rows.length * ROW_HEIGHT + 24 }}
        data={rows}
        layout="vertical"
        margin={{ top: 8, right: 48, bottom: 0, left: 8 }}
        barGap={2}
      >
        <CartesianGrid horizontal={false} className="grid" />
        <XAxis type="number" domain={[0, 1]} tickFormatter={(v: number) => formatPercent(v, 0)} />
        <YAxis type="category" dataKey="name" width={170} tickLine={false} axisLine={false} />
        <Tooltip content={RateTooltip} cursor={{ className: "bar-cursor" }} />
        <Bar dataKey="before" className="bar-context" maxBarSize={14} isAnimationActive={false}>
          <LabelList
            dataKey="before"
            position="right"
            className="bar-label"
            formatter={(value) => formatPercent(Number(value))}
          />
        </Bar>
        <Bar dataKey="after" className="bar-series-1" maxBarSize={14} isAnimationActive={false}>
          <LabelList
            dataKey="after"
            position="right"
            className="bar-label"
            formatter={(value) => formatPercent(Number(value), 0)}
          />
        </Bar>
      </BarChart>
    </>
  );
}
