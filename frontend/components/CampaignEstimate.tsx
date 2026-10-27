"use client"; // the rate is chosen by the shop manager

import { useState } from "react";
import { formatCompactPounds } from "@/lib/format";
import type { AtRiskPage } from "@/lib/types";

// "1 in 10" by default: a low rate, so the sum is not read as a promise
const RATES = [20, 10, 5];

/** What the campaign could bring back, from a rate the shop manager picks (not from the model). */
export default function CampaignEstimate({ page }: { page: AtRiskPage }) {
  const [oneIn, setOneIn] = useState(10);
  if (page.total === 0 || page.orders === 0) return null;
  const orderValue = page.revenue_at_risk / page.orders; // their usual order value, net
  const estimate = (page.total / oneIn) * orderValue;

  return (
    <aside className="estimate" aria-label="Campaign estimate">
      <label className="estimate-rate">
        If
        <select value={oneIn} onChange={(e) => setOneIn(Number(e.target.value))}>
          {RATES.map((rate) => (
            <option key={rate} value={rate}>
              1 in {rate}
            </option>
          ))}
        </select>
        order again
      </label>
      <div>
        <p aria-live="polite">
          at their usual order value, that is about{" "}
          <strong>{formatCompactPounds(estimate)}</strong> of sales.
        </p>
        <p className="note">An assumption you choose, not a forecast of the model.</p>
      </div>
    </aside>
  );
}
