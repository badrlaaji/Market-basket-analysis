"""Clean the raw transactions with PySpark: raw.parquet -> clean.parquet."""

from pathlib import Path

from pyspark.sql import DataFrame
from pyspark.sql import functions as F

from pipeline.spark_session import build_spark

ROOT = Path(__file__).resolve().parents[1]
RAW_PARQUET = ROOT / "data" / "interim" / "raw.parquet"
CLEAN_PARQUET = ROOT / "data" / "interim" / "clean.parquet"

COLUMNS = {
    "Invoice": "invoice",
    "StockCode": "stock_code",
    "Description": "description",
    "Quantity": "quantity",
    "InvoiceDate": "invoice_date",
    "Price": "price",
    "Customer ID": "customer_id",
    "Country": "country",
}

# Codes that are not products (measured on raw.parquet, step 2).
# Written upper-case: codes are normalized before this filter.
NON_PRODUCT_CODES = [
    "POST", "DOT", "C2", "C3",  # postage and carriage
    "M",  # manual entries ("m" becomes "M")
    "D", "S",  # discount, samples
    "BANK CHARGES", "AMAZONFEE", "CRUK",  # fees and commissions
    "ADJUST", "ADJUST2", "B",  # accounting adjustments ("A" invoices use "B")
    "TEST001", "TEST002",  # test products
    "GIFT", "GIFT_0001_10", "GIFT_0001_20", "GIFT_0001_30", "GIFT_0001_40",
    "GIFT_0001_50", "GIFT_0001_60", "GIFT_0001_70", "GIFT_0001_80", "GIFT_0001_90",
]  # fmt: skip


def rename_columns(df: DataFrame) -> DataFrame:
    """Rename the Excel columns to snake_case."""
    return df.select([F.col(old).alias(new) for old, new in COLUMNS.items()])


def normalize_stock_code(df: DataFrame) -> DataFrame:
    """Trim spaces and upper-case stock codes ("85123a " -> "85123A")."""
    return df.withColumn("stock_code", F.upper(F.trim("stock_code")))


def drop_cancellations(df: DataFrame) -> DataFrame:
    """Remove cancelled invoices (number starting with "C")."""
    return df.filter(~F.col("invoice").startswith("C"))


def drop_invalid_quantity_price(df: DataFrame) -> DataFrame:
    """Keep rows with a positive quantity and a positive price."""
    return df.filter((F.col("quantity") > 0) & (F.col("price") > 0))


def drop_non_products(df: DataFrame) -> DataFrame:
    """Remove postage, fees, adjustments, tests and gift vouchers."""
    return df.filter(~F.col("stock_code").isin(NON_PRODUCT_CODES))


def drop_exact_duplicates(df: DataFrame) -> DataFrame:
    """Remove rows identical on every column."""
    return df.dropDuplicates()


def cast_customer_id(df: DataFrame) -> DataFrame:
    """Store customer_id as an integer; missing ids stay null."""
    return df.withColumn("customer_id", F.col("customer_id").cast("int"))


CLEANING_STEPS = [
    drop_cancellations,
    drop_invalid_quantity_price,
    drop_non_products,
    drop_exact_duplicates,
]


def clean(df: DataFrame) -> DataFrame:
    """Apply every cleaning rule, in order, to the raw DataFrame."""
    df = normalize_stock_code(rename_columns(df))
    for step in CLEANING_STEPS:
        df = step(df)
    return cast_customer_id(df)


def print_step_counts(df: DataFrame) -> None:
    """Print how many rows each cleaning rule removes."""
    df = normalize_stock_code(rename_columns(df))
    before = df.count()
    print(f"raw: {before:,}")
    for step in CLEANING_STEPS:
        df = step(df)
        after = df.count()
        print(f"{step.__name__}: -{before - after:,} -> {after:,}")
        before = after


def quality_checks(df: DataFrame) -> dict[str, int]:
    """Count rows that must never remain after cleaning (all 0 except rows)."""
    row = df.agg(
        F.count("*").alias("rows"),
        F.count_if(F.col("description").isNull()).alias("null_description"),
        F.count_if(~F.col("invoice").rlike(r"^\d")).alias("invoice_not_digit"),
        F.count_if(F.col("description").rlike(r"^\d+$")).alias("numeric_description"),
    ).first()
    return row.asDict()


def main() -> None:
    """raw.parquet -> clean.parquet, then read it back and run the checks."""
    spark = build_spark("etl")
    raw = spark.read.parquet(str(RAW_PARQUET)).cache()
    print_step_counts(raw)
    clean(raw).write.mode("overwrite").parquet(str(CLEAN_PARQUET))
    back = spark.read.parquet(str(CLEAN_PARQUET))
    print(f"Wrote {CLEAN_PARQUET.relative_to(ROOT)}")
    print(f"customer_id type: {back.schema['customer_id'].dataType.simpleString()}")
    for key, value in quality_checks(back).items():
        print(f"{key}: {value:,}")
    spark.stop()


if __name__ == "__main__":
    main()
