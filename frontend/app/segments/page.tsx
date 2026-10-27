import { connection } from "next/server";
import NextStep from "@/components/NextStep";
import SegmentsView from "@/components/SegmentsView";
import { fetchApi } from "@/lib/fastapi";
import { segmentsAnswer } from "@/lib/insights";
import { parseSegment } from "@/lib/queries";
import type { GridCell, KReport, MapPoint, SegmentProfile, Transitions } from "@/lib/types";

const MAP_POINTS = 1500; // enough to see the shapes, light enough for the browser

export default async function SegmentsPage({ searchParams }: PageProps<"/segments">) {
  await connection(); // render at request time: no FastAPI call during next build
  const [profiles, points, cells, kReport, transitions] = await Promise.all([
    fetchApi<SegmentProfile[]>("/segments"),
    fetchApi<MapPoint[]>(`/segments/map?n=${MAP_POINTS}`),
    fetchApi<GridCell[]>("/segments/grid"),
    fetchApi<KReport>("/segments/k"),
    fetchApi<Transitions>("/segments/transitions"),
  ]);
  const requested = parseSegment((await searchParams).segment);
  const initialSegment = profiles.some((p) => p.segment === requested) ? requested : null;

  return (
    <main>
      <header className="page-head">
        <h1 className="question">Who are the customers?</h1>
        <p className="answer">{segmentsAnswer(profiles)}</p>
        <p className="lede">
          Every customer is placed in one of {profiles.length} groups, from how recently, how
          often and how much they ordered. Pick a group to see who they are and what they buy.
        </p>
      </header>
      <NextStep href="/win-back" action="See who to win back">
        Look after the Champions first, and contact the At risk customers before they stop
        buying for good.
      </NextStep>
      <SegmentsView
        profiles={profiles}
        points={points}
        cells={cells}
        kReport={kReport}
        transitions={transitions}
        initialSegment={initialSegment}
      />
    </main>
  );
}
