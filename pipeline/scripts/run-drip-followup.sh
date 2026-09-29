#!/usr/bin/env bash
set -euo pipefail

export HOME="/Users/pavanharati"
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"

cd "/Users/pavanharati/Documents/WebsiteDeveloper/pipeline"
exec npx tsx src/scripts/drip-followup.ts
