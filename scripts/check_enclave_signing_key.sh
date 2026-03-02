#!/bin/bash

set -euo pipefail

usage() {
  cat <<'USAGE'
Usage: ./scripts/check_enclave_signing_key.sh [--backend nitro]

Options:
  --backend <name>          Attestation backend to validate (default: nitro).
  -h, --help                Show this help.

Environment:
  NITRO_ATTESTATION_DOCUMENT_B64
                            Nitro attestation document (base64).
  NITRO_MODULE_ID           Optional Nitro module ID for sanity checks.
USAGE
}

BACKEND="nitro"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --backend)
      BACKEND="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    --key|--expected-signer)
      echo "$1 is no longer supported in Nitro-only mode." >&2
      exit 2
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage
      exit 1
      ;;
  esac
done

BACKEND="$(echo "$BACKEND" | tr 'A-Z' 'a-z')"
if [[ "$BACKEND" != "nitro" ]]; then
  echo "Unsupported --backend value: $BACKEND" >&2
  echo "This project is Nitro-only. Use: --backend nitro" >&2
  exit 1
fi

if [[ -z "${NITRO_ATTESTATION_DOCUMENT_B64:-}" ]]; then
  echo "Nitro validation failed: NITRO_ATTESTATION_DOCUMENT_B64 is not set." >&2
  exit 1
fi

if ! (printf '%s' "${NITRO_ATTESTATION_DOCUMENT_B64}" | base64 --decode >/dev/null 2>&1 || \
      printf '%s' "${NITRO_ATTESTATION_DOCUMENT_B64}" | base64 -D >/dev/null 2>&1); then
  echo "Nitro validation failed: NITRO_ATTESTATION_DOCUMENT_B64 is not valid base64." >&2
  exit 1
fi

echo "Nitro attestation configuration is valid."
if [[ -n "${NITRO_MODULE_ID:-}" ]]; then
  echo "ModuleID: ${NITRO_MODULE_ID}"
fi
