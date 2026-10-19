"""Tests for pipeline.spark_session."""

from pyspark.sql import SparkSession

from pipeline.spark_session import JAVA_OPTIONS


def test_jvm_starts_with_large_thread_stack(spark: SparkSession) -> None:
    """The JVM really got -Xss16m (ignored if a session existed before)."""
    jvm = spark.sparkContext._jvm
    runtime = jvm.java.lang.management.ManagementFactory.getRuntimeMXBean()
    assert JAVA_OPTIONS in list(runtime.getInputArguments())
