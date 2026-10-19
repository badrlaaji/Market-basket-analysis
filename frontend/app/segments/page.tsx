import { connection } from "next/server";
import SegmentsView from "@/components/SegmentsView";
import { fetchApi } from "@/lib/fastapi";
import { segmentsAnswer } from "@/lib/insights";
import type { GridCell, KReport, MapPoint, SegmentProfile } from "@/lib/types";

const MAP_POINTS = 1500; // enough to see the shapes, light enough for the browser

export default async function SegmentsPage() {
  await connection(); // render at request time: no FastAPI call during next build
  const [profiles, points, cells, kReport] = await Promise.all([
    fetchApi<SegmentProfile[]>("/segments"),
    fetchApi<MapPoint[]>(`/segments/map?n=${MAP_POINTS}`),
    fetchApi<GridCell[]>("/segments/grid"),
    fetchApi<KReport>("/segments/k"),
  ]);

  return (
    <main>
      <header className="page-head">
        <h1 className="question">Who are the customers?</h1>
        <p className="answer">{segmentsAnswer(profiles)}</p>
        <p className="lede">
          {profiles.length} groups built from how recently, how often and how much each customer
          bought, measured on the day after the last invoice. Pick a segment to see who they
          are and what they buy.
        </p>
      </header>
      <SegmentsView profiles={profiles} points={points} cells={cells} kReport={kReport} />
    </main>
  );
}
