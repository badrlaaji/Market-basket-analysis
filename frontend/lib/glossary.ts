// Short definitions shown on hover or focus by components/Term.tsx.
// Written for shop managers: no formula, one example when it helps.

export const GLOSSARY = {
  rule: "A buying habit seen in many orders: when a basket has these products, it often has that one too.",
  support: "How common the pattern is: the share of all orders that contain all of its products.",
  confidence:
    "When a basket has the first products, how often it also has the suggested one. 60% = 6 baskets out of 10.",
  lift: "How many times more often the products go together than by chance. 1× = no link; 5× = five times more often.",
  baseRate: "How often the product is in any basket, whatever else is in it.",
  recency: "Days since the customer's last order, counted from the day after the last order in the data.",
  frequency: "Number of separate orders the customer placed.",
  monetary: "Everything the customer bought in two years. Cancelled orders are not subtracted.",
  netSpend: "What the customer bought in two years, minus the products they cancelled.",
  preference:
    "How much more this group buys the product than all customers do. 2× = twice as much.",
  percentile:
    "Where the group's customers stand among all customers, from 0 (lowest) to 100 (highest).",
  silhouette:
    "How clearly each customer belongs to its own group rather than to the nearest one. Higher is better.",
  prAuc:
    "Precision-recall area: how well the score puts future buyers first. 1 is perfect; random gives the share of buyers.",
  rocAuc:
    "Chance that a random future buyer gets a higher score than a random customer who does not come back. 0.5 is random.",
  calibration:
    "Compares the chance the score predicted with the share of customers who really ordered again.",
  probability: "The score's estimate of the chance that the customer orders again within 90 days.",
} as const;

export type GlossaryKey = keyof typeof GLOSSARY;
