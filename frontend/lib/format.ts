// Display helpers, shared by server and client components.

const integer = new Intl.NumberFormat("en-GB");
const pounds = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
});
const compactPounds = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  notation: "compact",
  maximumSignificantDigits: 3,
});
// Fixed names: Intl month names differ between ICU versions ("Sep" / "Sept"),
// and the server and the browser must print the same text
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** 1003357 → "1,003,357". */
export function formatInt(value: number): string {
  return integer.format(value);
}

/** 1234.5 → "£1,235". */
export function formatPounds(value: number): string {
  return pounds.format(value);
}

/** 0.4351 → "43.5%". */
export function formatPercent(value: number, digits: number = 1): string {
  return `${(value * 100).toFixed(digits)}%`;
}

/** Product names are upper case in the data: "WHITE HANGING HEART" → "White hanging heart". */
export function productName(description: string): string {
  const lower = description.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

/** 19643862 → "£19.6m"; 1452116 → "£1.45m"; 543650 → "£544k". */
export function formatCompactPounds(value: number): string {
  return compactPounds.format(value);
}

/** "2011-11" → "Nov 2011". */
export function formatMonth(month: string): string {
  const [year, number] = month.split("-");
  return `${MONTHS[Number(number) - 1]} ${year}`;
}

/** "2011-12-09" → "9 Dec 2011". */
export function formatDate(date: string): string {
  const [year, number, day] = date.split("-");
  return `${Number(day)} ${MONTHS[Number(number) - 1]} ${year}`;
}

/** 1 → "1 day ago"; 25 → "25 days ago" (days before the date of the data). */
export function formatDaysAgo(days: number): string {
  return days === 1 ? "1 day ago" : `${integer.format(days)} days ago`;
}

/** 51.45 → "51×"; 8.47 → "8.5×". */
export function formatLift(value: number): string {
  return value >= 10 ? `${Math.round(value)}×` : `${value.toFixed(1)}×`;
}
