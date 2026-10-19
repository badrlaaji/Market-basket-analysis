# Market Basket Analysis

> **Work in progress.** This repository is built step by step. Results will be added as they are measured.

## Problem

An online retailer wants to answer three questions from its transaction history:

1. **Which products are bought together?** Association rules (FP-Growth) power a "customers also bought" feature.
2. **Who are our customers?** RFM features and KMeans group customers into named segments.
3. **Who will stop buying?** A model predicts each customer's probability of purchasing again within 90 days, so the team can target win-back campaigns.

The answers are served through a REST API and an interactive web app.

## Plan

- [x] 0. Repository, virtual environment, Spark smoke test
- [x] 1. Excel to Parquet ingestion
- [ ] 2. Data cleaning with PySpark
- [ ] 3. Association rules with FP-Growth
- [ ] 4. RFM segmentation with KMeans
- [ ] 5. Repurchase prediction (XGBoost vs baseline, tracked with MLflow)
- [ ] 6. REST API (FastAPI) with tests
- [ ] 7. Web interface (Next.js)
- [ ] 8. Docker Compose
- [ ] 9. CI with GitHub Actions
- [ ] 10. Deployment on AWS (S3 + EC2)
- [ ] 11. Final README, demo video, `v1.0`

## Architecture (planned)

```
OFFLINE   Excel -> Parquet -> PySpark cleaning -> FP-Growth rules
                                               -> RFM + KMeans segments
                                               -> XGBoost repurchase scores
                                               => Parquet outputs

ONLINE    Browser -> Next.js -> FastAPI -> in-memory pandas DataFrames
```

## Stack

- **Pipeline and ML:** Python 3.14, PySpark 4.2, pandas, scikit-learn, XGBoost, MLflow
- **API:** FastAPI, Uvicorn
- **Frontend:** Next.js 16, React 19, TypeScript, Recharts
- **Infrastructure:** Docker, GitHub Actions, AWS (S3, EC2)

## Data

[Online Retail II](https://archive.ics.uci.edu/dataset/502/online+retail+ii): 1,067,371 transactions from a UK-based online retailer, December 2009 to December 2011.
The data is not stored in this repository. Download it and run the pipeline with:

```bash
source .venv/bin/activate
python -m pipeline.run_all   # downloads the data if missing, then builds data/interim/raw.parquet
```

Chen, D. (2012). Online Retail II [Dataset]. UCI Machine Learning Repository. https://doi.org/10.24432/C5CG6D. Licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

Only numeric customer IDs are displayed. No re-identification is attempted.

## License

Code released under the [MIT License](LICENSE).
