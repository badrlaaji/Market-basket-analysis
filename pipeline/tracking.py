"""Shared MLflow logging: one SQLite database inside mlruns/."""

from pathlib import Path

import mlflow

ROOT = Path(__file__).resolve().parents[1]
# MLflow 3.17 refuses the ./mlruns file store: SQLite database inside mlruns/
MLRUNS = ROOT / "mlruns"
MLFLOW_URI = f"sqlite:///{MLRUNS / 'mlflow.db'}"
MLFLOW_ARTIFACTS = MLRUNS / "artifacts"


def log_run(
    experiment: str,
    run_name: str,
    params: dict[str, object],
    metrics: dict[str, float],
) -> None:
    """Record parameters and metrics as one MLflow run."""
    MLRUNS.mkdir(exist_ok=True)
    mlflow.set_tracking_uri(MLFLOW_URI)
    if mlflow.get_experiment_by_name(experiment) is None:
        # Default artifact folder is ./mlruns of the current directory: pin it
        mlflow.create_experiment(
            experiment, artifact_location=MLFLOW_ARTIFACTS.as_uri()
        )
    mlflow.set_experiment(experiment)
    with mlflow.start_run(run_name=run_name):
        mlflow.log_params(params)
        mlflow.log_metrics(metrics)
    print(f"MLflow run logged in {MLRUNS.relative_to(ROOT)}/ ({experiment})")
