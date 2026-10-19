# API image: FastAPI + pandas only (no Java, no Spark, no XGBoost: scores are precomputed).
# Build: docker build -t mba-api api/
# Run:   docker run -p 8000:8000 -v "$PWD/outputs:/app/outputs:ro" mba-api
FROM python:3.14-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    OUTPUTS_DIR=/app/outputs

WORKDIR /app

# Dependencies first: this layer stays cached while only the code changes
COPY requirements.txt api/requirements.txt
RUN pip install --no-cache-dir -r api/requirements.txt

# Code in /app/api, as in the repository: "uvicorn api.main:app" works the same way
COPY . api/

# Non-root user; the code stays owned by root (read-only for the app)
RUN useradd --uid 10001 --no-create-home --shell /usr/sbin/nologin app
USER app

EXPOSE 8000
CMD ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8000"]
