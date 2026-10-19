"use client"; // Recharts measures the page and handles hover

import {
  CartesianGrid,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
  type TooltipContentProps,
} from "recharts";
import { formatInt, formatPounds } from "@/lib/format";
import type { MapPoint, SegmentProfile } from "@/lib/types";

/** Hover card of one customer (no id: the sample only carries R, F, M). */
function CustomerTooltip({ active, payload }: TooltipContentProps) {
  const point = payload?.[0]?.payload as MapPoint | undefined;
  if (!active || !point) return null;
  return (
    <div className="chart-tooltip">
      <strong>{formatPounds(point.monetary)}</strong>
      {formatInt(point.frequency)} invoices, last one {formatInt(point.recency)} days before the
      end of the data
    </div>
  );
}

/**
 * Recency × frequency of a sample of customers. Only the selected segment is in
 * colour: four colours in one scatter cannot all be told apart (palette check).
 */
export default function SegmentScatter({
  points,
  selected,
}: {
  points: MapPoint[];
  selected: SegmentProfile;
}) {
  const others = points.filter((p) => p.segment !== selected.segment);
  const mine = points.filter((p) => p.segment === selected.segment);

  return (
    <>
      <ScatterChart
        responsive
        style={{ width: "100%", height: 360 }}
        margin={{ top: 8, right: 16, bottom: 24, left: 0 }}
      >
        <CartesianGrid className="grid" />
        <XAxis
          type="number"
          dataKey="recency"
          name="Days since last purchase"
          domain={[0, "dataMax"]}
          label={{ value: "Days since the last purchase", position: "insideBottom", offset: -16 }}
        />
        <YAxis
          type="number"
          dataKey="frequency"
          name="Invoices"
          scale="log"
          domain={[1, "dataMax"]}
          ticks={[1, 2, 5, 10, 20, 50, 100, 200]}
          width={60}
          label={{ value: "Invoices (log)", angle: -90, position: "insideLeft", offset: 4 }}
        />
        <ZAxis range={[14, 14]} />
        <Tooltip content={CustomerTooltip} cursor={false} />
        <Scatter data={others} className="dot-context" isAnimationActive={false} />
        <Scatter data={mine} className={`dot-seg-${selected.segment}`} isAnimationActive={false} />
      </ScatterChart>
      <ul className="legend" aria-label="Points">
        <li>
          <span className={`swatch seg-${selected.segment}`} aria-hidden="true" />
          {selected.segment_name} ({formatInt(mine.length)} in the sample)
        </li>
        <li>
          <span className="swatch" aria-hidden="true" />
          Other customers
        </li>
      </ul>
    </>
  );
}
