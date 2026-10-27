"""Small outputs for the API.

outputs/products.parquet, outputs/stats.json, outputs/monthly_sales.parquet,
outputs/segment_top_products.parquet, and the customer card files
(customer_profiles, customer_products, lost_products: see customers.py)
"""

import json
from pathlib import Path

import pandas as pd
import pyarrow.parquet as pq

from pipeline import customers

ROOT = Path(__file__).resolve().parents[1]
RAW_PARQUET = ROOT / "data" / "interim" / "raw.parquet"
CLEAN_PARQUET = ROOT / "data" / "interim" / "clean.parquet"
METRICS_JSON = ROOT / "data" / "interim" / "repurchase_metrics.json"
RULES_PARQUET = ROOT / "outputs" / "rules.parquet"
SEGMENTS_PARQUET = ROOT / "outputs" / "segments.parquet"
PRODUCTS_PARQUET = ROOT / "outputs" / "products.parquet"
STATS_JSON = ROOT / "outputs" / "stats.json"
MONTHLY_PARQUET = ROOT / "outputs" / "monthly_sales.parquet"
TOP_PRODUCTS_PARQUET = ROOT / "outputs" / "segment_top_products.parquet"
CUSTOMER_PROFILES_PARQUET = ROOT / "outputs" / "customer_profiles.parquet"
CUSTOMER_PRODUCTS_PARQUET = ROOT / "outputs" / "customer_products.parquet"
LOST_PRODUCTS_PARQUET = ROOT / "outputs" / "lost_products.parquet"
COLUMNS = ["invoice", "stock_code", "description", "invoice_date", "customer_id"]
COLUMNS += ["quantity", "price", "country"]
PRODUCT_COLUMNS = ["stock_code", "description", "n_invoices", "in_rules"]
TOP_COLUMNS = ["segment", "rank", "stock_code", "description"]
TOP_COLUMNS += ["customer_share", "preference"]
TOP_PRODUCTS = 5  # per segment
MIN_CUSTOMER_SHARE = 0.05  # bought by at least 5 % of the segment's customers


def most_frequent_description(clean: pd.DataFrame) -> pd.Series:
    """Most frequent description of each stock code (tie: alphabetical order)."""
    clean = clean.assign(description=clean["description"].str.strip())  # "X " = "X"
    counts = clean.groupby(["stock_code", "description"]).size().rename("n")
    counts = counts.reset_index().sort_values(
        ["stock_code", "n", "description"], ascending=[True, False, True]
    )
    return counts.drop_duplicates("stock_code").set_index("stock_code")["description"]


def rule_products(rules: pd.DataFrame) -> set[str]:
    """Stock codes used by at least one rule, as antecedent or consequent."""
    codes = set(rules["consequent"])
    for antecedent in rules["antecedent"]:
        codes.update(antecedent)
    return codes


def build_products(clean: pd.DataFrame, rules: pd.DataFrame) -> pd.DataFrame:
    """One row per product, most bought first; in_rules marks products with a rule."""
    products = clean.groupby("stock_code").agg(n_invoices=("invoice", "nunique"))
    products["description"] = most_frequent_description(clean)
    products["in_rules"] = products.index.isin(rule_products(rules))
    products = products.reset_index().sort_values(
        ["n_invoices", "stock_code"], ascending=[False, True]
    )
    return products[PRODUCT_COLUMNS].reset_index(drop=True)


def build_stats(
    raw_rows: int, clean: pd.DataFrame, rules: pd.DataFrame, model: dict
) -> dict:
    """Key figures for the home page, as plain Python types (JSON-ready)."""
    return {
        "raw_rows": int(raw_rows),
        "clean_rows": len(clean),
        "invoices": int(clean["invoice"].nunique()),
        "customers": int(clean["customer_id"].nunique()),  # NaN not counted
        "products": int(clean["stock_code"].nunique()),
        "rules": len(rules),
        "products_in_rules": len(rule_products(rules)),
        "first_date": clean["invoice_date"].min().date().isoformat(),
        "last_date": clean["invoice_date"].max().date().isoformat(),
        "model": model,
    }


def build_monthly_sales(clean: pd.DataFrame) -> pd.DataFrame:
    """Revenue, invoices and known customers per month; partial months flagged."""
    sales = clean.assign(
        month=clean["invoice_date"].dt.to_period("M"),
        amount=clean["quantity"] * clean["price"],
    )
    monthly = sales.groupby("month").agg(
        revenue=("amount", "sum"),  # all invoices, unknown customers included
        n_invoices=("invoice", "nunique"),
        n_customers=("customer_id", "nunique"),  # NaN not counted
    )
    first, last = clean["invoice_date"].min(), clean["invoice_date"].max()
    monthly["complete"] = True
    if first.day != 1:
        monthly.loc[first.to_period("M"), "complete"] = False
    if not last.is_month_end:  # data stops before the end of the last month
        monthly.loc[last.to_period("M"), "complete"] = False
    monthly.index = monthly.index.astype(str)  # Period("2011-12") -> "2011-12"
    return monthly.reset_index()


def build_segment_top_products(
    clean: pd.DataFrame,
    segments: pd.DataFrame,
    names: pd.Series,
    min_share: float = MIN_CUSTOMER_SHARE,
    top: int = TOP_PRODUCTS,
) -> pd.DataFrame:
    """Products each segment prefers: lift of the product inside the segment."""
    pairs = (
        clean.dropna(subset=["customer_id"])
        .astype({"customer_id": "int64"})[["customer_id", "stock_code"]]
        .drop_duplicates()  # one row per customer and product
        .merge(segments[["customer_id", "segment"]], on="customer_id")
    )
    overall = pairs["stock_code"].value_counts(normalize=True)
    sizes = pairs.groupby("segment")["customer_id"].nunique()
    tables = []
    for segment, group in pairs.groupby("segment"):
        counts = group["stock_code"].value_counts()  # customers who bought it
        table = pd.DataFrame(
            {
                "customer_share": counts / sizes[segment],
                # share of the segment's purchases / share of all purchases
                "preference": counts / len(group) / overall[counts.index],
            }
        ).rename_axis("stock_code")
        table = table[table["customer_share"] >= min_share].reset_index()
        table = table.sort_values(
            ["preference", "stock_code"], ascending=[False, True]
        ).head(top)
        tables.append(table.assign(segment=segment, rank=range(1, len(table) + 1)))
    best = pd.concat(tables, ignore_index=True)
    best["description"] = best["stock_code"].map(names)
    return best.astype({"segment": "int64"})[TOP_COLUMNS]


def write_customer_card(clean: pd.DataFrame) -> None:
    """Rhythm, favourite products and lost products of each customer."""
    profiles = customers.build_customer_profiles(clean)
    profiles.to_parquet(CUSTOMER_PROFILES_PARQUET, index=False)
    products = customers.build_customer_products(clean)
    products.to_parquet(CUSTOMER_PRODUCTS_PARQUET, index=False)
    ref_date = customers.reference_date(clean)
    lost = customers.build_lost_products(clean, ref_date)
    lost.to_parquet(LOST_PRODUCTS_PARQUET, index=False)
    rhythm = profiles["usual_gap_days"].notna()
    print(
        f"Wrote {CUSTOMER_PROFILES_PARQUET.relative_to(ROOT)}: {len(profiles):,} customers"
    )
    print(f"  with a rhythm (2+ order days): {int(rhythm.sum()):,}")
    print(f"  median usual gap: {profiles['usual_gap_days'].median():.0f} days")
    print(
        f"Wrote {CUSTOMER_PRODUCTS_PARQUET.relative_to(ROOT)}: {len(products):,} rows"
    )
    n_lost = lost["customer_id"].nunique()
    print(f"Wrote {LOST_PRODUCTS_PARQUET.relative_to(ROOT)}: {len(lost):,} rows")
    print(f"  customers with a lost product: {n_lost:,}")


def main() -> None:
    """Write the small outputs, then read them back."""
    clean = pd.read_parquet(CLEAN_PARQUET, columns=COLUMNS)
    rules = pd.read_parquet(RULES_PARQUET)
    products = build_products(clean, rules)
    products.to_parquet(PRODUCTS_PARQUET, index=False)
    build_monthly_sales(clean).to_parquet(MONTHLY_PARQUET, index=False)
    segments = pd.read_parquet(SEGMENTS_PARQUET, columns=["customer_id", "segment"])
    names = products.set_index("stock_code")["description"]
    top = build_segment_top_products(clean, segments.astype("int64"), names)
    top.to_parquet(TOP_PRODUCTS_PARQUET, index=False)
    raw_rows = pq.read_metadata(RAW_PARQUET).num_rows  # no need to load the rows
    model = json.loads(METRICS_JSON.read_text())
    stats = build_stats(raw_rows, clean, rules, model)
    STATS_JSON.write_text(json.dumps(stats, indent=2))
    write_customer_card(clean)

    products = pd.read_parquet(PRODUCTS_PARQUET)
    print(f"Wrote {PRODUCTS_PARQUET.relative_to(ROOT)}: {len(products):,} products")
    print(products.head(3).to_string(index=False))
    print(f"Wrote {STATS_JSON.relative_to(ROOT)}")
    print(STATS_JSON.read_text())
    monthly = pd.read_parquet(MONTHLY_PARQUET)
    print(f"Wrote {MONTHLY_PARQUET.relative_to(ROOT)}: {len(monthly)} months")
    print(monthly[~monthly["complete"]].to_string(index=False))
    top = pd.read_parquet(TOP_PRODUCTS_PARQUET)
    print(f"Wrote {TOP_PRODUCTS_PARQUET.relative_to(ROOT)}: {len(top)} rows")
    print(top.round(3).to_string(index=False))


if __name__ == "__main__":
    main()
