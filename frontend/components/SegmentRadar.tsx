"use client"; // Recharts measures the page

import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  Tooltip,
} from "recharts";
import type { SegmentProfile } from "@/lib/types";

const AXES = [
  { key: "score_recency", label: "Recent" },
  { key: "score_frequency", label: "Frequent" },
  { key: "score_monetary", label: "Big spender" },
  { key: "score_basket", label: "Big baskets" },
  { key: "score_repurchase", label: "Likely to rebuy" },
] as const;

/** Five percentile scores (0-100); the selected segment filled, the others as outlines. */
export default function SegmentRadar({
  profiles,
  selected,
}: {
  profiles: SegmentProfile[];
  selected: SegmentProfile;
}) {
  const rows = AXES.map((axis) => ({
    axis: axis.label,
    ...Object.fromEntries(profiles.map((p) => [p.segment_name, Math.round(p[axis.key])])),
  }));
  const others = profiles.filter((p) => p.segment !== selected.segment);

  return (
    <RadarChart
      responsive
      style={{ width: "100%", height: 300 }}
      data={rows}
      outerRadius="72%"
    >
      <PolarGrid className="grid" />
      <PolarAngleAxis dataKey="axis" className="radar-axis" />
      <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
      {others.map((p) => (
        <Radar
          key={p.segment}
          dataKey={p.segment_name}
          className="radar-context"
          isAnimationActive={false}
        />
      ))}
      <Radar
        dataKey={selected.segment_name}
        className={`radar-seg-${selected.segment}`}
        isAnimationActive={false}
      />
      <Tooltip formatter={(value, name) => [`${value} / 100`, name]} />
    </RadarChart>
  );
}
