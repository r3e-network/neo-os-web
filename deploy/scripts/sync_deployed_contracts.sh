#!/bin/bash
# Sync deployed_contracts.json from Neo Express by reading deployed contract names/hashes.
# Uses neoxp CLI; fills missing hashes by default (no overwrite unless --overwrite).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
CONFIG_DIR="$PROJECT_ROOT/deploy/config"
DEPLOYED_FILE="$CONFIG_DIR/deployed_contracts.json"
NEOEXPRESS_CONFIG="$CONFIG_DIR/default.neo-express"

NETWORK="neoexpress"
OVERWRITE="false"
SYNC_ALL="false"

usage() {
  cat <<'EOF'
Usage: ./deploy/scripts/sync_deployed_contracts.sh [OPTIONS]

Options:
  --network <neoexpress>   Network to sync (default: neoexpress)
  --config <path>          Neo Express config file (default: deploy/config/default.neo-express)
  --deployed-file <path>   Deployed contracts JSON (default: deploy/config/deployed_contracts.json)
  --overwrite              Overwrite existing hashes (default: fill missing only)
  --all                    Sync all contracts (default: platform contracts only)
  -h, --help               Show this help
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --network)
      NETWORK="$2"; shift 2;;
    --config)
      NEOEXPRESS_CONFIG="$2"; shift 2;;
    --deployed-file)
      DEPLOYED_FILE="$2"; shift 2;;
    --overwrite)
      OVERWRITE="true"; shift;;
    --all)
      SYNC_ALL="true"; shift;;
    -h|--help)
      usage; exit 0;;
    *)
      echo "Unknown option: $1" >&2
      usage
      exit 1;;
  esac
done

if [[ "$NETWORK" != "neoexpress" ]]; then
  echo "Only neoexpress sync is supported (got: $NETWORK)" >&2
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "jq not found; required to update $DEPLOYED_FILE" >&2
  exit 1
fi

resolve_neoxp() {
  local resolved=""
  resolved="$(command -v neoxp 2>/dev/null || true)"
  if [[ -n "$resolved" ]]; then
    echo "$resolved"
    return 0
  fi
  local dotnet_tool="${HOME}/.dotnet/tools/neoxp"
  if [[ -x "$dotnet_tool" ]]; then
    echo "$dotnet_tool"
    return 0
  fi
  echo "Error: neoxp not found. Install with: dotnet tool install -g Neo.Express" >&2
  exit 1
}

NEOXP="$(resolve_neoxp)"

if [[ ! -f "$NEOEXPRESS_CONFIG" ]]; then
  echo "Neo Express config not found: $NEOEXPRESS_CONFIG" >&2
  exit 1
fi

mkdir -p "$(dirname "$DEPLOYED_FILE")"
if [[ ! -f "$DEPLOYED_FILE" ]]; then
  echo "{}" > "$DEPLOYED_FILE"
fi

if ! jq -e . "$DEPLOYED_FILE" >/dev/null 2>&1; then
  echo "Warning: invalid $DEPLOYED_FILE, reinitializing" >&2
  echo "{}" > "$DEPLOYED_FILE"
fi

PLATFORM_CONTRACTS=(
  "PaymentHub"
  "Governance"
  "PriceFeed"
  "RandomnessLog"
  "AppRegistry"
  "AutomationAnchor"
  "ServiceLayerGateway"
)

should_sync_name() {
  local name="$1"
  if [[ "$SYNC_ALL" == "true" ]]; then
    return 0
  fi
  for item in "${PLATFORM_CONTRACTS[@]}"; do
    if [[ "$item" == "$name" ]]; then
      return 0
    fi
  done
  return 1
}

extract_pairs_from_json() {
  jq -r '
    def name:
      (.name // .Name // .contractName // .contract?.name // .manifest?.name // .manifest?.Name);
    def hash:
      (.hash // .Hash // .scriptHash // .ScriptHash // .hash160 // .Hash160);
    .. | objects | select(name and hash) | "\(.name)\t\(.hash)"
  ' 2>/dev/null || true
}

extract_pairs_from_text() {
  local line
  while IFS= read -r line; do
    if [[ "$line" =~ ([A-Za-z0-9_]+)[[:space:]]+.*(0x[a-fA-F0-9]{40}) ]]; then
      echo "${BASH_REMATCH[1]}\t${BASH_REMATCH[2]}"
    fi
  done
}

json_output=""
text_output=""

commands=(
  "$NEOXP contract list --json -i $NEOEXPRESS_CONFIG"
  "$NEOXP contract list -i $NEOEXPRESS_CONFIG --json"
  "$NEOXP show contracts --json -i $NEOEXPRESS_CONFIG"
  "$NEOXP show contracts -i $NEOEXPRESS_CONFIG --json"
)

for cmd in "${commands[@]}"; do
  if output=$(eval "$cmd" 2>/dev/null); then
    if echo "$output" | jq -e . >/dev/null 2>&1; then
      json_output="$output"
      break
    fi
  fi
done

if [[ -z "$json_output" ]]; then
  commands=(
    "$NEOXP contract list -i $NEOEXPRESS_CONFIG"
    "$NEOXP show contracts -i $NEOEXPRESS_CONFIG"
  )
  for cmd in "${commands[@]}"; do
    if output=$(eval "$cmd" 2>/dev/null); then
      text_output="$output"
      break
    fi
  done
fi

pairs=""
if [[ -n "$json_output" ]]; then
  pairs="$(echo "$json_output" | extract_pairs_from_json)"
elif [[ -n "$text_output" ]]; then
  pairs="$(echo "$text_output" | extract_pairs_from_text)"
fi

if [[ -z "$pairs" ]]; then
  echo "Failed to discover contracts via neoxp. Ensure Neo Express is running." >&2
  exit 1
fi

updated=0
while IFS=$'\t' read -r name hash; do
  [[ -z "$name" || -z "$hash" ]] && continue
  if ! should_sync_name "$name"; then
    continue
  fi

  if [[ "$OVERWRITE" == "true" ]]; then
    jq --arg name "$name" --arg hash "$hash" '.[$name]=$hash' "$DEPLOYED_FILE" > "${DEPLOYED_FILE}.tmp"
    mv "${DEPLOYED_FILE}.tmp" "$DEPLOYED_FILE"
    updated=$((updated + 1))
    continue
  fi

  if jq -e --arg name "$name" '.[$name] // empty | length == 0' "$DEPLOYED_FILE" >/dev/null 2>&1; then
    jq --arg name "$name" --arg hash "$hash" '.[$name]=$hash' "$DEPLOYED_FILE" > "${DEPLOYED_FILE}.tmp"
    mv "${DEPLOYED_FILE}.tmp" "$DEPLOYED_FILE"
    updated=$((updated + 1))
  fi
done <<< "$pairs"

echo "Synced deployed contracts: $updated entries updated in $DEPLOYED_FILE"
