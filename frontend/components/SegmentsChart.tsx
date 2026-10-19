"use client"; // clicking a segment changes the profile shown (no new API call)

import { useState } from "react";
import {
  Bar,
  BarChart,
  LabelList,
  Rectangle,
  Tooltip,
  XAxis,
  YAxis,
  type BarShapeProps,
  type TooltipContentProps,
} from "recharts";
import { formatInt, formatPercent, formatPounds } from "@/lib/format";
import type { SegmentProfile } from "@/lib/types";

const ROW_HEIGHT = 64; // px per segment bar

/** Hover card: value first, segment name second. */
function SegmentTooltip({ active, payload }: TooltipContentProps) {
  const profile = payload?.[0]?.payload as SegmentProfile | undefined;
  if (!active || !profile) return null;
  return (
    <div className="chart-tooltip">
      <strong>{formatInt(profile.n_customers)} customers</strong>
      {profile.segment_name}, {formatPercent(profile.share)} of all
    </div>
  );
}

/** Customers per segment (horizontal bars) and the RFM profile of the selected one. */
export default function SegmentsChart({ profiles }: { profiles: SegmentProfile[] }) {
  const [selected, setSelected] = useState(profiles[0]?.segment ?? 0);
  const profile = profiles.find((p) => p.segment === selected) ?? profiles[0];

  /** One bar; the selected segment gets the accent color (CSS). */
  function renderBar(props: BarShapeProps) {
    const row = props.payload as SegmentProfile;
    return (
      <Rectangle
        {...props}
        className={row.segment === selected ? "bar is-selected" : "bar"}
      />
    );
  }

  return (
    <div className="segments-layout">
      <section aria-labelledby="chart-title">
        <h2 id="chart-title" className="visually-hidden">
          Customers per segment
        </h2>
        <div className="segment-picker" role="group" aria-label="Choose a segment">
          {profiles.map((p) => (
            <button
              key={p.segment}
              type="button"
              aria-pressed={p.segment === selected}
              onClick={() => setSelected(p.segment)}
            >
              {p.segment_name}
            </button>
          ))}
        </div>
        <div className="chart">
          <BarChart
            responsive
            style={{ width: "100%", height: profiles.length * ROW_HEIGHT + 16 }}
            data={profiles}
            layout="vertical"
            margin={{ top: 0, right: 64, bottom: 0, left: 8 }}
            onClick={(state) => {
              const hit = profiles.find((p) => p.segment_name === state.activeLabel);
              if (hit) setSelected(hit.segment);
            }}
          >
            <XAxis type="number" dataKey="n_customers" hide />
            <YAxis
              type="category"
              dataKey="segment_name"
              width={88}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={SegmentTooltip} cursor={{ className: "bar-cursor" }} />
            <Bar
              dataKey="n_customers"
              maxBarSize={24}
              radius={[0, 4, 4, 0]}
              shape={renderBar}
              isAnimationActive={false}
            >
              <LabelList
                dataKey="n_customers"
                position="right"
                className="bar-label"
                formatter={(value) => formatInt(Number(value))}
              />
            </Bar>
          </BarChart>
        </div>
        <p className="note more">
          Click a bar or a button to see the profile. Segments come from KMeans on recency,
          frequency and spend.
        </p>
      </section>

      {profile && (
        <section className="panel" aria-live="polite" aria-labelledby="profile-title">
          <h2 id="profile-title">{profile.segment_name}</h2>
          <p className="profile-share">{formatPercent(profile.share)}</p>
          <p className="note status">
            of customers ({formatInt(profile.n_customers)} people)
          </p>
          <div className="table-wrap">
            <table>
              <caption className="visually-hidden">
                RFM profile of the {profile.segment_name} segment
              </caption>
              <thead>
                <tr>
                  <th scope="col">Measure</th>
                  <th scope="col" className="num">
                    Median
                  </th>
                  <th scope="col" className="num">
                    Mean
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">Days since last purchase</th>
                  <td className="num">{formatInt(Math.round(profile.recency_median))}</td>
                  <td className="num">{formatInt(Math.round(profile.recency_mean))}</td>
                </tr>
                <tr>
                  <th scope="row">Invoices</th>
                  <td className="num">{profile.frequency_median.toFixed(0)}</td>
                  <td className="num">{profile.frequency_mean.toFixed(1)}</td>
                </tr>
                <tr>
                  <th scope="row">Total spend</th>
                  <td className="num">{formatPounds(profile.monetary_median)}</td>
                  <td className="num">{formatPounds(profile.monetary_mean)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="note more">
            The mean is pulled up by a few very large buyers; the median is the typical
            customer.
          </p>
        </section>
      )}
    </div>
  );
}
