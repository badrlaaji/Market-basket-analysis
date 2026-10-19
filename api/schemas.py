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
    confidence: float
    support: float
    because: list[str]  # antecedent of the rule with the highest lift


class Recommendations(BaseModel):
    recommendations: list[Recommendation]
    unknown_codes: list[str]  # ignored: not in products.parquet


class SegmentProfile(BaseModel):
    segment: int
    segment_name: str
    n_customers: int
    share: float  # n_customers / all customers
    recency_mean: float
    frequency_mean: float
    monetary_mean: float
    recency_median: float
    frequency_median: float
    monetary_median: float


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
    monetary: float


class AtRiskPage(BaseModel):
    total: int  # customers below the threshold, before the limit
    customers: list[AtRiskCustomer]
