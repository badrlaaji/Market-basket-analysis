"""Shared local Spark session, sized for a laptop."""

from pyspark.sql import SparkSession

MASTER = "local[2]"  # 2 cores: WSL has ~3.8 GiB of RAM
SHUFFLE_PARTITIONS = "4"  # default 200 is far too many for one machine
# FP-Growth serializes deep trees recursively: the default 1 MB thread stack
# overflows on long baskets (step 3). Applied only when the JVM starts.
JAVA_OPTIONS = "-Xss16m"


def build_spark(app_name: str) -> SparkSession:
    """Create (or reuse) a small local Spark session."""
    return (
        SparkSession.builder.master(MASTER)
        .appName(app_name)
        .config("spark.sql.shuffle.partitions", SHUFFLE_PARTITIONS)
        .config("spark.driver.extraJavaOptions", JAVA_OPTIONS)
        .getOrCreate()
    )
