"use client"; // the selected segment drives the scatter, the radar and the persona card

import { useState } from "react";
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
import type { GridCell, KReport, MapPoint, SegmentProfile } from "@/lib/types";

/** Segment picker, three main charts, the persona card and the detail tabs. */
export default function SegmentsView({
  profiles,
  points,
  cells,
  kReport,
}: {
  profiles: SegmentProfile[];
  points: MapPoint[];
  cells: GridCell[];
  kReport: KReport;
}) {
  const [segment, setSegment] = useState(topRevenueSegment(profiles).segment);
  const selected = profiles.find((p) => p.segment === segment) ?? profiles[0];

  return (
    <>
      <div className="segment-picker" role="group" aria-label="Choose a segment">
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
        <section className="panel chart-panel" aria-labelledby="map-title">
          <h2 id="map-title">
            Where the {selected.segment_name} sit: <Term id="recency">recency</Term> and{" "}
            <Term id="frequency">frequency</Term>
          </h2>
          <SegmentScatter points={points} selected={selected} />
          <p className="note">
            A sample of {formatInt(points.length)} customers, each segment keeping its share.
          </p>
        </section>
        <aside className="panel">
          <PersonaCard profile={selected} />
        </aside>
      </div>

      <div className="pair section">
        <section aria-labelledby="share-title" className="figure-block">
          <h2 id="share-title">Customers against revenue</h2>
          <ShareBars profiles={profiles} />
        </section>
        <section aria-labelledby="radar-title" className="figure-block">
          <h2 id="radar-title">
            Profile of the {selected.segment_name} (<Term id="percentile">percentile</Term>)
          </h2>
          <SegmentRadar profiles={profiles} selected={selected} />
          <p className="note">Filled: {selected.segment_name}. Outlines: the other segments.</p>
        </section>
      </div>

      <section className="section" aria-labelledby="segment-details">
        <h2 id="segment-details">Look closer</h2>
        <Tabs
          label="Segment details"
          tabs={[
            { id: "grid", label: "RFM grid", content: <RfmGrid cells={cells} profiles={profiles} /> },
            { id: "treemap", label: "Revenue map", content: <RevenueTreemap profiles={profiles} /> },
            {
              id: "k",
              label: "Choosing the number of segments",
              content: <SilhouetteChart report={kReport} />,
            },
          ]}
        />
      </section>
    </>
  );
}
