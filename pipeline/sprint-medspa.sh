#!/bin/bash
# sprint-medspa.sh — AGGRESSIVE MEDSPAS + Beauty scraper until 100k phones
# Run in Terminal 2: bash pipeline/sprint-medspa.sh
# Covers: MEDSPAS + Salons + BarberShops + SkinClinics + NailStudios + IVTherapy

set -uo pipefail
cd "$(dirname "$0")"
source <(grep -v '^#' .env | grep -v '^$' | sed 's/^/export /') 2>/dev/null || true

SCRAPE_TARGET=${SCRAPE_TARGET:-150}

BEAUTY_TABS=(
  "MEDSPAS"
  "USA_SkinClinics"
  "USA_Salons"
  "USA_BarberShops"
  "USA_NailStudios"
  "USA_IVTherapy"
  "USA_CosmeticSurgeons"
)

db_count() {
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
  echo "══════════════════════════════════════════════════════"
  echo "  MEDSPA/BEAUTY SPRINT — Round $round — $(date '+%H:%M:%S')"
  echo "══════════════════════════════════════════════════════"

  for TAB in "${BEAUTY_TABS[@]}"; do
    before=$(db_count "$TAB")
    SHEET_TAB="$TAB" SCRAPE_TARGET=$SCRAPE_TARGET npx tsx --env-file=.env src/scripts/scrape-universal.ts 2>/dev/null \
      && after=$(db_count "$TAB") && echo "  [$TAB] $before → $after (+$((after - before)))" \
      || echo "  [$TAB] ✗ errored"
    sleep 3
  done

  sleep 5
done
