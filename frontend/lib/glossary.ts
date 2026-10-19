// Short definitions shown on hover or focus by components/Term.tsx.

export const GLOSSARY = {
  rule: "A pattern “baskets with these products also hold that one”, kept when it is frequent and well above chance.",
  support: "Share of all invoices that contain every product of the rule.",
  confidence:
    "Among the baskets with the first products, the share that also contain the suggested one.",
  lift: "How many times more often the products are bought together than if they were unrelated. 1× means no link.",
  baseRate: "Share of all baskets that contain the product, whatever else is in them.",
  recency: "Days between the customer's last purchase and the day after the last invoice in the data.",
  frequency: "Number of distinct invoices of the customer.",
  monetary: "Total spend of the customer: quantity × price, cancellations not deducted.",
  netSpend: "Total spend minus the products the customer cancelled, over the two years of data.",
  preference:
    "How much more this product weighs in the segment's purchases than in all purchases. 2× = twice as much.",
  percentile:
    "Average rank of the segment's customers among all customers, from 0 (lowest) to 100 (highest).",
  silhouette:
    "How well each customer fits its own segment rather than the nearest other one. Higher is better.",
  prAuc:
    "Area under the precision-recall curve: how well the score puts future buyers first. 1 is perfect; random gives the share of buyers.",
  rocAuc:
    "Probability that a random future buyer gets a higher score than a random non-buyer. 0.5 is random.",
  calibration:
    "Compares the predicted probability with the share of customers who really bought again.",
  probability: "Model estimate of the chance that the customer orders again within 90 days.",
} as const;

export type GlossaryKey = keyof typeof GLOSSARY;
