// Mirrors api/schemas.py (the FastAPI responses).

export type Rule = {
  antecedent: string[]; // stock codes, sorted
  antecedent_names: string[];
  consequent: string;
  consequent_name: string;
  support: number;
  confidence: number;
  lift: number;
};

export type RulesPage = {
  total: number; // rules matching the filters, before the limit
  rules: Rule[];
};

export type RuleSort = "lift" | "confidence" | "support";

export type Product = {
  stock_code: string;
  description: string;
  n_invoices: number;
  in_rules: boolean;
};

export type Recommendation = {
  stock_code: string;
  description: string;
  lift: number;
  confidence: number; // P(product | basket)
  support: number;
  base_rate: number; // P(product) in all baskets = confidence / lift
  because: string[]; // stock codes of the rule antecedent
};

export type Recommendations = {
  recommendations: Recommendation[];
  unknown_codes: string[];
};

export type Scenario = {
  items: string[]; // stock codes of an antecedent with 2+ products
  names: string[];
  n_rules: number;
};

export type SegmentProduct = {
  rank: number;
  stock_code: string;
  description: string;
  customer_share: number; // share of the segment's customers who bought it
  preference: number; // share in the segment's purchases / share in all purchases
};

export type BandRevenue = {
  frequency_band: string; // "1", "2", "3-4", "5-9" or "10+" invoices
  n_customers: number;
  revenue: number;
};

export type SegmentProfile = {
  segment: number;
  segment_name: string;
  n_customers: number;
  customer_share: number;
  revenue_share: number;
  recency_mean: number;
  frequency_mean: number;
  monetary_mean: number;
  recency_median: number;
  frequency_median: number;
  monetary_median: number;
  // Mean percentile rank of the customers (0-100, higher = better)
  score_recency: number;
  score_frequency: number;
  score_monetary: number;
  score_basket: number;
  score_repurchase: number;
  top_products: SegmentProduct[];
  revenue_by_band: BandRevenue[];
};

export type MapPoint = {
  recency: number;
  frequency: number;
  monetary: number;
  segment: number;
};

export type GridCell = {
  recency_quintile: number; // 1 = most recent fifth of the customers
  recency_min: number;
  recency_max: number;
  frequency_band: string;
  n_customers: number;
  top_segment: number | null;
};

export type KReport = {
  k: number;
  metric: string;
  scores: { k: number; silhouette: number }[];
};

export type Flow = {
  segment_before: number; // -1: no purchase before date_before (new customer)
  segment_now: number;
  n_customers: number;
};

export type Transitions = {
  date_before: string;
  date_now: string;
  flows: Flow[];
};

export type Month = {
  month: string; // "2011-11"
  revenue: number;
  n_invoices: number;
  n_customers: number;
  complete: boolean; // false: the data covers only part of the month
};

export type ModelMetrics = {
  train_date: string;
  test_date: string;
  score_date: string;
  horizon_days: number;
  n_train: number;
  n_test: number;
  positive_rate_train: number;
  positive_rate_test: number;
  pr_auc_model: number;
  roc_auc_model: number;
  pr_auc_baseline: number;
  roc_auc_baseline: number;
  mean_proba_test: number;
};

export type CurvePoint = { x: number; y: number };

export type CurvePair = { model: CurvePoint[]; baseline: CurvePoint[] };

export type CalibrationBin = {
  proba_mean: number;
  rate: number;
  n: number;
  ci95: number; // half-width of the 95 % interval of rate
};

export type ModelReport = {
  metrics: ModelMetrics;
  pr: CurvePair; // x = recall, y = precision
  roc: CurvePair; // x = false positive rate, y = true positive rate
  calibration: CalibrationBin[];
  importances: { feature: string; importance: number }[];
};

export type Stats = {
  raw_rows: number;
  clean_rows: number;
  invoices: number;
  customers: number;
  products: number;
  rules: number;
  products_in_rules: number;
  first_date: string;
  last_date: string;
  model: ModelMetrics;
};

export type AtRiskCustomer = {
  customer_id: number;
  proba_90d: number;
  segment: number;
  segment_name: string;
  monetary: number; // gross: purchases only
  monetary_net: number; // gross + cancellations
  recency: number; // days since the last order, at the date of the data
  stake: number; // money at stake = monetary_net × (1 − proba_90d)
};

export type AtRiskSort = "stake" | "spend";

export type AtRiskPage = {
  total: number; // customers below the threshold, before the limit
  revenue_at_risk: number; // their total net spend over the 2 years of data
  customers: AtRiskCustomer[];
};

export type HistogramBin = {
  start: number; // probability bin [start, end)
  end: number;
  n_customers: number;
  monetary_net: number;
};
