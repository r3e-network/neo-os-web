#!/bin/bash

set -euo pipefail

usage() {
  cat <<'USAGE'
Usage: ./scripts/check_enclave_signing_key.sh [--backend sgx|nitro] [--key /path/to/private.pem] [--expected-signer <hex64>]

Options:
  --backend <name>          Attestation backend to validate (default: sgx).
  --key <path>               Path to enclave signing private key (PEM).
  --expected-signer <hex64>  Optional expected signer ID (64 hex chars, with or without 0x).
  -h, --help                 Show this help.

Key requirements (Open Enclave SGX signing):
  - RSA private key
  - 3072-bit modulus
  - public exponent = 3

Environment:
  EGO_VERSION                EGo image tag for Docker fallback (default: 1.8.0).
  NITRO_ATTESTATION_DOCUMENT_B64
                             Nitro attestation document (base64).
  NITRO_MODULE_ID            Optional Nitro module ID for sanity checks.
USAGE
}

BACKEND="sgx"
KEY_PATH=""
EXPECTED_SIGNER=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --backend)
      BACKEND="${2:-}"
      shift 2
      ;;
    --key)
      KEY_PATH="${2:-}"
      shift 2
      ;;
    --expected-signer)
      EXPECTED_SIGNER="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage
      exit 1
      ;;
  esac
done

BACKEND="$(echo "$BACKEND" | tr 'A-Z' 'a-z')"

if [[ "$BACKEND" == "nitro" ]]; then
  if [[ -n "$KEY_PATH" ]]; then
    echo "Warning: --key is ignored when --backend nitro is selected." >&2
  fi
  if [[ -n "$EXPECTED_SIGNER" ]]; then
    echo "Warning: --expected-signer is ignored when --backend nitro is selected." >&2
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
  exit 0
fi

if [[ "$BACKEND" != "sgx" ]]; then
  echo "Unsupported --backend value: $BACKEND (expected sgx or nitro)." >&2
  exit 1
fi

if [[ -z "$KEY_PATH" ]]; then
  echo "Missing required --key argument for SGX backend." >&2
  usage
  exit 1
fi

if [[ ! -f "$KEY_PATH" ]]; then
  echo "Key file not found: $KEY_PATH" >&2
  exit 1
fi

if ! openssl pkey -in "$KEY_PATH" -noout >/dev/null 2>&1; then
  echo "Invalid private key PEM: $KEY_PATH" >&2
  exit 1
fi

KEY_META="$(openssl rsa -in "$KEY_PATH" -text -noout 2>/dev/null || true)"
if ! grep -q "Private-Key: (3072 bit" <<<"$KEY_META"; then
  echo "Invalid SGX signing key size: expected RSA-3072." >&2
  exit 1
fi
if ! grep -q "publicExponent: 3 (0x3)" <<<"$KEY_META"; then
  echo "Invalid SGX signing key exponent: expected publicExponent=3." >&2
  exit 1
fi

compute_signerid_with_ego() {
  local key_path="$1"
  local signer=""
  local tmp_pub=""

  signer="$(ego signerid "$key_path" 2>/dev/null | tr -d '\r\n' || true)"
  if [[ "$signer" =~ ^[0-9a-fA-F]{64}$ ]]; then
    echo "$signer"
    return 0
  fi

  tmp_pub="$(mktemp -t enclave-signing-key.pub.XXXXXX.pem)"
  if openssl rsa -in "$key_path" -pubout -out "$tmp_pub" >/dev/null 2>&1; then
    signer="$(ego signerid "$tmp_pub" 2>/dev/null | tr -d '\r\n' || true)"
  fi
  rm -f "$tmp_pub"

  echo "$signer"
}

compute_signerid_with_docker() {
  local key_path="$1"
  local image="ghcr.io/edgelesssys/ego-dev:v${EGO_VERSION:-1.8.0}"
  docker run --rm -v "${key_path}:/signing-key:ro" "$image" \
    sh -c 'ego signerid /signing-key >/tmp/signer.txt 2>/dev/null || true; if ! grep -Eq "^[0-9a-fA-F]{64}$" /tmp/signer.txt; then openssl rsa -in /signing-key -pubout -out /tmp/pub.pem >/dev/null 2>&1 && ego signerid /tmp/pub.pem >/tmp/signer.txt 2>/dev/null || true; fi; cat /tmp/signer.txt' \
    2>/dev/null | tr -d '\r\n'
}

SIGNER_ID=""
if command -v ego >/dev/null 2>&1; then
  SIGNER_ID="$(compute_signerid_with_ego "$KEY_PATH" || true)"
fi

if [[ ! "$SIGNER_ID" =~ ^[0-9a-fA-F]{64}$ ]]; then
  if ! command -v docker >/dev/null 2>&1; then
    echo "Could not derive SignerID with ego, and docker is not available for fallback." >&2
    exit 1
  fi
  SIGNER_ID="$(compute_signerid_with_docker "$KEY_PATH" || true)"
fi

if [[ ! "$SIGNER_ID" =~ ^[0-9a-fA-F]{64}$ ]]; then
  echo "Failed to derive SignerID from key: $KEY_PATH" >&2
  exit 1
fi

SIGNER_ID="$(echo "$SIGNER_ID" | tr 'A-F' 'a-f')"

echo "Key PEM is valid."
echo "SignerID: $SIGNER_ID"

if [[ -n "$EXPECTED_SIGNER" ]]; then
  normalized_expected="${EXPECTED_SIGNER#0x}"
  normalized_expected="$(echo "$normalized_expected" | tr 'A-F' 'a-f')"

  if [[ ! "$normalized_expected" =~ ^[0-9a-f]{64}$ ]]; then
    echo "Invalid --expected-signer value (must be 64 hex chars): $EXPECTED_SIGNER" >&2
    exit 1
  fi

  if [[ "$SIGNER_ID" != "$normalized_expected" ]]; then
    echo "SignerID mismatch." >&2
    echo "  expected: $normalized_expected" >&2
    echo "  actual:   $SIGNER_ID" >&2
    exit 1
  fi

  echo "SignerID matches expected value."
fi
