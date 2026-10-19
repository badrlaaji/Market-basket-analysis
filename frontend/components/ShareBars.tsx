"use client"; // Recharts measures the page and handles hover

import { Bar, BarChart, CartesianGrid, LabelList, Tooltip, XAxis, YAxis } from "recharts";
import { formatPercent } from "@/lib/format";
import type { SegmentProfile } from "@/lib/types";

/** Share of the customers against share of the spending, per group. */
export default function ShareBars({ profiles }: { profiles: SegmentProfile[] }) {
  const rows = profiles.map((p) => ({
    name: p.segment_name,
    customers: p.customer_share,
    revenue: p.revenue_share,
  }));

  return (
    <>
      <ul className="legend" aria-label="Bars">
        <li>
          <span className="swatch" aria-hidden="true" />
          Share of the customers
        </li>
        <li>
          <span className="swatch series-1" aria-hidden="true" />
          Share of the spending
        </li>
      </ul>
      <BarChart
        responsive
        style={{ width: "100%", height: 280 }}
        data={rows}
        layout="vertical"
        margin={{ top: 8, right: 48, bottom: 0, left: 8 }}
        barGap={2}
      >
        <CartesianGrid horizontal={false} className="grid" />
        <XAxis type="number" domain={[0, 1]} tickFormatter={(v: number) => formatPercent(v, 0)} />
        <YAxis type="category" dataKey="name" width={84} tickLine={false} axisLine={false} />
        <Tooltip
          formatter={(value, name) => [
            formatPercent(Number(value)),
            name === "customers" ? "Customers" : "Spending",
          ]}
          cursor={{ className: "bar-cursor" }}
        />
        <Bar dataKey="customers" className="bar-context" maxBarSize={14} isAnimationActive={false}>
          <LabelList
            dataKey="customers"
            position="right"
            className="bar-label"
            formatter={(value) => formatPercent(Number(value), 0)}
          />
        </Bar>
        <Bar dataKey="revenue" className="bar-series-1" maxBarSize={14} isAnimationActive={false}>
          <LabelList
            dataKey="revenue"
            position="right"
            className="bar-label"
            formatter={(value) => formatPercent(Number(value), 0)}
          />
        </Bar>
      </BarChart>
    </>
  );
}
