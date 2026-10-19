"""Load the pipeline outputs once, then query them in memory with pandas."""

import json
from pathlib import Path
from typing import Any

import pandas as pd


def add_names(rules: pd.DataFrame, names: dict[str, str]) -> pd.DataFrame:
    """Add product names to each rule, and a lower-case text for the search."""
    rules = rules.assign(antecedent=rules["antecedent"].map(list))  # ndarray -> list
    rules["antecedent_names"] = rules["antecedent"].map(
        lambda codes: [names.get(code, code) for code in codes]
    )
    rules["consequent_name"] = rules["consequent"].map(lambda c: names.get(c, c))
    rules["search_text"] = [
        " ".join([*codes, *labels, code, label]).lower()
        for codes, labels, code, label in zip(
            rules["antecedent"],
            rules["antecedent_names"],
            rules["consequent"],
            rules["consequent_name"],
        )
    ]
    return rules


def segment_profiles(profiles: pd.DataFrame, segments: pd.DataFrame) -> pd.DataFrame:
    """Segment profiles plus share of customers and median R, F, M."""
    medians = segments.groupby("segment")[["recency", "frequency", "monetary"]].median()
    profiles = profiles.merge(medians.add_suffix("_median"), on="segment")
    profiles["share"] = profiles["n_customers"] / profiles["n_customers"].sum()
    return profiles.sort_values("segment").reset_index(drop=True)


def load_outputs(outputs_dir: Path) -> dict[str, Any]:
    """Read every output file of the pipeline (called once, at startup)."""
    products = pd.read_parquet(outputs_dir / "products.parquet")
    names = dict(zip(products["stock_code"], products["description"]))
    rules = pd.read_parquet(outputs_dir / "rules.parquet")
    segments = pd.read_parquet(outputs_dir / "segments.parquet")
    profiles = pd.read_parquet(outputs_dir / "segment_profiles.parquet")
    scores = pd.read_parquet(outputs_dir / "repurchase_scores.parquet")
    segment_names = profiles[["segment", "segment_name"]]
    return {
        "rules": add_names(rules, names),
        "products": products,
        "known_codes": set(names),
        "profiles": segment_profiles(profiles, segments),
        "scores": scores.merge(segment_names, on="segment", how="left"),
        "stats": json.loads((outputs_dir / "stats.json").read_text()),
    }


def filter_rules(
    rules: pd.DataFrame,
    min_confidence: float,
    min_lift: float,
    product: str | None,
    sort: str,
    limit: int,
) -> tuple[int, pd.DataFrame]:
    """Rules above both thresholds, optionally with a product; best first."""
    kept = rules[(rules["confidence"] >= min_confidence) & (rules["lift"] >= min_lift)]
    if product and product.strip():
        text = product.strip().lower()
        kept = kept[kept["search_text"].str.contains(text, regex=False)]
    # Stable sort: ties keep the export order (lift, then confidence)
    kept = kept.sort_values(sort, ascending=False, kind="stable")
    return len(kept), kept.head(limit)


def search_products(products: pd.DataFrame, q: str, limit: int) -> pd.DataFrame:
    """Products whose code starts with q or whose name contains q; popular first."""
    text = q.strip().lower()
    if not text:
        return products.head(limit)  # products.parquet is sorted by n_invoices
    by_code = products["stock_code"].str.lower().str.startswith(text)
    by_name = products["description"].str.lower().str.contains(text, regex=False)
    return products[by_code | by_name].head(limit)


def normalize_codes(items: list[str]) -> list[str]:
    """Trim and upper-case codes like the ETL; drop empty codes and repeats."""
    codes = [item.strip().upper() for item in items]
    return list(dict.fromkeys(code for code in codes if code))


def recommend(
    rules: pd.DataFrame, known_codes: set[str], items: list[str], k: int
) -> tuple[pd.DataFrame, list[str]]:
    """Top-k products for a basket, and the unknown codes that were ignored."""
    codes = normalize_codes(items)
    unknown = [code for code in codes if code not in known_codes]
    basket = set(codes) - set(unknown)
    covered = rules["antecedent"].map(lambda antecedent: set(antecedent) <= basket)
    matches = rules[covered & ~rules["consequent"].isin(basket)]
    # One line per product: keep the rule with the highest lift
    best = matches.sort_values("lift", ascending=False, kind="stable")
    return best.drop_duplicates("consequent").head(k), unknown


def at_risk(
    scores: pd.DataFrame, threshold: float, top: int
) -> tuple[int, pd.DataFrame]:
    """Customers with proba_90d < threshold, highest monetary first."""
    risky = scores[scores["proba_90d"] < threshold]
    risky = risky.sort_values("monetary", ascending=False, kind="stable")
    return len(risky), risky.head(top)
