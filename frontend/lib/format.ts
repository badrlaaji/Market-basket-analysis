// Display helpers, shared by server and client components.

const integer = new Intl.NumberFormat("en-GB");
const pounds = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
});

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
