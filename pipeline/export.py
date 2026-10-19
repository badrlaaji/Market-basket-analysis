"""Small outputs for the API: outputs/products.parquet and outputs/stats.json."""

import json
from pathlib import Path

import pandas as pd
import pyarrow.parquet as pq

ROOT = Path(__file__).resolve().parents[1]
RAW_PARQUET = ROOT / "data" / "interim" / "raw.parquet"
CLEAN_PARQUET = ROOT / "data" / "interim" / "clean.parquet"
METRICS_JSON = ROOT / "data" / "interim" / "repurchase_metrics.json"
RULES_PARQUET = ROOT / "outputs" / "rules.parquet"
PRODUCTS_PARQUET = ROOT / "outputs" / "products.parquet"
STATS_JSON = ROOT / "outputs" / "stats.json"
COLUMNS = ["invoice", "stock_code", "description", "invoice_date", "customer_id"]
PRODUCT_COLUMNS = ["stock_code", "description", "n_invoices", "in_rules"]


def most_frequent_description(clean: pd.DataFrame) -> pd.Series:
    """Most frequent description of each stock code (tie: alphabetical order)."""
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


def main() -> None:
    """Write products.parquet and stats.json, then read them back."""
    clean = pd.read_parquet(CLEAN_PARQUET, columns=COLUMNS)
    rules = pd.read_parquet(RULES_PARQUET)
    build_products(clean, rules).to_parquet(PRODUCTS_PARQUET, index=False)
    raw_rows = pq.read_metadata(RAW_PARQUET).num_rows  # no need to load the rows
    model = json.loads(METRICS_JSON.read_text())
    stats = build_stats(raw_rows, clean, rules, model)
    STATS_JSON.write_text(json.dumps(stats, indent=2))

    products = pd.read_parquet(PRODUCTS_PARQUET)
    print(f"Wrote {PRODUCTS_PARQUET.relative_to(ROOT)}: {len(products):,} products")
    print(products.head(3).to_string(index=False))
    print(f"Wrote {STATS_JSON.relative_to(ROOT)}")
    print(STATS_JSON.read_text())


if __name__ == "__main__":
    main()
