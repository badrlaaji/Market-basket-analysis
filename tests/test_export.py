"""Tests for pipeline.export, on tiny hand-made DataFrames."""

import json
from datetime import datetime

import pandas as pd
import pytest

from pipeline.export import (
    build_monthly_sales,
    build_products,
    build_segment_top_products,
    build_stats,
    most_frequent_description,
)

ROWS = [
    # invoice, stock_code, description, invoice_date, customer_id
    ("1", "A", "RED MUG", datetime(2010, 1, 4, 9, 0), 10.0),
    ("1", "A", "RED MUG", datetime(2010, 1, 4, 9, 0), 10.0),  # same invoice twice
    ("2", "A", "MUG RED", datetime(2010, 2, 1, 9, 0), None),
    ("2", "B", "LAMP", datetime(2010, 2, 1, 9, 0), None),
    ("3", "B", "BLUE LAMP", datetime(2011, 3, 1, 9, 0), 20.0),  # tie with LAMP
    ("3", "C", "BOX ", datetime(2011, 3, 1, 9, 0), 20.0),  # trailing space
]


@pytest.fixture
def clean() -> pd.DataFrame:
    """3 products, 3 invoices, 2 known customers."""
    columns = ["invoice", "stock_code", "description", "invoice_date", "customer_id"]
    return pd.DataFrame(ROWS, columns=columns)


@pytest.fixture
def rules() -> pd.DataFrame:
    """One rule A -> B: product C has no rule."""
    return pd.DataFrame(
        {
            "antecedent": [["A"]],
            "consequent": ["B"],
            "support": [0.3],
            "confidence": [0.5],
            "lift": [1.6],
        }
    )


def test_most_frequent_description_with_tie(clean: pd.DataFrame) -> None:
    """A: RED MUG (2 rows) beats MUG RED (1); B: tie, alphabetical order wins."""
    names = most_frequent_description(clean)
    assert names.to_dict() == {"A": "RED MUG", "B": "BLUE LAMP", "C": "BOX"}


def test_build_products(clean: pd.DataFrame, rules: pd.DataFrame) -> None:
    """Distinct invoices per product, most bought first, rule flag."""
    products = build_products(clean, rules)
    assert products.columns.tolist() == [
        "stock_code",
        "description",
        "n_invoices",
        "in_rules",
    ]
    assert products["stock_code"].tolist() == ["A", "B", "C"]
    assert products["n_invoices"].tolist() == [2, 2, 1]  # invoice 1 counted once
    assert products["in_rules"].tolist() == [True, True, False]


def test_build_stats_is_json_ready(clean: pd.DataFrame, rules: pd.DataFrame) -> None:
    """Counts match the tiny table and the dict survives a JSON round trip."""
    stats = build_stats(10, clean, rules, {"pr_auc_model": 0.7})
    assert json.loads(json.dumps(stats)) == stats
    assert stats == {
        "raw_rows": 10,
        "clean_rows": 6,
        "invoices": 3,
        "customers": 2,
        "products": 3,
        "rules": 1,
        "products_in_rules": 2,
        "first_date": "2010-01-04",
        "last_date": "2011-03-01",
        "model": {"pr_auc_model": 0.7},
    }


SALES_ROWS = [
    # invoice, quantity, price, invoice_date, customer_id
    ("1", 2, 1.5, datetime(2011, 10, 1, 9, 0), 10.0),
    ("1", 1, 4.0, datetime(2011, 10, 1, 9, 0), 10.0),
    ("2", 1, 5.0, datetime(2011, 10, 20, 9, 0), None),  # unknown customer
    ("3", 3, 2.0, datetime(2011, 11, 30, 9, 0), 20.0),
    ("4", 1, 1.0, datetime(2011, 12, 9, 12, 50), 10.0),  # data stops on 9 December
]


@pytest.fixture
def sales() -> pd.DataFrame:
    """5 rows over 3 months; the last month stops on the 9th."""
    columns = ["invoice", "quantity", "price", "invoice_date", "customer_id"]
    return pd.DataFrame(SALES_ROWS, columns=columns)


def test_build_monthly_sales(sales: pd.DataFrame) -> None:
    """Revenue includes unknown customers; customers do not; December is partial."""
    monthly = build_monthly_sales(sales)
    assert monthly.columns.tolist() == [
        "month",
        "revenue",
        "n_invoices",
        "n_customers",
        "complete",
    ]
    assert monthly["month"].tolist() == ["2011-10", "2011-11", "2011-12"]
    assert monthly["revenue"].tolist() == [12.0, 6.0, 1.0]  # 3 + 4 + 5 in October
    assert monthly["n_invoices"].tolist() == [2, 1, 1]
    assert monthly["n_customers"].tolist() == [1, 1, 1]
    assert monthly["complete"].tolist() == [True, True, False]


def test_build_monthly_sales_first_month_partial(sales: pd.DataFrame) -> None:
    """Data starting on 20 October: October is partial too."""
    monthly = build_monthly_sales(sales.iloc[2:])
    assert monthly["complete"].tolist() == [False, True, False]


@pytest.fixture
def purchases() -> pd.DataFrame:
    """Customers 1, 2 in segment 0 and 3, 4 in segment 1; product A everywhere."""
    rows = [(1, "A"), (1, "A"), (1, "B"), (2, "A"), (3, "A"), (3, "C"), (4, "C")]
    return pd.DataFrame(rows, columns=["customer_id", "stock_code"]).assign(
        customer_id=lambda df: df["customer_id"].astype("float64")  # as in Parquet
    )


def test_build_segment_top_products(purchases: pd.DataFrame) -> None:
    """Preference = share of the segment's purchases / share of all purchases."""
    segments = pd.DataFrame({"customer_id": [1, 2, 3, 4], "segment": [0, 0, 1, 1]})
    names = pd.Series({"A": "RED MUG", "B": "BLUE LAMP", "C": "GREEN BOX"})
    top = build_segment_top_products(purchases, segments, names)
    # 6 customer-product pairs: A 3, B 1, C 2. Segment 0: A 2 of 3, B 1 of 3
    # B: (1/3) / (1/6) = 2.0 beats A: (2/3) / (3/6) = 1.33 although fewer buy it
    assert top[["segment", "rank", "stock_code"]].values.tolist() == [
        [0, 1, "B"],
        [0, 2, "A"],
        [1, 1, "C"],
        [1, 2, "A"],
    ]
    assert top["preference"].tolist() == pytest.approx([2.0, 4 / 3, 2.0, 2 / 3])
    assert top["customer_share"].tolist() == [0.5, 1.0, 1.0, 0.5]
    assert top["description"].tolist()[:2] == ["BLUE LAMP", "RED MUG"]


def test_segment_top_products_minimum_share(purchases: pd.DataFrame) -> None:
    """Products bought by fewer customers than min_share are left out."""
    segments = pd.DataFrame({"customer_id": [1, 2, 3, 4], "segment": [0, 0, 1, 1]})
    names = pd.Series({"A": "RED MUG", "B": "BLUE LAMP", "C": "GREEN BOX"})
    top = build_segment_top_products(purchases, segments, names, min_share=0.6)
    assert top["stock_code"].tolist() == ["A", "C"]  # B and A (segment 1): 50 %
