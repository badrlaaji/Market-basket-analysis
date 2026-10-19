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

## Step 5 — 2026-10-19
- **Done:** `ml/repurchase.py` (7 features before a reference date, label on the next 90 days, out-of-time validation, recency baseline, XGBoost, MLflow run, final scores) writes `outputs/repurchase_scores.parquet`; `pipeline/export.py` writes `outputs/products.parquet` and `outputs/stats.json`; both added to `run_all`; 12 new tests (36 in total), including the anti-leak test.
- **Blocked:** nothing broke. `pd.Timestamp ± pd.Timedelta` raises a numpy `DeprecationWarning` (numpy 2.5.4), so dates are computed with `datetime.timedelta`.
- **Measured:** training set 4,951 customers (32.3 % positive), test set 5,256 (43.5 %); XGBoost PR-AUC 0.770 / ROC-AUC 0.795 vs recency baseline 0.685 / 0.762; mean predicted probability 0.316 on the test set; importance (gain): frequency 0.36, recency 0.25, invoices_90d 0.16; 5,852 customers scored (mean 0.354; Champions 0.73, Lost 0.05); repurchase step 7.8 s (peak 602 MB); full pipeline 4 min 24 s (peak RSS of the Python process 1.1 GB, JVM not included); 36 tests in 46 s.

## Step 6 — 2026-10-19
- **Done:** FastAPI app (`api/main.py`, `api/queries.py`, `api/schemas.py`): 7 endpoints, outputs loaded once by the lifespan, validated parameters; PySpark import moved into the test fixture; non-root Docker image; `.env.example`; README with architecture, results and endpoints. After review: `monetary_net` added to the repurchase scores and used to sort `/at-risk` (D06-8). 22 API tests (59 in total).
- **Blocked:** nothing broke. Every test run prints `StarletteDeprecationWarning: Using httpx with starlette.testclient is deprecated; install httpx2 instead` (Starlette 1.9.0). `httpx` is kept because the stack is frozen; the tests pass. Sorted by gross monetary, the first "at risk" customers had cancelled everything (D04-5), hence D06-8.
- **Measured:** outputs loaded in 0.11 s; `/recommend` 9.1 ms per call (100 in-process calls); `/at-risk?threshold=0.3` → 3,198 customers; docker build 92 s, image 646 MB; `/health` and `/rules?limit=3` answer in the container; 22 API tests green inside the image (no PySpark there; rebuild 14 s with the dependency layer cached); net value: 2,422 customers with cancellations (−£708,584), customer 16446 moves from rank 1 to 3,181 of 3,198; 59 tests in 41 s.

## Step 7 — 2026-10-19
- **Done:** Next.js 16.4.2 app in `frontend/`: 5 server pages (`/`, `/rules`, `/basket`, `/segments`, `/win-back`), 4 client components, 7 `/api/*` routes forwarding to FastAPI, error page when FastAPI is down; `/win-back` shows net and gross spend; light and dark themes; README section.
- **Blocked:** nothing broke. `npm audit` reports 5 high alerts in the ESLint chain only (not shipped; the forced fix downgrades Next). Next 16.4 renamed the `reset` prop of `error.tsx` to `retry` (bundled docs). `next start` does not apply to `output: "standalone"`: checks run with `node .next/standalone/server.js` after copying `.next/static`.
- **Measured:** `npm run build` 32 s (peak 822 MB) with FastAPI stopped, 5 pages + 7 routes dynamic; standalone folder 42 MB; first page 0.41 s cold, then 30 to 90 ms; scripted browser flow: 14 API calls, all `200`, all to `localhost:3000`, 0 console errors; FastAPI stopped → routes `502`, pages show the error screen; 1,861 lines of TypeScript and CSS.

## Step 8 — 2026-10-19
- **Done:** `frontend/Dockerfile` (3 stages, non-root `node` user), `frontend/.dockerignore`, `infra/docker-compose.yml` (internal API with a Python health check, web on port 3000 started once the API is healthy); README section.
- **Blocked:** nothing broke. Adapted from the official Next.js example: no `public/` folder to copy, and the example's `.dockerignore` replaced by a short one. No `curl` in the API image, hence the Python health check.
- **Measured:** first `up -d --build` 155 s, cached rebuild 7.7 s; images `mba-api` 646 MB, `mba-web` 386 MB (app folder 42 MB); memory at rest 150 MiB (api) + 176 MiB (web), 181 MiB after a page; 5 pages and 7 `/api/*` routes answer 200; `localhost:8000` refused from the host; uids 10001 (api) and 1000 (web); `down` 2.8 s.

## Step 9 — 2026-10-19
- **Done:** `.github/workflows/ci.yml` (jobs api, pipeline, web, docker), CI badge in the README; branch `step-09-ci`; GitHub CLI installed from the official repository to follow the runs.
- **Blocked:** nothing broke: the first run was green. The Ubuntu package of GitHub CLI (2.46) is reported broken by its maintainers, so the official repository was used.
- **Measured:** first run 2 min 8 s in total; api 30 s (install 19 s, 22 tests in 1.4 s), pipeline 2 min 4 s (install 85 s including the PySpark wheel build in 14 s, 37 tests in 23.7 s), web 38 s (npm ci 12 s, build 8 s), docker 45 s (build 40 s); caches saved: pip 1.04 GiB (pipeline), 83 MiB (api), npm 106 MiB; image sizes reported by the runner 457 MB (api) and 269 MB (web).

## Step 7b — 2026-10-19
- **Done:** five new pipeline outputs (monthly sales, model report, silhouette per k, preferred products per segment, 90-day segment migration) and segment shares; 9 new API endpoints and 4 extended; the 5 pages rebuilt around one business question each, with an answer sentence generated from the data, and a new `/model` page; glossary, tabs, loading state; screenshots in `docs/img/`; 29 new tests (88 in total).
- **Blocked:** nothing broke. Found on the way: `qcut` fails on frequency (27.6 % of customers have 1 invoice: fixed bands, validated); the Recharts Sankey loops forever on a cycle (two-column graph); no 4-colour palette passes the all-pairs colour-blindness check (one segment in colour in the scatter); a CSS rule written after its media query broke the phone layout; `next build` while `next dev` runs leaves stale modules in the dev server.
- **Measured:** `run_all` 5 min 42 s (peak 1.1 GB); 88 tests in 55 s, 39 API tests with `api/requirements.txt` only; every rule as JSON 283 KB; calibration: the observed rate is above the prediction in 10 of 10 deciles; migration: 1,299 of 1,345 Champions stay, 596 new customers; `compose up --build` 61 to 73 s, images 646 MB (api) and 389 MB (web); scripted browser run of the 6 pages and every tab: 0 console error, one host (`localhost:3000`), no horizontal scroll at 390 px; 10 screenshots, 1.1 MB.

## Step 7c — 2026-10-20
- **Done:** interface rewritten for non-specialists: menu named by questions, plain words, one "What to do" box per page, technical charts in a closed analyst block; new look (shopfront green, Retrospot red, system book serif, basket as a till receipt, logo); new main chart on the model page; 3 small components (`NextStep`, `AnalystDetails`, `Logo`); README page table and the 10 screenshots updated.
- **Blocked:** `next dev` opened from `127.0.0.1` never hydrated (dev assets blocked for that origin, `allowedDevOrigins` in the Next.js docs): checks moved to the production build. The 7b browser script could close the user's Edge tabs: fixed in the copy used here.
- **Measured:** 27 frontend files changed (+1,095 / −566 lines, 3 new components of 67 lines in total); `npm run lint` clean, build compiled in 9.2 s; 6 pages and the `/api/*` routes answer `200`; browser run of the 6 pages in light, dark and 390 px: 0 console error, 0 exception, one host (`127.0.0.1:3000`), page width 390 px on a phone; no FastAPI address in `.next/static`; 10 screenshots, 968 KB.
