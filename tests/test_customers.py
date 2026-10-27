"""Tests for pipeline.customers (customer card), on tiny hand-made DataFrames."""

from datetime import date, datetime

import pandas as pd
import pytest

from pipeline.customers import (
    build_customer_products,
    build_customer_profiles,
    build_lost_products,
    reference_date,
)

ROWS = [
    # invoice, stock_code, invoice_date, customer_id, country
    ("1", "A", datetime(2011, 1, 1, 9), 1.0, "United Kingdom"),
    ("1", "B", datetime(2011, 1, 1, 9), 1.0, "United Kingdom"),
    ("2", "A", datetime(2011, 1, 11, 9), 1.0, "United Kingdom"),
    ("2", "C", datetime(2011, 1, 11, 9), 1.0, "United Kingdom"),
    ("3", "A", datetime(2011, 1, 21, 9), 1.0, "France"),
    ("3", "C", datetime(2011, 1, 21, 9), 1.0, "France"),
    ("4", "B", datetime(2011, 2, 20, 9), 1.0, "United Kingdom"),
    ("4", "C", datetime(2011, 2, 20, 9), 1.0, "United Kingdom"),
    ("5", "A", datetime(2011, 2, 28, 9), 2.0, "Spain"),
    ("6", "B", datetime(2011, 2, 28, 15), 2.0, "Spain"),  # same day: one order day
    ("7", "A", datetime(2011, 2, 28, 16), None, "Spain"),  # guest order: ignored
]
REF = date(2011, 3, 1)  # day after the last invoice


@pytest.fixture
def clean() -> pd.DataFrame:
    """Customer 1: 4 orders, gaps 10, 10, 30 days. Customer 2: 2 invoices, 1 day."""
    columns = ["invoice", "stock_code", "invoice_date", "customer_id", "country"]
    return pd.DataFrame(ROWS, columns=columns)


def test_reference_date(clean: pd.DataFrame) -> None:
    """The day after the last invoice, as for the segments."""
    assert reference_date(clean) == REF


def test_customer_profiles(clean: pd.DataFrame) -> None:
    """Median gap 10 (not the mean 16.7); one order day: no rhythm."""
    profiles = build_customer_profiles(clean).set_index("customer_id")
    assert profiles.index.tolist() == [1, 2]
    one, two = profiles.loc[1], profiles.loc[2]
    assert (one["country"], one["first_order"], one["n_order_days"]) == (
        "United Kingdom",
        "2011-01-01",
        4,
    )
    assert one["usual_gap_days"] == 10.0
    assert (two["n_order_days"], two["first_order"]) == (1, "2011-02-28")
    assert pd.isna(two["usual_gap_days"])


def test_customer_products_ranked(clean: pd.DataFrame) -> None:
    """Most orders first; tie between A and C: the most recent (C) first."""
    products = build_customer_products(clean, top=10)
    one = products[products["customer_id"] == 1]
    assert one["stock_code"].tolist() == ["C", "A", "B"]
    assert one["rank"].tolist() == [1, 2, 3]
    assert one["n_orders"].tolist() == [3, 3, 2]
    assert build_customer_products(clean, top=1)["stock_code"].tolist() == ["C", "A"]


def test_lost_products(clean: pd.DataFrame) -> None:
    """A: 3 orders every 10 days, none for 39 days while the customer ordered again.

    B has only 2 orders; C was in the last order: neither is lost.
    """
    lost = build_lost_products(clean, REF)
    assert lost[["customer_id", "stock_code"]].values.tolist() == [[1, "A"]]
    row = lost.iloc[0]
    assert (row["n_orders"], row["usual_gap_days"], row["days_since"]) == (3, 10.0, 39)


def test_lost_products_needs_a_gap_twice_the_habit(clean: pd.DataFrame) -> None:
    """On 2011-02-10, A was last bought 20 days ago: exactly 2 x 10, not lost yet."""
    before = clean[clean["invoice_date"] < datetime(2011, 2, 10)]
    extra = pd.DataFrame(
        [("8", "B", datetime(2011, 2, 9, 9), 1.0, "United Kingdom")],
        columns=clean.columns,
    )
    lost = build_lost_products(pd.concat([before, extra]), date(2011, 2, 10))
    assert lost.empty
