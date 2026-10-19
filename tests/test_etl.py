"""Tests for pipeline.etl: one test per cleaning rule, on tiny DataFrames."""

from datetime import datetime

from pyspark.sql import DataFrame, SparkSession

from pipeline.etl import (
    cast_customer_id,
    clean,
    drop_cancellations,
    drop_exact_duplicates,
    drop_invalid_quantity_price,
    drop_non_products,
    normalize_stock_code,
    quality_checks,
    rename_columns,
)

RAW_SCHEMA = (
    "Invoice string, StockCode string, Description string, Quantity long, "
    "InvoiceDate timestamp, Price double, `Customer ID` double, Country string"
)
DATE = datetime(2010, 12, 1, 8, 26)


def raw_row(
    invoice: str = "489434",
    code: str = "85123A",
    description: str | None = "WHITE HANGING HEART T-LIGHT HOLDER",
    quantity: int = 6,
    price: float = 2.55,
    customer: float | None = 13085.0,
) -> tuple:
    """Build one raw row; every argument has a valid default."""
    return (
        invoice,
        code,
        description,
        quantity,
        DATE,
        price,
        customer,
        "United Kingdom",
    )


def raw_df(spark: SparkSession, rows: list[tuple]) -> DataFrame:
    """Build a DataFrame with the raw Excel column names."""
    return spark.createDataFrame(rows, RAW_SCHEMA)


def clean_df(spark: SparkSession, rows: list[tuple]) -> DataFrame:
    """Build a DataFrame with the snake_case column names."""
    return rename_columns(raw_df(spark, rows))


def codes(df: DataFrame) -> list[str]:
    """Return the stock codes of a DataFrame, sorted."""
    return sorted(row.stock_code for row in df.collect())


def test_rename_columns(spark: SparkSession) -> None:
    """Excel names become snake_case, in the same order."""
    df = clean_df(spark, [raw_row()])
    assert df.columns == [
        "invoice", "stock_code", "description", "quantity",
        "invoice_date", "price", "customer_id", "country",
    ]  # fmt: skip


def test_normalize_stock_code(spark: SparkSession) -> None:
    """Spaces are trimmed and letters upper-cased."""
    df = clean_df(spark, [raw_row(code="85123a "), raw_row(code="85123A")])
    assert codes(normalize_stock_code(df)) == ["85123A", "85123A"]


def test_drop_cancellations(spark: SparkSession) -> None:
    """Invoices starting with "C" are removed."""
    df = clean_df(spark, [raw_row(invoice="489434"), raw_row(invoice="C489449")])
    assert [r.invoice for r in drop_cancellations(df).collect()] == ["489434"]


def test_drop_invalid_quantity_price(spark: SparkSession) -> None:
    """Zero or negative quantity or price is removed."""
    rows = [
        raw_row(code="OK"),
        raw_row(code="Q0", quantity=0),
        raw_row(code="QNEG", quantity=-1),
        raw_row(code="P0", price=0.0),
        raw_row(code="PNEG", price=-1.0),
    ]
    assert codes(drop_invalid_quantity_price(clean_df(spark, rows))) == ["OK"]


def test_drop_non_products(spark: SparkSession) -> None:
    """Postage and gift vouchers go; real products (DCGS..., PADS) stay."""
    rows = [
        raw_row(code="POST"),
        raw_row(code="GIFT_0001_20"),
        raw_row(code="DCGS0058"),
        raw_row(code="PADS"),
    ]
    assert codes(drop_non_products(clean_df(spark, rows))) == ["DCGS0058", "PADS"]


def test_drop_exact_duplicates(spark: SparkSession) -> None:
    """Only rows identical on every column are merged."""
    rows = [raw_row(), raw_row(), raw_row(quantity=12)]
    assert drop_exact_duplicates(clean_df(spark, rows)).count() == 2


def test_cast_customer_id_keeps_missing(spark: SparkSession) -> None:
    """customer_id becomes an integer and missing ids stay as null rows."""
    df = cast_customer_id(clean_df(spark, [raw_row(), raw_row(customer=None)]))
    assert df.schema["customer_id"].dataType.simpleString() == "int"
    assert sorted(r.customer_id or 0 for r in df.collect()) == [0, 13085]


def test_lowercase_m_is_excluded(spark: SparkSession) -> None:
    """Manual entry "m" is normalized to "M", then excluded."""
    df = clean(raw_df(spark, [raw_row(code="m"), raw_row(code="85123A")]))
    assert codes(df) == ["85123A"]


def test_bad_debt_invoice_a_is_excluded(spark: SparkSession) -> None:
    """An "A" invoice with code "B" and a positive price is excluded."""
    bad_debt = raw_row(
        invoice="A563185",
        code="B",
        description="Adjust bad debt",
        quantity=1,
        price=11062.06,
        customer=None,
    )
    df = clean(raw_df(spark, [bad_debt, raw_row()]))
    assert [r.invoice for r in df.collect()] == ["489434"]


def test_quality_checks_count_bad_rows(spark: SparkSession) -> None:
    """The checks count null and numeric descriptions and non-digit invoices."""
    rows = [
        raw_row(),
        raw_row(description=None),
        raw_row(description="21494"),
        raw_row(invoice="A506401"),
    ]
    assert quality_checks(clean_df(spark, rows)) == {
        "rows": 4,
        "null_description": 1,
        "invoice_not_digit": 1,
        "numeric_description": 1,
    }
