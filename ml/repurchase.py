"""Repurchase within 90 days: XGBoost vs a recency baseline, tracked with MLflow.

clean.parquet -> outputs/repurchase_scores.parquet, data/interim/repurchase_metrics.json
"""

import json
import time
from datetime import date, timedelta
from pathlib import Path

import pandas as pd
from sklearn.metrics import average_precision_score, roc_auc_score
from xgboost import XGBClassifier

from pipeline.tracking import log_run

ROOT = Path(__file__).resolve().parents[1]
CLEAN_PARQUET = ROOT / "data" / "interim" / "clean.parquet"
SEGMENTS_PARQUET = ROOT / "outputs" / "segments.parquet"
SCORES_PARQUET = ROOT / "outputs" / "repurchase_scores.parquet"
METRICS_JSON = ROOT / "data" / "interim" / "repurchase_metrics.json"

# Dates fixed in C7 and measured in step 5 (DECISIONS.md D05-1 to D05-3)
HORIZON_DAYS = 90
TEST_DATE = date(2011, 9, 10)  # T = last invoice date - 90 days
TRAIN_DATE = TEST_DATE - timedelta(days=HORIZON_DAYS)  # 2011-06-12
COLUMNS = ["invoice", "stock_code", "quantity", "invoice_date", "price", "customer_id"]
FEATURES = [
    "recency",  # days since the last purchase
    "frequency",  # distinct invoices
    "monetary",  # sum of quantity x price
    "tenure",  # days since the first purchase
    "avg_basket",  # monetary / frequency
    "n_products",  # distinct stock codes
    "invoices_90d",  # distinct invoices in the 90 days before ref_date
]
# Fixed, simple parameters: nothing is tuned on the test period
XGB_PARAMS = {
    "n_estimators": 200,
    "max_depth": 3,
    "learning_rate": 0.05,
    "random_state": 42,
    "n_jobs": 2,
}
SCORE_COLUMNS = ["customer_id", "proba_90d", "segment", "monetary"]
EXPERIMENT = "repurchase"


def load_transactions(path: Path = CLEAN_PARQUET) -> pd.DataFrame:
    """Clean rows of known customers only, customer_id as an integer."""
    df = pd.read_parquet(path, columns=COLUMNS)
    return df.dropna(subset=["customer_id"]).astype({"customer_id": "int64"})


def day(ref_date: date, days: int = 0) -> pd.Timestamp:
    """Midnight of ref_date + days (date arithmetic: no numpy timedelta warning)."""
    return pd.Timestamp(ref_date + timedelta(days=days))


def build_features(df: pd.DataFrame, ref_date: date) -> pd.DataFrame:
    """One row per customer, computed from purchases strictly before ref_date."""
    past = df[df["invoice_date"] < day(ref_date)]  # anti-leak: first line, always
    recent = past["invoice_date"] >= day(ref_date, -HORIZON_DAYS)
    past = past.assign(
        amount=past["quantity"] * past["price"],
        recent_invoice=past["invoice"].where(recent),  # NaN outside the 90 days
    )
    features = past.groupby("customer_id").agg(
        last=("invoice_date", "max"),
        first=("invoice_date", "min"),
        frequency=("invoice", "nunique"),
        monetary=("amount", "sum"),
        n_products=("stock_code", "nunique"),
        invoices_90d=("recent_invoice", "nunique"),  # nunique ignores NaN
    )
    # Calendar days, like Spark datediff in pipeline/segments.py
    features["recency"] = (day(ref_date) - features["last"].dt.normalize()).dt.days
    features["tenure"] = (day(ref_date) - features["first"].dt.normalize()).dt.days
    features["avg_basket"] = features["monetary"] / features["frequency"]
    return features[FEATURES]


def build_labels(df: pd.DataFrame, customers: pd.Index, ref_date: date) -> pd.Series:
    """1 if the customer buys in [ref_date, ref_date + 90 days), else 0."""
    start, end = day(ref_date), day(ref_date, HORIZON_DAYS)
    window = df[(df["invoice_date"] >= start) & (df["invoice_date"] < end)]
    bought = customers.isin(window["customer_id"]).astype("int64")
    return pd.Series(bought, index=customers, name="label")


def build_dataset(df: pd.DataFrame, ref_date: date) -> pd.DataFrame:
    """Features before ref_date and label of the next 90 days (known customers)."""
    features = build_features(df, ref_date)
    return features.assign(label=build_labels(df, features.index, ref_date))


def train_model(train: pd.DataFrame) -> XGBClassifier:
    """Fit XGBoost with the fixed parameters."""
    return XGBClassifier(**XGB_PARAMS).fit(train[FEATURES], train["label"])


def predict(model: XGBClassifier, features: pd.DataFrame) -> pd.Series:
    """Probability of the positive class (a purchase within 90 days)."""
    proba = model.predict_proba(features[FEATURES])[:, 1]
    return pd.Series(proba, index=features.index, name="proba_90d").astype("float64")


def recency_baseline(features: pd.DataFrame) -> pd.Series:
    """Baseline score: the more recent the last purchase, the higher the score."""
    return -features["recency"]


def evaluate(labels: pd.Series, scores: pd.Series) -> dict[str, float]:
    """PR-AUC (average precision) and ROC-AUC of a score."""
    return {
        "pr_auc": float(average_precision_score(labels, scores)),
        "roc_auc": float(roc_auc_score(labels, scores)),
    }


def score_date(df: pd.DataFrame) -> date:
    """Day after the last invoice (same reference date as the segments)."""
    return df["invoice_date"].max().date() + timedelta(days=1)


def score_customers(
    model: XGBClassifier, features: pd.DataFrame, segments: pd.DataFrame
) -> pd.DataFrame:
    """Contract table: probability per customer, segment joined for display only."""
    scores = pd.DataFrame(
        {"proba_90d": predict(model, features), "monetary": features["monetary"]}
    ).reset_index()
    scores = scores.merge(
        segments[["customer_id", "segment"]],
        on="customer_id",
        how="left",
        validate="one_to_one",
    )
    # astype fails loudly if a customer has no segment (NaN)
    return scores.astype({"customer_id": "int64", "segment": "int64"})[SCORE_COLUMNS]


def rfm_gap(features: pd.DataFrame, segments: pd.DataFrame) -> dict[str, float]:
    """Largest difference with segments.parquet on R, F and M (expected: ~0)."""
    joined = features.join(segments.set_index("customer_id"), rsuffix="_seg")
    return {
        col: float((joined[col] - joined[f"{col}_seg"]).abs().max())
        for col in ["recency", "frequency", "monetary"]
    }


def main() -> None:
    """Train at T - 90 days, test at T, then score every customer today."""
    start = time.perf_counter()
    df = load_transactions()
    train = build_dataset(df, TRAIN_DATE)
    test = build_dataset(df, TEST_DATE)
    model = train_model(train)
    proba_test = predict(model, test)
    model_scores = evaluate(test["label"], proba_test)
    baseline_scores = evaluate(test["label"], recency_baseline(test))

    # Final scoring with the validated model (D05-3)
    ref_date = score_date(df)
    now = build_features(df, ref_date)
    segments = pd.read_parquet(SEGMENTS_PARQUET)
    scores = score_customers(model, now, segments)
    scores.to_parquet(SCORES_PARQUET, index=False)
    back = pd.read_parquet(SCORES_PARQUET)

    summary = {
        "train_date": str(TRAIN_DATE),
        "test_date": str(TEST_DATE),
        "score_date": str(ref_date),
        "horizon_days": HORIZON_DAYS,
        "n_train": len(train),
        "n_test": len(test),
        "positive_rate_train": float(train["label"].mean()),
        "positive_rate_test": float(test["label"].mean()),
        "pr_auc_model": model_scores["pr_auc"],
        "roc_auc_model": model_scores["roc_auc"],
        "pr_auc_baseline": baseline_scores["pr_auc"],
        "roc_auc_baseline": baseline_scores["roc_auc"],
        "mean_proba_test": float(proba_test.mean()),
    }
    METRICS_JSON.write_text(json.dumps(summary, indent=2))
    print(f"Wrote {SCORES_PARQUET.relative_to(ROOT)}: {len(back):,} customers")
    print(f"Wrote {METRICS_JSON.relative_to(ROOT)}")
    print(back.dtypes.to_string())
    print(
        f"RFM vs segments.parquet ({len(segments):,} customers): {rfm_gap(now, segments)}"
    )
    for key, value in summary.items():
        print(f"{key}: {value}")
    importances = dict(zip(FEATURES, model.feature_importances_.tolist()))
    print(
        "feature importances (gain, sum = 1):",
        {k: round(v, 3) for k, v in importances.items()},
    )

    keys = ["train_date", "test_date", "score_date", "horizon_days"]
    params = {key: summary[key] for key in keys}
    params |= {"features": ",".join(FEATURES)} | XGB_PARAMS
    metrics = {k: v for k, v in summary.items() if k not in params}
    metrics["n_scored"] = len(back)
    metrics["mean_proba_scored"] = float(back["proba_90d"].mean())
    metrics |= {f"importance_{k}": v for k, v in importances.items()}
    metrics["duration_s"] = round(time.perf_counter() - start, 1)
    log_run(EXPERIMENT, "xgboost-vs-recency", params, metrics)


if __name__ == "__main__":
    main()
