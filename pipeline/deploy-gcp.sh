#!/bin/bash
# deploy-gcp.sh — GCP deployment: Scraper Cloud Run Jobs + Cloud Scheduler
# Firecrawl: uses cloud API (api.firecrawl.dev) — no self-hosting needed
# Usage: bash pipeline/deploy-gcp.sh
# Requires: gcloud CLI logged in, pipeline/.env readable, pipeline/service-account.json present

set -e

PROJECT=gen-lang-client-0844283339
REGION=us-central1
REGISTRY=us-central1-docker.pkg.dev/${PROJECT}/webcrew

echo "=== Webcrew GCP Deployment ==="
echo "Project: $PROJECT | Region: $REGION"
echo ""

# ─── 1. Build scraper image ──────────────────────────────────────────────────
echo "[1/3] Building scraper image..."
gcloud builds submit pipeline/ \
  --config=pipeline/cloudbuild-scraper.yaml \
  --project=${PROJECT}

echo "[1/3] Scraper image: ${REGISTRY}/scraper:latest"

# ─── 2. Create/update Cloud Run Jobs (one per tab) ───────────────────────────
echo "[2/3] Creating Cloud Run Jobs..."

# Source env — DATABASE_URL has quotes, handle safely
export $(grep -v '^#' pipeline/.env | grep -v '^$' | sed "s/^/export /" | tr -d '"' | sed 's/export export/export/g' | grep -E 'LEADS_SHEET_ID|GOOGLE_AI_API_KEY|GOOGLE_PLACES_API_KEY|DATABASE_URL|FIRECRAWL_URL|FIRECRAWL_API_KEY' | sed 's/export //' | xargs)

SA_JSON=$(cat pipeline/service-account.json | tr -d '\n' | tr -d ' ')

for TAB in "Local SMBs" "MEDSPAS" "INDIA_MEDSPAS" "USA_DentalOffices" "INDIA_DentalOffices" "USA_Salons" "USA_BarberShops" "USA_FinancialAdvisorsandInsuranceAgents" "USA_RealEstateAgents" "USA_Restaurants" "India_Restaurants" "USA_LawFirms" "USA_SkinClinics" "USA_IVTherapy" "USA_NailStudios"; do
  JOB_NAME=$(echo "scraper-$(echo "$TAB" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g' | sed 's/-$//')" | cut -c1-49)

  ENV_VARS="SHEET_TAB=${TAB}"
  ENV_VARS="${ENV_VARS},SCRAPE_TARGET=150"
  ENV_VARS="${ENV_VARS},LEADS_SHEET_ID=${LEADS_SHEET_ID}"
  ENV_VARS="${ENV_VARS},GOOGLE_AI_API_KEY=${GOOGLE_AI_API_KEY}"
  ENV_VARS="${ENV_VARS},GOOGLE_PLACES_API_KEY=${GOOGLE_PLACES_API_KEY}"
  ENV_VARS="${ENV_VARS},DATABASE_URL=${DATABASE_URL}"
  ENV_VARS="${ENV_VARS},FIRECRAWL_URL=${FIRECRAWL_URL:-https://api.firecrawl.dev}"
  ENV_VARS="${ENV_VARS},FIRECRAWL_API_KEY=${FIRECRAWL_API_KEY}"
  ENV_VARS="${ENV_VARS},GOOGLE_SERVICE_ACCOUNT_JSON=${SA_JSON}"

  if gcloud run jobs describe "${JOB_NAME}" --project=${PROJECT} --region=${REGION} &>/dev/null; then
    gcloud run jobs update "${JOB_NAME}" \
      --image=${REGISTRY}/scraper:latest \
      --project=${PROJECT} \
      --region=${REGION} \
      --memory=1Gi --cpu=1 \
      --set-env-vars="${ENV_VARS}"
    echo "  updated: ${JOB_NAME}"
  else
    gcloud run jobs create "${JOB_NAME}" \
      --image=${REGISTRY}/scraper:latest \
      --project=${PROJECT} \
      --region=${REGION} \
      --memory=1Gi --cpu=1 \
      --max-retries=2 \
      --task-timeout=3600s \
      --set-env-vars="${ENV_VARS}"
    echo "  created: ${JOB_NAME}"
  fi
done

echo "[2/3] All scraper jobs done."

# ─── 3. Cloud Scheduler ──────────────────────────────────────────────────────
echo "[3/3] Setting up Cloud Scheduler..."

SA_EMAIL="scraper-scheduler@${PROJECT}.iam.gserviceaccount.com"
gcloud iam service-accounts create scraper-scheduler \
  --display-name="Scraper Scheduler" --project=${PROJECT} 2>/dev/null || true
gcloud projects add-iam-policy-binding ${PROJECT} \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/run.invoker" 2>/dev/null || true

declare -A SCHEDULES=(
  ["scraper-medspas"]="0 * * * *"
  ["scraper-india-medspas"]="30 * * * *"
  ["scraper-usa-dentaloffices"]="15 * * * *"
  ["scraper-india-dentaloffices"]="15 * * * *"
  ["scraper-usa-salons"]="45 * * * *"
  ["scraper-usa-barbershops"]="45 * * * *"
  ["scraper-local-smbs"]="0 * * * *"
  ["scraper-usa-financialadvisorsandinsuran"]="5 1,3,5,7,9,11,13,15,17,19,21,23 * * *"
  ["scraper-usa-realestateagents"]="5 2,4,6,8,10,12,14,16,18,20,22,0 * * *"
  ["scraper-usa-restaurants"]="35 1,3,5,7,9,11,13,15,17,19,21,23 * * *"
  ["scraper-india-restaurants"]="35 2,4,6,8,10,12,14,16,18,20,22,0 * * *"
  ["scraper-usa-lawfirms"]="55 1,3,5,7,9,11,13,15,17,19,21,23 * * *"
  # Beauty & wellness (Week 2) — hourly, staggered minutes
  ["scraper-usa-skinclinics"]="10 * * * *"
  ["scraper-usa-ivtherapy"]="50 * * * *"
  ["scraper-usa-nailstudios"]="20 * * * *"
)

JOB_RUN_URI="https://${REGION}-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/${PROJECT}/jobs"

for JOB_NAME in "${!SCHEDULES[@]}"; do
  SCHEDULE="${SCHEDULES[$JOB_NAME]}"
  SCHED_NAME="schedule-${JOB_NAME}"

  if gcloud scheduler jobs describe "${SCHED_NAME}" --project=${PROJECT} --location=${REGION} &>/dev/null; then
    echo "  exists: ${SCHED_NAME}"
  else
    gcloud scheduler jobs create http "${SCHED_NAME}" \
      --project=${PROJECT} \
      --location=${REGION} \
      --schedule="${SCHEDULE}" \
      --uri="${JOB_RUN_URI}/${JOB_NAME}:run" \
      --message-body="{}" \
      --oauth-service-account-email="${SA_EMAIL}" \
      --time-zone="America/Los_Angeles"
    echo "  created: ${SCHED_NAME}"
  fi
done

echo "[3/3] Cloud Scheduler done."

# ─── 4. Retention loop — daily Cloud Scheduler job ───────────────────────────
# Calls POST /retention on the AI Reception Cloud Run server, which runs
# GBP posts, review replies, analytics reports, AEO refresh for ALL paid clients.
# Cost: $0 (first 3 Cloud Scheduler jobs free per billing account per month)
echo ""
echo "[4/4] Retention daily scheduler..."

RETENTION_URL="https://ai-reception-571925663575.us-central1.run.app/retention"
RETENTION_SECRET=$(grep 'RECEPTION_PROVISION_SECRET' pipeline/.env | cut -d'=' -f2 | tr -d '"' | head -1)

if gcloud scheduler jobs describe "webcrew-retention-daily" --project=${PROJECT} --location=${REGION} &>/dev/null; then
  gcloud scheduler jobs update http "webcrew-retention-daily" \
    --project=${PROJECT} \
    --location=${REGION} \
    --schedule="0 15 * * *" \
    --uri="${RETENTION_URL}" \
    --message-body="{}" \
    --headers="Authorization=Bearer ${RETENTION_SECRET},Content-Type=application/json" \
    --time-zone="UTC"
  echo "  updated: webcrew-retention-daily (runs daily 7am PST)"
else
  gcloud scheduler jobs create http "webcrew-retention-daily" \
    --project=${PROJECT} \
    --location=${REGION} \
    --schedule="0 15 * * *" \
    --uri="${RETENTION_URL}" \
    --message-body="{}" \
    --headers="Authorization=Bearer ${RETENTION_SECRET},Content-Type=application/json" \
    --time-zone="UTC"
  echo "  created: webcrew-retention-daily (runs daily 7am PST)"
fi

echo ""
echo "=== Deployment complete ==="
echo "Scraper jobs run 24/7 on GCP. Mac no longer needed for scraping."
echo "Retention agents run daily at 7am PST for all paid clients."
echo "Firecrawl: using cloud API at https://api.firecrawl.dev"
