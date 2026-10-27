"use client"; // the slider, the group and the order update the answer, the list and the address

import { useEffect, useState } from "react";
import AnalystDetails from "@/components/AnalystDetails";
import NextStep from "@/components/NextStep";
import ProbaHistogram from "@/components/ProbaHistogram";
import Term from "@/components/Term";
import {
  formatCompactPounds,
  formatDaysAgo,
  formatInt,
  formatPercent,
  formatPounds,
} from "@/lib/format";
import {
  THRESHOLD_MAX,
  THRESHOLD_MIN,
  THRESHOLD_STEP,
  atRiskExportQuery,
  atRiskQuery,
  segmentQuery,
  winBackSearch,
  type WinBackState,
} from "@/lib/queries";
import type { AtRiskPage, AtRiskSort, HistogramBin, SegmentProfile } from "@/lib/types";
import { useDebounce } from "@/lib/useDebounce";

type Shown = { query: string; page: AtRiskPage };
type Bins = { query: string; bins: HistogramBin[] };

const FOLDED_ROWS = 10; // rows shown before "Show all"
const SORT_LABELS: Record<AtRiskSort, string> = {
  stake: "Most money at stake",
  spend: "Highest spend",
};

/** GET a JSON route of Next.js; throws on an error status. */
async function getJson<T>(url: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`status ${response.status}`);
  return response.json() as Promise<T>;
}

/** Live answer, filters kept in the address, customers to call first, histogram for analysts. */
export default function WinBackList({
  initialState,
  initialPage,
  initialBins,
  profiles,
}: {
  initialState: WinBackState;
  initialPage: AtRiskPage;
  initialBins: HistogramBin[];
  profiles: SegmentProfile[];
}) {
  const [threshold, setThreshold] = useState(initialState.threshold);
  const [segment, setSegment] = useState(initialState.segment);
  const [sort, setSort] = useState(initialState.sort);
  const [shown, setShown] = useState<Shown>({
    query: atRiskQuery(initialState.threshold, initialState.segment, initialState.sort),
    page: initialPage,
  });
  const [histogram, setHistogram] = useState<Bins>({
    query: segmentQuery(initialState.segment),
    bins: initialBins,
  });
  const [error, setError] = useState("");
  const [unfolded, setUnfolded] = useState(false);

  const state: WinBackState = { threshold, segment, sort };
  const liveQuery = atRiskQuery(threshold, segment, sort);
  const query = useDebounce(liveQuery);
  const binsQuery = segmentQuery(segment);
  const loading = query !== shown.query || query !== liveQuery;
  const search = winBackSearch(state);

  // The address keeps the filters: a shared link or Back gives the same list.
  // replaceState, not the router: no new history entry, no server round trip.
  useEffect(() => {
    if (window.location.search !== search) {
      window.history.replaceState(null, "", `${window.location.pathname}${search}`);
    }
  }, [search]);

  useEffect(() => {
    if (query === shown.query) return; // the list already shows these filters
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
  const who = segmentName ? `${segmentName} customers` : "customers";
  const rows = unfolded ? customers : customers.slice(0, FOLDED_ROWS);
  const order = sort === "stake" ? "with the most money at stake" : "who spent the most";

  return (
    <>
      <header className="page-head">
        <h1 className="question">Who is about to stop buying?</h1>
        <p className={loading ? "answer is-loading" : "answer"} aria-live="polite">
          {formatInt(total)} {who} may stop buying. Together they spent{" "}
          {formatCompactPounds(revenue)}.
        </p>
        <p className="lede">
          They have less than a {formatPercent(threshold, 0)} chance of ordering in the 90 days
          after the date of the data. Choose who to contact first, then download the list for
          the team.
        </p>
      </header>

      <NextStep>
        Call the customers at the top of the list first, with a personal offer: they have the
        most money at stake.
      </NextStep>

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
            name="threshold"
            min={THRESHOLD_MIN}
            max={THRESHOLD_MAX}
            step={THRESHOLD_STEP}
            value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value))}
          />
        </label>
        <label className="field">
          Customer group
          <select
            name="segment"
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
        <label className="field">
          Contact first
          <select name="sort" value={sort} onChange={(e) => setSort(e.target.value as AtRiskSort)}>
            {(Object.keys(SORT_LABELS) as AtRiskSort[]).map((key) => (
              <option key={key} value={key}>
                {SORT_LABELS[key]}
              </option>
            ))}
          </select>
        </label>
        <a className="button" href={`/api/at-risk/export${atRiskExportQuery(state)}`} download>
          <span aria-hidden="true">↓</span> Download the list (CSV)
        </a>
      </div>
      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}

      <section aria-labelledby="list-title">
        <div className="section-head">
          <h2 id="list-title">Who to contact first</h2>
          <p className="note">
            <Term id="stake">Money at stake</Term> = spent × chance of not coming back
          </p>
        </div>
        <p className="note list-status">
          The {formatInt(rows.length)} {order}
          {total > customers.length ? `, of ${formatInt(total)}` : ""}
          {loading ? ", updating…" : "."}
        </p>
        <div className={loading ? "is-loading" : undefined}>
          {customers.length > 0 ? (
            <div className="table-wrap">
              <table className="win-back-table">
                <caption className="visually-hidden">
                  Customers to win back, {SORT_LABELS[sort].toLowerCase()} first
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Customer</th>
                    <th scope="col">Group</th>
                    <th scope="col">Chance of ordering</th>
                    <th scope="col">Last order</th>
                    <th
                      scope="col"
                      className="num"
                      aria-sort={sort === "stake" ? "descending" : undefined}
                    >
                      Money at stake
                    </th>
                    <th
                      scope="col"
                      className="num"
                      aria-sort={sort === "spend" ? "descending" : undefined}
                      title="Purchases minus cancelled products"
                    >
                      Spent (net)
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((customer) => (
                    <tr key={customer.customer_id}>
                      <td className="num-id">{customer.customer_id}</td>
                      <td>
                        <span
                          className={`swatch seg-${customer.segment}`}
                          aria-hidden="true"
                        />{" "}
                        {customer.segment_name}
                      </td>
                      <td>
                        <div className="cell-meter">
                          <span>{formatPercent(customer.proba_90d, 0)}</span>
                          <div className="meter" aria-hidden="true">
                            <span style={{ width: `${customer.proba_90d * 100}%` }} />
                          </div>
                        </div>
                      </td>
                      <td>{formatDaysAgo(customer.recency)}</td>
                      <td className={customer.stake < 0 ? "num loss" : "num strong"}>
                        {formatPounds(customer.stake)}
                      </td>
                      <td className={customer.monetary_net < 0 ? "num loss" : "num"}>
                        {formatPounds(customer.monetary_net)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty">
              <p>No customer with these filters. Move the slider to the right to widen it.</p>
              {segment !== null && (
                <p className="more">
                  <button type="button" onClick={() => setSegment(null)}>
                    Show every group
                  </button>
                </p>
              )}
            </div>
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
