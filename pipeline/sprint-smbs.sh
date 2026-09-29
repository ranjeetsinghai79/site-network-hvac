#!/bin/bash
# sprint-smbs.sh — AGGRESSIVE Local SMBs scraper until 100k phones
# Run in Terminal 1: bash pipeline/sprint-smbs.sh
# Target: 100k leads with phone in Local SMBs tab
# Potential: 25 niches × 340 cities = 8,500 combos × ~25 phones = 212,500 leads

set -uo pipefail
cd "$(dirname "$0")"
source <(grep -v '^#' .env | grep -v '^$' | sed 's/^/export /') 2>/dev/null || true

TARGET_PHONE=100000
SCRAPE_TARGET=${SCRAPE_TARGET:-150}   # leads per combo run

phone_count() {
  node --env-file=.env -e "
const pg = require('pg')
const p = new pg.Pool({ connectionString: process.env.DATABASE_URL })
p.query(\"SELECT COUNT(*) as c FROM scraped_places WHERE tab='Local SMBs'\")
  .then(r => { console.log(r.rows[0].c); p.end() }).catch(() => { console.log('?'); p.end() })
" 2>/dev/null
}

round=0
while true; do
  round=$((round + 1))
  current=$(phone_count)
  echo ""
  echo "══════════════════════════════════════════════════════"
  echo "  LOCAL SMBs SPRINT — Round $round"
  echo "  DB rows: $current | Target: $TARGET_PHONE phones"
  echo "  $(date '+%Y-%m-%d %H:%M:%S')"
  echo "══════════════════════════════════════════════════════"

  SHEET_TAB="Local SMBs" SCRAPE_TARGET=$SCRAPE_TARGET npx tsx --env-file=.env src/scripts/scrape-universal.ts 2>/dev/null \
    && echo "  ✓ Round $round done" \
    || echo "  ✗ Round $round errored"

  after=$(phone_count)
  echo "  After: $after rows in DB (+$((after - current)))"
  sleep 5
done
