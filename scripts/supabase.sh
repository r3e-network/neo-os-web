#!/usr/bin/env bash
set -euo pipefail

# Dockerized Supabase CLI wrapper.
#
# This repo intentionally does not vendor a full Supabase docker-compose stack.
# Instead, this wrapper runs the Supabase CLI container and lets it manage the
# local dev containers (Postgres/Auth/Edge runtime/etc.) via the Docker socket.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

USE_DOCKER="${SUPABASE_CLI_USE_DOCKER:-}"
CLI_BIN="${SUPABASE_CLI_BIN:-}"

TTY_ARGS=()
if [ -t 0 ] && [ -t 1 ]; then
  TTY_ARGS=(-it)
fi

ENV_FILE_ARGS=()
if [[ -f "$PROJECT_ROOT/.env" ]]; then
  ENV_FILE_ARGS+=(--env-file "$PROJECT_ROOT/.env")
fi
if [[ -f "$PROJECT_ROOT/supabase/.env" ]]; then
  ENV_FILE_ARGS+=(--env-file "$PROJECT_ROOT/supabase/.env")
fi

run_local_cli() {
  local bin="$1"
  shift
  exec "$bin" "$@"
}

if [[ -z "$USE_DOCKER" ]]; then
  if [[ -n "$CLI_BIN" ]] && [[ -x "$CLI_BIN" ]]; then
    run_local_cli "$CLI_BIN" "$@"
  fi

  if [[ -x "$PROJECT_ROOT/bin/supabase" ]]; then
    run_local_cli "$PROJECT_ROOT/bin/supabase" "$@"
  fi

  if command -v supabase >/dev/null 2>&1; then
    run_local_cli "$(command -v supabase)" "$@"
  fi
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "docker not found in PATH (required for running Supabase CLI via container)" >&2
  echo "Tip: install the Supabase CLI locally and rerun, e.g. make supabase-cli-install" >&2
  exit 1
fi

pick_image() {
  if [[ -n "${SUPABASE_CLI_IMAGE:-}" ]]; then
    echo "$SUPABASE_CLI_IMAGE"
    return 0
  fi

  # Prefer Docker Hub by default (most common), but fall back to GHCR which can
  # help in environments where `docker.io` is blocked or mirrored.
  #
  # `registry-1.docker.io/...` can bypass some Docker Hub mirror configurations.
  echo "registry-1.docker.io/supabase/cli:latest"
  echo "supabase/cli:latest"
  echo "ghcr.io/supabase/cli:latest"
}

last_err=""
while IFS= read -r image; do
  if docker image inspect "$image" >/dev/null 2>&1; then
    exec docker run --rm "${TTY_ARGS[@]}" \
      "${ENV_FILE_ARGS[@]}" \
      -v "${PROJECT_ROOT}:/workspace" \
      -w /workspace \
      -v /var/run/docker.sock:/var/run/docker.sock \
      "$image" supabase "$@"
  fi

  # Try pull + run (some registries require an explicit pull first).
  if docker pull "$image" >/dev/null 2>&1; then
    exec docker run --rm "${TTY_ARGS[@]}" \
      "${ENV_FILE_ARGS[@]}" \
      -v "${PROJECT_ROOT}:/workspace" \
      -w /workspace \
      -v /var/run/docker.sock:/var/run/docker.sock \
      "$image" supabase "$@"
  fi
  last_err="$image"
done < <(pick_image)

echo "ERROR: unable to fetch a Supabase CLI container image." >&2
echo "Tried: ${SUPABASE_CLI_IMAGE:-registry-1.docker.io/supabase/cli:latest, supabase/cli:latest, ghcr.io/supabase/cli:latest}" >&2
echo "Last attempted: ${last_err:-unknown}" >&2
echo "Tip: install the Supabase CLI locally and rerun, e.g. make supabase-cli-install" >&2
exit 1
