"""Customer card: rhythm, favourite products and lost products of each customer.

Written by export.py: outputs/customer_profiles.parquet,
outputs/customer_products.parquet, outputs/lost_products.parquet.
Rules, not machine learning: each figure can be checked by hand.
"""

from datetime import date, timedelta

import pandas as pd

TOP_PRODUCTS = 10  # per customer: 3 shown, 10 used as the basket for the offers
LOST_MIN_ORDERS = 3  # a habit needs at least 3 orders of the product
LOST_GAP_FACTOR = 2  # lost: not bought for more than 2 x its usual gap
LOST_PER_CUSTOMER = 3


def reference_date(clean: pd.DataFrame) -> date:
    """Day after the last invoice: every "days ago" is counted from it."""
    return clean["invoice_date"].max().date() + timedelta(days=1)


def known_lines(clean: pd.DataFrame) -> pd.DataFrame:
    """Lines with a customer id (int), plus the day of the order."""
    lines = clean.dropna(subset=["customer_id"]).astype({"customer_id": "int64"})
    return lines.assign(day=lines["invoice_date"].dt.normalize())


def median_gap(days: pd.DataFrame, keys: list[str]) -> pd.Series:
    """Median number of days between consecutive distinct days, per key."""
    days = days.drop_duplicates([*keys, "day"]).sort_values([*keys, "day"])
    gaps = days.groupby(keys)["day"].diff().dt.days
    return gaps.groupby([days[key] for key in keys]).median()


def build_customer_profiles(clean: pd.DataFrame) -> pd.DataFrame:
    """Country, first order, order days and usual gap (median) of each customer.

    The median resists one long break; the gap is empty below 2 order days.
    """
    lines = known_lines(clean)
    country = (
        lines.groupby(["customer_id", "country"])
        .size()
        .rename("n")
        .reset_index()
        .sort_values(["customer_id", "n", "country"], ascending=[True, False, True])
        .drop_duplicates("customer_id")
        .set_index("customer_id")["country"]
    )
    by_customer = lines.groupby("customer_id")
    profiles = pd.DataFrame(
        {
            "country": country,
            "first_order": by_customer["day"].min().dt.strftime("%Y-%m-%d"),
            "n_order_days": by_customer["day"].nunique(),
            "usual_gap_days": median_gap(lines, ["customer_id"]),
        }
    )
    return profiles.rename_axis("customer_id").reset_index()


def build_customer_products(
    clean: pd.DataFrame, top: int = TOP_PRODUCTS
) -> pd.DataFrame:
    """Products of each customer: most orders first, then the most recent."""
    lines = known_lines(clean)
    products = (
        lines.groupby(["customer_id", "stock_code"])
        .agg(n_orders=("invoice", "nunique"), last_bought=("day", "max"))
        .reset_index()
        .sort_values(
            ["customer_id", "n_orders", "last_bought", "stock_code"],
            ascending=[True, False, False, True],
        )
    )
    products["rank"] = products.groupby("customer_id").cumcount() + 1
    products = products[products["rank"] <= top]
    columns = ["customer_id", "rank", "stock_code", "n_orders"]
    return products[columns].reset_index(drop=True)


def build_lost_products(
    clean: pd.DataFrame,
    ref_date: date,
    min_orders: int = LOST_MIN_ORDERS,
    factor: int = LOST_GAP_FACTOR,
    per_customer: int = LOST_PER_CUSTOMER,
) -> pd.DataFrame:
    """Products a customer bought regularly but no longer, while still ordering.

    Lost: bought on min_orders days or more, not bought for more than
    factor x its usual gap, and the customer ordered again after it.
    """
    lines = known_lines(clean)
    keys = ["customer_id", "stock_code"]
    # n_days for the habit (gaps between days); n_orders (invoices) for display,
    # counted like customer_products so the card shows one number per product
    pairs = lines.groupby(keys).agg(
        n_days=("day", "nunique"),
        n_orders=("invoice", "nunique"),
        last_bought=("day", "max"),
    )
    pairs["usual_gap_days"] = median_gap(lines, keys)
    last_order = lines.groupby("customer_id")["day"].max()
    pairs = pairs.reset_index()
    pairs["days_since"] = (pd.Timestamp(ref_date) - pairs["last_bought"]).dt.days
    lost = pairs[
        (pairs["n_days"] >= min_orders)
        & (pairs["days_since"] > factor * pairs["usual_gap_days"])
        & (pairs["customer_id"].map(last_order) > pairs["last_bought"])
    ]
    lost = lost.sort_values(
        ["customer_id", "n_orders", "days_since", "stock_code"],
        ascending=[True, False, True, True],
    )
    lost = lost.groupby("customer_id").head(per_customer)
    columns = ["customer_id", "stock_code", "n_orders", "usual_gap_days", "days_since"]
    return lost[columns].reset_index(drop=True)
