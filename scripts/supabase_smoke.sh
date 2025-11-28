#!/usr/bin/env bash
set -euo pipefail

# Supabase profile smoke test for local compose.
# - Brings up the Supabase profile (GoTrue/PostgREST/Kong/Studio) plus core stack.
# - Waits for GoTrue and PostgREST to report healthy.
# - Hits /auth/refresh on the appserver and /system/status to verify refresh proxying and Supabase health.
#
# Usage: ./scripts/supabase_smoke.sh
# Requires: docker compose, curl, jq

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

for dep in docker curl jq; do
  if ! command -v "$dep" >/dev/null 2>&1; then
    echo "[supabase-smoke] missing dependency: $dep"
    exit 1
  fi
done

echo "[supabase-smoke] Ensuring .env exists..."
if [ ! -f .env ]; then
  cp .env.example .env
  echo "  > created .env from .env.example"
fi

echo "[supabase-smoke] Starting compose with Supabase profile..."
docker compose --profile supabase up -d --build

echo "[supabase-smoke] Waiting for GoTrue..."
until curl -sf "${SUPABASE_GOTRUE_URL:-http://localhost:9999}/health" >/dev/null 2>&1; do
  sleep 2
done

echo "[supabase-smoke] Waiting for PostgREST..."
until curl -sf "${SUPABASE_HEALTH_POSTGREST:-http://localhost:3000}" >/dev/null 2>&1; do
  sleep 2
done

echo "[supabase-smoke] Waiting for appserver /healthz..."
until curl -sf "${SERVICE_LAYER_ADDR:-http://localhost:8080}/healthz" >/dev/null 2>&1; do
  sleep 2
done

echo "[supabase-smoke] Checking /auth/refresh via appserver..."
REFRESH_TOKEN="${SUPABASE_REFRESH_TOKEN:-}"
API_BASE="${SERVICE_LAYER_ADDR:-http://localhost:8080}"
if [ -z "$REFRESH_TOKEN" ]; then
  echo "  ! SUPABASE_REFRESH_TOKEN not set; skipping refresh token proxy check"
else
  curl -sf -X POST "${API_BASE}/auth/refresh" \
    -H "Content-Type: application/json" \
    -d "{\"refresh_token\":\"${REFRESH_TOKEN}\"}" >/dev/null
  echo "  ✓ /auth/refresh proxy reachable"
fi

echo "[supabase-smoke] Checking /system/status..."
curl -sf "${API_BASE}/system/status" | jq '.supabase // .neo // .status' >/dev/null
echo "  ✓ system/status reachable"

echo "[supabase-smoke] Done. To stop services: docker compose --profile supabase down --remove-orphans"
