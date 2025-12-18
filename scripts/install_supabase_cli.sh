#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

DEST_DIR="$PROJECT_ROOT/bin"
DEST_BIN="$DEST_DIR/supabase"

VERSION="${SUPABASE_CLI_VERSION:-latest}"

os="$(uname -s | tr '[:upper:]' '[:lower:]')"
arch="$(uname -m | tr '[:upper:]' '[:lower:]')"

case "$os" in
  linux|darwin) ;;
  *)
    echo "ERROR: unsupported OS for automated install: $os" >&2
    echo "Install manually and set SUPABASE_CLI_BIN=/path/to/supabase" >&2
    exit 1
    ;;
esac

case "$arch" in
  x86_64|amd64) arch="amd64" ;;
  aarch64|arm64) arch="arm64" ;;
  *)
    echo "ERROR: unsupported architecture for automated install: $arch" >&2
    echo "Install manually and set SUPABASE_CLI_BIN=/path/to/supabase" >&2
    exit 1
    ;;
esac

if ! command -v curl >/dev/null 2>&1; then
  echo "ERROR: curl is required for automated install" >&2
  exit 1
fi

if ! command -v tar >/dev/null 2>&1; then
  echo "ERROR: tar is required for automated install" >&2
  exit 1
fi

mkdir -p "$DEST_DIR"

tmp="$(mktemp -d)"
cleanup() { rm -rf "$tmp"; }
trap cleanup EXIT

artifact="supabase_${os}_${arch}.tar.gz"

if [[ "$VERSION" == "latest" ]]; then
  url="https://github.com/supabase/cli/releases/latest/download/${artifact}"
else
  url="https://github.com/supabase/cli/releases/download/${VERSION}/${artifact}"
fi

echo "Installing Supabase CLI:"
echo "  url:  $url"
echo "  dest: $DEST_BIN"

curl -fsSL \
  --retry 3 \
  --retry-delay 2 \
  --retry-all-errors \
  --connect-timeout 10 \
  --max-time 300 \
  "$url" -o "$tmp/$artifact"
tar -xzf "$tmp/$artifact" -C "$tmp"

if [[ ! -f "$tmp/supabase" ]]; then
  echo "ERROR: downloaded archive did not contain a 'supabase' binary" >&2
  exit 1
fi

install -m 0755 "$tmp/supabase" "$DEST_BIN"

echo "Installed: $DEST_BIN"
echo "Version:"
"$DEST_BIN" --version || true
