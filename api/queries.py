"""Load the pipeline outputs once, then query them in memory with pandas."""

import json
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

# RFM grid (D07b): recency in quintiles; frequency in fixed bands because
# 27.6 % of the customers have exactly 1 invoice (quintile edges would repeat)
RECENCY_QUINTILES = 5
FREQUENCY_EDGES = [0, 1, 2, 4, 9, np.inf]  # (0, 1], (1, 2], (2, 4], (4, 9], (9, inf)
FREQUENCY_BANDS = ["1", "2", "3-4", "5-9", "10+"]
HISTOGRAM_BINS = 20  # width 0.05: the step of the threshold slider
SCENARIOS = 3  # example baskets on /basket
SEED = 42  # sample of /segments/map
CSV_COLUMNS = ["antecedent", "antecedent_names", "consequent", "consequent_name"]
CSV_COLUMNS += ["support", "confidence", "lift"]


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


def radar_scores(segments: pd.DataFrame, scores: pd.DataFrame) -> pd.DataFrame:
    """Mean percentile rank (0-100) of each segment on 5 measures; higher = better."""
    customers = segments.merge(scores[["customer_id", "proba_90d"]], on="customer_id")
    ranks = pd.DataFrame(
        {
            "segment": customers["segment"],
            "score_recency": (-customers["recency"]).rank(pct=True),  # recent = high
            "score_frequency": customers["frequency"].rank(pct=True),
            "score_monetary": customers["monetary"].rank(pct=True),
            "score_basket": (customers["monetary"] / customers["frequency"]).rank(
                pct=True
            ),
            "score_repurchase": customers["proba_90d"].rank(pct=True),
        }
    )
    return (ranks.groupby("segment").mean() * 100).reset_index()


def segment_profiles(
    profiles: pd.DataFrame, segments: pd.DataFrame, scores: pd.DataFrame
) -> pd.DataFrame:
    """Segment profiles plus median R, F, M and the 5 radar scores."""
    medians = segments.groupby("segment")[["recency", "frequency", "monetary"]].median()
    profiles = profiles.merge(medians.add_suffix("_median"), on="segment")
    profiles = profiles.merge(radar_scores(segments, scores), on="segment")
    return profiles.sort_values("segment").reset_index(drop=True)


def frequency_band(frequency: pd.Series) -> pd.Series:
    """Number of invoices -> "1", "2", "3-4", "5-9" or "10+" (ordered category)."""
    return pd.cut(frequency, bins=FREQUENCY_EDGES, labels=FREQUENCY_BANDS)


def revenue_by_band(segments: pd.DataFrame) -> pd.DataFrame:
    """Customers and revenue of each segment, split by frequency band."""
    bands = segments.assign(frequency_band=frequency_band(segments["frequency"]))
    return (
        bands.groupby(["segment", "frequency_band"], observed=True)
        .agg(n_customers=("customer_id", "size"), revenue=("monetary", "sum"))
        .reset_index()
        .astype({"frequency_band": str})
    )


def rfm_grid(segments: pd.DataFrame) -> pd.DataFrame:
    """Customers per recency quintile (1 = most recent) and frequency band."""
    df = segments.assign(
        recency_quintile=pd.qcut(
            segments["recency"], RECENCY_QUINTILES, labels=False, duplicates="drop"
        )
        + 1,
        frequency_band=frequency_band(segments["frequency"]),
    )
    cells = ["recency_quintile", "frequency_band"]
    counts = df.groupby(cells, observed=False).size().rename("n_customers")
    ranges = df.groupby("recency_quintile")["recency"].agg(
        recency_min="min", recency_max="max"
    )
    # Most common segment of each cell (ties: smallest segment id)
    main = (
        df.groupby([*cells, "segment"], observed=True)
        .size()
        .rename("n")
        .reset_index()
        .sort_values(["n", "segment"], ascending=[False, True])
        .drop_duplicates(cells)
        .rename(columns={"segment": "top_segment"})
    )
    grid = counts.reset_index().merge(ranges.reset_index(), on="recency_quintile")
    grid = grid.merge(main[[*cells, "top_segment"]], on=cells, how="left")
    grid = grid.sort_values(cells).reset_index(drop=True)
    grid = grid.astype({"frequency_band": str})
    # object column: None stays None for an empty cell (a float column turns it to NaN)
    top = [None if pd.isna(value) else int(value) for value in grid["top_segment"]]
    return grid.assign(top_segment=pd.Series(top, dtype=object))


def sample_customers(segments: pd.DataFrame, n: int) -> pd.DataFrame:
    """About n customers, each segment keeping its share (fixed seed)."""
    frac = min(1.0, n / len(segments))
    return segments.groupby("segment").sample(frac=frac, random_state=SEED)


def basket_scenarios(rules: pd.DataFrame, k: int = SCENARIOS) -> pd.DataFrame:
    """Baskets of 2+ products that start the most rules; no product used twice."""
    multi = rules[rules["antecedent"].map(len) >= 2]
    grouped = (
        multi.assign(items=multi["antecedent"].map(tuple))
        .groupby("items")
        .agg(
            names=("antecedent_names", "first"),
            n_rules=("consequent", "size"),
            best_lift=("lift", "max"),
        )
        .reset_index()
        .sort_values(["n_rules", "best_lift"], ascending=False, kind="stable")
    )
    chosen, used = [], set()
    for row in grouped.itertuples():
        if used.isdisjoint(row.items):
            scenario = {"items": list(row.items), "names": row.names}
            chosen.append(scenario | {"n_rules": row.n_rules})
            used.update(row.items)
        if len(chosen) == k:
            break
    return pd.DataFrame(chosen, columns=["items", "names", "n_rules"])


def load_outputs(outputs_dir: Path) -> dict[str, Any]:
    """Read every output file of the pipeline (called once, at startup)."""
    products = pd.read_parquet(outputs_dir / "products.parquet")
    names = dict(zip(products["stock_code"], products["description"]))
    rules = pd.read_parquet(outputs_dir / "rules.parquet")
    segments = pd.read_parquet(outputs_dir / "segments.parquet")
    profiles = pd.read_parquet(outputs_dir / "segment_profiles.parquet")
    scores = pd.read_parquet(outputs_dir / "repurchase_scores.parquet")
    segment_names = profiles[["segment", "segment_name"]]
    named_rules = add_names(rules, names)
    return {
        "rules": named_rules,
        "products": products,
        "known_codes": set(names),
        "profiles": segment_profiles(profiles, segments, scores),
        "segments": segments,
        "grid": rfm_grid(segments),
        "band_revenue": revenue_by_band(segments),
        "top_products": pd.read_parquet(outputs_dir / "segment_top_products.parquet"),
        "k_report": json.loads((outputs_dir / "segments_k_report.json").read_text()),
        "scores": scores.merge(segment_names, on="segment", how="left"),
        "stats": json.loads((outputs_dir / "stats.json").read_text()),
        "timeline": pd.read_parquet(outputs_dir / "monthly_sales.parquet"),
        "model": json.loads((outputs_dir / "model_report.json").read_text()),
        "scenarios": basket_scenarios(named_rules),
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


def rules_csv(rules: pd.DataFrame) -> str:
    """Rules as CSV text; multi-product antecedents joined with " + "."""
    table = rules[CSV_COLUMNS].assign(
        antecedent=rules["antecedent"].map(" + ".join),
        antecedent_names=rules["antecedent_names"].map(" + ".join),
    )
    return table.to_csv(index=False)


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
    best = best.drop_duplicates("consequent").head(k)
    # lift = P(B | basket) / P(B), so P(B) in all baskets = confidence / lift
    return best.assign(base_rate=best["confidence"] / best["lift"]), unknown


def in_segment(scores: pd.DataFrame, segment: int | None) -> pd.DataFrame:
    """Customers of one segment, or all of them when segment is None."""
    return scores if segment is None else scores[scores["segment"] == segment]


def at_risk(
    scores: pd.DataFrame, threshold: float, top: int, segment: int | None = None
) -> tuple[int, float, pd.DataFrame]:
    """Customers with proba_90d < threshold, highest net value first (D06-8).

    Also returns their total net spend (past purchases minus cancellations).
    """
    risky = in_segment(scores, segment)
    risky = risky[risky["proba_90d"] < threshold]
    risky = risky.sort_values("monetary_net", ascending=False, kind="stable")
    return len(risky), float(risky["monetary_net"].sum()), risky.head(top)


def proba_histogram(scores: pd.DataFrame, segment: int | None = None) -> pd.DataFrame:
    """Customers and net spend per probability bin [k/20, (k+1)/20)."""
    scores = in_segment(scores, segment)
    # proba 1.0 would get bin 20: kept in the last bin
    bins = (scores["proba_90d"] * HISTOGRAM_BINS).astype(int)
    bins = np.minimum(bins, HISTOGRAM_BINS - 1)
    table = (
        scores.groupby(bins)
        .agg(n_customers=("customer_id", "size"), monetary_net=("monetary_net", "sum"))
        .reindex(range(HISTOGRAM_BINS), fill_value=0)
    )
    table["start"] = table.index / HISTOGRAM_BINS
    table["end"] = (table.index + 1) / HISTOGRAM_BINS
    return table.reset_index(drop=True)
