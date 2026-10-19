"""Tests for the FastAPI app, on tiny output files written in tmp_path.

No Spark here: this file must also run in the API image (no pyspark).
"""

import json
from collections.abc import Iterator
from pathlib import Path

import pandas as pd
import pytest
from fastapi.testclient import TestClient

from api.main import app

PRODUCTS = pd.DataFrame(
    {
        "stock_code": ["A", "B", "C", "D", "E"],
        "description": ["RED MUG", "BLUE LAMP", "GREEN BOX", "PINK BAG", "TEA SET"],
        "n_invoices": [50, 40, 30, 20, 10],
        "in_rules": [True, True, True, True, False],
    }
)
RULES = pd.DataFrame(
    {
        "antecedent": [["A"], ["A"], ["A", "D"], ["B"], ["D"]],
        "consequent": ["B", "C", "C", "A", "B"],
        "support": [0.20, 0.10, 0.05, 0.20, 0.08],
        "confidence": [0.60, 0.30, 0.50, 0.80, 0.25],
        "lift": [3.0, 2.0, 4.0, 2.5, 1.6],
    }
)
SEGMENTS = pd.DataFrame(
    {
        "customer_id": [101, 102, 103, 104, 105, 106],
        "recency": [5, 300, 400, 500, 10, 20],
        "frequency": [10, 1, 2, 1, 8, 6],
        "monetary": [500.0, 300.0, 800.0, 100.0, 1000.0, 50.0],
        "segment": [0, 1, 1, 1, 0, 0],
    }
)
PROFILES = pd.DataFrame(
    {
        "segment": [0, 1],
        "segment_name": ["Champions", "Lost"],
        "n_customers": [3, 3],
        "recency_mean": [11.67, 400.0],
        "frequency_mean": [8.0, 1.33],
        "monetary_mean": [516.67, 400.0],
    }
)
SCORES = pd.DataFrame(
    {
        "customer_id": [101, 102, 103, 104, 105, 106],
        "proba_90d": [0.9, 0.2, 0.1, 0.05, 0.6, 0.25],
        "segment": [0, 1, 1, 1, 0, 0],
        "monetary": [500.0, 300.0, 800.0, 100.0, 1000.0, 50.0],
        "monetary_net": [500.0, 300.0, 0.0, 100.0, 900.0, 50.0],  # 103 cancelled all
    }
)
STATS = {
    "raw_rows": 10,
    "clean_rows": 8,
    "invoices": 4,
    "customers": 6,
    "products": 5,
    "rules": 5,
    "products_in_rules": 4,
    "first_date": "2010-01-04",
    "last_date": "2011-12-09",
    "model": {
        "train_date": "2011-06-12",
        "test_date": "2011-09-10",
        "score_date": "2011-12-10",
        "horizon_days": 90,
        "n_train": 4,
        "n_test": 5,
        "positive_rate_train": 0.25,
        "positive_rate_test": 0.4,
        "pr_auc_model": 0.8,
        "roc_auc_model": 0.85,
        "pr_auc_baseline": 0.7,
        "roc_auc_baseline": 0.75,
        "mean_proba_test": 0.3,
    },
}


@pytest.fixture
def client(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Iterator[TestClient]:
    """App started on tiny outputs; the with block runs the lifespan."""
    PRODUCTS.to_parquet(tmp_path / "products.parquet")
    RULES.to_parquet(tmp_path / "rules.parquet")  # antecedent read back as ndarray
    SEGMENTS.to_parquet(tmp_path / "segments.parquet")
    PROFILES.to_parquet(tmp_path / "segment_profiles.parquet")
    SCORES.to_parquet(tmp_path / "repurchase_scores.parquet")
    (tmp_path / "stats.json").write_text(json.dumps(STATS))
    monkeypatch.setenv("OUTPUTS_DIR", str(tmp_path))
    with TestClient(app) as test_client:
        yield test_client


def codes(rules: list[dict]) -> list[tuple[list[str], str]]:
    """(antecedent, consequent) of each rule, in response order."""
    return [(rule["antecedent"], rule["consequent"]) for rule in rules]


def test_health(client: TestClient) -> None:
    """The outputs read from OUTPUTS_DIR are loaded."""
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "rules": 5,
        "products": 5,
        "customers": 6,
    }


def test_rules_thresholds_sort_and_limit(client: TestClient) -> None:
    """confidence >= 0.3 and lift >= 2 keep 4 rules; sorted by lift; limit 2."""
    body = client.get("/rules?min_confidence=0.3&min_lift=2&limit=2").json()
    assert body["total"] == 4
    assert codes(body["rules"]) == [(["A", "D"], "C"), (["A"], "B")]
    body = client.get("/rules?min_confidence=0.3&min_lift=2&sort=confidence").json()
    assert [rule["confidence"] for rule in body["rules"]] == [0.8, 0.6, 0.5, 0.3]


def test_rules_product_search_by_name(client: TestClient) -> None:
    """'lamp' matches the 3 rules with BLUE LAMP; names are added."""
    body = client.get("/rules?product=Lamp").json()
    assert body["total"] == 3
    assert codes(body["rules"]) == [(["A"], "B"), (["B"], "A"), (["D"], "B")]
    assert body["rules"][0]["consequent_name"] == "BLUE LAMP"
    assert body["rules"][1]["antecedent_names"] == ["BLUE LAMP"]


@pytest.mark.parametrize(
    "query",
    ["min_confidence=1.5", "min_lift=-1", "limit=0", "limit=501", "sort=price"],
)
def test_rules_rejects_bad_parameters(client: TestClient, query: str) -> None:
    """Out-of-range or unknown values are rejected with 422."""
    assert client.get(f"/rules?{query}").status_code == 422


def test_products_search(client: TestClient) -> None:
    """Search by name or code prefix; an empty query lists popular products."""
    assert [p["stock_code"] for p in client.get("/products?q=tea").json()] == ["E"]
    popular = client.get("/products?limit=2").json()
    assert popular == [
        {
            "stock_code": "A",
            "description": "RED MUG",
            "n_invoices": 50,
            "in_rules": True,
        },
        {
            "stock_code": "B",
            "description": "BLUE LAMP",
            "n_invoices": 40,
            "in_rules": True,
        },
    ]


def test_recommend_dedup_by_best_lift(client: TestClient) -> None:
    """Basket {A, D}: C comes from 2 rules, kept once with lift 4.0."""
    body = client.post("/recommend", json={"items": ["a", " D ", "ZZZ"]}).json()
    assert [
        (r["stock_code"], r["lift"], r["because"]) for r in body["recommendations"]
    ] == [
        ("C", 4.0, ["A", "D"]),
        ("B", 3.0, ["A"]),
    ]
    assert body["recommendations"][0]["description"] == "GREEN BOX"
    assert body["unknown_codes"] == ["ZZZ"]


def test_recommend_skips_basket_items_and_applies_k(client: TestClient) -> None:
    """Basket {A, B}: B and A are already in it, so only C is suggested."""
    body = client.post("/recommend", json={"items": ["A", "B"], "k": 5}).json()
    assert [r["stock_code"] for r in body["recommendations"]] == ["C"]
    body = client.post("/recommend", json={"items": ["A", "D"], "k": 1}).json()
    assert [r["stock_code"] for r in body["recommendations"]] == ["C"]


def test_recommend_basket_without_rule(client: TestClient) -> None:
    """A product without any rule gives an empty list, not an error."""
    body = client.post("/recommend", json={"items": ["E"]}).json()
    assert body == {"recommendations": [], "unknown_codes": []}


@pytest.mark.parametrize(
    "payload", [{"items": ["A"] * 51}, {"items": ["A"], "k": 0}, {"k": 3}]
)
def test_recommend_rejects_bad_body(client: TestClient, payload: dict) -> None:
    """Too many items, k out of range or no items: 422."""
    assert client.post("/recommend", json=payload).status_code == 422


def test_segments(client: TestClient) -> None:
    """Profiles with share of customers and median R, F, M."""
    body = client.get("/segments").json()
    assert [s["segment_name"] for s in body] == ["Champions", "Lost"]
    assert body[0]["share"] == 0.5
    assert (body[0]["recency_median"], body[1]["monetary_median"]) == (10.0, 300.0)


def test_stats(client: TestClient) -> None:
    """stats.json is returned as written by the pipeline."""
    assert client.get("/stats").json() == STATS


def test_at_risk_threshold_sort_and_top(client: TestClient) -> None:
    """4 customers below 0.3; highest net value first; integer ids; top 2."""
    body = client.get("/at-risk?threshold=0.3&top=2").json()
    assert body["total"] == 4
    assert [c["customer_id"] for c in body["customers"]] == [102, 104]
    assert all(isinstance(c["customer_id"], int) for c in body["customers"])
    assert body["customers"][0]["segment_name"] == "Lost"


def test_at_risk_customer_who_cancelled_everything_comes_last(
    client: TestClient,
) -> None:
    """103 has the highest gross value (800) but a net value of 0: last."""
    body = client.get("/at-risk?threshold=0.3").json()
    assert [c["customer_id"] for c in body["customers"]] == [102, 104, 106, 103]
    last = body["customers"][-1]
    assert (last["monetary"], last["monetary_net"]) == (800.0, 0.0)


@pytest.mark.parametrize("query", ["threshold=1.5", "threshold=-0.1", "top=0"])
def test_at_risk_rejects_bad_parameters(client: TestClient, query: str) -> None:
    """Threshold outside [0, 1] or top < 1: 422."""
    assert client.get(f"/at-risk?{query}").status_code == 422
