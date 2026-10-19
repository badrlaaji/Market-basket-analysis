"""Tests for pipeline.ingest on tiny fabricated data."""

from pathlib import Path

import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq

from pipeline.ingest import excel_to_parquet, summarize


def test_excel_to_parquet_types(tmp_path: Path) -> None:
    """Mixed codes become text and dates are microseconds, readable by Spark (C2)."""
    xlsx = tmp_path / "tiny.xlsx"
    parquet = tmp_path / "tiny.parquet"
    sheet_1 = pd.DataFrame(
        {
            "Invoice": [489434, "C489449"],
            "StockCode": [85048, "79323P"],
            "Description": ["PINK CHERRY LIGHTS", 21494],
            "InvoiceDate": pd.to_datetime(["2009-12-01 07:45", "2009-12-01 10:06"]),
        }
    )
    sheet_2 = pd.DataFrame(
        {
            "Invoice": [489435],
            "StockCode": [22041],
            "Description": [None],
            "InvoiceDate": pd.to_datetime(["2010-12-01 08:26"]),
        }
    )
    with pd.ExcelWriter(xlsx) as writer:
        sheet_1.to_excel(writer, sheet_name="Year 2009-2010", index=False)
        sheet_2.to_excel(writer, sheet_name="Year 2010-2011", index=False)

    excel_to_parquet(xlsx, parquet)  # fails without dtype=str
    df = pd.read_parquet(parquet)

    assert df["Invoice"].tolist() == ["489434", "C489449", "489435"]
    assert df["StockCode"].tolist() == ["85048", "79323P", "22041"]
    assert df["Description"].tolist()[:2] == ["PINK CHERRY LIGHTS", "21494"]
    assert df["Description"].isna().tolist() == [False, False, True]  # NaN stays NaN
    assert pq.read_schema(parquet).field("InvoiceDate").type == pa.timestamp("us")


def test_summarize_counts() -> None:
    """Cancellations, missing customers and exact duplicates are counted."""
    df = pd.DataFrame(
        {
            "Invoice": ["489434", "489434", "C489449", "489450"],
            "Customer ID": [13085.0, 13085.0, None, 12345.0],
            "InvoiceDate": pd.to_datetime(
                ["2009-12-01", "2009-12-01", "2009-12-02", "2009-12-03"]
            ),
        }
    )

    summary = summarize(df)

    assert summary["rows"] == 4
    assert summary["cancellations"] == 1
    assert summary["missing_customers"] == 1
    assert summary["duplicate_rows"] == 1
