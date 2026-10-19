"""Shared local Spark session (decision C4)."""

from pyspark.sql import SparkSession

MASTER = "local[2]"  # 2 cores: WSL has ~3.8 GiB of RAM
SHUFFLE_PARTITIONS = "4"  # default 200 is far too many for one machine


def build_spark(app_name: str) -> SparkSession:
    """Create (or reuse) a small local Spark session."""
    return (
        SparkSession.builder.master(MASTER)
        .appName(app_name)
        .config("spark.sql.shuffle.partitions", SHUFFLE_PARTITIONS)
        .getOrCreate()
    )
