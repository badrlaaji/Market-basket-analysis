# Journal

## Step 0 — 2026-10-19
- **Done:** repository, `.gitignore`, MIT license, WIP README; `.venv` on Python 3.14.4; dependencies pinned (9 pipeline + 6 API, 101 packages installed, `pip check` clean); `spark.range(5).show()` prints 5 rows.
- **Blocked:** the PySpark wheel build failed because `/tmp` is a 2 GiB tmpfs; fixed by setting `TMPDIR` to a folder on disk.
- **Measured:** failed install 4 min 08 s, successful install 3 min 41 s; Spark smoke test 17.6 s (JVM start included); venv 1.8 GB with `xgboost`, 1.4 GB with `xgboost-cpu`.

## Step 1 — 2026-10-19
- **Done:** download script (45.6 MB in 10.4 s, skipped when present); Excel (2 sheets) to `data/interim/raw.parquet`, read back by pandas and by Spark; `python -m pipeline.run_all`; 2 tests green.
- **Blocked:** 4 numeric descriptions broke the Parquet write (`ArrowTypeError`): `Description` now read as text. Spark refused nanosecond timestamps: written in microseconds.
- **Measured:** 1,067,371 rows (525,461 + 541,910); 19,494 cancellations (1.8 %); 243,007 missing Customer ID (22.8 %); 34,335 exact duplicate rows (3.2 %); 2009-12-01 07:45 to 2011-12-09 12:50; Parquet 7.2 MB vs Excel 45.6 MB; Excel read and write 1 min 14 s, peak RAM 948 MiB; Parquet read back in 0.31 s.

## Step 2 — 2026-10-19
- **Done:** shared Spark session; `pipeline/etl.py` (rename, normalize codes, 4 cleaning rules, integer customer id) writes `data/interim/clean.parquet`; 10 Spark tests (12 in total, 26.5 s).
- **Blocked:** nothing. Profiling found invoice `A563185` (positive bad-debt adjustment) and 173 lower-case product codes before any rule was written.
- **Measured:** 1,067,371 → 1,003,357 rows (−19,494 cancellations, −6,207 quantity/price, −4,649 non-products, −33,664 duplicates), equal to the pandas reference; 39,516 invoices, 4,725 products, 5,852 customers; 0 null description, 0 non-digit invoice; full pipeline 2 min 13 s, peak RAM 1.0 GB.
