// Sentences built from the API data: no figure in them is written by hand.
import {
  formatCompactPounds,
  formatDate,
  formatInt,
  formatLift,
  formatMonth,
  formatPercent,
  productName,
} from "@/lib/format";
import type { ModelMetrics, Month, Rule, SegmentProfile, Stats } from "@/lib/types";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** Complete months, highest revenue first (a partial month is never a peak). */
export function peakMonths(months: Month[], count: number = 2): Month[] {
  return [...months]
    .filter((month) => month.complete)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, count);
}

/** Mean revenue of the complete months. */
export function averageMonth(months: Month[]): number {
  const complete = months.filter((month) => month.complete);
  return complete.reduce((sum, month) => sum + month.revenue, 0) / complete.length;
}

/** "November" when every peak falls in the same calendar month, else null. */
function sharedPeakMonth(peaks: Month[]): string | null {
  const numbers = new Set(peaks.map((peak) => peak.month.slice(5)));
  return numbers.size === 1 ? MONTH_NAMES[Number([...numbers][0]) - 1] : null;
}

/** Segment with the largest share of the revenue. */
export function topRevenueSegment(profiles: SegmentProfile[]): SegmentProfile {
  return profiles.reduce((best, p) => (p.revenue_share > best.revenue_share ? p : best));
}

/** Share of the revenue that has no customer ID (guest orders). */
export function guestShare(months: Month[], profiles: SegmentProfile[]): number {
  const total = months.reduce((sum, month) => sum + month.revenue, 0);
  const known = profiles.reduce((sum, p) => sum + p.monetary_mean * p.n_customers, 0);
  return 1 - known / total;
}

/** "a basket with Jumbo bag red retrospot" or "a basket with A and B". */
export function basketWith(names: string[]): string {
  const readable = names.map(productName);
  const list =
    readable.length > 1
      ? `${readable.slice(0, -1).join(", ")} and ${readable.at(-1)}`
      : readable[0];
  return `a basket with ${list}`;
}

/** Home page answer: when sales peak and who brings them. */
export function overviewAnswer(months: Month[], profiles: SegmentProfile[]): string {
  const peaks = peakMonths(months);
  const shared = sharedPeakMonth(peaks);
  const when = shared ? `peak every ${shared}` : `peaked in ${formatMonth(peaks[0].month)}`;
  const top = topRevenueSegment(profiles);
  return (
    `Sales ${when}, and ${formatPercent(top.customer_share, 0)} of the customers ` +
    `bring ${formatPercent(top.revenue_share, 0)} of the customer revenue.`
  );
}

/** Insight: revenue concentration in one segment. */
export function concentrationInsight(months: Month[], profiles: SegmentProfile[]): string {
  const top = topRevenueSegment(profiles);
  return (
    `${top.segment_name} are ${formatPercent(top.customer_share, 0)} of the identified ` +
    `customers and bring ${formatPercent(top.revenue_share, 0)} of their revenue. ` +
    `Guest orders without a customer ID add ${formatPercent(guestShare(months, profiles), 0)} ` +
    `of all sales.`
  );
}

/** Insight: the best month against an average month. */
export function seasonalityInsight(months: Month[]): string {
  const [best] = peakMonths(months, 1);
  const ratio = best.revenue / averageMonth(months);
  return (
    `${formatMonth(best.month)} was the best month: ${formatCompactPounds(best.revenue)}, ` +
    `${ratio.toFixed(1)}× an average month. Customers who drift away before the peak ` +
    `are worth winning back early.`
  );
}

/** "a basket…" → "A basket…". */
function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Insight: a rule in plain words. */
export function ruleSentence(rule: Rule): string {
  return (
    `${capitalize(basketWith(rule.antecedent_names))} holds ` +
    `${productName(rule.consequent_name)} ${formatLift(rule.lift)} more often than the ` +
    `average basket.`
  );
}

/** /rules answer: how many rules, and how strong the best one is. */
export function rulesAnswer(stats: Stats, strongest: Rule): string {
  return (
    `${formatInt(stats.rules)} rules link ${formatInt(stats.products_in_rules)} of the ` +
    `${formatInt(stats.products)} products. The strongest makes a product ` +
    `${formatLift(strongest.lift)} more likely than usual.`
  );
}

/** /segments answer: the most and the least valuable segment. */
export function segmentsAnswer(profiles: SegmentProfile[]): string {
  const top = topRevenueSegment(profiles);
  const bottom = profiles.reduce((low, p) => (p.revenue_share < low.revenue_share ? p : low));
  return (
    `${top.segment_name}, ${formatPercent(top.customer_share, 0)} of the customers, bring ` +
    `${formatPercent(top.revenue_share, 0)} of the revenue; ${bottom.segment_name}, ` +
    `${formatPercent(bottom.customer_share, 0)}, bring ${formatPercent(bottom.revenue_share, 0)}.`
  );
}

/** /model answer: the model against its baseline. */
export function modelAnswer(m: ModelMetrics): string {
  const gain = (m.pr_auc_model - m.pr_auc_baseline) / m.pr_auc_baseline;
  return (
    `The model finds future buyers better than recency alone: PR-AUC ` +
    `${m.pr_auc_model.toFixed(3)} against ${m.pr_auc_baseline.toFixed(3)}, ` +
    `${formatPercent(gain, 0)} higher.`
  );
}

/** The honest part: probabilities shifted by the season of the test window. */
export function seasonNote(m: ModelMetrics, months: Month[]): string {
  // Months that start inside [test month, test date + horizon)
  const end = new Date(`${m.test_date}T00:00:00Z`);
  end.setUTCDate(end.getUTCDate() + m.horizon_days);
  const window = months.filter(
    (month) =>
      month.month >= m.test_date.slice(0, 7) && new Date(`${month.month}-01T00:00:00Z`) < end,
  );
  const [peak] = peakMonths(window, 1);
  const peakText = peak ? `, including ${formatMonth(peak.month)}, the best month of the data` : "";
  return (
    `On the ${formatInt(m.n_test)} test customers it predicted ${formatPercent(m.mean_proba_test, 0)} ` +
    `on average, but ${formatPercent(m.positive_rate_test, 0)} bought again. The ${m.horizon_days} days ` +
    `after ${formatDate(m.test_date)} cover the busy season${peakText}; in the training window only ` +
    `${formatPercent(m.positive_rate_train, 0)} bought again. Use the scores to rank customers, ` +
    `not as exact probabilities.`
  );
}
