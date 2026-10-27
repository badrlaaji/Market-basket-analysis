import Link from "next/link";
import { connection } from "next/server";
import RevenueChart from "@/components/RevenueChart";
import { fetchApi } from "@/lib/fastapi";
import {
  formatCompactPounds,
  formatDate,
  formatInt,
  formatMonth,
  formatPounds,
} from "@/lib/format";
import {
  lookAfterInsight,
  modelAnswer,
  peakMonths,
  seasonalityInsight,
  sellMoreInsight,
  topRevenueSegment,
  winBackInsight,
} from "@/lib/insights";
import { DEFAULT_THRESHOLD, atRiskQuery } from "@/lib/queries";
import type { AtRiskPage, ModelReport, Month, SegmentProfile, Stats } from "@/lib/types";

export default async function ThisWeekPage() {
  await connection(); // render at request time: no FastAPI call during next build
  const [stats, months, profiles, atRisk, model] = await Promise.all([
    fetchApi<Stats>("/stats"),
    fetchApi<Month[]>("/timeline"),
    fetchApi<SegmentProfile[]>("/segments"),
    fetchApi<AtRiskPage>(`/at-risk${atRiskQuery(DEFAULT_THRESHOLD, null)}`),
    fetchApi<ModelReport>("/model"),
  ]);
  const [best] = peakMonths(months, 1);
  const partial = months.filter((month) => !month.complete);
  const top = topRevenueSegment(profiles);

  return (
    <main>
      <header className="page-head">
        <h1 className="question">What should I do this week?</h1>
        <p className="answer">Three things to do this week, most urgent first.</p>
        <p className="lede">
          From two years of orders of a UK online gift shop, up to{" "}
          {formatDate(stats.last_date)}. Each card opens the list or the tool you need, already
          filtered.
        </p>
      </header>

      <ol className="action-cards">
        <li className="action-card is-urgent">
          <p className="action-kicker">
            <span className="action-number">1</span> Call first
          </p>
          <h2>Win back customers who are slipping away</h2>
          <p className="action-text">{winBackInsight(atRisk, DEFAULT_THRESHOLD)}</p>
          <div className="action-foot">
            <Link className="button button-primary" href="/win-back">
              Open the call list <span aria-hidden="true">→</span>
            </Link>
            <span className="note">Win back</span>
          </div>
        </li>
        <li className="action-card">
          <p className="action-kicker">
            <span className="action-number">2</span> Sell more
          </p>
          <h2>Suggest products that go together</h2>
          <p className="action-text">{sellMoreInsight(stats)}</p>
          <div className="action-foot">
            <Link className="button" href="/basket">
              Try a basket <span aria-hidden="true">→</span>
            </Link>
            <span className="note">Sell more</span>
          </div>
        </li>
        <li className="action-card">
          <p className="action-kicker">
            <span className="action-number">3</span> Look after
          </p>
          <h2>Keep your {top.segment_name} happy</h2>
          <p className="action-text">{lookAfterInsight(top)}</p>
          <div className="action-foot">
            <Link className="button" href={`/segments?segment=${top.segment}`}>
              See the {top.segment_name} <span aria-hidden="true">→</span>
            </Link>
            <span className="note">Customers</span>
          </div>
        </li>
      </ol>

      <dl className="figures key-figures">
        <div>
          <dt>Orders</dt>
          <dd>{formatInt(stats.invoices)}</dd>
        </div>
        <div>
          <dt>Customers</dt>
          <dd>{formatInt(stats.customers)}</dd>
        </div>
        <div>
          <dt>Products</dt>
          <dd>{formatInt(stats.products)}</dd>
        </div>
        <div>
          <dt>Best month ({formatMonth(best.month)})</dt>
          <dd>{formatCompactPounds(best.revenue)}</dd>
        </div>
      </dl>

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

      <p className="trust-strip">
        <span>{modelAnswer(model.metrics, model.calibration)}</span>
        <Link href="/model">
          Can I trust these numbers? <span aria-hidden="true">→</span>
        </Link>
      </p>
    </main>
  );
}
