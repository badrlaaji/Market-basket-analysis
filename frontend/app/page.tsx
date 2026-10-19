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
  overviewAnswer,
  peakMonths,
  ruleSentence,
  seasonalityInsight,
} from "@/lib/insights";
import type { Month, RulesPage, SegmentProfile, Stats } from "@/lib/types";

export default async function OverviewPage() {
  await connection(); // render at request time: no FastAPI call during next build
  const [stats, months, profiles, top] = await Promise.all([
    fetchApi<Stats>("/stats"),
    fetchApi<Month[]>("/timeline"),
    fetchApi<SegmentProfile[]>("/segments"),
    fetchApi<RulesPage>("/rules?limit=1"),
  ]);
  const revenue = months.reduce((sum, month) => sum + month.revenue, 0);
  const [best] = peakMonths(months, 1);
  const partial = months.filter((month) => !month.complete);
  const model = stats.model;

  return (
    <main>
      <header className="page-head">
        <h1 className="question">What do two years of orders say?</h1>
        <p className="answer">{overviewAnswer(months, profiles)}</p>
        <p className="lede">
          Invoices of a UK online gift shop from {formatDate(stats.first_date)} to{" "}
          {formatDate(stats.last_date)}, turned into product rules, customer segments and a
          repurchase score.
        </p>
      </header>

      <section className="panel chart-panel" aria-labelledby="revenue-title">
        <h2 id="revenue-title">Revenue per month</h2>
        <RevenueChart months={months} />
        <p className="note">
          Quantity × price of every invoice line kept after cleaning; cancelled orders are
          not deducted.
          {partial.map((month) => (
            <span key={month.month}>
              {" "}
              {formatMonth(month.month)} is drawn dashed: the data covers only part of it.
            </span>
          ))}
        </p>
        <details className="data-table">
          <summary>Show the numbers</summary>
          <div className="table-wrap">
            <table>
              <caption className="visually-hidden">Revenue, invoices and customers per month</caption>
              <thead>
                <tr>
                  <th scope="col">Month</th>
                  <th scope="col" className="num">Revenue</th>
                  <th scope="col" className="num">Invoices</th>
                  <th scope="col" className="num">Identified customers</th>
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
          <dt>Revenue</dt>
          <dd>{formatCompactPounds(revenue)}</dd>
          <dd className="figure-context">
            Best month {formatMonth(best.month)}: {formatCompactPounds(best.revenue)}
          </dd>
        </div>
        <div>
          <dt>Invoices</dt>
          <dd>{formatInt(stats.invoices)}</dd>
          <dd className="figure-context">
            {formatPounds(revenue / stats.invoices)} per invoice on average
          </dd>
        </div>
        <div>
          <dt>Identified customers</dt>
          <dd>{formatInt(stats.customers)}</dd>
          <dd className="figure-context">
            {formatPercent(model.positive_rate_test, 0)} bought again within{" "}
            {model.horizon_days} days of {formatDate(model.test_date)}
          </dd>
        </div>
        <div>
          <dt>
            <Term id="rule">Association rules</Term>
          </dt>
          <dd>{formatInt(stats.rules)}</dd>
          <dd className="figure-context">
            Covering {formatInt(stats.products_in_rules)} of {formatInt(stats.products)}{" "}
            products
          </dd>
        </div>
      </dl>

      <section className="section" aria-labelledby="insights-title">
        <h2 id="insights-title">What to act on</h2>
        <ul className="insights">
          <li className="insight series-1">
            <p>{concentrationInsight(months, profiles)}</p>
            <Link href="/segments">Compare the segments</Link>
          </li>
          <li className="insight series-2">
            <p>{seasonalityInsight(months)}</p>
            <Link href="/win-back">See who is about to stop buying</Link>
          </li>
          {top.rules[0] && (
            <li className="insight series-3">
              <p>{ruleSentence(top.rules[0])}</p>
              <Link href="/rules">Explore the {formatInt(stats.rules)} rules</Link>
            </li>
          )}
        </ul>
      </section>
    </main>
  );
}
