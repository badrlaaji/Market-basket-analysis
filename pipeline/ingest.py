"""Read the Excel file (2 sheets) and save it as one Parquet file."""

from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
RAW_XLSX = ROOT / "data" / "raw" / "online_retail_II.xlsx"
RAW_PARQUET = ROOT / "data" / "interim" / "raw.parquet"
# Columns mix numbers and text (489434, C489449; 4 descriptions are numbers):
# read them as text, else Parquet fails with ArrowInvalid / ArrowTypeError (C2)
DTYPES = {"Invoice": str, "StockCode": str, "Description": str}


def read_sheets(path: Path) -> dict[str, pd.DataFrame]:
    """Read every sheet of the Excel file, codes as text."""
    return pd.read_excel(path, sheet_name=None, dtype=DTYPES)


def concat_sheets(sheets: dict[str, pd.DataFrame]) -> pd.DataFrame:
    """Stack all sheets into one DataFrame."""
    return pd.concat(sheets.values(), ignore_index=True)


def summarize(df: pd.DataFrame) -> dict[str, object]:
    """Count rows, cancellations, missing customers and exact duplicates."""
    return {
        "rows": len(df),
        "cancellations": int(df["Invoice"].str.startswith("C", na=False).sum()),
        "missing_customers": int(df["Customer ID"].isna().sum()),
        "duplicate_rows": int(df.duplicated().sum()),
        "first_date": df["InvoiceDate"].min(),
        "last_date": df["InvoiceDate"].max(),
    }


def excel_to_parquet(src: Path, dest: Path) -> None:
    """Convert the Excel file to one Parquet file."""
    sheets = read_sheets(src)
    for name, sheet in sheets.items():
        print(f"Sheet {name!r}: {len(sheet):,} rows")
    dest.parent.mkdir(parents=True, exist_ok=True)
    # Spark cannot read nanosecond timestamps (pandas default): write microseconds
    concat_sheets(sheets).to_parquet(dest, index=False, coerce_timestamps="us")


def main() -> None:
    """Excel -> Parquet, then read the Parquet back and print a summary."""
    excel_to_parquet(RAW_XLSX, RAW_PARQUET)
    df = pd.read_parquet(RAW_PARQUET)  # read back: proves the file is usable
    print(
        f"Wrote {RAW_PARQUET.relative_to(ROOT)} ({RAW_PARQUET.stat().st_size:,} bytes)"
    )
    print(df.dtypes.to_string())
    for key, value in summarize(df).items():
        print(f"{key}: {value}")


if __name__ == "__main__":
    main()
