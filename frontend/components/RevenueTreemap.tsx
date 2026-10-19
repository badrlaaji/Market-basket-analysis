"use client"; // Recharts measures the page

import { ResponsiveContainer, Tooltip, Treemap, type TreemapNode } from "recharts";
import { formatCompactPounds, formatPounds } from "@/lib/format";
import type { SegmentProfile } from "@/lib/types";

/** One rectangle per segment and frequency band; label only when it fits. */
function Cell(node: TreemapNode) {
  const { depth, x, y, width, height, name } = node;
  if (depth !== 2) return <g />; // the segments are drawn by their bands
  const segment = node.segment as number;
  const fits = width > 70 && height > 34;
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} className={`treemap-cell seg-${segment}`} />
      {fits && (
        <text x={x + 8} y={y + 18} className="treemap-label">
          {`${node.segment_name as string}, ${name} inv.`}
          <tspan x={x + 8} dy={16}>
            {formatCompactPounds(node.value)}
          </tspan>
        </text>
      )}
    </g>
  );
}

/** Revenue by segment, split by number of invoices: where the money comes from. */
export default function RevenueTreemap({ profiles }: { profiles: SegmentProfile[] }) {
  const data = profiles.map((p) => ({
    name: p.segment_name,
    children: p.revenue_by_band.map((band) => ({
      name: band.frequency_band.replace("-", "–"),
      revenue: band.revenue,
      segment: p.segment,
      segment_name: p.segment_name,
    })),
  }));

  return (
    <>
      <p className="note status">
        Area = revenue. Each segment is split by the number of invoices of its customers.
      </p>
      <ResponsiveContainer width="100%" height={360}>
        <Treemap
          data={data}
          dataKey="revenue"
          content={Cell}
          aspectRatio={4 / 3}
          isAnimationActive={false}
        >
          <Tooltip
            formatter={(value, _name, item) => [
              formatPounds(Number(value)),
              `${(item.payload as { segment_name: string }).segment_name}, ${(item.payload as { name: string }).name} invoices`,
            ]}
          />
        </Treemap>
      </ResponsiveContainer>
    </>
  );
}
