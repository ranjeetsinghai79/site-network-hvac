#!/bin/bash
# enrich-all-tabs.sh — run enrichment sequentially for all tabs, highest-value first
# Usage: bash enrich-all-tabs.sh
# Log:   pipeline/enrich-all-tabs.log

set -a
source /Users/pavanharati/Documents/WebsiteDeveloper/pipeline/.env
set +a

SCRIPT=/Users/pavanharati/Documents/WebsiteDeveloper/pipeline/src/scripts/enrich-existing-rows.ts
LOG=/Users/pavanharati/Documents/WebsiteDeveloper/pipeline/enrich-all-tabs.log

TABS=(
  "MEDSPAS"
  "USA_Restaurants"
  "USA_FinancialAdvisorsandInsuranceAgents"
  "Local SMBs"
  "USA_DentalOffices"
  "USA_SkinClinics"
  "USA_IVTherapy"
  "USA_NailStudios"
  "USA_Salons"
  "USA_BarberShops"
  "USA_LawFirms"
  "USA_AutoDetailing"
  "USA_HVAC"
  "USA_Roofing"
  "USA_Remodeling"
  "USA_Plumbing"
  "USA_RealEstateAgents"
  "INDIA_DentalOffices"
  "INDIA_MEDSPAS"
  "India_Restaurants"
  "USA_CosmeticSurgeons"
)

echo "=== Enrich All Tabs — $(date) ===" | tee -a "$LOG"

for TAB in "${TABS[@]}"; do
  echo "" | tee -a "$LOG"
  echo ">>> Starting: $TAB — $(date)" | tee -a "$LOG"
  SHEET_TAB="$TAB" ENRICH_LIMIT=99999 ENRICH_CONCUR=8 \
    npx tsx --env-file=/Users/pavanharati/Documents/WebsiteDeveloper/pipeline/.env "$SCRIPT" 2>&1 | tee -a "$LOG"
  echo "<<< Done: $TAB — $(date)" | tee -a "$LOG"
done

echo "" | tee -a "$LOG"
echo "=== ALL DONE — $(date) ===" | tee -a "$LOG"
