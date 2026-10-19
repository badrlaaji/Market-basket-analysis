"""Tests for pipeline.segments, on tiny hand-made DataFrames."""

from datetime import date, datetime

import numpy as np
import pandas as pd
import pytest
from pyspark.ml.linalg import Vectors
from pyspark.sql import DataFrame, SparkSession

from pipeline.segments import (
    compute_rfm,
    fit_kmeans,
    name_segments,
    reference_date,
    scale_features,
    silhouette,
)

CLEAN_SCHEMA = (
    "invoice string, quantity int, invoice_date timestamp, price double, "
    "customer_id int"
)


@pytest.fixture(scope="module")
def clean(spark: SparkSession) -> DataFrame:
    """Customer 100: 2 invoices (one with 2 lines); 200: 1 invoice; 1 unknown."""
    rows = [
        ("1", 2, datetime(2011, 12, 1, 10, 0), 1.5, 100),
        ("1", 4, datetime(2011, 12, 1, 10, 0), 2.0, 100),
        ("2", 1, datetime(2011, 12, 9, 12, 50), 10.0, 100),  # last invoice
        ("3", 3, datetime(2011, 11, 10, 9, 0), 1.0, 200),
        ("4", 5, datetime(2011, 12, 5, 9, 0), 1.0, None),
    ]
    return spark.createDataFrame(rows, CLEAN_SCHEMA)


def test_reference_date_is_day_after_last_invoice(clean: DataFrame) -> None:
    """Last invoice on 2011-12-09 12:50 -> reference date 2011-12-10."""
    assert reference_date(clean) == date(2011, 12, 10)


def test_compute_rfm(clean: DataFrame) -> None:
    """Recency in calendar days, distinct invoices, sum of quantity x price."""
    rfm = compute_rfm(clean, date(2011, 12, 10))
    rows = {r.customer_id: (r.recency, r.frequency, r.monetary) for r in rfm.collect()}
    # 100: 2 x 1.5 + 4 x 2.0 + 1 x 10.0 = 21.0 ; the unknown customer is dropped
    assert rows == {100: (1, 2, 21.0), 200: (30, 1, 3.0)}


def test_scale_features_centered_unit_variance(spark: SparkSession) -> None:
    """Each feature gets mean 0 and standard deviation 1 (withMean=True)."""
    rows = [(10, 0.7, 5.0), (40, 1.1, 6.0), (100, 2.4, 9.0), (300, 0.7, 4.0)]
    rfm = spark.createDataFrame(
        rows, "recency int, log_frequency double, log_monetary double"
    )
    x = np.array([r.features.toArray() for r in scale_features(rfm).collect()])
    assert x.mean(axis=0) == pytest.approx([0, 0, 0], abs=1e-9)
    assert x.std(axis=0, ddof=1) == pytest.approx([1, 1, 1])


def test_fit_kmeans_separates_two_groups(spark: SparkSession) -> None:
    """Two far-apart groups of points end up in two different clusters."""
    points = [(0.0, 0.0), (0.1, 0.2), (0.2, 0.1), (9.0, 9.0), (9.1, 9.2), (9.2, 9.1)]
    df = spark.createDataFrame([(Vectors.dense(p),) for p in points], ["features"])
    model = fit_kmeans(df, k=2)
    labels = [r.prediction for r in model.transform(df).collect()]
    assert len(set(labels[:3])) == 1 and len(set(labels[3:])) == 1
    assert labels[0] != labels[3]
    assert silhouette(model, df) > 0.9


def test_name_segments_ignores_cluster_numbers() -> None:
    """Names come from the profiles, whatever the KMeans cluster numbers."""
    profiles = pd.DataFrame(
        {
            "prediction": [0, 1, 2, 3],
            "recency_mean": [492.0, 48.0, 374.0, 73.0],
            "monetary_mean": [258.0, 8456.0, 1391.0, 763.0],
        }
    )
    named = name_segments(profiles)
    assert named["prediction"].tolist() == [1, 3, 2, 0]
    assert named["segment"].tolist() == [0, 1, 2, 3]
    assert named["segment_name"].tolist() == [
        "Champions",
        "Promising",
        "At risk",
        "Lost",
    ]


def test_name_segments_needs_four_clusters() -> None:
    """The naming rule is written for exactly 4 clusters."""
    profiles = pd.DataFrame({"prediction": [0, 1, 2], "recency_mean": [1.0, 2.0, 3.0]})
    with pytest.raises(ValueError):
        name_segments(profiles)
