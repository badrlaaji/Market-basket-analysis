"""Smoke test: start a local Spark session and show 5 rows.

Run from the repository root: python -m scripts.check_spark
"""

import pandas as pd
import pyspark

from pipeline.spark_session import build_spark


def main() -> None:
    """Print versions, show 5 rows, then convert them to pandas."""
    spark = build_spark("check-spark")
    print(f"pyspark {pyspark.__version__} | pandas {pd.__version__}")
    print(f"Spark (JVM) {spark.version} | master {spark.sparkContext.master}")
    df = spark.range(5)
    df.show()
    print(df.toPandas())
    spark.stop()


if __name__ == "__main__":
    main()
