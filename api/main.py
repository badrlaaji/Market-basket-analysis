"""FastAPI app: serves the pipeline outputs, loaded once at startup.

Run from the repository root: uvicorn api.main:app --reload
"""

import os
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Annotated, Any, Literal

import pandas as pd
from fastapi import FastAPI, Query
from pydantic import BaseModel

from api import queries
from api.schemas import (
    AtRiskCustomer,
    AtRiskPage,
    BasketIn,
    Health,
    Product,
    Recommendation,
    Recommendations,
    Rule,
    RulesPage,
    SegmentProfile,
    Stats,
)

# Default: outputs/ next to api/ (repository root, or /app in the image)
DEFAULT_OUTPUTS = Path(__file__).resolve().parents[1] / "outputs"
MAX_LIMIT = 500
DATA: dict[str, Any] = {}  # filled by the lifespan, read by the endpoints


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
    min_confidence: Annotated[float, Query(ge=0, le=1)] = 0.0,
    min_lift: Annotated[float, Query(ge=0)] = 0.0,
    product: Annotated[str | None, Query(max_length=100)] = None,
    sort: Literal["lift", "confidence", "support"] = "lift",
    limit: Annotated[int, Query(ge=1, le=MAX_LIMIT)] = 50,
) -> RulesPage:
    """Association rules filtered by thresholds and product (code or name)."""
    total, rules = queries.filter_rules(
        DATA["rules"], min_confidence, min_lift, product, sort, limit
    )
    return RulesPage(total=total, rules=to_models(rules, Rule))


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


@app.get("/segments")
def get_segments() -> list[SegmentProfile]:
    """RFM profile of each customer segment."""
    return to_models(DATA["profiles"], SegmentProfile)


@app.get("/stats")
def get_stats() -> Stats:
    """Key figures of the data, the rules and the repurchase model."""
    return Stats(**DATA["stats"])


@app.get("/at-risk")
def get_at_risk(
    threshold: Annotated[float, Query(ge=0, le=1)] = 0.3,
    top: Annotated[int, Query(ge=1, le=MAX_LIMIT)] = 50,
) -> AtRiskPage:
    """Customers unlikely to buy within 90 days, most valuable first."""
    total, customers = queries.at_risk(DATA["scores"], threshold, top)
    return AtRiskPage(total=total, customers=to_models(customers, AtRiskCustomer))
