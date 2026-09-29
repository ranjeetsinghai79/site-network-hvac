#!/usr/bin/env bash
set -euo pipefail

export HOME="/Users/pavanharati"
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"

cd "/Users/pavanharati/Documents/WebsiteDeveloper/pipeline"
TARGET="${SCRAPE_TARGET_PER_TAB:-1000}"
STIER_TARGET=$(( TARGET * 2 ))
LOG_FILE="scrape-fast-$(date +%Y-%m-%d).log"

log() { echo "[$(date '+%H:%M:%S')] $*" | tee -a "$LOG_FILE"; }

run_tab() {
  local tab="$1"
  local t="${2:-$TARGET}"
  log "▶ START: $tab (target=$t, email=OFF)"
  SHEET_TAB="$tab" SCRAPE_TARGET="$t" SKIP_EMAIL_ENRICHMENT=true \
    npx tsx src/scripts/scrape-universal.ts 2>&1 | tee -a "$LOG_FILE"
  log "✓ DONE:  $tab"
}

log "FAST SCRAPE launchd runner — target=$TARGET, s-tier=$STIER_TARGET"
run_tab "MEDSPAS" "$STIER_TARGET"
run_tab "USA_SkinClinics" "$STIER_TARGET"
run_tab "USA_IVTherapy" "$STIER_TARGET"
run_tab "USA_Salons"
run_tab "USA_BarberShops"
run_tab "USA_NailStudios"
run_tab "Local SMBs"
run_tab "USA_DentalOffices"
run_tab "USA_Restaurants"
run_tab "USA_FinancialAdvisorsandInsuranceAgents"
log "DONE"
