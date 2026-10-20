# Market Basket Analysis

[![CI](https://github.com/badrlaaji/market-basket-analysis/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/badrlaaji/market-basket-analysis/actions/workflows/ci.yml)

An end-to-end retail analytics project on two years of orders from a UK online gift shop (1,067,371 invoice lines): a PySpark pipeline finds which products sell together, groups the customers, and scores who is about to stop buying; a FastAPI service and a Next.js app turn the results into answers a shop manager can act on.

## The problem

An online gift retailer wants three answers from its transaction history:

1. **Which products are bought together?** Association rules (FP-Growth) feed a "customers also bought" feature and the placement of products.
2. **Who are the customers?** RFM features (recency, frequency, monetary) and KMeans split them into four named groups.
3. **Who will stop buying?** A model gives each customer a chance of ordering again within 90 days, so the team knows whom to contact first.

## Demo

<!-- Demo video (2 min): drag the .mp4 into this README on GitHub, or paste its link here. -->
_Demo video (2 min): coming soon._

| Basket helper (association rules) | Customer groups (clustering) | Score reliability (classification) |
| --- | --- | --- |
| [![The basket as a till receipt, with the products customers often add](docs/img/web-basket.png)](docs/img/web-basket.png) | [![Share of customers against share of spending, and the card of a group](docs/img/web-segments.png)](docs/img/web-segments.png) | [![Share of customers who came back, per tenth of the score](docs/img/web-model.png)](docs/img/web-model.png) |

<details>
<summary>More screenshots: summary, bought together, win back, dark theme, phone</summary>

![Summary page: the answer in one sentence, three business questions and the monthly sales](docs/img/web-overview.png)

![Bought together: the patterns that match and the selected one in plain words](docs/img/web-rules.png)

![Win back: chance-of-ordering slider and customers to contact](docs/img/web-win-back.png)

![Summary page, dark theme](docs/img/web-overview-dark.png)

![Customer groups in the dark theme](docs/img/web-segments-dark.png)

<img src="docs/img/web-rules-mobile.png" alt="Bought together page on a phone" width="260"> <img src="docs/img/web-win-back-mobile.png" alt="Win back page on a phone" width="260">

</details>

## Architecture

```
OFFLINE   python -m pipeline.run_all                    (5 min 42 s on a laptop, Spark local[2])

  download ─► Excel ─► raw.parquet ─► cleaning ─► clean.parquet ─┬─► FP-Growth ─────► rules.parquet
              (pandas)                (PySpark)                  ├─► RFM + KMeans ──► segments.parquet, segment_profiles.parquet,
                                                                 │   (PySpark)        segments_k_report.json, segment_transitions.parquet
                                                                 ├─► XGBoost ───────► repurchase_scores.parquet, model_report.json
                                                                 │   (pandas)
                                                                 └─► export ────────► products.parquet, stats.json,
                                                                                      monthly_sales.parquet, segment_top_products.parquet
            experiments (thresholds, k, silhouettes, AUCs) ─► MLflow, local SQLite store

ONLINE    docker compose (infra/docker-compose.yml)

  Browser ─► web: Next.js, port 3000 ─► api: FastAPI, internal network only ─► pandas DataFrames in memory
             pages + /api/* routes        outputs/ mounted read-only, loaded once at startup
             (the browser never calls     no Spark, Java or XGBoost in the image: scores are precomputed
              FastAPI directly)

CI        GitHub Actions on every push: API tests, pipeline tests + ruff, Next.js lint + build, both Docker images
```

## Results

All figures are measured by the code of this repository.

| Step | Result |
| --- | --- |
| Cleaning (PySpark) | 1,067,371 → 1,003,357 rows: cancellations, invalid quantity or price, 25 non-product codes and exact duplicates removed. 39,516 invoices, 4,725 products, 5,852 customers. Same count as an independent pandas implementation. |
| Association rules (FP-Growth) | minSupport 0.01, confidence ≥ 0.2, lift ≥ 1.5: **1,166 rules covering 224 products** (minSupport 0.005 gave 10,586). The strongest has a lift of 51. 5 rules recomputed with pandas: difference 0.0. |
| Customer segments (RFM + KMeans) | log1p on frequency and monetary, standardization, **k = 4** (silhouette 0.553, squared distance): Champions 1,650, Promising 2,076, At risk 869, Lost 1,257 customers. Champions are 28 % of the customers and bring 82 % of their spending. |
| Repurchase within 90 days (XGBoost) | Out-of-time validation: trained on features before 2011-06-12, tested on features before 2011-09-10 (5,256 customers, 43.5 % buy again). **PR-AUC 0.770 / ROC-AUC 0.795** against a recency baseline at 0.685 / 0.762. Among the tenth of customers with the highest score, 93 % ordered again. An anti-leak test checks that purchases after the reference date never change a feature. |
| REST API (FastAPI) | 16 endpoints; `/recommend` answers in about 9 ms (in-process); invalid parameters return `422`. |
| Web app (Next.js) | 6 pages, one business question each, written for non-specialists: an answer sentence built from the data, one piece of advice, the technical charts in a closed analyst block. A scripted browser run in light, dark and phone width: 0 console errors, every request sent to the Next.js server only. |
| Packaging | Docker images `mba-api` 646 MB and `mba-web` 389 MB; 127 and 75 MiB of memory after loading every page; `compose up --build` in 57 s; only the web port is published. |
| Tests and CI | 88 pytest tests on tiny hand-made datasets; 4 parallel CI jobs, about 2 minutes per run. |

## Quick start

Needs Linux or WSL2, Python 3.14, Java 21 (for Spark), Docker with Compose, and about 3 GB of free memory (peak measured: 2.4 GB).

```bash
git clone https://github.com/badrlaaji/market-basket-analysis.git && cd market-basket-analysis

python3.14 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt
python -m pipeline.run_all                                    # downloads the data (45.6 MB), about 6 min
docker compose -f infra/docker-compose.yml up -d --build      # http://localhost:3000
```

PySpark is built from source during `pip install`; if `/tmp` is a small tmpfs, set `TMPDIR` to a folder on disk first. Stop the app with `docker compose -f infra/docker-compose.yml down`.

<details>
<summary>Run without Docker, run the tests, open MLflow</summary>

```bash
source .venv/bin/activate
pytest -q                                            # 88 tests (Java needed for the Spark ones)
uvicorn api.main:app                                 # API on http://localhost:8000/docs (Swagger UI)
cd frontend && npm ci && npm run dev                 # web app on http://localhost:3000
mlflow ui --backend-store-uri sqlite:///mlruns/mlflow.db   # experiments on http://127.0.0.1:5000
```

`API_URL` (server side only) tells Next.js where FastAPI is: `http://localhost:8000` by default, `http://api:8000` inside Compose. See [`.env.example`](.env.example).

</details>

<details>
<summary>REST API endpoints</summary>

| Endpoint | Description |
| --- | --- |
| `GET /health` | Liveness check and size of the loaded outputs |
| `GET /rules?min_confidence=&min_lift=&product=&sort=&limit=` | Rules filtered by thresholds and by product (code or name), sorted by lift, confidence or support |
| `GET /rules/export?...` | Every rule matching the `/rules` filters, as a CSV file |
| `GET /products?q=&limit=` | Product search; an empty query returns the most bought products |
| `POST /recommend` | `{"items": [...], "k": 5}` → products to suggest, from the rules whose antecedent is in the basket; unknown codes are listed, not rejected |
| `GET /scenarios` | Example baskets: the product pairs that start the most rules |
| `GET /segments` | Profile of each segment (size, share, means and medians, preferred products) |
| `GET /segments/map?n=` | A sample of customers (recency, frequency, spend, segment), no customer ID |
| `GET /segments/grid` | Customers per recency fifth × invoice band (1, 2, 3–4, 5–9, 10+) |
| `GET /segments/k` | Silhouette for k = 2 to 8 and the k kept |
| `GET /segments/transitions` | Customers moving between segments in the last 90 days |
| `GET /at-risk?threshold=&top=&segment=` | Customers below a repurchase probability, highest net spend first, with the total net spend of all of them |
| `GET /at-risk/histogram?segment=` | Customers and net spend per probability band of 0.05 |
| `GET /model` | Model metrics, precision-recall and ROC curves against the baseline, calibration per decile, feature importances |
| `GET /timeline` | Revenue, invoices and customers per month; partial months flagged |
| `GET /stats` | Key figures of the data, the rules and the model |

Parameters are validated (for example `min_confidence` and `threshold` in [0, 1], `limit` ≤ 500, or ≤ 2,000 for `/rules`, at most 50 basket items).

</details>

<details>
<summary>Web app pages</summary>

| Page (menu) | Question | What you can do |
| --- | --- | --- |
| `/` Summary | What do two years of orders say? | Three questions with their answer, monthly sales with the peaks, four key figures |
| `/rules` Bought together | Which products sell together? | Filter by product, how often and strength; read a pattern in plain words; CSV download. Analysts: map of every rule, flows, one product's rules, distributions |
| `/basket` Basket helper | What else goes in this basket? | Example baskets, popular products, search; the basket as a receipt with "customers often add" |
| `/segments` Customer groups | Who are the customers? | Share of customers against share of spending, a card per group. Analysts: scatter, radar, RFM grid, treemap, 90-day moves, silhouette per k |
| `/win-back` Win back | Who is about to stop buying? | Chance-of-ordering slider, filter by group, customers to contact first. Analysts: probability histogram |
| `/model` Score reliability | Can we trust the score? | Share of customers who came back per tenth of the score, what the score looks at. Analysts: PR and ROC curves, calibration |

</details>

## Repository structure

```
pipeline/      ingest.py (Excel → Parquet), etl.py (cleaning), rules.py (FP-Growth),
               segments.py (RFM + KMeans), export.py, run_all.py (one command for every output),
               spark_session.py (shared Spark settings), tracking.py (MLflow)
ml/            repurchase.py: features before a date, XGBoost vs baseline, final scores
api/           main.py (FastAPI, outputs loaded once), queries.py (pandas), schemas.py (Pydantic), Dockerfile
frontend/      Next.js app: app/ (6 pages, /api/* routes to FastAPI), components/, lib/, Dockerfile
infra/         docker-compose.yml
tests/         pytest on tiny hand-made datasets: cleaning rules, rules, segments, anti-leak test, every endpoint
scripts/       download_data.py, check_spark.py, check_rules.py (5 rules recomputed with pandas)
.github/       workflows/ci.yml
docs/img/      screenshots
```

## Limitations

- **Gross spend in the segments.** Cancellations are not deducted from the monetary value used by KMeans; the win-back list sorts by net spend instead.
- **Seasonal shift of the probabilities.** On the test period the model predicted 0.316 on average while 0.435 of the customers came back (the Christmas season): the scores are reliable as a ranking, not as exact probabilities.
- **Few products have a rule.** Only 224 of the 4,725 products appear in a rule, so most products get no suggestion.
- **Final scores without retraining.** The scores of today come from the model validated on the earlier period; retraining on all the data is left to review.
- **Not deployed yet.** The app runs locally with Docker Compose; the AWS deployment (S3 + EC2) is planned but postponed.
- **Static data.** The dataset ends on 9 December 2011; the pipeline is a batch job, rerun by hand.

## Data

[Online Retail II](https://archive.ics.uci.edu/dataset/502/online+retail+ii): 1,067,371 transactions from a UK-based online retailer, December 2009 to December 2011. The data is not stored in this repository; `python -m pipeline.run_all` downloads it.

Chen, D. (2012). Online Retail II [Dataset]. UCI Machine Learning Repository. https://doi.org/10.24432/C5CG6D. Licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

Only numeric customer IDs are displayed. No re-identification is attempted.

## License

Code released under the [MIT License](LICENSE).
