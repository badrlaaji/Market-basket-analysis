"""Tests for ml.repurchase, on a tiny hand-made transaction table (no Spark)."""

from datetime import date, datetime
from pathlib import Path

import pandas as pd
import pytest

from ml.repurchase import (
    COLUMNS,
    build_dataset,
    build_features,
    evaluate,
    load_transactions,
    recency_baseline,
    score_customers,
    score_date,
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


def test_score_customers_contract(transactions: pd.DataFrame) -> None:
    """Contract columns and types; the segment is only joined, not a feature."""
    model = train_model(build_dataset(transactions, REF))
    segments = pd.DataFrame(
        {"customer_id": pd.array([4, 1, 2], dtype="int32"), "segment": [1, 0, 3]}
    )
    scores = score_customers(model, build_features(transactions, REF), segments)
    assert scores.columns.tolist() == [
        "customer_id",
        "proba_90d",
        "segment",
        "monetary",
    ]
    assert scores["customer_id"].tolist() == [1, 2, 4]
    assert scores["customer_id"].dtype == "int64"
    assert scores["segment"].tolist() == [0, 3, 1]
    assert scores["proba_90d"].between(0, 1).all()
    assert scores["monetary"].tolist() == [13.0, 5.0, 2.0]


def test_score_customers_fails_on_missing_segment(transactions: pd.DataFrame) -> None:
    """A customer without segment raises instead of writing a NaN segment."""
    model = train_model(build_dataset(transactions, REF))
    segments = pd.DataFrame({"customer_id": [1, 2], "segment": [0, 3]})
    with pytest.raises(ValueError):
        score_customers(model, build_features(transactions, REF), segments)
