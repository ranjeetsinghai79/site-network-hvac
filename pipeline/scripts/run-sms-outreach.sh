#!/usr/bin/env bash
set -euo pipefail

export HOME="/Users/pavanharati"
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
export BATCH_SIZE="${BATCH_SIZE:-200}"

cd "/Users/pavanharati/Documents/WebsiteDeveloper/pipeline"
exec npx tsx src/scripts/sheets-sms-outreach.ts
