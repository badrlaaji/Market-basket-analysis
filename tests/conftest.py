"""Shared pytest fixtures."""

from collections.abc import Iterator
from typing import TYPE_CHECKING

import pytest

if TYPE_CHECKING:
    from pyspark.sql import SparkSession


@pytest.fixture(scope="session")
def spark() -> Iterator["SparkSession"]:
    """One local Spark session shared by all tests (JVM start is slow)."""
    # Imported here, not at the top: API tests must run without pyspark
    from pipeline.spark_session import build_spark

    session = build_spark("tests")
    yield session
    session.stop()
