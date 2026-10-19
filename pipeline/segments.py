"""Customer segments: RFM -> log -> StandardScaler -> KMeans (k = 4).

clean.parquet -> outputs/segments.parquet, outputs/segment_profiles.parquet,
outputs/segments_k_report.json
"""

import json
import time
from datetime import date
from pathlib import Path

import pandas as pd
from pyspark.ml import Pipeline
from pyspark.ml.clustering import KMeans, KMeansModel
from pyspark.ml.evaluation import ClusteringEvaluator
from pyspark.ml.feature import StandardScaler, VectorAssembler
from pyspark.sql import DataFrame
from pyspark.sql import functions as F

from pipeline.spark_session import build_spark
from pipeline.tracking import log_run

ROOT = Path(__file__).resolve().parents[1]
CLEAN_PARQUET = ROOT / "data" / "interim" / "clean.parquet"
SEGMENTS_PARQUET = ROOT / "outputs" / "segments.parquet"
PROFILES_PARQUET = ROOT / "outputs" / "segment_profiles.parquet"
K_REPORT_JSON = ROOT / "outputs" / "segments_k_report.json"

# Choices measured in step 4 (DECISIONS.md D04-1 to D04-4)
FEATURES = ["recency", "log_frequency", "log_monetary"]  # skew 12 and 25 before log
K_RANGE = range(2, 9)  # silhouette logged for each k
K = 4  # recent or not x high or low value
SEED = 42
MAX_ITER = 100  # default 20 is too few: up to 74 iterations measured (k = 8)
SEGMENT_NAMES = ["Champions", "Promising", "At risk", "Lost"]  # segment 0 to 3
EXPERIMENT = "customer-segments"


def reference_date(df: DataFrame) -> date:
    """Day after the last invoice: recency is counted from this date."""
    return df.agg(F.date_add(F.to_date(F.max("invoice_date")), 1)).first()[0]


def compute_rfm(df: DataFrame, ref_date: date) -> DataFrame:
    """Recency, frequency and monetary per customer; unknown customers dropped."""
    return (
        df.filter(F.col("customer_id").isNotNull())
        .groupBy("customer_id")
        .agg(
            F.datediff(F.lit(ref_date), F.max("invoice_date")).alias("recency"),
            F.countDistinct("invoice").alias("frequency"),
            F.sum(F.col("quantity") * F.col("price")).alias("monetary"),
        )
    )


def add_log_features(rfm: DataFrame) -> DataFrame:
    """Add log1p of frequency and monetary, the two very skewed columns."""
    return rfm.withColumn("log_frequency", F.log1p("frequency")).withColumn(
        "log_monetary", F.log1p("monetary")
    )


def scale_features(rfm: DataFrame) -> DataFrame:
    """Put FEATURES in one vector column, centered and scaled to unit variance."""
    stages = [
        VectorAssembler(inputCols=FEATURES, outputCol="raw_features"),
        # Spark default is withMean=False: values would not be centered
        StandardScaler(inputCol="raw_features", outputCol="features", withMean=True),
    ]
    return Pipeline(stages=stages).fit(rfm).transform(rfm)


def fit_kmeans(features: DataFrame, k: int) -> KMeansModel:
    """KMeans with a fixed seed: same clusters at every run."""
    return KMeans(k=k, seed=SEED, maxIter=MAX_ITER).fit(features)


def silhouette(model: KMeansModel, features: DataFrame) -> float:
    """Spark silhouette: squared Euclidean distance (higher than sklearn's)."""
    return ClusteringEvaluator().evaluate(model.transform(features))


def profile_clusters(clustered: DataFrame) -> pd.DataFrame:
    """Size and mean RFM of each KMeans cluster, as a small pandas table."""
    return (
        clustered.groupBy("prediction")
        .agg(
            F.count("*").alias("n_customers"),
            F.mean("recency").alias("recency_mean"),
            F.mean("frequency").alias("frequency_mean"),
            F.mean("monetary").alias("monetary_mean"),
        )
        .toPandas()
    )


def name_segments(profiles: pd.DataFrame) -> pd.DataFrame:
    """Name 4 clusters: 2 most recent vs 2 others, then higher vs lower value."""
    if len(profiles) != len(SEGMENT_NAMES):
        raise ValueError(f"expected {len(SEGMENT_NAMES)} clusters, got {len(profiles)}")
    by_recency = profiles.sort_values("recency_mean")
    recent, lapsed = by_recency.iloc[:2], by_recency.iloc[2:]
    ordered = pd.concat(
        [
            recent.sort_values(
                "monetary_mean", ascending=False
            ),  # Champions, Promising
            lapsed.sort_values("monetary_mean", ascending=False),  # At risk, Lost
        ]
    )
    # KMeans cluster numbers are arbitrary: segment ids follow the names
    return ordered.assign(segment=range(len(SEGMENT_NAMES)), segment_name=SEGMENT_NAMES)


def add_shares(profiles: pd.DataFrame) -> pd.DataFrame:
    """Share of all customers and share of all revenue of each segment."""
    revenue = profiles["monetary_mean"] * profiles["n_customers"]  # segment total
    return profiles.assign(
        customer_share=profiles["n_customers"] / profiles["n_customers"].sum(),
        revenue_share=revenue / revenue.sum(),
    )


def k_report(scores: dict[int, float], k: int) -> dict:
    """Silhouette of each k tried and the k kept, as plain Python types."""
    return {
        "k": k,
        "metric": "silhouette, squared Euclidean distance (Spark default)",
        "scores": [{"k": key, "silhouette": float(v)} for key, v in scores.items()],
    }


def main() -> None:
    """clean.parquet -> segments and profiles, read back, then log the run."""
    start = time.perf_counter()
    spark = build_spark("segments")
    clean = spark.read.parquet(str(CLEAN_PARQUET))
    ref_date = reference_date(clean)
    rfm = add_log_features(compute_rfm(clean, ref_date))
    features = scale_features(rfm).cache()

    models = {k: fit_kmeans(features, k) for k in K_RANGE}
    scores = {k: silhouette(model, features) for k, model in models.items()}
    clustered = models[K].transform(features)
    profiles = add_shares(name_segments(profile_clusters(clustered)))

    ids = spark.createDataFrame(profiles[["prediction", "segment"]])
    segments = clustered.join(ids, "prediction").select(
        "customer_id", "recency", "frequency", "monetary", "segment"
    )
    segments.coalesce(1).write.mode("overwrite").parquet(str(SEGMENTS_PARQUET))
    columns = ["segment", "segment_name", "n_customers", "customer_share"]
    columns += ["revenue_share", "recency_mean", "frequency_mean", "monetary_mean"]
    profiles[columns].to_parquet(PROFILES_PARQUET, index=False)
    K_REPORT_JSON.write_text(json.dumps(k_report(scores, K), indent=2))

    back = spark.read.parquet(str(SEGMENTS_PARQUET))
    n_customers = back.count()
    print(f"Reference date: {ref_date}")
    for k, score in scores.items():
        print(f"k={k}: silhouette (squared Euclidean) {score:.3f}")
    print(f"Wrote {SEGMENTS_PARQUET.relative_to(ROOT)}: {n_customers:,} customers")
    print(f"Wrote {PROFILES_PARQUET.relative_to(ROOT)}")
    print(profiles[columns].round(3).to_string(index=False))
    print(f"Wrote {K_REPORT_JSON.relative_to(ROOT)}")
    spark.stop()

    metrics = {"n_customers": n_customers}
    metrics |= {f"silhouette_sq_k{k}": score for k, score in scores.items()}
    for row in profiles.itertuples():
        metrics[f"n_{row.segment_name.lower().replace(' ', '_')}"] = row.n_customers
    metrics["duration_s"] = round(time.perf_counter() - start, 1)
    params = {
        "features": ",".join(FEATURES),
        "k": K,
        "k_range": f"{K_RANGE.start}-{K_RANGE.stop - 1}",
        "seed": SEED,
        "max_iter": MAX_ITER,
        "reference_date": str(ref_date),
    }
    log_run(EXPERIMENT, f"k={K}", params, metrics)


if __name__ == "__main__":
    main()
