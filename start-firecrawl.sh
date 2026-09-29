#!/bin/bash
set -e

FIRECRAWL_DIR="$HOME/Documents/firecrawl"

if ! docker info &>/dev/null; then
  echo "Docker not running. Start Docker Desktop first."
  exit 1
fi

cd "$FIRECRAWL_DIR"
docker compose up -d
echo "Firecrawl running at http://localhost:3002"
echo "Test: curl http://localhost:3002/v1/scrape -X POST -H 'Authorization: Bearer local' -H 'Content-Type: application/json' -d '{\"url\":\"https://example.com\",\"formats\":[\"markdown\"]}'"
