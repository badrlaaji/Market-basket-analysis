"""Run the whole offline pipeline: python -m pipeline.run_all"""

from pipeline import etl, ingest
from scripts import download_data


def main() -> None:
    """Run every offline step in order."""
    download_data.main()
    ingest.main()
    etl.main()


if __name__ == "__main__":
    main()
