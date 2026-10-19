"use client"; // the threshold slider updates the list

import { useEffect, useState } from "react";
import { formatInt, formatPercent, formatPounds } from "@/lib/format";
import { atRiskQuery } from "@/lib/queries";
import type { AtRiskPage } from "@/lib/types";
import { useDebounce } from "@/lib/useDebounce";

type Shown = { query: string; page: AtRiskPage };

/** Threshold slider + customers to contact, highest net spend first (sorted by the API). */
export default function WinBackList({
  initialThreshold,
  initialPage,
}: {
  initialThreshold: number;
  initialPage: AtRiskPage;
}) {
  const [threshold, setThreshold] = useState(initialThreshold);
  const [shown, setShown] = useState<Shown>({
    query: atRiskQuery(initialThreshold),
    page: initialPage,
  });
  const [error, setError] = useState("");

  const query = useDebounce(atRiskQuery(threshold));
  const loading = query !== shown.query || query !== atRiskQuery(threshold);

  useEffect(() => {
    if (query === shown.query) return; // the list already shows this threshold
    const controller = new AbortController();
    fetch(`/api/at-risk${query}`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`status ${response.status}`);
        return response.json() as Promise<AtRiskPage>;
      })
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

  const { total, customers } = shown.page;

  return (
    <>
      <div className="controls">
        <label className="field">
          <span className="field-label">
            Chance of buying again below <output>{formatPercent(threshold, 0)}</output>
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
      </div>

      <p className="note status" aria-live="polite">
        {error ||
          `${formatInt(total)} customers below ${formatPercent(threshold, 0)}. Showing the ${formatInt(customers.length)} with the highest net spend${loading ? ", updating" : ""}.`}
      </p>

      <div className={loading ? "is-loading" : undefined}>
        {customers.length > 0 ? (
          <div className="table-wrap">
            <table>
              <caption className="visually-hidden">Customers to win back</caption>
              <thead>
                <tr>
                  <th scope="col">Customer ID</th>
                  <th scope="col">Segment</th>
                  <th scope="col">Chance of buying in 90 days</th>
                  <th scope="col" className="num" title="Purchases minus cancelled products">
                    Net spend
                  </th>
                  <th scope="col" className="num" title="Purchases only, as in the segments">
                    Gross spend
                  </th>
                </tr>
              </thead>
              <tbody>
                {customers.map((customer) => (
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
            No customer is below this threshold. Move the slider to the right.
          </p>
        )}
      </div>
    </>
  );
}
