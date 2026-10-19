"""Run the whole offline pipeline: python -m pipeline.run_all"""

from ml import repurchase
from pipeline import etl, export, ingest, rules, segments
from scripts import download_data


def main() -> None:
    """Run every offline step in order."""
    download_data.main()
    ingest.main()
    etl.main()
    rules.main()
    segments.main()
    repurchase.main()  # needs segments.parquet (segment joined for display)
    export.main()  # needs rules.parquet and the repurchase metrics


if __name__ == "__main__":
    main()
