"""Tests for ml.repurchase, on a tiny hand-made transaction table (no Spark)."""

from datetime import date, datetime
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

from ml.repurchase import (
    COLUMNS,
    FEATURES,
    build_dataset,
    build_features,
    calibration_bins,
    cancelled_amounts,
    curves,
    evaluate,
    importances,
    load_transactions,
    recency_baseline,
    score_customers,
    score_date,
    thin_curve,
    train_model,
)

REF = date(2011, 9, 10)  # ref - 90 days = 2011-06-12 ; ref + 90 days = 2011-12-09
ROWS = [
    # invoice, stock_code, quantity, invoice_date, price, customer_id
    ("1", "A", 2, datetime(2011, 1, 5, 10, 0), 1.5, 1),
    ("1", "B", 1, datetime(2011, 1, 5, 10, 0), 4.0, 1),
    ("2", "A", 3, datetime(2011, 8, 20, 15, 30), 2.0, 1),  # in the last 90 days
    ("3", "B", 1, datetime(2011, 5, 1, 12, 0), 5.0, 2),
    ("4", "C", 1, datetime(2011, 6, 1, 9, 0), 2.0, 4),
    # On or after ref_date: labels only, never features
    ("5", "C", 1, datetime(2011, 9, 15, 9, 0), 10.0, 1),
    ("6", "A", 1, datetime(2011, 9, 20, 9, 0), 1.0, 3),  # new customer
    ("7", "A", 1, datetime(2011, 12, 9, 0, 0), 1.0, 4),  # ref + 90 days: outside
    ("8", "B", 1, datetime(2011, 9, 10, 0, 0), 1.0, 2),  # ref_date itself: inside
]


@pytest.fixture
def transactions() -> pd.DataFrame:
    """The 9 rows above, with the columns of clean.parquet."""
    return pd.DataFrame(ROWS, columns=COLUMNS)


def test_load_transactions_keeps_known_customers(tmp_path: Path) -> None:
    """Rows without customer are dropped; customer_id becomes an integer."""
    raw = pd.DataFrame(ROWS[:2], columns=COLUMNS).astype({"customer_id": "float64"})
    raw.loc[1, "customer_id"] = None
    raw.to_parquet(tmp_path / "clean.parquet")
    df = load_transactions(tmp_path / "clean.parquet")
    assert df["customer_id"].tolist() == [1]
    assert df["customer_id"].dtype == "int64"


def test_build_features_by_hand(transactions: pd.DataFrame) -> None:
    """Customer 1: invoices on 01-05 (3 + 4) and 08-20 (6), before 09-10."""
    features = build_features(transactions, REF)
    assert features.index.tolist() == [1, 2, 4]  # customer 3 starts after REF
    assert features.loc[1].to_dict() == {
        "recency": 21,  # 08-20 -> 09-10
        "frequency": 2,
        "monetary": 13.0,
        "tenure": 248,  # 2011-01-05 -> 2011-09-10
        "avg_basket": 6.5,
        "n_products": 2,
        "invoices_90d": 1,  # only invoice 2 is after 06-12
    }
    assert features.loc[4, "recency"] == 101  # 06-01 -> 09-10
    assert features.loc[4, "invoices_90d"] == 0  # 06-01 is before 06-12


def test_no_leak_from_purchases_after_ref_date(transactions: pd.DataFrame) -> None:
    """Changing, adding or deleting purchases on or after ref_date changes nothing."""
    expected = build_features(transactions, REF)
    future = transactions["invoice_date"] >= pd.Timestamp(REF)
    changed = transactions.copy()
    changed.loc[future, ["quantity", "price"]] = [1000, 99.0]  # modified
    changed = changed[~(future & (changed["customer_id"] == 1))]  # deleted
    extra = pd.DataFrame(
        [("9", "Z", 50, datetime(2011, 10, 1), 7.0, 2)], columns=COLUMNS
    )
    changed = pd.concat([changed, extra], ignore_index=True)  # added
    pd.testing.assert_frame_equal(build_features(changed, REF), expected)
    pd.testing.assert_frame_equal(build_features(transactions[~future], REF), expected)


def test_build_dataset_labels_and_window_bounds(transactions: pd.DataFrame) -> None:
    """Window [ref_date, ref_date + 90 days): start included, end excluded."""
    data = build_dataset(transactions, REF)
    # 1: buys on 09-15 ; 2: buys on 09-10 00:00 ; 4: buys on 12-09 00:00 (too late)
    assert data["label"].to_dict() == {1: 1, 2: 1, 4: 0}


def test_recency_baseline_ranks_recent_customers_first(
    transactions: pd.DataFrame,
) -> None:
    """Recency 21, 101 and 132 days: customer 1 first, customer 2 last."""
    scores = recency_baseline(build_features(transactions, REF))
    assert scores.sort_values(ascending=False).index.tolist() == [1, 4, 2]


def test_evaluate_perfect_and_reversed_scores() -> None:
    """A perfect ranking gives 1.0; a reversed one gives a ROC-AUC of 0."""
    labels = pd.Series([0, 0, 1, 1])
    assert evaluate(labels, pd.Series([0.1, 0.2, 0.8, 0.9])) == {
        "pr_auc": 1.0,
        "roc_auc": 1.0,
    }
    assert evaluate(labels, pd.Series([0.9, 0.8, 0.2, 0.1]))["roc_auc"] == 0.0


def test_score_date_is_day_after_last_invoice(transactions: pd.DataFrame) -> None:
    """Last invoice on 2011-12-09 -> scoring date 2011-12-10."""
    assert score_date(transactions) == date(2011, 12, 10)


def test_cancelled_amounts_uses_the_etl_product_rules() -> None:
    """Customer 1: -3 (duplicate and postage ignored); 2: -5; unknown dropped."""
    day = datetime(2011, 5, 2, 10, 0)
    rows = [
        ("C1", "a ", "RED MUG", -2, day, 1.5, 1.0, "UK"),  # code normalized to A
        ("C1", "a ", "RED MUG", -2, day, 1.5, 1.0, "UK"),  # exact duplicate
        ("C2", "POST", "POSTAGE", -1, day, 18.0, 1.0, "UK"),  # not a product
        ("C3", "22423", "CAKESTAND", -1, day, 5.0, 2.0, "UK"),
        ("C4", "22423", "CAKESTAND", -3, day, 5.0, None, "UK"),  # no customer
        ("10", "A", "RED MUG", 4, day, 1.5, 1.0, "UK"),  # a purchase, not cancelled
    ]
    columns = ["Invoice", "StockCode", "Description", "Quantity"]
    columns += ["InvoiceDate", "Price", "Customer ID", "Country"]
    cancelled = cancelled_amounts(pd.DataFrame(rows, columns=columns))
    assert cancelled.to_dict() == {1: -3.0, 2: -5.0}


def test_score_customers_contract(transactions: pd.DataFrame) -> None:
    """Contract columns and types; segment and net value are display only."""
    model = train_model(build_dataset(transactions, REF))
    segments = pd.DataFrame(
        {"customer_id": pd.array([4, 1, 2], dtype="int32"), "segment": [1, 0, 3]}
    )
    cancelled = pd.Series({1: -3.0, 2: -5.0})  # customer 2 cancelled everything
    features = build_features(transactions, REF)
    scores = score_customers(model, features, segments, cancelled)
    assert scores.columns.tolist() == [
        "customer_id",
        "proba_90d",
        "segment",
        "monetary",
        "monetary_net",
    ]
    assert scores["customer_id"].tolist() == [1, 2, 4]
    assert scores["customer_id"].dtype == "int64"
    assert scores["segment"].tolist() == [0, 3, 1]
    assert scores["proba_90d"].between(0, 1).all()
    assert scores["monetary"].tolist() == [13.0, 5.0, 2.0]
    assert scores["monetary_net"].tolist() == [10.0, 0.0, 2.0]  # 4: no cancellation


def test_score_customers_fails_on_missing_segment(transactions: pd.DataFrame) -> None:
    """A customer without segment raises instead of writing a NaN segment."""
    model = train_model(build_dataset(transactions, REF))
    segments = pd.DataFrame({"customer_id": [1, 2], "segment": [0, 3]})
    features = build_features(transactions, REF)
    with pytest.raises(ValueError):
        score_customers(model, features, segments, pd.Series(dtype="float64"))


def test_thin_curve_keeps_both_ends() -> None:
    """1,001 points -> 100 real points, first and last kept; never more points."""
    xs = np.linspace(0, 1, 1001)
    points = thin_curve(xs, xs**2, n_points=100)
    assert len(points) == 100
    assert points[0] == {"x": 0.0, "y": 0.0}
    assert points[-1] == {"x": 1.0, "y": 1.0}
    assert len(thin_curve(np.array([0.0, 1.0]), np.array([0.0, 1.0]))) == 2


def test_curves_of_a_perfect_score() -> None:
    """Perfect ranking: precision 1 at full recall, ROC through (0, 1)."""
    labels = pd.Series([0, 0, 1, 1])
    result = curves(labels, pd.Series([0.1, 0.2, 0.8, 0.9]))
    recalls = [point["x"] for point in result["pr"]]
    assert recalls == sorted(recalls)  # drawn from left to right
    assert {"x": 1.0, "y": 1.0} in result["pr"]
    assert {"x": 0.0, "y": 1.0} in result["roc"]
    assert result["roc"][-1] == {"x": 1.0, "y": 1.0}


def test_calibration_bins_by_hand() -> None:
    """2 bins of 4 customers: mean probability, observed rate, 95 % interval."""
    proba = pd.Series([0.1, 0.2, 0.3, 0.4, 0.6, 0.7, 0.8, 0.9])
    labels = pd.Series([0, 0, 0, 1, 1, 1, 0, 1])
    bins = calibration_bins(labels, proba, n_bins=2)
    assert [b["n"] for b in bins] == [4, 4]
    assert [b["proba_mean"] for b in bins] == pytest.approx([0.25, 0.75])
    assert [b["rate"] for b in bins] == [0.25, 0.75]
    # 1.96 x sqrt(0.25 x 0.75 / 4) = 0.424
    assert bins[0]["ci95"] == pytest.approx(0.4244, abs=1e-4)


def test_importances_sorted_and_sum_to_one() -> None:
    """Label driven by recency only: recency first, gains summing to 1."""
    rng = np.random.default_rng(0)
    train = pd.DataFrame(rng.random((200, len(FEATURES))), columns=FEATURES)
    train["label"] = (train["recency"] < 0.5).astype("int64")
    ranked = importances(train_model(train))
    assert sorted(row["feature"] for row in ranked) == sorted(FEATURES)
    assert ranked[0]["feature"] == "recency"
    values = [row["importance"] for row in ranked]
    assert values == sorted(values, reverse=True)
    assert sum(values) == pytest.approx(1.0, abs=1e-6)
