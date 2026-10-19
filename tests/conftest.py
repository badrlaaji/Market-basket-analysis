"""Shared pytest fixtures."""

from collections.abc import Iterator

import pytest
from pyspark.sql import SparkSession

from pipeline.spark_session import build_spark


@pytest.fixture(scope="session")
def spark() -> Iterator[SparkSession]:
    """One local Spark session shared by all tests (JVM start is slow)."""
    session = build_spark("tests")
    yield session
    session.stop()
