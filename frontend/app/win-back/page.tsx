import { connection } from "next/server";
import WinBackList from "@/components/WinBackList";
import { fetchApi } from "@/lib/fastapi";
import { atRiskQuery, parseWinBack, segmentQuery, type WinBackState } from "@/lib/queries";
import type { AtRiskPage, HistogramBin, SegmentProfile } from "@/lib/types";

/** The customers and the histogram of one state of the page, fetched together. */
function fetchList(state: WinBackState) {
  return Promise.all([
    fetchApi<AtRiskPage>(`/at-risk${atRiskQuery(state.threshold, state.segment, state.sort)}`),
    fetchApi<HistogramBin[]>(`/at-risk/histogram${segmentQuery(state.segment)}`),
  ]);
}

export default async function WinBackPage({ searchParams }: PageProps<"/win-back">) {
  await connection(); // render at request time: no FastAPI call during next build
  let state = parseWinBack(await searchParams);
  // One round trip: the groups, the list and the histogram in parallel
  const [profiles, list] = await Promise.all([
    fetchApi<SegmentProfile[]>("/segments"),
    fetchList(state),
  ]);
  let [page, bins] = list;
  // Then check the group: an unknown one (old link) falls back to every group
  if (state.segment !== null && !profiles.some((p) => p.segment === state.segment)) {
    state = { ...state, segment: null };
    [page, bins] = await fetchList(state);
  }

  // The answer follows the slider: the client component renders the page head too
  return (
    <main>
      <WinBackList initialState={state} initialPage={page} initialBins={bins} profiles={profiles} />
    </main>
  );
}
