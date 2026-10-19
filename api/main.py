"""FastAPI app: serves the pipeline outputs, loaded once at startup.

Run from the repository root: uvicorn api.main:app --reload
"""

import os
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Annotated, Any, Literal

import pandas as pd
from fastapi import FastAPI, Query, Response
from pydantic import BaseModel

from api import queries
from api.schemas import (
    AtRiskCustomer,
    AtRiskPage,
    BandRevenue,
    BasketIn,
    GridCell,
    Health,
    HistogramBin,
    KReport,
    MapPoint,
    ModelReport,
    Month,
    Product,
    Recommendation,
    Recommendations,
    Rule,
    RulesPage,
    Scenario,
    SegmentProduct,
    SegmentProfile,
    Stats,
)

# Default: outputs/ next to api/ (repository root, or /app in the image)
DEFAULT_OUTPUTS = Path(__file__).resolve().parents[1] / "outputs"
MAX_LIMIT = 500
RULES_MAX_LIMIT = 2_000  # all rules fit (1,166): the /rules chart needs them all
MAP_MAX_POINTS = 6_000  # all customers fit (5,852)
DATA: dict[str, Any] = {}  # filled by the lifespan, read by the endpoints

# Filters shared by /rules and /rules/export
MinConfidence = Annotated[float, Query(ge=0, le=1)]
MinLift = Annotated[float, Query(ge=0)]
ProductText = Annotated[str | None, Query(max_length=100)]
RuleSort = Literal["lift", "confidence", "support"]
Segment = Annotated[int | None, Query(ge=0)]  # None: every segment


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None]:
    """Load the outputs before the first request; free them at shutdown."""
    outputs_dir = Path(os.environ.get("OUTPUTS_DIR", DEFAULT_OUTPUTS))
    DATA.update(queries.load_outputs(outputs_dir))
    yield
    DATA.clear()


app = FastAPI(title="Market Basket Analysis API", version="1.0.0", lifespan=lifespan)


def to_models[M: BaseModel](df: pd.DataFrame, schema: type[M]) -> list[M]:
    """Rows of df as schema objects (M = any Pydantic schema), extra columns dropped."""
    rows = df[list(schema.model_fields)].to_dict(orient="records")
    return [schema(**row) for row in rows]


@app.get("/health")
def health() -> Health:
    """Liveness check, with the size of the loaded outputs."""
    return Health(
        status="ok",
        rules=len(DATA["rules"]),
        products=len(DATA["products"]),
        customers=len(DATA["scores"]),
    )


@app.get("/rules")
def get_rules(
    min_confidence: MinConfidence = 0.0,
    min_lift: MinLift = 0.0,
    product: ProductText = None,
    sort: RuleSort = "lift",
    limit: Annotated[int, Query(ge=1, le=RULES_MAX_LIMIT)] = 50,
) -> RulesPage:
    """Association rules filtered by thresholds and product (code or name)."""
    total, rules = queries.filter_rules(
        DATA["rules"], min_confidence, min_lift, product, sort, limit
    )
    return RulesPage(total=total, rules=to_models(rules, Rule))


@app.get("/rules/export", response_class=Response)
def export_rules(
    min_confidence: MinConfidence = 0.0,
    min_lift: MinLift = 0.0,
    product: ProductText = None,
    sort: RuleSort = "lift",
) -> Response:
    """Every rule matching the filters, as a CSV file (no limit)."""
    all_rules = DATA["rules"]
    _, rules = queries.filter_rules(
        all_rules, min_confidence, min_lift, product, sort, len(all_rules)
    )
    return Response(
        queries.rules_csv(rules),
        media_type="text/csv",
        headers={"content-disposition": 'attachment; filename="rules.csv"'},
    )


@app.get("/products")
def get_products(
    q: Annotated[str, Query(max_length=100)] = "",
    limit: Annotated[int, Query(ge=1, le=MAX_LIMIT)] = 20,
) -> list[Product]:
    """Product search; an empty query returns the most bought products."""
    return to_models(queries.search_products(DATA["products"], q, limit), Product)


@app.post("/recommend")
def post_recommend(basket: BasketIn) -> Recommendations:
    """Products to suggest for a basket, from the rules it fully contains."""
    best, unknown = queries.recommend(
        DATA["rules"], DATA["known_codes"], basket.items, basket.k
    )
    best = best.rename(
        columns={
            "consequent": "stock_code",
            "consequent_name": "description",
            "antecedent": "because",
        }
    )
    return Recommendations(
        recommendations=to_models(best, Recommendation), unknown_codes=unknown
    )


@app.get("/scenarios")
def get_scenarios() -> list[Scenario]:
    """Example baskets built from the rules (2+ products, no product shared)."""
    return to_models(DATA["scenarios"], Scenario)


def rows_of(df: pd.DataFrame, segment: int) -> pd.DataFrame:
    """Rows of one segment in a table with a segment column."""
    return df[df["segment"] == segment]


@app.get("/segments")
def get_segments() -> list[SegmentProfile]:
    """Profile of each segment: shares, RFM, radar scores, top products."""
    return [
        SegmentProfile(
            **row,  # extra columns are ignored by Pydantic
            top_products=to_models(
                rows_of(DATA["top_products"], row["segment"]), SegmentProduct
            ),
            revenue_by_band=to_models(
                rows_of(DATA["band_revenue"], row["segment"]), BandRevenue
            ),
        )
        for row in DATA["profiles"].to_dict(orient="records")
    ]


@app.get("/segments/map")
def get_segment_map(
    n: Annotated[int, Query(ge=1, le=MAP_MAX_POINTS)] = 1_500,
) -> list[MapPoint]:
    """About n customers (R, F, M, segment), sampled per segment; no customer id."""
    return to_models(queries.sample_customers(DATA["segments"], n), MapPoint)


@app.get("/segments/grid")
def get_segment_grid() -> list[GridCell]:
    """Customers per recency quintile x frequency band (25 cells)."""
    return to_models(DATA["grid"], GridCell)


@app.get("/segments/k")
def get_segment_k() -> KReport:
    """Silhouette of each number of segments tried, and the number kept."""
    return KReport(**DATA["k_report"])


@app.get("/timeline")
def get_timeline() -> list[Month]:
    """Revenue, invoices and customers per month; partial months flagged."""
    return to_models(DATA["timeline"], Month)


@app.get("/model")
def get_model() -> ModelReport:
    """Repurchase model on its test period: metrics, curves, calibration."""
    return ModelReport(metrics=DATA["stats"]["model"], **DATA["model"])


@app.get("/stats")
def get_stats() -> Stats:
    """Key figures of the data, the rules and the repurchase model."""
    return Stats(**DATA["stats"])


@app.get("/at-risk")
def get_at_risk(
    threshold: Annotated[float, Query(ge=0, le=1)] = 0.3,
    top: Annotated[int, Query(ge=1, le=MAX_LIMIT)] = 50,
    segment: Segment = None,
) -> AtRiskPage:
    """Customers unlikely to buy within 90 days, highest net value first."""
    total, revenue, customers = queries.at_risk(DATA["scores"], threshold, top, segment)
    return AtRiskPage(
        total=total,
        revenue_at_risk=revenue,
        customers=to_models(customers, AtRiskCustomer),
    )


@app.get("/at-risk/histogram")
def get_at_risk_histogram(segment: Segment = None) -> list[HistogramBin]:
    """Customers and net spend per repurchase probability bin (width 0.05)."""
    return to_models(queries.proba_histogram(DATA["scores"], segment), HistogramBin)
