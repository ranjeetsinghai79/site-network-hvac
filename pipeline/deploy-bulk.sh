#!/bin/bash
# deploy-bulk.sh — Deploy scrape-bulk.ts as a GCP Cloud Run Job + Cloud Scheduler
# Runs all 5 niches sequentially (medspa → hvac → roofing → dental → restaurant)
# Schedule: every 6 hours = 4 runs/day
# Usage: bash pipeline/deploy-bulk.sh

set -e

PROJECT=gen-lang-client-0844283339
REGION=us-central1
REGISTRY=us-central1-docker.pkg.dev/${PROJECT}/webcrew
JOB_NAME=scraper-bulk-all
SCHED_NAME=schedule-scraper-bulk-all
SA_EMAIL="scraper-scheduler@${PROJECT}.iam.gserviceaccount.com"

echo "=== Bulk Scraper GCP Deployment ==="
echo "Project: $PROJECT | Job: $JOB_NAME"
echo ""

# ─── 1. Build image ───────────────────────────────────────────────────────────
echo "[1/3] Building scraper-bulk image..."
gcloud builds submit pipeline/ \
  --config=pipeline/cloudbuild-bulk.yaml \
  --project=${PROJECT}
echo "  image: ${REGISTRY}/scraper-bulk:latest"

# ─── 2. Load env vars ─────────────────────────────────────────────────────────
export $(grep -v '^#' pipeline/.env | grep -v '^$' | tr -d '"' | \
  grep -E 'LEADS_SHEET_ID|GOOGLE_AI_API_KEY|GOOGLE_PLACES_API_KEY|DATABASE_URL|FIRECRAWL_URL|FIRECRAWL_API_KEY' | \
  xargs)

SA_JSON=$(cat pipeline/service-account.json | tr -d '\n' | tr -d ' ')

ENV_VARS="LEADS_SHEET_ID=${LEADS_SHEET_ID}"
ENV_VARS="${ENV_VARS},GOOGLE_AI_API_KEY=${GOOGLE_AI_API_KEY}"
ENV_VARS="${ENV_VARS},GOOGLE_PLACES_API_KEY=${GOOGLE_PLACES_API_KEY}"
ENV_VARS="${ENV_VARS},DATABASE_URL=${DATABASE_URL}"
ENV_VARS="${ENV_VARS},GOOGLE_SERVICE_ACCOUNT_JSON=${SA_JSON}"
ENV_VARS="${ENV_VARS},SKIP_OSM=true"
ENV_VARS="${ENV_VARS},PLACES_BATCH=400"
ENV_VARS="${ENV_VARS},MAPS_BATCH=60"

# ─── 3. Create / update Cloud Run Job ─────────────────────────────────────────
echo "[2/3] Creating Cloud Run Job: ${JOB_NAME}..."

if gcloud run jobs describe "${JOB_NAME}" --project=${PROJECT} --region=${REGION} &>/dev/null; then
  gcloud run jobs update "${JOB_NAME}" \
    --image=${REGISTRY}/scraper-bulk:latest \
    --project=${PROJECT} \
    --region=${REGION} \
    --memory=2Gi \
    --cpu=2 \
    --max-retries=1 \
    --task-timeout=21600s \
    --set-env-vars="${ENV_VARS}"
  echo "  updated: ${JOB_NAME}"
else
  gcloud run jobs create "${JOB_NAME}" \
    --image=${REGISTRY}/scraper-bulk:latest \
    --project=${PROJECT} \
    --region=${REGION} \
    --memory=2Gi \
    --cpu=2 \
    --max-retries=1 \
    --task-timeout=21600s \
    --set-env-vars="${ENV_VARS}"
  echo "  created: ${JOB_NAME}"
fi

# ─── 4. Ensure scheduler service account exists ───────────────────────────────
gcloud iam service-accounts create scraper-scheduler \
  --display-name="Scraper Scheduler" --project=${PROJECT} 2>/dev/null || true
gcloud projects add-iam-policy-binding ${PROJECT} \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/run.invoker" 2>/dev/null || true

# ─── 5. Create / update Cloud Scheduler (every 6 hours) ──────────────────────
echo "[3/3] Setting up Cloud Scheduler (every 6 hours)..."

JOB_RUN_URI="https://${REGION}-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/${PROJECT}/jobs/${JOB_NAME}:run"

if gcloud scheduler jobs describe "${SCHED_NAME}" --project=${PROJECT} --location=${REGION} &>/dev/null; then
  gcloud scheduler jobs update http "${SCHED_NAME}" \
    --project=${PROJECT} \
    --location=${REGION} \
    --schedule="0 */6 * * *" \
    --uri="${JOB_RUN_URI}" \
    --message-body="{}" \
    --oauth-service-account-email="${SA_EMAIL}" \
    --time-zone="America/Los_Angeles"
  echo "  updated: ${SCHED_NAME} (every 6h)"
else
  gcloud scheduler jobs create http "${SCHED_NAME}" \
    --project=${PROJECT} \
    --location=${REGION} \
    --schedule="0 */6 * * *" \
    --uri="${JOB_RUN_URI}" \
    --message-body="{}" \
    --oauth-service-account-email="${SA_EMAIL}" \
    --time-zone="America/Los_Angeles"
  echo "  created: ${SCHED_NAME} (every 6h = 4 runs/day)"
fi

echo ""
echo "=== Deployment complete ==="
echo ""
echo "Schedule: every 6h → 4 runs/day"
echo "Niches per run: medspa → hvac → roofing → dental → restaurant"
echo ""
echo "Estimated completion (at 4 runs/day):"
echo "  medspa     (~5 runs)   → ~2 days"
echo "  roofing    (~20 runs)  → ~5 days"
echo "  dental     (~25 runs)  → ~7 days"
echo "  hvac       (~40 runs)  → ~10 days"
echo "  restaurant (~120 runs) → ~30 days (Places API ceiling ~90k)"
echo ""
echo "Checkpoint system prevents duplicates — safe to run any time."
echo "Monitor: gcloud run jobs executions list --job=${JOB_NAME} --region=${REGION} --project=${PROJECT}"
