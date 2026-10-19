"""Tests for pipeline.export, on tiny hand-made DataFrames."""

import json
from datetime import datetime

import pandas as pd
import pytest

from pipeline.export import build_products, build_stats, most_frequent_description

ROWS = [
    # invoice, stock_code, description, invoice_date, customer_id
    ("1", "A", "RED MUG", datetime(2010, 1, 4, 9, 0), 10.0),
    ("1", "A", "RED MUG", datetime(2010, 1, 4, 9, 0), 10.0),  # same invoice twice
    ("2", "A", "MUG RED", datetime(2010, 2, 1, 9, 0), None),
    ("2", "B", "LAMP", datetime(2010, 2, 1, 9, 0), None),
    ("3", "B", "BLUE LAMP", datetime(2011, 3, 1, 9, 0), 20.0),  # tie with LAMP
    ("3", "C", "BOX", datetime(2011, 3, 1, 9, 0), 20.0),
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
