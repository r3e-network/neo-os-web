#!/bin/bash
# Fix permission issues in node_modules caused by root-owned files
# Run with: sudo ./scripts/fix-permissions.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "🔧 Fixing permissions in $PROJECT_ROOT"

# Remove root-owned directories in node_modules
if [ -d "$PROJECT_ROOT/node_modules/@anthropic-ai" ]; then
    echo "Removing @anthropic-ai (root-owned)..."
    rm -rf "$PROJECT_ROOT/node_modules/@anthropic-ai"
fi

if [ -d "$PROJECT_ROOT/node_modules/@img" ]; then
    echo "Removing @img (root-owned)..."
    rm -rf "$PROJECT_ROOT/node_modules/@img"
fi

if [ -d "$PROJECT_ROOT/node_modules/.bin" ]; then
    echo "Removing .bin (root-owned)..."
    rm -rf "$PROJECT_ROOT/node_modules/.bin"
fi

# Change ownership of remaining files to current user
echo "Changing ownership of node_modules..."
chown -R "${SUDO_USER:-$USER}:${SUDO_USER:-$USER}" "$PROJECT_ROOT/node_modules" 2>/dev/null || true

echo "✅ Permissions fixed. Run 'pnpm install' to reinstall dependencies."
