# Decisions

One entry per decision: context, options, choice, why.

## Step 0 — Environment

### D00-1 Pin direct dependencies only
- **Context:** the stack must not drift during the project (Python 3.14.4, 101 packages installed).
- **Options:** loose constraints; pin direct dependencies with `==`; full lock file from `pip freeze`.
- **Choice:** install from the constraints first, then pin the versions pip actually chose for the 9 + 6 direct dependencies.
- **Why:** readable files that a reviewer can check at a glance. Transitive dependencies are not pinned: accepted risk for a portfolio project.

### D00-2 `xgboost-cpu` instead of `xgboost`
- **Context:** on Linux, `xgboost` 3.4.1 (58 MB) also pulls `nvidia-nccl-cu13` (305 MB), a GPU library. The project runs on CPU only.
- **Options:** keep `xgboost`; use `xgboost-cpu`, the CPU-only build published by the same project.
- **Choice:** `xgboost-cpu==3.4.1` (6 MB). Same version and same `import xgboost`.
- **Why:** the virtual environment went from 1.8 GB to 1.4 GB, with no code change.

### D00-3 One local venv, same pandas and pyarrow in both requirement files
- **Context:** the pipeline writes Parquet files that the API reads. The API image has its own `api/requirements.txt`.
- **Options:** one venv per component; one shared local venv.
- **Choice:** one `.venv` installed from both files. `pandas==2.3.3` and `pyarrow==25.0.1` are identical in both.
- **Why:** simpler for local development, and Parquet is written and read by the same library versions.

### D00-4 pandas 2.3.3 and pyarrow 25.0.1
- **Context:** PySpark 4.2 warns with pandas 3 (measured). The latest pyarrow is 26.0.0.
- **Choice:** `pandas>=2.3.3,<3` resolves to 2.3.3, the only 2.3.x release with Python 3.14 wheels. `mlflow` 3.17.1 requires `pyarrow<26`, so pip chose 25.0.1.
- **Why:** versions chosen by the resolver are consistent by construction (`pip check`: no broken requirements).

### D00-5 Small local Spark session
- **Context:** WSL has about 3.8 GiB of RAM and 4 cores.
- **Choice:** `master("local[2]")` and `spark.sql.shuffle.partitions=4` instead of all cores and 200 partitions.
- **Why:** 4 to 11 times faster on this machine (measured during setup). Fallback if out of memory: `spark.driver.memory=2g`, then a 10 % sample.

### D00-6 pip temporary files on disk
- **Context:** `/tmp` is a 2 GiB tmpfs (in RAM). Building the 450 MB PySpark source archive there failed.
- **Choice:** `TMPDIR=~/.cache/pip-tmp pip install ...` for the first install.
- **Why:** the disk has plenty of space. The built wheel is then cached by pip, so later installs are fast.

## Step 1 — Excel to Parquet

### D01-1 Read code and text columns as text
- **Context:** `Invoice` and `StockCode` mix numbers and text (`489434`, `C489449`, `79323P`). 4 descriptions are numbers (other stock codes typed by mistake).
- **Options:** let pandas guess types; force `str` on the columns that failed; force `str` on every text column.
- **Choice:** `dtype={"Invoice": str, "StockCode": str, "Description": str}`.
- **Why:** mixed columns make Parquet fail (`ArrowInvalid` or `ArrowTypeError`, both reproduced). Missing values stay missing.

### D01-2 Timestamps written in microseconds
- **Context:** pandas stores dates in nanoseconds; Spark 4.2 refuses them (`PARQUET_TYPE_ILLEGAL`, reproduced).
- **Options:** `coerce_timestamps="us"` when writing; a Spark legacy option that reads them as integers.
- **Choice:** write microseconds with pyarrow. Dates are minute-precise, so nothing is lost.

### D01-3 Raw Parquet keeps the original columns
- **Context:** the Parquet file is the starting point of the Spark cleaning step.
- **Choice:** no renaming and no filtering at ingestion: only types are fixed. Renaming to snake_case happens in step 2.
- **Why:** one job per step. Spark reads `Customer ID` (with a space) without trouble (checked: 1,067,371 rows).

### D01-4 Download script
- **Choice:** standard library only (`urllib`, `zipfile`); the zip is checked in memory, then only `online_retail_II.xlsx` is written; skipped if the file exists.
- **Why:** no extra dependency, no path from the archive is trusted, and `python -m pipeline.run_all` can be run again safely.

### D01-5 Test configuration in `pyproject.toml`
- **Context:** the `pytest` command does not add the repository root to the import path, so `import pipeline` fails.
- **Choice:** `[tool.pytest.ini_options] pythonpath = ["."]`, rather than an empty `conftest.py` that works by side effect.
