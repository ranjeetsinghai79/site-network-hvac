#!/usr/bin/env bash
# scrape-fast.sh — S-tier beauty/wellness first, then rest. NO email enrichment.
# Enrich emails separately: ENRICH_LIMIT=99999 npx tsx src/scripts/enrich-existing-rows.ts
#
# Usage: ./scrape-fast.sh [TARGET_PER_TAB]
# Default 1000/tab for standard tabs; S-tier tabs run at 2× (2000) first
#
# S-TIER GOAL: MEDSPAS + SkinClinics + IVTherapy → 50k combined
#   MEDSPAS     : ~9k used  → ~11k left in current cities, expanding to 340 cities
#   SkinClinics : ~1k used  → ~19k left
#   IVTherapy   : ~1k used  → ~19k left
#   Combined remaining: ~49k → 2000/tab/day = ~8 days to hit 50k
#
# Tab capacity (340 cities):
#   Local SMBs       : 7 niches × 340 × 60 = ~142k  (17k used — 125k left)
#   MEDSPAS          : 1 × 340 × 60 = ~20k           (9k used  — 11k left)
#   USA_Salons       : 2 × 340 × 60 = ~41k           (1k used  — 40k left)
#   USA_BarberShops  : 1 × 340 × 60 = ~20k           (1k used  — 19k left)
#   USA_NailStudios  : 1 × 340 × 60 = ~20k           (1k used  — 19k left)
#   USA_SkinClinics  : 1 × 340 × 60 = ~20k           (1k used  — 19k left)
#   USA_IVTherapy    : 1 × 340 × 60 = ~20k           (1k used  — 19k left)
#   USA_DentalOffices: 1 × 340 × 60 = ~20k           (10k used — 10k left)
#   USA_Restaurants  : 1 × 340 × 60 = ~20k           (11k used — 9k left)
#   USA_FinancialAdvisors: 2 × 340 × 60 = ~41k       (1k used  — 40k left)
# Total: ~364k → 284k target = ~28 days at 10k/day

set -euo pipefail

TARGET=${1:-1000}
STIER_TARGET=$(( TARGET * 2 ))  # S-tier runs at 2× to hit 50k faster
LOG_FILE="scrape-fast-$(date +%Y-%m-%d).log"
START_TIME=$(date +%s)

cd "$(dirname "$0")"

log() { echo "[$(date '+%H:%M:%S')] $*" | tee -a "$LOG_FILE"; }

run_tab() {
  local tab="$1"
  local t="${2:-$TARGET}"
  log "▶ START: $tab (target=$t, email=OFF)"
  SHEET_TAB="$tab" SCRAPE_TARGET="$t" SKIP_EMAIL_ENRICHMENT=true \
    npx tsx src/scripts/scrape-universal.ts 2>&1 | tee -a "$LOG_FILE"
  log "✓ DONE:  $tab"
}

STABS=3
TABS=7
TOTAL_EST=$(( STIER_TARGET * STABS + TARGET * TABS ))
log "════════════════════════════════════════════════════════════════"
log "FAST SCRAPE — S-tier ×${STIER_TARGET} (×3 tabs) + standard ×${TARGET} (×7 tabs)"
log "Log: $LOG_FILE"
log "Estimate: ~${TOTAL_EST} total leads today"
log "S-tier MEDSPAS+SkinClinics+IVTherapy goal: 50k combined (~8 days)"
log "════════════════════════════════════════════════════════════════"

# ── S-TIER: Beauty wellness (run first, 2× target) ───────────────────────────
log "── S-TIER (${STIER_TARGET}/tab) ──────────────────────────────────────────"
run_tab "MEDSPAS"         "$STIER_TARGET"
run_tab "USA_SkinClinics" "$STIER_TARGET"
run_tab "USA_IVTherapy"   "$STIER_TARGET"

# ── A-TIER: High-conversion service niches ────────────────────────────────────
log "── A-TIER (${TARGET}/tab) ───────────────────────────────────────────────"
run_tab "USA_Salons"
run_tab "USA_BarberShops"
run_tab "USA_NailStudios"
run_tab "Local SMBs"

# ── B-TIER: Service + finance ─────────────────────────────────────────────────
log "── B-TIER (${TARGET}/tab) ───────────────────────────────────────────────"
run_tab "USA_DentalOffices"
run_tab "USA_Restaurants"
run_tab "USA_FinancialAdvisorsandInsuranceAgents"

END_TIME=$(date +%s)
ELAPSED=$(( (END_TIME - START_TIME) / 60 ))
log "════════════════════════════════════════════════════════════════"
log "DONE — elapsed: ${ELAPSED} min, ~${TOTAL_EST} new leads added"
log "Run enrich: ENRICH_LIMIT=99999 npx tsx src/scripts/enrich-existing-rows.ts"
log "════════════════════════════════════════════════════════════════"
