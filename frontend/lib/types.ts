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
  confidence: number;
  support: number;
  because: string[]; // stock codes of the rule antecedent
};

export type Recommendations = {
  recommendations: Recommendation[];
  unknown_codes: string[];
};

export type SegmentProfile = {
  segment: number;
  segment_name: string;
  n_customers: number;
  share: number;
  recency_mean: number;
  frequency_mean: number;
  monetary_mean: number;
  recency_median: number;
  frequency_median: number;
  monetary_median: number;
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
  monetary_net: number; // gross + cancellations, used for the order
};

export type AtRiskPage = {
  total: number; // customers below the threshold, before the limit
  customers: AtRiskCustomer[];
};
