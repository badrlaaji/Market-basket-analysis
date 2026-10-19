"""Smoke test: start a local Spark session and show 5 rows."""

import pandas as pd
import pyspark
from pyspark.sql import SparkSession

MASTER = "local[2]"  # 2 cores: WSL has ~3.8 GiB of RAM
SHUFFLE_PARTITIONS = "4"  # default 200 is far too many for one machine


def build_spark() -> SparkSession:
    """Create a small local Spark session (decision C4)."""
    return (
        SparkSession.builder.master(MASTER)
        .appName("check-spark")
        .config("spark.sql.shuffle.partitions", SHUFFLE_PARTITIONS)
        .getOrCreate()
    )


def main() -> None:
    """Print versions, show 5 rows, then convert them to pandas."""
    spark = build_spark()
    print(f"pyspark {pyspark.__version__} | pandas {pd.__version__}")
    print(f"Spark (JVM) {spark.version} | master {spark.sparkContext.master}")
    df = spark.range(5)
    df.show()
    print(df.toPandas())
    spark.stop()


if __name__ == "__main__":
    main()
