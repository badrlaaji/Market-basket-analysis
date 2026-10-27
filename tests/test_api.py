"""Tests for the FastAPI app, on tiny output files written in tmp_path.

No Spark here: this file must also run in the API image (no pyspark).
"""

import json
from collections.abc import Iterator
from pathlib import Path

import pandas as pd
import pytest
from fastapi.testclient import TestClient

from api import queries
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
        "customer_share": [0.5, 0.5],
        "revenue_share": [0.5636, 0.4364],  # 1,550 and 1,200 of 2,750
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
TOP_PRODUCTS = pd.DataFrame(
    {
        "segment": [0, 0, 1],
        "rank": [1, 2, 1],
        "stock_code": ["B", "A", "E"],
        "description": ["BLUE LAMP", "RED MUG", "TEA SET"],
        "customer_share": [0.67, 1.0, 0.33],
        "preference": [1.5, 1.2, 2.0],
    }
)
TRANSITIONS = pd.DataFrame(
    {
        "segment_before": [-1, 0, 0, 1],
        "segment_now": [1, 0, 1, 1],
        "n_customers": [2, 2, 1, 1],
        "date_before": ["2011-09-11"] * 4,
        "date_now": ["2011-12-10"] * 4,
    }
)
MONTHLY = pd.DataFrame(
    {
        "month": ["2011-11", "2011-12"],
        "revenue": [1000.0, 200.0],
        "n_invoices": [10, 3],
        "n_customers": [8, 3],
        "complete": [True, False],
    }
)
MODEL_REPORT = {
    "pr": {
        "model": [{"x": 0.0, "y": 1.0}, {"x": 1.0, "y": 0.4}],
        "baseline": [{"x": 0.0, "y": 0.8}, {"x": 1.0, "y": 0.4}],
    },
    "roc": {
        "model": [{"x": 0.0, "y": 0.0}, {"x": 1.0, "y": 1.0}],
        "baseline": [{"x": 0.0, "y": 0.0}, {"x": 1.0, "y": 1.0}],
    },
    "calibration": [{"proba_mean": 0.2, "rate": 0.3, "n": 4, "ci95": 0.45}],
    "importances": [
        {"feature": "frequency", "importance": 0.6},
        {"feature": "recency", "importance": 0.4},
    ],
}
K_REPORT = {
    "k": 4,
    "metric": "silhouette, squared Euclidean distance (Spark default)",
    "scores": [{"k": 2, "silhouette": 0.6}, {"k": 3, "silhouette": 0.55}],
}
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
    TOP_PRODUCTS.to_parquet(tmp_path / "segment_top_products.parquet")
    MONTHLY.to_parquet(tmp_path / "monthly_sales.parquet")
    TRANSITIONS.to_parquet(tmp_path / "segment_transitions.parquet")
    (tmp_path / "stats.json").write_text(json.dumps(STATS))
    (tmp_path / "model_report.json").write_text(json.dumps(MODEL_REPORT))
    (tmp_path / "segments_k_report.json").write_text(json.dumps(K_REPORT))
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
    ["min_confidence=1.5", "min_lift=-1", "limit=0", "limit=2001", "sort=price"],
)
def test_rules_rejects_bad_parameters(client: TestClient, query: str) -> None:
    """Out-of-range or unknown values are rejected with 422."""
    assert client.get(f"/rules?{query}").status_code == 422


def test_rules_limit_up_to_2000(client: TestClient) -> None:
    """The /rules chart loads every rule: limit accepts up to 2,000."""
    body = client.get("/rules?limit=2000").json()
    assert (body["total"], len(body["rules"])) == (5, 5)


def test_rules_export_csv(client: TestClient) -> None:
    """Same filters as /rules, no limit; antecedents joined with " + "."""
    response = client.get("/rules/export?min_lift=2")
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/csv")
    assert "attachment" in response.headers["content-disposition"]
    lines = response.text.splitlines()
    assert lines[0] == (
        "antecedent,antecedent_names,consequent,consequent_name,support,confidence,lift"
    )
    assert len(lines) == 1 + 4  # header + the 4 rules with lift >= 2
    assert lines[1] == "A + D,RED MUG + PINK BAG,C,GREEN BOX,0.05,0.5,4.0"


def test_rules_export_rejects_bad_parameters(client: TestClient) -> None:
    """The export validates its filters like /rules."""
    assert client.get("/rules/export?min_confidence=2").status_code == 422


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
    # base rate = confidence / lift: 0.5 / 4.0 and 0.6 / 3.0
    assert [r["base_rate"] for r in body["recommendations"]] == pytest.approx(
        [0.125, 0.2]
    )
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
    """Profiles with shares, median R, F, M and the segment's top products."""
    body = client.get("/segments").json()
    assert [s["segment_name"] for s in body] == ["Champions", "Lost"]
    assert (body[0]["customer_share"], body[0]["revenue_share"]) == (0.5, 0.5636)
    assert (body[0]["recency_median"], body[1]["monetary_median"]) == (10.0, 300.0)
    assert [p["stock_code"] for p in body[0]["top_products"]] == ["B", "A"]
    assert [p["stock_code"] for p in body[1]["top_products"]] == ["E"]


def test_segments_radar_scores(client: TestClient) -> None:
    """Mean percentile rank x 100; recent customers score high on recency."""
    champions, lost = client.get("/segments").json()
    # -recency ranks: 101 (5 days) 6/6, 105 5/6, 106 4/6 | 102 3/6, 103 2/6, 104 1/6
    assert champions["score_recency"] == pytest.approx(500 / 6)
    assert lost["score_recency"] == pytest.approx(200 / 6)
    for key in ["score_frequency", "score_monetary", "score_basket"]:
        assert 0 <= lost[key] <= 100
    assert champions["score_repurchase"] > lost["score_repurchase"]


def test_segments_revenue_by_band(client: TestClient) -> None:
    """Revenue per frequency band: 105 (8) and 106 (6) both in 5-9."""
    champions, lost = client.get("/segments").json()
    assert {
        b["frequency_band"]: b["revenue"] for b in champions["revenue_by_band"]
    } == {
        "5-9": 1050.0,
        "10+": 500.0,
    }
    assert {b["frequency_band"]: b["n_customers"] for b in lost["revenue_by_band"]} == {
        "1": 2,
        "2": 1,
    }


def test_segments_map(client: TestClient) -> None:
    """Sample keeps each segment's share; no customer id; same sample twice."""
    points = client.get("/segments/map?n=3").json()
    assert set(points[0]) == {"recency", "frequency", "monetary", "segment"}
    assert sorted(p["segment"] for p in points) == [0, 0, 1, 1]  # half of 3 + 3
    assert client.get("/segments/map?n=3").json() == points
    assert len(client.get("/segments/map").json()) == 6  # default n > customers


@pytest.mark.parametrize("query", ["n=0", "n=6001"])
def test_segments_map_rejects_bad_n(client: TestClient, query: str) -> None:
    """n outside [1, 6000]: 422."""
    assert client.get(f"/segments/map?{query}").status_code == 422


def test_segments_grid(client: TestClient) -> None:
    """5 recency quintiles x 5 fixed frequency bands, every customer counted once."""
    cells = client.get("/segments/grid").json()
    assert len(cells) == 25
    assert sum(c["n_customers"] for c in cells) == 6
    by_cell = {(c["recency_quintile"], c["frequency_band"]): c for c in cells}
    # Recency 5 and 10 days: first quintile; frequency 10 -> "10+", 8 -> "5-9"
    assert by_cell[(1, "10+")]["n_customers"] == 1
    assert by_cell[(1, "5-9")]["top_segment"] == 0
    assert (by_cell[(1, "1")]["n_customers"], by_cell[(1, "1")]["top_segment"]) == (
        0,
        None,
    )
    assert (by_cell[(1, "1")]["recency_min"], by_cell[(1, "1")]["recency_max"]) == (
        5,
        10,
    )
    assert by_cell[(5, "1")]["top_segment"] == 1  # customer 104: 500 days, 1 invoice


def test_segments_k(client: TestClient) -> None:
    """The k report is returned as written by the pipeline."""
    assert client.get("/segments/k").json() == K_REPORT


def test_segments_transitions(client: TestClient) -> None:
    """Dates once, then one flow per (before, now) pair; -1 = new customers."""
    body = client.get("/segments/transitions").json()
    assert (body["date_before"], body["date_now"]) == ("2011-09-11", "2011-12-10")
    assert body["flows"][0] == {
        "segment_before": -1,
        "segment_now": 1,
        "n_customers": 2,
    }
    assert sum(flow["n_customers"] for flow in body["flows"]) == 6


def test_scenarios(client: TestClient) -> None:
    """Only antecedents of 2+ products: {A, D}, with its product names."""
    assert client.get("/scenarios").json() == [
        {"items": ["A", "D"], "names": ["RED MUG", "PINK BAG"], "n_rules": 1}
    ]


def test_timeline(client: TestClient) -> None:
    """Monthly sales as written by the pipeline, partial month flagged."""
    body = client.get("/timeline").json()
    assert [m["month"] for m in body] == ["2011-11", "2011-12"]
    assert [m["complete"] for m in body] == [True, False]


def test_model(client: TestClient) -> None:
    """Metrics from stats.json, curves and calibration from model_report.json."""
    body = client.get("/model").json()
    assert body["metrics"] == STATS["model"]
    assert body["pr"]["model"][0] == {"x": 0.0, "y": 1.0}
    assert body["calibration"][0]["n"] == 4
    assert [i["feature"] for i in body["importances"]] == ["frequency", "recency"]


def test_stats(client: TestClient) -> None:
    """stats.json is returned as written by the pipeline."""
    assert client.get("/stats").json() == STATS


def test_at_risk_threshold_sort_and_top(client: TestClient) -> None:
    """4 customers below 0.3; highest net value first; integer ids; top 2."""
    body = client.get("/at-risk?threshold=0.3&top=2").json()
    assert body["total"] == 4
    assert body["revenue_at_risk"] == 450.0  # net: 300 + 0 + 100 + 50, all 4 counted
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


def test_at_risk_one_segment(client: TestClient) -> None:
    """segment=0: only customer 106 (0.25) is below 0.3."""
    body = client.get("/at-risk?threshold=0.3&segment=0").json()
    assert (body["total"], body["revenue_at_risk"]) == (1, 50.0)
    assert [c["customer_id"] for c in body["customers"]] == [106]
    assert client.get("/at-risk?segment=7").json()["total"] == 0  # unknown segment


def test_at_risk_histogram(client: TestClient) -> None:
    """20 bins of width 0.05; every customer in one bin; net spend summed."""
    bins = client.get("/at-risk/histogram").json()
    assert len(bins) == 20
    assert sum(b["n_customers"] for b in bins) == 6
    assert bins[1] == {
        "start": 0.05,
        "end": 0.1,
        "n_customers": 1,
        "monetary_net": 100.0,
    }
    lost = client.get("/at-risk/histogram?segment=1").json()
    assert [b["n_customers"] for b in lost if b["n_customers"]] == [1, 1, 1]


@pytest.mark.parametrize(
    "query",
    ["threshold=1.5", "threshold=-0.1", "top=0", "segment=-1", "sort=price"],
)
def test_at_risk_rejects_bad_parameters(client: TestClient, query: str) -> None:
    """Threshold outside [0, 1], top < 1 or an unknown sort: 422."""
    assert client.get(f"/at-risk?{query}").status_code == 422


def test_at_risk_returns_recency_and_stake(client: TestClient) -> None:
    """recency comes from the segments; stake = net spend x (1 - chance)."""
    body = client.get("/at-risk?threshold=0.3").json()
    first = body["customers"][0]
    assert first["customer_id"] == 102
    assert first["recency"] == 300
    assert first["stake"] == pytest.approx(300.0 * (1 - 0.2))


def test_at_risk_sort_by_stake(client: TestClient) -> None:
    """101 spent more than 102 but will likely come back (0.9): less at stake."""
    body = client.get("/at-risk?threshold=1&sort=stake").json()
    # stakes: 105 360, 102 240, 104 95, 101 50, 106 37.5, 103 0
    assert [c["customer_id"] for c in body["customers"]] == [
        105,
        102,
        104,
        101,
        106,
        103,
    ]
    assert [c["stake"] for c in body["customers"]] == pytest.approx(
        [360.0, 240.0, 95.0, 50.0, 37.5, 0.0]
    )


def test_at_risk_default_sort_is_unchanged(client: TestClient) -> None:
    """Without sort, or with sort=spend: highest net spend first, as before."""
    default = client.get("/at-risk?threshold=1").json()
    spend = client.get("/at-risk?threshold=1&sort=spend").json()
    expected = [105, 101, 102, 104, 106, 103]
    assert [c["customer_id"] for c in default["customers"]] == expected
    assert [c["customer_id"] for c in spend["customers"]] == expected


def test_at_risk_export_csv(client: TestClient) -> None:
    """Same filters and sort as /at-risk, no limit; one row per customer."""
    response = client.get("/at-risk/export?threshold=1&sort=stake")
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/csv")
    assert "attachment" in response.headers["content-disposition"]
    lines = response.text.splitlines()
    assert lines[0] == (
        "customer_id,group,chance_90d,last_order_days_ago,money_at_stake,"
        "spent_net,spent_gross"
    )
    assert len(lines) == 1 + 6  # header + every customer below 1
    assert lines[1] == "105,Champions,0.6,10,360.0,900.0,1000.0"
    assert [line.split(",")[0] for line in lines[1:]] == [
        "105",
        "102",
        "104",
        "101",
        "106",
        "103",
    ]


def test_at_risk_export_one_segment(client: TestClient) -> None:
    """segment=0 and threshold 0.3: only customer 106."""
    lines = client.get("/at-risk/export?threshold=0.3&segment=0").text.splitlines()
    assert [line.split(",")[0] for line in lines[1:]] == ["106"]


@pytest.mark.parametrize("query", ["threshold=2", "sort=price", "segment=-1"])
def test_at_risk_export_rejects_bad_parameters(client: TestClient, query: str) -> None:
    """The export validates its filters like /at-risk."""
    assert client.get(f"/at-risk/export?{query}").status_code == 422


def test_csv_cells_cannot_start_a_formula() -> None:
    """Text starting with =, +, -, @ gets a quote; numbers stay numbers."""
    table = pd.DataFrame(
        {
            "name": ["=SUM(A1)", "+33", "-cmd", "@me", "Mug", "\tx"],
            "value": [-25.5, 1.0, 2.0, 3.0, 4.0, 5.0],
        }
    )
    safe = queries.neutralize_formulas(table)
    assert list(safe["name"]) == ["'=SUM(A1)", "'+33", "'-cmd", "'@me", "Mug", "'\tx"]
    assert list(safe["value"]) == [-25.5, 1.0, 2.0, 3.0, 4.0, 5.0]
    assert table.loc[0, "name"] == "=SUM(A1)"  # the input is not changed
