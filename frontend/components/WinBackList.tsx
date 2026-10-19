"use client"; // the threshold slider and the segment filter update the chart and the list

import { useEffect, useState } from "react";
import AnalystDetails from "@/components/AnalystDetails";
import ProbaHistogram from "@/components/ProbaHistogram";
import Term from "@/components/Term";
import { formatCompactPounds, formatInt, formatPercent, formatPounds } from "@/lib/format";
import { atRiskQuery, segmentQuery } from "@/lib/queries";
import type { AtRiskPage, HistogramBin, SegmentProfile } from "@/lib/types";
import { useDebounce } from "@/lib/useDebounce";

type Shown = { query: string; page: AtRiskPage };
type Bins = { query: string; bins: HistogramBin[] };

const FOLDED_ROWS = 10; // rows shown before "Show all"

/** GET a JSON route of Next.js; throws on an error status. */
async function getJson<T>(url: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`status ${response.status}`);
  return response.json() as Promise<T>;
}

/** Live counters, customers to contact (highest net spend first), histogram for analysts. */
export default function WinBackList({
  initialThreshold,
  initialSegment,
  initialPage,
  initialBins,
  profiles,
}: {
  initialThreshold: number;
  initialSegment: number | null;
  initialPage: AtRiskPage;
  initialBins: HistogramBin[];
  profiles: SegmentProfile[];
}) {
  const [threshold, setThreshold] = useState(initialThreshold);
  const [segment, setSegment] = useState(initialSegment);
  const [shown, setShown] = useState<Shown>({
    query: atRiskQuery(initialThreshold, initialSegment),
    page: initialPage,
  });
  const [histogram, setHistogram] = useState<Bins>({
    query: segmentQuery(initialSegment),
    bins: initialBins,
  });
  const [error, setError] = useState("");
  const [unfolded, setUnfolded] = useState(false);

  const query = useDebounce(atRiskQuery(threshold, segment));
  const binsQuery = segmentQuery(segment);
  const loading = query !== shown.query || query !== atRiskQuery(threshold, segment);

  useEffect(() => {
    if (query === shown.query) return; // the list already shows this threshold
    const controller = new AbortController();
    getJson<AtRiskPage>(`/api/at-risk${query}`, controller.signal)
      .then((page) => {
        setShown({ query, page });
        setError("");
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setError(`Could not load the customers (${err instanceof Error ? err.message : err}).`);
      });
    return () => controller.abort();
  }, [query, shown.query]);

  useEffect(() => {
    if (binsQuery === histogram.query) return; // same segment: same histogram
    const controller = new AbortController();
    getJson<HistogramBin[]>(`/api/at-risk/histogram${binsQuery}`, controller.signal)
      .then((bins) => setHistogram({ query: binsQuery, bins }))
      .catch(() => {
        if (!controller.signal.aborted) setError("Could not load the histogram.");
      });
    return () => controller.abort();
  }, [binsQuery, histogram.query]);

  const { total, revenue_at_risk: revenue, customers } = shown.page;
  const segmentName = profiles.find((p) => p.segment === segment)?.segment_name;
  const scope = segmentName ? `${segmentName} customers` : "Customers";

  return (
    <>
      <div className="controls">
        <label className="field">
          <span className="field-label">
            <span>
              <Term id="probability">Chance of ordering again</Term>, below
            </span>
            <output>{formatPercent(threshold, 0)}</output>
          </span>
          <input
            type="range"
            min={0.05}
            max={0.9}
            step={0.05}
            value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value))}
          />
        </label>
        <label className="field">
          Customer group
          <select
            value={segment ?? ""}
            onChange={(e) => setSegment(e.target.value === "" ? null : Number(e.target.value))}
          >
            <option value="">All groups</option>
            {profiles.map((p) => (
              <option key={p.segment} value={p.segment}>
                {p.segment_name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <dl className={loading ? "counters is-loading" : "counters"} aria-live="polite">
        <div>
          <dt>{scope} to contact</dt>
          <dd>{formatInt(total)}</dd>
        </div>
        <div>
          <dt>
            What they spent in two years (<Term id="netSpend">net</Term>)
          </dt>
          <dd>{formatCompactPounds(revenue)}</dd>
        </div>
      </dl>
      {error && <p className="error-text">{error}</p>}

      <section aria-labelledby="list-title">
        <div className="section-head">
          <h2 id="list-title">Who to contact first</h2>
          <p className="note">
            The {formatInt(Math.min(customers.length, unfolded ? customers.length : FOLDED_ROWS))}{" "}
            who spent the most
            {loading ? ", updating" : ""}.
          </p>
        </div>
        <div className={loading ? "is-loading" : undefined}>
          {customers.length > 0 ? (
            <div className="table-wrap">
              <table>
                <caption className="visually-hidden">Customers to win back</caption>
                <thead>
                  <tr>
                    <th scope="col">Customer number</th>
                    <th scope="col">Group</th>
                    <th scope="col">Chance of ordering in 90 days</th>
                    <th scope="col" className="num" title="Purchases minus cancelled products">
                      Spent (net)
                    </th>
                    <th scope="col" className="num" title="Purchases only, as in the groups">
                      Before cancellations
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {(unfolded ? customers : customers.slice(0, FOLDED_ROWS)).map((customer) => (
                    <tr key={customer.customer_id}>
                      <td className="num-id">{customer.customer_id}</td>
                      <td>{customer.segment_name}</td>
                      <td>
                        <div className="cell-meter">
                          <span>{formatPercent(customer.proba_90d, 0)}</span>
                          <div className="meter" aria-hidden="true">
                            <span style={{ width: `${customer.proba_90d * 100}%` }} />
                          </div>
                        </div>
                      </td>
                      <td className={customer.monetary_net < 0 ? "num loss" : "num"}>
                        {formatPounds(customer.monetary_net)}
                      </td>
                      <td className="num">{formatPounds(customer.monetary)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="empty">
              No customer is below this chance. Move the slider to the right or pick another
              group.
            </p>
          )}
        </div>
        {!unfolded && customers.length > FOLDED_ROWS && (
          <p className="more">
            <button type="button" onClick={() => setUnfolded(true)}>
              Show all {formatInt(customers.length)} customers
            </button>
          </p>
        )}
      </section>

      <AnalystDetails>
        <h3 className="tab-title">
          How likely each {segmentName ? `${segmentName} customer` : "customer"} is to order
          again
        </h3>
        <div className={histogram.query === binsQuery ? undefined : "is-loading"}>
          <ProbaHistogram bins={histogram.bins} threshold={threshold} />
        </div>
        <p className="note">
          Customers per band of 5 points of <Term id="probability">chance</Term>. The coloured
          bars, left of the line, are the customers counted above. The chances run low in this
          season, so read them as a ranking.
        </p>
      </AnalystDetails>
    </>
  );
}
