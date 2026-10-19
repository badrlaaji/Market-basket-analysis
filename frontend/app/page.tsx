import Link from "next/link";
import { connection } from "next/server";
import RevenueChart from "@/components/RevenueChart";
import Term from "@/components/Term";
import { fetchApi } from "@/lib/fastapi";
import {
  formatCompactPounds,
  formatDate,
  formatInt,
  formatMonth,
  formatPercent,
  formatPounds,
} from "@/lib/format";
import {
  concentrationInsight,
  guestShare,
  overviewAnswer,
  peakMonths,
  ruleSentence,
  seasonalityInsight,
  winBackInsight,
} from "@/lib/insights";
import { DEFAULT_THRESHOLD, atRiskQuery } from "@/lib/queries";
import type { AtRiskPage, Month, RulesPage, SegmentProfile, Stats } from "@/lib/types";

export default async function OverviewPage() {
  await connection(); // render at request time: no FastAPI call during next build
  const [stats, months, profiles, top, atRisk] = await Promise.all([
    fetchApi<Stats>("/stats"),
    fetchApi<Month[]>("/timeline"),
    fetchApi<SegmentProfile[]>("/segments"),
    fetchApi<RulesPage>("/rules?limit=1"),
    fetchApi<AtRiskPage>(`/at-risk${atRiskQuery(DEFAULT_THRESHOLD, null)}`),
  ]);
  const revenue = months.reduce((sum, month) => sum + month.revenue, 0);
  const [best] = peakMonths(months, 1);
  const partial = months.filter((month) => !month.complete);

  return (
    <main>
      <header className="page-head">
        <h1 className="question">What do two years of orders say?</h1>
        <p className="answer">{overviewAnswer(months, profiles)}</p>
        <p className="lede">
          Orders of a UK online gift shop from {formatDate(stats.first_date)} to{" "}
          {formatDate(stats.last_date)}. Pick a question below to see the answer in detail.
        </p>
      </header>

      <ul className="question-cards">
        {top.rules[0] && (
          <li className="question-card">
            <h2>Which products sell together?</h2>
            <p>{ruleSentence(top.rules[0])}</p>
            <Link className="button" href="/rules">
              See what is bought together
            </Link>
          </li>
        )}
        <li className="question-card">
          <h2>Who are my best customers?</h2>
          <p>{concentrationInsight(profiles)}</p>
          <Link className="button" href="/segments">
            Meet the customer groups
          </Link>
        </li>
        <li className="question-card">
          <h2>Who may stop buying?</h2>
          <p>{winBackInsight(atRisk.total, DEFAULT_THRESHOLD)}</p>
          <Link className="button button-primary" href="/win-back">
            See who to win back
          </Link>
        </li>
      </ul>

      <section className="panel chart-panel" aria-labelledby="revenue-title">
        <h2 id="revenue-title">Sales per month</h2>
        <p className="lede-small">{seasonalityInsight(months)}</p>
        <RevenueChart months={months} />
        <p className="note">
          Value of every order line kept after cleaning; cancelled orders are not subtracted.
          {partial.map((month) => (
            <span key={month.month}>
              {" "}
              {formatMonth(month.month)} is dashed: the data covers only part of it.
            </span>
          ))}
        </p>
        <details className="data-table">
          <summary>Show the numbers</summary>
          <div className="table-wrap">
            <table>
              <caption className="visually-hidden">Sales, orders and customers per month</caption>
              <thead>
                <tr>
                  <th scope="col">Month</th>
                  <th scope="col" className="num">Sales</th>
                  <th scope="col" className="num">Orders</th>
                  <th scope="col" className="num">Known customers</th>
                </tr>
              </thead>
              <tbody>
                {months.map((month) => (
                  <tr key={month.month}>
                    <th scope="row">
                      {formatMonth(month.month)}
                      {month.complete ? "" : " (partial)"}
                    </th>
                    <td className="num">{formatPounds(month.revenue)}</td>
                    <td className="num">{formatInt(month.n_invoices)}</td>
                    <td className="num">{formatInt(month.n_customers)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </section>

      <dl className="figures">
        <div>
          <dt>Sales</dt>
          <dd>{formatCompactPounds(revenue)}</dd>
          <dd className="figure-context">
            Best month {formatMonth(best.month)}: {formatCompactPounds(best.revenue)}
          </dd>
        </div>
        <div>
          <dt>Orders</dt>
          <dd>{formatInt(stats.invoices)}</dd>
          <dd className="figure-context">
            {formatPounds(revenue / stats.invoices)} per order on average
          </dd>
        </div>
        <div>
          <dt>Known customers</dt>
          <dd>{formatInt(stats.customers)}</dd>
          <dd className="figure-context">
            They bring {formatPercent(1 - guestShare(months, profiles), 0)} of the sales; the
            rest are guest orders
          </dd>
        </div>
        <div>
          <dt>
            <Term id="rule">Buying patterns</Term>
          </dt>
          <dd>{formatInt(stats.rules)}</dd>
          <dd className="figure-context">
            Found among {formatInt(stats.products_in_rules)} of the {formatInt(stats.products)}{" "}
            products
          </dd>
        </div>
      </dl>
    </main>
  );
}
