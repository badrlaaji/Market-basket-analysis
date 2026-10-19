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

## Step 2 — Cleaning with PySpark

### D02-1 Measure the raw data before writing cleaning rules
- **Context:** the planned rules were: drop "C" invoices, `Quantity <= 0`, `Price <= 0`.
- **Example:** invoice `A563185` ("Adjust bad debt", code `B`) has a **positive** price (+11,062.06): none of the planned rules removes it. Only 6 "A" invoices exist; 5 have a negative price.
- **Choice:** profile invoice prefixes and non-standard stock codes first, then decide the rules.
- **Why:** a rule written from assumptions would have let an accounting line enter the baskets as a "product".

### D02-2 Explicit list of non-product codes
- **Context:** 62 stock codes do not start with 5 digits (6,093 rows): postage, manual entries, fees, adjustments, tests, gift vouchers, but also real products (`DCGS...`, `PADS`, `SP1002`).
- **Options:** drop every code not starting with 5 digits; an explicit list.
- **Choice:** an explicit list of 25 codes (exact match), including gift vouchers. `DCGS...`, `PADS` and `SP1002` are kept.
- **Why:** a pattern would drop real products. Each excluded code can be justified. Removed: 4,649 rows.

### D02-3 Normalize stock codes before filtering
- **Context:** `upper(trim())` changes 3,472 rows (184 codes): 3,471 by case (`85123a`), 1 by a trailing space. 173 product codes merge into their upper-case twin.
- **Choice:** `normalize_stock_code()` runs first; the non-product list is written in upper case (`m` becomes `M` and is excluded).
- **Why:** without it, one product would be split into two codes in the association rules.

### D02-4 Remove exact duplicates
- **Context:** 34,335 exact duplicate rows in the raw data (3.2 %); 33,664 remain after the other rules and normalization.
- **Choice:** `dropDuplicates()` on all columns, after normalization.
- **Why:** duplicates inflate `monetary` in RFM. Baskets are not affected (`collect_set`), so removing them costs nothing.

### D02-5 Integer customer id, missing ids kept
- **Context:** all 5,852 customer ids are whole numbers (12346 to 18287); 226,761 clean rows have no id.
- **Choice:** cast to `int`; missing ids stay null.
- **Why:** rows without a customer still describe a basket. They are excluded only from RFM and repurchase.

### D02-6 Spark result checked against pandas
- **Choice:** the same rules computed with pandas give the reference count; Spark must match it exactly.
- **Result:** 1,003,357 rows on both sides, with the same count removed by each rule.

## Step 3 — Association rules with FP-Growth

### D03-1 minSupport 0.01, not 0.005
- **Context:** 39,516 baskets (median 15 products, p90 51, max 1,106), minConfidence 0.2. Measured: 0.02 → 113 rules, 45 products covered; 0.01 → 1,166 rules, 224 products, 86 s, peak RAM 1.7 GB; 0.005 → 10,586 rules, 592 products, 124 s.
- **Problem:** at 0.005 Spark failed with `java.lang.StackOverflowError`, not a memory error (peak 1.6 GB). Java serializes FP-trees recursively, and a branch is as deep as the number of frequent products in one basket: 197 / 441 / 751 at 0.02 / 0.01 / 0.005 (invoice 573585). It passed with a 16 MB thread stack (`-Xss16m`).
- **Choice:** 0.01: an itemset must appear in at least 396 invoices.
- **Why:** 1,166 rules can be checked and displayed, and the 224 covered products include the best sellers. 0.005 gives 9 times more rules.

### D03-2 16 MB thread stack in the shared Spark session (C4 extended)
- **Context:** at 0.01 the step passed alone (4 runs out of 4) but failed inside `pipeline.run_all`, after the ETL in the same JVM (2 out of 2), with the same `StackOverflowError`. A depth of 441 is close to the limit of the 1 MB default stack. Why the ETL run changes the outcome was not identified.
- **Options:** `-Xss16m`; drop the longest baskets from FP-Growth; one process per Spark step; minSupport 0.02 (45 products).
- **Choice:** `spark.driver.extraJavaOptions=-Xss16m` in `build_spark()`; a test checks that the JVM really started with it (the option is ignored if a session already exists).
- **Why:** it fixes the cause without changing the data or the thresholds. `run_all` passes (211 s) with the same peak RAM as the failed runs (2.4 GB): stack pages are only used when needed.

### D03-3 Confidence >= 0.2 and lift >= 1.5 kept as floors
- **Context:** the lift filter removes 0 rules at 0.01 (5 at 0.005).
- **Why it is almost inactive:** lift = confidence / support(consequent). The most frequent product (85123A) is in 13.8 % of invoices, so confidence >= 0.2 already implies lift >= 1.45.
- **Choice:** keep both thresholds as export floors; the `/rules` sliders filter further.

### D03-4 Consequent exported as text, antecedent sorted
- **Context:** Spark returns `consequent` as an array. The Spark 4.2.0 guide says it always holds one item and lists 5 columns, `support` included (the installed docstring says "four columns"; 5 are returned).
- **Choice:** `consequent[0]` as a string and `array_sort(antecedent)`; columns: antecedent, consequent, support, confidence, lift. A test checks the types.
- **Why:** the API compares plain strings, and the antecedent order no longer depends on `collect_set`.

### D03-5 MLflow on a SQLite database inside `mlruns/`
- **Context:** MLflow 3.17.1 raises an exception for the `./mlruns` file store ("maintenance mode"). Its default is now `sqlite:///mlflow.db`, and artifacts go to `./mlruns` of the current folder.
- **Options:** opt out with `MLFLOW_ALLOW_FILE_STORE=true`; SQLite at the repository root; SQLite inside `mlruns/`.
- **Choice:** `sqlite:///<repo>/mlruns/mlflow.db`, with the experiment's artifacts pinned to `mlruns/artifacts/`.
- **Why:** a supported backend, one folder already ignored by Git, and the same location whatever the working directory.

### D03-6 Invoice 573585 kept as an extreme basket
- **Context:** the largest basket has 1,106 distinct products (2011-10-31, no customer id, £14,838.86), 441 of them frequent at 0.01: the deepest FP-tree branch. The 20 largest baskets have no customer id; 58 baskets have more than 500 products.
- **Options:** cap the basket size; drop these invoices; keep them.
- **Choice:** keep them (the larger thread stack, D03-2, handles the depth).
- **Why:** they are real, clean invoices. One basket weighs 1 of 39,516 and a rule needs at least 396 invoices, so it cannot create a rule alone. Without a customer id, they are already outside RFM and repurchase.

### D03-7 Rules checked with pandas
- **Choice:** `scripts/check_rules.py` recomputes 5 rules (max lift, max confidence, max support, 3-item antecedent, a rule with 85123A) from `clean.parquet` with set intersections, N = 39,516 invoices.
- **Result:** identical values (max difference 0.0). Example: JUMBO BAG PINK POLKADOT → JUMBO BAG RED RETROSPOT, support 3.6 %, confidence 63.6 %, lift 6.26.

## Step 4 — Customer segments (RFM + KMeans)

### D04-1 log1p of frequency as well as monetary (C6 amended)
- **Context:** 5,852 customers, reference date 2011-12-10. Skew: recency 0.9, frequency 12.0, monetary 25.3; after log1p: frequency 1.00, monetary 0.27.
- **Problem:** with raw frequency (C6 as first written: log of amounts only), the scaled frequency reaches z = 28.8 (5.4 after log1p) and KMeans isolates 21 wholesale customers from k = 4 (2 customers at k = 7).
- **Choice:** features recency, log1p(frequency), log1p(monetary).
- **Why:** every segment keeps at least 259 customers for all k from 2 to 8. Silhouettes of two different feature spaces were not compared.

### D04-2 k = 4
- **Context:** the silhouette decreases with k: 0.599 (k = 2), 0.576, 0.553, 0.537 (k = 5) down to 0.469 (k = 8). Alone, it would pick k = 2.
- **Choice:** k = 4, inside the 3 to 5 range of C6.
- **Why:** the 4 profiles form clear quadrants (recent or not × higher or lower value), the smallest segment has 869 customers (15 %), and "At risk" matches the win-back use case. k = 5 only splits the best customers in two.

### D04-3 Segments named by rules on their profiles
- **Context:** KMeans cluster numbers are arbitrary.
- **Choice:** the 2 clusters with the lowest mean recency are "recent"; in each pair, the higher mean monetary comes first. Names Champions, Promising, At risk, Lost = segments 0 to 3. A test permutes the cluster numbers.
- **Result (mean recency / frequency / monetary):** Champions 48 days / 15.9 invoices / £8,456 (1,650 customers); Promising 73 / 2.7 / £763 (2,076); At risk 374 / 3.6 / £1,391 (869); Lost 492 / 1.2 / £258 (1,257).

### D04-4 Spark ML settings checked
- `StandardScaler(withMean=True)`: Spark does not center by default (`withMean=False`). A test checks mean 0 and standard deviation 1 (sample, n − 1).
- `KMeans(seed=42, maxIter=100)`: the default 20 iterations is too few (28 at k = 5, 74 at k = 8); with the seed, two runs give the same silhouettes.
- The Spark silhouette uses the squared Euclidean distance (Spark 4.2.0 docs): 0.553 at k = 4, against 0.384 for the usual Euclidean silhouette (scikit-learn, measured once). It is logged as `silhouette_sq_k*`.

### D04-5 Monetary kept gross of cancellations
- **Context:** the ETL removes cancellation lines, but the purchases they cancel stay. £1.10M cancelled vs £17.07M gross (6.4 %); 68 customers cancelled at least half of their gross amount, and cancellations can exceed purchases (3.9 times for one customer).
- **Options:** subtract cancellations taken from the raw data; keep the definition (sum of quantity × price on clean data).
- **Choice:** keep it gross, as a known limitation.
- **Why:** the log reduces the effect, and netting would bring back rows rejected by the ETL, some of them cancelling purchases that are not in the data.

### D04-6 Results checked with pandas
- **Result:** same 5,852 customers; recency and frequency identical for every customer, monetary within 2.3e-10; total £17,068,582.74.

### D04-7 Shared MLflow helper
- **Choice:** `pipeline/tracking.py` holds the SQLite settings and `log_run()`, used by the rules and segments steps (and by step 5).

## Step 5 — Repurchase prediction (XGBoost vs baseline)

### D05-1 Label window [ref, ref + 90 days) (to review)
- **Context:** C7 says "a purchase between T and 2011-12-09"; T = 2011-09-10 is the last invoice date minus 90 days, and the last invoice is on 2011-12-09 at 12:50.
- **Options:** a half-open 90-day window; an inclusive window (91 days, 2011-12-09 included).
- **Choice:** `ref <= invoice_date < ref + 90 days`, for both training and test.
- **Why:** both windows have the same length. Cost measured at T: 2,287 positives instead of 2,289. 2011-09-10 is a Saturday without invoices, so the training and test windows never overlap.

### D05-2 Out-of-time validation
- **Context:** a random split of customers would put the same weeks in training and test.
- **Choice:** training set = features before 2011-06-12, label up to 2011-09-10 (4,951 customers, 32.3 % positive). Test set = features before 2011-09-10, label up to 2011-12-09 (5,256 customers, 43.5 %).
- **Why:** the model is judged as in production: trained on the past, scored on a later period. Customers whose first purchase falls inside the window are excluded (305 and 595): they have no history to score.

### D05-3 Final scores come from the validated model (to review)
- **Context:** every customer is scored on 2011-12-10 (day after the last invoice, same date as the segments).
- **Options:** reuse the model trained at T − 90 days; refit it on the T dataset.
- **Choice:** reuse the validated model.
- **Why:** the reported metrics describe the model that actually produces the scores. Its training base rate (32.3 %, June to September) is close to the base rate of the window being predicted, measured one year earlier (December 2010 to March 2011: 30.7 %). The T window is the Christmas peak (43.5 %; 57.6 % one year earlier).

### D05-4 Features in pandas, one function for training, test and scoring
- **Context:** 776,596 rows with a customer id. XGBoost and scikit-learn work on pandas or numpy anyway.
- **Choice:** `build_features(df, ref_date)` in pandas, whose first line keeps `invoice_date < ref_date`. 7 features: recency, frequency, monetary, tenure, average basket, distinct products, invoices in the last 90 days. No segment: it is computed on all dates.
- **Checks:** at 2011-12-10, recency, frequency and monetary equal `segments.parquet` (Spark) for all 5,852 customers (max gaps 0, 0, 2.3e-10). The anti-leak test fails if `<` becomes `<=` (checked on a mutated copy).

### D05-5 Recency baseline, fixed XGBoost parameters
- **Choice:** baseline score = −recency. XGBoost: 200 trees, depth 3, learning rate 0.05, seed 42, 2 threads; nothing is tuned on the test period.
- **Metrics:** PR-AUC (`average_precision_score`; a random score gets the positive rate, 0.435) and ROC-AUC.
- **Result at T:** XGBoost PR-AUC 0.770 / ROC-AUC 0.795; baseline 0.685 / 0.762. Two runs give identical metrics and scores.

### D05-6 Probabilities shifted by seasonality (known limitation)
- **Measure:** mean predicted probability on the test period 0.316, observed rate 0.435: the model learned on a period with 32.3 % of buyers.
- **Consequence:** the ranking metrics are not affected, but the `/at-risk` threshold is a relative score, not an exact probability.

### D05-7 Export: products and stats (contract extended)
- **Choice:** `products.parquet` = most frequent description (tie: alphabetical order), distinct invoices, and `in_rules` (224 of 4,725 products appear in a rule), so that the basket page can point to products with recommendations.
- **Choice:** `stats.json` = counts from the data and the model metrics, read from `data/interim/repurchase_metrics.json` (written by step 5, not part of the API contract). The raw row count comes from the Parquet metadata, without loading the rows.

## Step 6 — REST API (FastAPI)

### D06-1 Outputs loaded once with the lifespan, folder from `OUTPUTS_DIR`
- **Context:** the outputs are small (1,166 rules, 4,725 products, 5,852 customers) and change only when the pipeline runs again.
- **Choice:** a `lifespan` function (FastAPI docs: the code before `yield` runs once, before the first request) fills a module-level dict. The folder comes from `OUTPUTS_DIR`; default `outputs/` next to `api/`, the same path in the repository and in the image.
- **Why:** each request is an in-memory pandas filter: loading takes 0.11 s, `/recommend` about 9 ms. The deprecated startup events are not used.

### D06-2 Query logic in plain functions, responses in Pydantic schemas
- **Choice:** `api/queries.py` holds pure pandas functions (filter, search, recommend, at-risk). `api/main.py` only validates parameters and turns rows into the schemas of `api/schemas.py`.
- **Why:** the logic is readable and testable apart from HTTP. The schemas document Swagger and guarantee the JSON types (integer `customer_id`, lists instead of numpy arrays).

### D06-3 Parameter validation and a tolerant `/recommend`
- **Bounds:** `min_confidence` and `threshold` in [0, 1], `min_lift` ≥ 0, `sort` in {lift, confidence, support}, `limit` and `top` from 1 to 500, at most 50 basket codes, `k` from 1 to 20. Anything else returns `422`.
- **`/recommend`:** codes are trimmed and upper-cased like in the ETL. Unknown codes are ignored and returned in `unknown_codes`. Each product is suggested once (rule with the highest lift), with that rule's antecedent in `because`.
- **Why:** one mistyped code should not cancel a whole basket, but the caller is told about it.

### D06-4 Product names joined at startup
- **Choice:** names (most frequent description) are joined to the rules once, with a lower-case search text, so `/rules?product=` matches codes and names. `pipeline/export.py` now trims descriptions before counting them ("X " and "X" are the same name).
- **Why:** no join per request, and the web app does not need a second call to display names.

### D06-5 Docker image
- **Choice:** `python:3.14-slim`; build context `api/` (the 1.4 GB `.venv` and `data/` are never sent); code copied into `/app/api`, so `uvicorn api.main:app` works as in the repository; user uid 10001; code owned by root; outputs mounted read-only.
- **Result:** build 92 s, image 646 MB, Python 3.14.8 (the tag follows 3.14 patch releases; the local venv runs 3.14.4). No Java, PySpark or XGBoost inside. The API tests pass inside the image.

### D06-6 PySpark import moved into the test fixture
- **Context:** `tests/conftest.py` imported PySpark at the top, so every test run needed PySpark, even for the API.
- **Choice:** import inside the `spark` fixture; the return annotation is quoted, under `TYPE_CHECKING`.
- **Check:** after `pytest tests/test_api.py`, no `pyspark`, `py4j`, `xgboost` or `pipeline` module is loaded; the same file passes in the image, where PySpark is absent.

### D06-7 Known issues (to review)
- Starlette 1.9 warns that its test client should use `httpx2` instead of `httpx`. `httpx2` is not in the pinned dependencies, so `httpx` is kept (it still works).
- `/at-risk` sorts by gross monetary (D04-5): at threshold 0.3, the first two customers (16446, £168,472 gross; 12346, £77,353) cancelled everything (net −£6 and −£268).
