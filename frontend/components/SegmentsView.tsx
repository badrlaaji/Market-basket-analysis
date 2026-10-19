"use client"; // the selected group drives the persona card and the analyst charts

import { useState } from "react";
import AnalystDetails from "@/components/AnalystDetails";
import MigrationFlows from "@/components/MigrationFlows";
import PersonaCard from "@/components/PersonaCard";
import RevenueTreemap from "@/components/RevenueTreemap";
import RfmGrid from "@/components/RfmGrid";
import SegmentRadar from "@/components/SegmentRadar";
import SegmentScatter from "@/components/SegmentScatter";
import ShareBars from "@/components/ShareBars";
import SilhouetteChart from "@/components/SilhouetteChart";
import Tabs from "@/components/Tabs";
import Term from "@/components/Term";
import { formatInt } from "@/lib/format";
import { topRevenueSegment } from "@/lib/insights";
import type { GridCell, KReport, MapPoint, SegmentProfile, Transitions } from "@/lib/types";

/** Group picker, share of customers against spending, the persona card, then analyst tabs. */
export default function SegmentsView({
  profiles,
  points,
  cells,
  kReport,
  transitions,
}: {
  profiles: SegmentProfile[];
  points: MapPoint[];
  cells: GridCell[];
  kReport: KReport;
  transitions: Transitions;
}) {
  const [segment, setSegment] = useState(topRevenueSegment(profiles).segment);
  const selected = profiles.find((p) => p.segment === segment) ?? profiles[0];

  return (
    <>
      <div className="segment-picker" role="group" aria-label="Choose a group">
        {profiles.map((p) => (
          <button
            key={p.segment}
            type="button"
            aria-pressed={p.segment === segment}
            onClick={() => setSegment(p.segment)}
          >
            <span className={`swatch seg-${p.segment}`} aria-hidden="true" /> {p.segment_name}
          </button>
        ))}
      </div>

      <div className="split">
        <section className="panel chart-panel" aria-labelledby="share-title">
          <h2 id="share-title">Share of the customers, share of the spending</h2>
          <ShareBars profiles={profiles} />
          <p className="note">
            Read each pair of bars: a group with a short grey bar and a long coloured bar
            brings much more than its size.
          </p>
        </section>
        <aside className="panel">
          <PersonaCard profile={selected} />
        </aside>
      </div>

      <AnalystDetails>
        <Tabs
          label="Group details"
          tabs={[
            {
              id: "map",
              label: "Where customers sit",
              content: (
                <>
                  <h3 className="tab-title">
                    The {selected.segment_name} by <Term id="recency">last order</Term> and{" "}
                    <Term id="frequency">number of orders</Term>
                  </h3>
                  <SegmentScatter points={points} selected={selected} />
                  <p className="note">
                    A sample of {formatInt(points.length)} customers, each group keeping its
                    share.
                  </p>
                </>
              ),
            },
            {
              id: "radar",
              label: "Group profile",
              content: (
                <>
                  <h3 className="tab-title">
                    The {selected.segment_name} against all customers (
                    <Term id="percentile">rank</Term>)
                  </h3>
                  <SegmentRadar profiles={profiles} selected={selected} />
                  <p className="note">
                    Filled: {selected.segment_name}. Outlines: the other groups.
                  </p>
                </>
              ),
            },
            { id: "grid", label: "RFM grid", content: <RfmGrid cells={cells} profiles={profiles} /> },
            { id: "treemap", label: "Spending map", content: <RevenueTreemap profiles={profiles} /> },
            {
              id: "migration",
              label: "Moves in 90 days",
              content: (
                <MigrationFlows transitions={transitions} profiles={profiles} focus={selected} />
              ),
            },
            {
              id: "k",
              label: `Why ${kReport.k} groups`,
              content: <SilhouetteChart report={kReport} />,
            },
          ]}
        />
      </AnalystDetails>
    </>
  );
}
