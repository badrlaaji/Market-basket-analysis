"""Mine association rules with FP-Growth: clean.parquet -> outputs/rules.parquet."""

import time
from pathlib import Path

from pyspark.ml.fpm import FPGrowth, FPGrowthModel
from pyspark.sql import DataFrame
from pyspark.sql import functions as F

from pipeline.spark_session import build_spark
from pipeline.tracking import log_run

ROOT = Path(__file__).resolve().parents[1]
CLEAN_PARQUET = ROOT / "data" / "interim" / "clean.parquet"
RULES_PARQUET = ROOT / "outputs" / "rules.parquet"

# Thresholds chosen by measurement: 0.005 gave 10,586 rules, 0.01 gives 1,166
MIN_SUPPORT = 0.01  # itemset in at least 396 of the 39,516 invoices
MIN_CONFIDENCE = 0.2
MIN_LIFT = 1.5
EXPERIMENT = "association-rules"


def build_baskets(df: DataFrame) -> DataFrame:
    """One basket per invoice: the set of distinct stock codes."""
    return df.groupBy("invoice").agg(F.collect_set("stock_code").alias("items"))


def mine_rules(
    baskets: DataFrame,
    min_support: float = MIN_SUPPORT,
    min_confidence: float = MIN_CONFIDENCE,
) -> FPGrowthModel:
    """Fit FP-Growth; itemsets and rules are computed at the first action."""
    fp = FPGrowth(
        itemsCol="items", minSupport=min_support, minConfidence=min_confidence
    )
    return fp.fit(baskets)


def format_rules(rules: DataFrame, min_lift: float = MIN_LIFT) -> DataFrame:
    """Keep rules with lift >= min_lift, in the API contract format."""
    return rules.filter(F.col("lift") >= min_lift).select(
        F.array_sort("antecedent").alias("antecedent"),  # stable, readable order
        F.col("consequent")[0].alias("consequent"),  # always 1 item (Spark doc)
        "support",
        "confidence",
        "lift",
    )


def count_products(rules: DataFrame) -> int:
    """Count distinct stock codes used by at least one formatted rule."""
    items = F.array_union("antecedent", F.array("consequent"))
    return rules.select(F.explode(items)).distinct().count()


def main() -> None:
    """clean.parquet -> rules.parquet, read it back, then log the run."""
    start = time.perf_counter()
    spark = build_spark("rules")
    baskets = build_baskets(spark.read.parquet(str(CLEAN_PARQUET))).cache()
    model = mine_rules(baskets)
    itemsets = model.freqItemsets.cache()  # rules reuse it: mined only once
    all_rules = model.associationRules.cache()
    rules = format_rules(all_rules).orderBy(F.desc("lift"), F.desc("confidence"))
    rules.coalesce(1).write.mode("overwrite").parquet(str(RULES_PARQUET))  # 1 file

    back = spark.read.parquet(str(RULES_PARQUET))
    metrics = {
        "n_baskets": baskets.count(),
        "n_itemsets": itemsets.count(),
        "n_rules_before_lift": all_rules.count(),
        "n_rules": back.count(),
        "n_products_covered": count_products(back),
    }
    print(f"Wrote {RULES_PARQUET.relative_to(ROOT)}")
    print(back.schema.simpleString())
    back.show(5, truncate=False)
    spark.stop()

    metrics["duration_s"] = round(time.perf_counter() - start, 1)
    for key, value in metrics.items():
        print(f"{key}: {value:,}")
    params = {
        "min_support": MIN_SUPPORT,
        "min_confidence": MIN_CONFIDENCE,
        "min_lift": MIN_LIFT,
    }
    log_run(EXPERIMENT, f"min_support={MIN_SUPPORT}", params, metrics)


if __name__ == "__main__":
    main()
