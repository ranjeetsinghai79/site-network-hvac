#!/bin/bash
# sprint-400k.sh — scrape to 400k in priority order, $0 cost
# Run: bash pipeline/sprint-400k.sh
# Ctrl+C to stop anytime

set -uo pipefail
cd "$(dirname "$0")"
source <(grep -v '^#' .env | grep -v '^$' | sed 's/^/export /') 2>/dev/null || true

# ── Priority order (user-defined) ────────────────────────────────────────────
# 1. Local SMBs     — 7 niches × 314 cities left  → ~130k potential
# 2. Medspa/Beauty  — 12 niches (wave2) × 340 cities → ~240k potential
# 3. Financial      — 8 niches × 338 cities left   → ~163k potential
# 4. Restaurants    — 5 niches × 265 cities left   → ~79k potential
# 5. Real Estate    — 6 niches × 290 cities left   → ~104k potential
# 6. Dental         — 6 niches (wave2) × 340 cities → ~122k potential
# 7. Law Firms      — 8 niches × 272 cities left   → ~130k potential
# 8. Beauty subtabs — fill Salons/Barbers/Nails/Skin/IV
# 9. New tabs       — AutoRepair/Medical/Fitness/Pets

PRIORITY_TABS=(
  # ── 1. Local SMBs ──
  "Local SMBs"
  # ── 2. Medspa / Beauty group ──
  "MEDSPAS"
  "USA_SkinClinics"
  "USA_Salons"
  "USA_BarberShops"
  "USA_NailStudios"
  "USA_IVTherapy"
  "USA_CosmeticSurgeons"
  # ── 3. Financial ──
  "USA_FinancialAdvisorsandInsuranceAgents"
  # ── 4. Restaurants ──
  "USA_Restaurants"
  # ── 5. Real Estate ──
  "USA_RealEstateAgents"
  # ── 6. Dental ──
  "USA_DentalOffices"
  # ── 7. Law Firms ──
  "USA_LawFirms"
  # ── 8. New niche tabs ──
  "USA_AutoRepair"
  "USA_MedicalOffices"
  "USA_Fitness"
  "USA_PetServices"
)

log_count() {
  local tab="$1"
  node --env-file=.env -e "
const pg = require('pg')
const p = new pg.Pool({ connectionString: process.env.DATABASE_URL })
p.query('SELECT COUNT(*) as c FROM scraped_places WHERE tab=\$1', ['$tab'])
  .then(r => { console.log(r.rows[0].c); p.end() }).catch(() => { console.log('?'); p.end() })
" 2>/dev/null
}

round=0
while true; do
  round=$((round + 1))
  echo ""
  echo "╔══════════════════════════════════════════════════════╗"
  echo "  SPRINT ROUND $round  —  $(date '+%Y-%m-%d %H:%M:%S')"
  echo "╚══════════════════════════════════════════════════════╝"

  for TAB in "${PRIORITY_TABS[@]}"; do
    before=$(log_count "$TAB")
    echo ""
    echo "▶  [$TAB]  before: $before"
    SHEET_TAB="$TAB" npx tsx --env-file=.env src/scripts/scrape-universal.ts 2>/dev/null \
      && after=$(log_count "$TAB") && echo "   after:  $after  (+$((after - before)))" \
      || echo "   ✗ errored, continuing"
    sleep 3
  done

  # Status check after each full round
  echo ""
  echo "──────────────────────────────────────────────────────"
  echo "  TOTALS after round $round:"
  node --env-file=.env -e "
const pg = require('pg')
const p = new pg.Pool({ connectionString: process.env.DATABASE_URL })
p.query('SELECT COUNT(*) as total FROM scraped_places').then(r => {
  console.log('  DB total: ' + r.rows[0].total)
  p.end()
}).catch(() => p.end())
" 2>/dev/null
  echo "──────────────────────────────────────────────────────"

  echo ""
  echo "  Sleeping 30s → next round..."
  sleep 30
done
