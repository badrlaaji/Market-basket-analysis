"use client"; // Recharts measures the page and handles hover and clicks

import {
  CartesianGrid,
  ReferenceLine,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
  type ScatterShapeProps,
  type TooltipContentProps,
} from "recharts";
import { formatLift, formatPercent, productName } from "@/lib/format";
import { LIFT_CLASSES, liftClass, ruleKey } from "@/lib/rules";
import type { Rule } from "@/lib/types";

type Point = Rule & { key: string; liftClass: number; kept: boolean };

/** Hover card: the rule, then its three measures. */
function RuleTooltip({ active, payload }: TooltipContentProps) {
  const point = payload?.[0]?.payload as Point | undefined;
  if (!active || !point) return null;
  return (
    <div className="chart-tooltip">
      <strong>
        {point.antecedent_names.map(productName).join(" + ")} → {productName(point.consequent_name)}
      </strong>
      Confidence {formatPercent(point.confidence, 0)}, lift {formatLift(point.lift)}, support{" "}
      {formatPercent(point.support)}
    </div>
  );
}

/** Colour scale of the points, as an HTML legend (readable and selectable). */
export function LiftLegend() {
  return (
    <ul className="legend" aria-label="Lift colour scale">
      {LIFT_CLASSES.map((liftRange, i) => (
        <li key={liftRange.label}>
          <span className={`swatch lift-${i}`} aria-hidden="true" />
          Lift {liftRange.label}
        </li>
      ))}
    </ul>
  );
}

/** Every rule: support (x) × confidence (y); size and colour = lift. */
export default function RulesScatter({
  rules,
  minConfidence,
  minLift,
  selectedKey,
  onSelect,
}: {
  rules: Rule[];
  minConfidence: number;
  minLift: number;
  selectedKey: string | null;
  onSelect: (key: string) => void;
}) {
  const points: Point[] = rules
    .map((rule) => ({
      ...rule,
      key: ruleKey(rule),
      liftClass: liftClass(rule.lift),
      kept: rule.confidence >= minConfidence && rule.lift >= minLift,
    }))
    .sort((a, b) => Number(a.kept) - Number(b.kept)); // filtered-out points drawn first

  /** One circle; class names carry the colour, the dimming and the selection. */
  function renderPoint(props: ScatterShapeProps) {
    const point = props.payload as Point;
    const classes = [`rule-dot lift-${point.liftClass}`];
    if (!point.kept) classes.push("is-dim");
    if (point.key === selectedKey) classes.push("is-selected");
    return (
      <circle cx={props.cx} cy={props.cy} r={props.width / 2} className={classes.join(" ")} />
    );
  }

  return (
    <ScatterChart
      responsive
      style={{ width: "100%", height: 380 }}
      margin={{ top: 16, right: 16, bottom: 24, left: 8 }}
    >
      <CartesianGrid className="grid" />
      <XAxis
        type="number"
        dataKey="support"
        name="Support"
        scale="log"
        domain={[0.009, 0.04]}
        ticks={[0.01, 0.015, 0.02, 0.03, 0.04]}
        tickFormatter={(value: number) => formatPercent(value)}
        label={{
          value: "Support: share of all orders (log scale)",
          position: "insideBottom",
          offset: -16,
        }}
      />
      <YAxis
        type="number"
        dataKey="confidence"
        name="Confidence"
        domain={[0.1, 1]} // room under the lowest threshold (20 %)
        ticks={[0.2, 0.4, 0.6, 0.8, 1]}
        width={48}
        tickFormatter={(value: number) => formatPercent(value, 0)}
      />
      <ZAxis type="number" dataKey="lift" range={[16, 300]} />
      <ReferenceLine
        y={minConfidence}
        className="threshold-line"
        label={{
          value: `Minimum confidence ${formatPercent(minConfidence, 0)}`,
          position: "insideTopRight",
          className: "threshold-label",
        }}
      />
      <Tooltip content={RuleTooltip} cursor={false} />
      <Scatter
        data={points}
        shape={renderPoint}
        onClick={(item) => onSelect((item.payload as Point).key)}
        isAnimationActive={false}
      />
    </ScatterChart>
  );
}
