"use client"; // Recharts measures the page

import {
  ResponsiveContainer,
  Sankey,
  type SankeyLinkProps,
  type SankeyNodeProps,
} from "recharts";
import { formatDate, formatInt, formatPercent } from "@/lib/format";
import type { SegmentProfile, Transitions } from "@/lib/types";

const NEW = -1; // segment_before of customers without a purchase back then

type FlowNode = { name: string; side: "left" | "right"; segment: number };

/** Two columns (before → now) so the graph has no cycle; segment order kept. */
function toSankey(transitions: Transitions, names: Map<number, string>) {
  const nodes: FlowNode[] = [];
  const index = new Map<string, number>();
  const sides = [
    ["left", [...new Set(transitions.flows.map((f) => f.segment_before))]],
    ["right", [...new Set(transitions.flows.map((f) => f.segment_now))]],
  ] as const;
  for (const [side, segments] of sides) {
    for (const segment of [...segments].sort((a, b) => a - b)) {
      index.set(`${side}:${segment}`, nodes.length);
      nodes.push({ name: names.get(segment) ?? "New customers", side, segment });
    }
  }
  const links = transitions.flows.map((f) => ({
    source: index.get(`left:${f.segment_before}`)!,
    target: index.get(`right:${f.segment_now}`)!,
    value: f.n_customers,
  }));
  return { nodes, links };
}

/** A node in its segment colour, with its name and size outside. */
function NodeShape({ x, y, width, height, payload }: SankeyNodeProps) {
  const node = payload as unknown as FlowNode & { value: number };
  const left = node.side === "left";
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        className={node.segment === NEW ? "sankey-node" : `migration-node seg-${node.segment}`}
      />
      <text
        x={left ? x - 8 : x + width + 8}
        y={y + height / 2}
        textAnchor={left ? "end" : "start"}
        dominantBaseline="middle"
        className="sankey-label"
      >
        {node.name} ({formatInt(node.value)})
      </text>
    </g>
  );
}

/** A flow coloured by the segment it comes from. */
function LinkShape(props: SankeyLinkProps) {
  const { sourceX, sourceY, targetX, targetY, sourceControlX, targetControlX, linkWidth } =
    props;
  const source = props.payload.source as unknown as FlowNode;
  const target = props.payload.target as unknown as FlowNode;
  return (
    <path
      d={`M${sourceX},${sourceY} C${sourceControlX},${sourceY} ${targetControlX},${targetY} ${targetX},${targetY}`}
      strokeWidth={Math.max(linkWidth, 1)}
      className={source.segment === NEW ? "migration-link" : `migration-link seg-${source.segment}`}
    >
      <title>
        {source.name} → {target.name}: {formatInt(props.payload.value)} customers
      </title>
    </path>
  );
}

/** Customers moving between segments in the last 90 days (same scaler, same centers). */
export default function MigrationFlows({
  transitions,
  profiles,
  focus,
}: {
  transitions: Transitions;
  profiles: SegmentProfile[];
  focus: SegmentProfile;
}) {
  const names = new Map(profiles.map((p) => [p.segment, p.segment_name]));
  const from = transitions.flows.filter((f) => f.segment_before === focus.segment);
  const total = from.reduce((sum, f) => sum + f.n_customers, 0);
  const stayed = from.find((f) => f.segment_now === focus.segment)?.n_customers ?? 0;
  const [moved] = from
    .filter((f) => f.segment_now !== focus.segment)
    .sort((a, b) => b.n_customers - a.n_customers);
  const newcomers = transitions.flows
    .filter((f) => f.segment_before === NEW)
    .reduce((sum, f) => sum + f.n_customers, 0);

  return (
    <>
      <p className="note status">
        {total > 0 &&
          `Of the ${formatInt(total)} ${focus.segment_name} of ${formatDate(transitions.date_before)}, ` +
            `${formatPercent(stayed / total, 0)} are still ${focus.segment_name} on ` +
            `${formatDate(transitions.date_now)}` +
            (moved
              ? `; ${formatPercent(moved.n_customers / total, 0)} became ${names.get(moved.segment_now)}. `
              : ". ")}
        {formatInt(newcomers)} customers bought for the first time in between. Both dates use
        the same scaler and the same KMeans centers.
      </p>
      <div className="scroll-x">
        <div className="sankey-frame">
          <ResponsiveContainer width="100%" height={380}>
            <Sankey
              data={toSankey(transitions, names)}
              node={NodeShape}
              link={LinkShape}
              sort={false}
              nodePadding={18}
              nodeWidth={10}
              margin={{ top: 8, right: 170, bottom: 8, left: 170 }}
            />
          </ResponsiveContainer>
        </div>
      </div>
    </>
  );
}
