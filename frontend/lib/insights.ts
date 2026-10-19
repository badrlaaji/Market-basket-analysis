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
import type {
  CalibrationBin,
  ModelMetrics,
  Month,
  Rule,
  SegmentProfile,
  Stats,
} from "@/lib/types";

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

/** "Jumbo bag red retrospot" or "A, B and C". */
export function productList(names: string[]): string {
  const readable = names.map(productName);
  return readable.length > 1
    ? `${readable.slice(0, -1).join(", ")} and ${readable.at(-1)}`
    : readable[0];
}

/** "a basket with Jumbo bag red retrospot" or "a basket with A and B". */
export function basketWith(names: string[]): string {
  return `a basket with ${productList(names)}`;
}

/** Home page answer: when sales peak and who brings them. */
export function overviewAnswer(months: Month[], profiles: SegmentProfile[]): string {
  const peaks = peakMonths(months);
  const shared = sharedPeakMonth(peaks);
  const when = shared ? `peak every ${shared}` : `peaked in ${formatMonth(peaks[0].month)}`;
  const top = topRevenueSegment(profiles);
  return (
    `Sales ${when}, and ${formatPercent(top.customer_share, 0)} of the customers ` +
    `bring ${formatPercent(top.revenue_share, 0)} of the spending.`
  );
}

/** Insight: spending concentrated in one group of customers. */
export function concentrationInsight(profiles: SegmentProfile[]): string {
  const top = topRevenueSegment(profiles);
  return (
    `${top.segment_name} are ${formatPercent(top.customer_share, 0)} of the customers ` +
    `but bring ${formatPercent(top.revenue_share, 0)} of the spending.`
  );
}

/** Insight: the best month against an average month. */
export function seasonalityInsight(months: Month[]): string {
  const [best] = peakMonths(months, 1);
  const ratio = best.revenue / averageMonth(months);
  return (
    `${formatMonth(best.month)} was the best month: ${formatCompactPounds(best.revenue)}, ` +
    `${ratio.toFixed(1)}× an average month.`
  );
}

/** Home card: how many customers may stop buying, at the default threshold. */
export function winBackInsight(total: number, threshold: number): string {
  return (
    `${formatInt(total)} customers have less than a ${formatPercent(threshold, 0)} chance ` +
    `of ordering again in the next 90 days.`
  );
}

// One line per group, checked against the medians of /segments (no figure written here)
const SEGMENT_BLURBS: Record<string, string> = {
  Champions: "Order often and recently, and spend the most.",
  Promising: "Ordered recently, but only a few times so far.",
  "At risk": "Ordered several times, but not for a long while.",
  Lost: "Ordered once or twice, a long time ago.",
};

/** "Order often and recently…" for a group name; empty for an unknown name. */
export function segmentBlurb(name: string): string {
  return SEGMENT_BLURBS[name] ?? "";
}

/** "a basket…" → "A basket…". */
function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Insight: a rule in plain words. */
export function ruleSentence(rule: Rule): string {
  return (
    `${capitalize(basketWith(rule.antecedent_names))} also has ` +
    `${productName(rule.consequent_name)} ${formatLift(rule.lift)} more often than an ` +
    `average basket.`
  );
}

/** /rules answer: how many patterns, and how strong the best one is. */
export function rulesAnswer(stats: Stats, strongest: Rule): string {
  return (
    `${formatInt(stats.rules)} buying patterns link ${formatInt(stats.products_in_rules)} of ` +
    `the ${formatInt(stats.products)} products. In the strongest, a product is ` +
    `${formatLift(strongest.lift)} more likely than usual.`
  );
}

/** /segments answer: the most and the least valuable group. */
export function segmentsAnswer(profiles: SegmentProfile[]): string {
  const top = topRevenueSegment(profiles);
  const bottom = profiles.reduce((low, p) => (p.revenue_share < low.revenue_share ? p : low));
  return (
    `${top.segment_name} are ${formatPercent(top.customer_share, 0)} of the customers but ` +
    `bring ${formatPercent(top.revenue_share, 0)} of the spending. ` +
    `${bottom.segment_name} customers, ${formatPercent(bottom.customer_share, 0)}, ` +
    `bring ${formatPercent(bottom.revenue_share, 0)}.`
  );
}

/** Calibration bin with the highest predicted chance: the best-scored customers. */
export function topDecile(bins: CalibrationBin[]): CalibrationBin {
  return bins.reduce((best, bin) => (bin.proba_mean > best.proba_mean ? bin : best));
}

/** /model answer: what happened to the customers the score ranked first. */
export function modelAnswer(m: ModelMetrics, bins: CalibrationBin[]): string {
  const top = topDecile(bins);
  return (
    `Of the ${formatPercent(1 / bins.length, 0)} of customers with the highest score, ` +
    `${formatPercent(top.rate, 0)} ordered again within ${m.horizon_days} days, against ` +
    `${formatPercent(m.positive_rate_test, 0)} of all customers.`
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
  const peakText = peak ? `, with ${formatMonth(peak.month)}, the best month of the data` : "";
  return (
    `The score expected ${formatPercent(m.mean_proba_test, 0)} of the customers to come back, ` +
    `but ${formatPercent(m.positive_rate_test, 0)} did. The ${m.horizon_days} days after ` +
    `${formatDate(m.test_date)} are the Christmas season${peakText}, while only ` +
    `${formatPercent(m.positive_rate_train, 0)} came back in the period it learned from.`
  );
}
