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

## Step 3 — 2026-10-19
- **Done:** `pipeline/rules.py` (baskets, FP-Growth, lift filter, consequent as text) writes `outputs/rules.parquet`; one MLflow run per execution in `mlruns/mlflow.db`; `scripts/check_rules.py` recomputes 5 rules with pandas; 6 new tests (18 in total).
- **Blocked:** `StackOverflowError` at minSupport 0.005, then at 0.01 inside `run_all` only (2/2; 4/4 passes alone): the 1 MB Java thread stack is too small for deep FP-trees, fixed with `-Xss16m` in the shared session. MLflow 3.17.1 refuses the `./mlruns` file store: SQLite instead.
- **Measured:** baskets median 15, p90 51, max 1,106 products; 707 products in ≥ 1 % of invoices; minSupport 0.02 / 0.01 / 0.005 → 113 / 1,166 / 10,586 rules, 45 / 224 / 592 products covered, deepest branch 197 / 441 / 751; 1,355 itemsets at 0.01; 5 rules equal to pandas (difference 0.0); full pipeline 3 min 31 s, peak RAM 2.4 GB.
- **Note for step 7:** `/basket` must show a message when no product in the basket has a rule (only 224 of 4,725 products appear in a rule).

## Step 4 — 2026-10-19
- **Done:** `pipeline/segments.py` (RFM, log1p, StandardScaler, KMeans k = 2 to 8, 4 named segments) writes `outputs/segments.parquet` and `outputs/segment_profiles.parquet`; MLflow logging moved to `pipeline/tracking.py`; 6 new tests (24 in total).
- **Blocked:** nothing broke, but C6 as written (log of monetary only) gave a 21-customer cluster from k = 4: log1p added on frequency after approval. Spark pitfalls found: `StandardScaler` does not center by default, the silhouette uses squared distances, `maxIter` 20 is too low.
- **Measured:** 5,852 customers, reference date 2011-12-10; skew frequency 12.0 → 1.00, monetary 25.3 → 0.27; silhouette (squared) 0.599 → 0.469 from k = 2 to 8, 0.553 at k = 4 (0.384 Euclidean); segments Champions 1,650, Promising 2,076, At risk 869, Lost 1,257; RFM equal to pandas; segments step 84 s; full pipeline 4 min 28 s, peak RAM 2.3 GB.
