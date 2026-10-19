"""Download the Online Retail II dataset (UCI) into data/raw/."""

import io
import urllib.request
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
URL = "https://archive.ics.uci.edu/static/public/502/online+retail+ii.zip"
XLSX_NAME = "online_retail_II.xlsx"
RAW_XLSX = ROOT / "data" / "raw" / XLSX_NAME
TIMEOUT_SECONDS = 120


def download_zip(url: str) -> bytes:
    """Download a file and return its bytes."""
    with urllib.request.urlopen(url, timeout=TIMEOUT_SECONDS) as response:
        return response.read()


def extract_xlsx(zip_bytes: bytes, dest: Path) -> None:
    """Write the one expected Excel file of the zip to dest."""
    with zipfile.ZipFile(io.BytesIO(zip_bytes)) as archive:
        content = archive.read(XLSX_NAME)  # one named member, never extractall
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(content)


def main() -> None:
    """Download and extract the dataset, unless it is already there."""
    if RAW_XLSX.exists():
        print(f"Already downloaded: {RAW_XLSX.relative_to(ROOT)}")
        return
    print(f"Downloading {URL}")
    extract_xlsx(download_zip(URL), RAW_XLSX)
    print(f"Saved {RAW_XLSX.relative_to(ROOT)} ({RAW_XLSX.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()
