"""Pydantic schemas: the /recommend body and every response of the API."""

from pydantic import BaseModel, Field

MAX_BASKET = 50  # products per basket
MAX_K = 20  # recommendations per request


class Health(BaseModel):
    status: str
    rules: int
    products: int
    customers: int


class Rule(BaseModel):
    antecedent: list[str]  # stock codes, sorted
    antecedent_names: list[str]
    consequent: str
    consequent_name: str
    support: float
    confidence: float
    lift: float


class RulesPage(BaseModel):
    total: int  # rules matching the filters, before the limit
    rules: list[Rule]


class Product(BaseModel):
    stock_code: str
    description: str
    n_invoices: int
    in_rules: bool  # True if the product appears in at least one rule


class BasketIn(BaseModel):
    items: list[str] = Field(max_length=MAX_BASKET)  # stock codes
    k: int = Field(default=5, ge=1, le=MAX_K)


class Recommendation(BaseModel):
    stock_code: str
    description: str
    lift: float
    confidence: float  # P(product | basket)
    support: float
    base_rate: float  # P(product) in all baskets = confidence / lift
    because: list[str]  # antecedent of the rule with the highest lift


class Recommendations(BaseModel):
    recommendations: list[Recommendation]
    unknown_codes: list[str]  # ignored: not in products.parquet


class Scenario(BaseModel):
    items: list[str]  # stock codes of an antecedent with 2+ products
    names: list[str]
    n_rules: int  # rules that start from exactly this basket


class SegmentProduct(BaseModel):
    rank: int
    stock_code: str
    description: str
    customer_share: float  # share of the segment's customers who bought it
    preference: float  # share in the segment's purchases / share in all purchases


class BandRevenue(BaseModel):
    frequency_band: str  # "1", "2", "3-4", "5-9" or "10+" invoices
    n_customers: int
    revenue: float


class SegmentProfile(BaseModel):
    segment: int
    segment_name: str
    n_customers: int
    customer_share: float  # n_customers / all customers
    revenue_share: float  # segment revenue / revenue of all customers
    recency_mean: float
    frequency_mean: float
    monetary_mean: float
    recency_median: float
    frequency_median: float
    monetary_median: float
    # Mean percentile rank of the customers (0-100, higher = better)
    score_recency: float
    score_frequency: float
    score_monetary: float
    score_basket: float
    score_repurchase: float
    top_products: list[SegmentProduct]
    revenue_by_band: list[BandRevenue]


class MapPoint(BaseModel):
    recency: int
    frequency: int
    monetary: float
    segment: int


class GridCell(BaseModel):
    recency_quintile: int  # 1 = most recent fifth of the customers
    recency_min: int  # days, range of the quintile
    recency_max: int
    frequency_band: str
    n_customers: int
    top_segment: int | None  # most common segment in the cell (None if empty)


class KScore(BaseModel):
    k: int
    silhouette: float


class KReport(BaseModel):
    k: int  # number of segments kept
    metric: str
    scores: list[KScore]


class Flow(BaseModel):
    segment_before: int  # -1: no purchase before date_before (new customer)
    segment_now: int
    n_customers: int


class Transitions(BaseModel):
    date_before: str  # segments computed with the purchases before this date
    date_now: str  # reference date of the current segments
    flows: list[Flow]


class Month(BaseModel):
    month: str  # "2011-11"
    revenue: float
    n_invoices: int
    n_customers: int
    complete: bool  # False: the data covers only part of the month


class ModelMetrics(BaseModel):
    train_date: str
    test_date: str
    score_date: str
    horizon_days: int
    n_train: int
    n_test: int
    positive_rate_train: float
    positive_rate_test: float
    pr_auc_model: float
    roc_auc_model: float
    pr_auc_baseline: float
    roc_auc_baseline: float
    mean_proba_test: float


class CurvePoint(BaseModel):
    x: float
    y: float


class CurvePair(BaseModel):
    model: list[CurvePoint]
    baseline: list[CurvePoint]


class CalibrationBin(BaseModel):
    proba_mean: float  # mean predicted probability in the decile
    rate: float  # share of these customers who did buy again
    n: int
    ci95: float  # half-width of the 95 % interval of rate


class Importance(BaseModel):
    feature: str
    importance: float  # gain, sum = 1


class ModelReport(BaseModel):
    metrics: ModelMetrics
    pr: CurvePair  # x = recall, y = precision
    roc: CurvePair  # x = false positive rate, y = true positive rate
    calibration: list[CalibrationBin]
    importances: list[Importance]


class Stats(BaseModel):
    raw_rows: int
    clean_rows: int
    invoices: int
    customers: int
    products: int
    rules: int
    products_in_rules: int
    first_date: str
    last_date: str
    model: ModelMetrics


class AtRiskCustomer(BaseModel):
    customer_id: int
    proba_90d: float
    segment: int
    segment_name: str
    monetary: float  # gross: purchases only (as in the segments)
    monetary_net: float  # gross + cancellations: default sort of /at-risk
    recency: int  # days since the last order, at the reference date
    stake: float  # money at stake = monetary_net x (1 - proba_90d)


class AtRiskPage(BaseModel):
    total: int  # customers below the threshold, before the limit
    revenue_at_risk: float  # their total net spend over the 2 years of data
    customers: list[AtRiskCustomer]


class HistogramBin(BaseModel):
    start: float  # probability bin [start, end)
    end: float
    n_customers: int
    monetary_net: float
