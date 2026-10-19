"use client"; // Recharts measures the page

import {
  ResponsiveContainer,
  Sankey,
  type SankeyLinkProps,
  type SankeyNodeProps,
} from "recharts";
import { formatPercent, productName } from "@/lib/format";
import { withoutMirrors } from "@/lib/rules";
import type { Rule } from "@/lib/types";

const MAX_FLOWS = 20;
const LABEL_CHARS = 30;

type FlowNode = { name: string; side: "left" | "right" };

/** "Jumbo bag red retrospot + Jumbo storage bag suki", cut to fit the margin. */
function label(names: string[]): string {
  const text = names.map(productName).join(" + ");
  return text.length > LABEL_CHARS ? `${text.slice(0, LABEL_CHARS - 1)}…` : text;
}

/**
 * Two separate columns: "if the basket has" (left) and "it also has" (right).
 * A product can appear on both sides as two nodes, so the graph never has a
 * cycle (Recharts loops forever on A → B → A).
 */
function toSankey(rules: Rule[]) {
  const nodes: FlowNode[] = [];
  const index = new Map<string, number>();
  function nodeOf(side: FlowNode["side"], key: string, name: string): number {
    const id = `${side}:${key}`;
    if (!index.has(id)) {
      index.set(id, nodes.length);
      nodes.push({ name, side });
    }
    return index.get(id)!;
  }
  const links = rules.map((rule) => ({
    source: nodeOf("left", rule.antecedent.join("+"), label(rule.antecedent_names)),
    target: nodeOf("right", rule.consequent, label([rule.consequent_name])),
    value: rule.support,
  }));
  return { nodes, links };
}

/** A node: bar plus its name, outside the flows. */
function FlowNodeShape({ x, y, width, height, payload }: SankeyNodeProps) {
  const node = payload as unknown as FlowNode;
  const left = node.side === "left";
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} className="sankey-node" />
      <text
        x={left ? x - 8 : x + width + 8}
        y={y + height / 2}
        textAnchor={left ? "end" : "start"}
        dominantBaseline="middle"
        className="sankey-label"
      >
        {node.name}
      </text>
    </g>
  );
}

/** A flow: width = support; its title gives the share of invoices. */
function FlowLink(props: SankeyLinkProps) {
  const { sourceX, sourceY, targetX, targetY, sourceControlX, targetControlX, linkWidth } =
    props;
  const source = props.payload.source as unknown as FlowNode;
  const target = props.payload.target as unknown as FlowNode;
  return (
    <path
      d={`M${sourceX},${sourceY} C${sourceControlX},${sourceY} ${targetControlX},${targetY} ${targetX},${targetY}`}
      strokeWidth={Math.max(linkWidth, 1)}
      className="sankey-link"
    >
      <title>
        {source.name} → {target.name}: {formatPercent(props.payload.value)} of orders
      </title>
    </path>
  );
}

/** The first rules of the table as flows (same filters and order as the table). */
export default function RuleFlows({ rules }: { rules: Rule[] }) {
  const shown = withoutMirrors(rules).slice(0, MAX_FLOWS);
  if (shown.length === 0) {
    return <p className="empty">No rule matches the filters. Lower the thresholds.</p>;
  }
  const height = Math.max(320, shown.length * 30);

  return (
    <>
      <p className="note status">
        The first {shown.length} pairs of the table (A → B and B → A count once), in the
        table order. Width: share of orders with the whole set.
      </p>
      <div className="scroll-x">
        <div className="sankey-frame">
          <ResponsiveContainer width="100%" height={height}>
            <Sankey
              data={toSankey(shown)}
              node={FlowNodeShape}
              link={FlowLink}
              nodePadding={12}
              nodeWidth={8}
              margin={{ top: 8, right: 220, bottom: 8, left: 220 }}
            />
          </ResponsiveContainer>
        </div>
      </div>
    </>
  );
}
