#!/usr/bin/env bash
# scrape-local.sh — Run all tabs locally, priority order, append to sheet
# Usage: ./scrape-local.sh [TARGET_PER_TAB]
# Default TARGET_PER_TAB=300 → ~6,600 leads/night across 22 tabs
# Start at 10pm → finishes ~5-6am, machine free by 9am
#
# Priority 1 (high-value): local smbs, medspas, restaurants, financial, beauty & wellness
# Priority 2 (rest): real estate, law, trades

set -euo pipefail

TARGET=${1:-300}
LOG_FILE="scrape-$(date +%Y-%m-%d).log"
START_TIME=$(date +%s)

cd "$(dirname "$0")"

log() { echo "[$(date '+%H:%M:%S')] $*" | tee -a "$LOG_FILE"; }

run_tab() {
  local tab="$1"
  log "▶ START: $tab (target=$TARGET)"
  SHEET_TAB="$tab" SCRAPE_TARGET="$TARGET" npx tsx src/scripts/scrape-universal.ts 2>&1 | tee -a "$LOG_FILE"
  log "✓ DONE:  $tab"
}

log "════════════════════════════════════════════════════════════════"
log "LOCAL SCRAPE RUN — target=$TARGET per tab"
log "Log: $LOG_FILE"
log "════════════════════════════════════════════════════════════════"

# ── PRIORITY 1: High-value (scrape these first) ──────────────────────────────
run_tab "Local SMBs"
run_tab "MEDSPAS"
run_tab "INDIA_MEDSPAS"
run_tab "USA_Restaurants"
run_tab "India_Restaurants"
run_tab "USA_FinancialAdvisorsandInsuranceAgents"

# ── PRIORITY 1: Beauty & Wellness ────────────────────────────────────────────
run_tab "USA_Salons"
run_tab "USA_BarberShops"
run_tab "USA_SkinClinics"
run_tab "USA_IVTherapy"
run_tab "USA_NailStudios"
run_tab "USA_DentalOffices"
run_tab "INDIA_DentalOffices"
run_tab "USA_CosmeticSurgeons"

# ── PRIORITY 2: Rest ─────────────────────────────────────────────────────────
run_tab "USA_RealEstateAgents"
run_tab "USA_LawFirms"
run_tab "USA_HVAC"
run_tab "USA_Roofing"
run_tab "USA_Remodeling"
run_tab "USA_Plumbing"
run_tab "USA_AutoDetailing"

# ── Summary ───────────────────────────────────────────────────────────────────
END_TIME=$(date +%s)
ELAPSED=$(( (END_TIME - START_TIME) / 60 ))
log "════════════════════════════════════════════════════════════════"
log "ALL TABS DONE — elapsed: ${ELAPSED} min"
log "Leads scraped tonight → check sheet for new rows"
log "════════════════════════════════════════════════════════════════"
