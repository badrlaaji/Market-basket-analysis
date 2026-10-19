import { connection } from "next/server";
import NextStep from "@/components/NextStep";
import WinBackList from "@/components/WinBackList";
import { fetchApi } from "@/lib/fastapi";
import { formatCompactPounds, formatInt, formatPercent } from "@/lib/format";
import { DEFAULT_THRESHOLD, atRiskQuery, segmentQuery } from "@/lib/queries";
import type { AtRiskPage, HistogramBin, SegmentProfile } from "@/lib/types";

/** "?segment=2" from a persona card → 2, if that segment exists; else every segment. */
function parseSegment(value: string | string[] | undefined, profiles: SegmentProfile[]) {
  const segment = Number(Array.isArray(value) ? value[0] : value);
  return profiles.some((p) => p.segment === segment) ? segment : null;
}

export default async function WinBackPage({ searchParams }: PageProps<"/win-back">) {
  await connection(); // render at request time: no FastAPI call during next build
  const profiles = await fetchApi<SegmentProfile[]>("/segments");
  const segment = parseSegment((await searchParams).segment, profiles);
  const [page, bins] = await Promise.all([
    fetchApi<AtRiskPage>(`/at-risk${atRiskQuery(DEFAULT_THRESHOLD, segment)}`),
    fetchApi<HistogramBin[]>(`/at-risk/histogram${segmentQuery(segment)}`),
  ]);
  const name = profiles.find((p) => p.segment === segment)?.segment_name;

  return (
    <main>
      <header className="page-head">
        <h1 className="question">Who is about to stop buying?</h1>
        <p className="answer">
          {formatInt(page.total)} {name ? `${name} customers` : "customers"} have less than a{" "}
          {formatPercent(DEFAULT_THRESHOLD, 0)} chance of ordering in the next 90 days. Together
          they spent {formatCompactPounds(page.revenue_at_risk)} in two years.
        </p>
        <p className="lede">
          A score gives every customer a chance of ordering again. Move the slider to choose
          how wide the campaign is; the list starts with those who spent the most, after
          cancellations.
        </p>
      </header>
      <NextStep>
        Contact the customers at the top of the list first, with a personal offer: they spent
        the most and are slipping away.
      </NextStep>
      <WinBackList
        initialThreshold={DEFAULT_THRESHOLD}
        initialSegment={segment}
        initialPage={page}
        initialBins={bins}
        profiles={profiles}
      />
    </main>
  );
}
