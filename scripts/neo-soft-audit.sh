#!/usr/bin/env bash
#
# Neo Soft continuous-audit gate (cross-repo).
#
# Runs the repeatable verification gates for the Neo Soft UI redesign across
# all three repos. Exit non-zero if any gate fails. See docs/DESIGN_SYSTEM.md.
#
# Usage:
#   scripts/neo-soft-audit.sh            # full audit (builds all 60 miniapps)
#   scripts/neo-soft-audit.sh --quick    # skip the 60-app build
#
set -uo pipefail

PLATFORM_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
R3E_DIR="$(cd "$PLATFORM_DIR/.." && pwd)"
AA_DIR="$R3E_DIR/neo-abstract-account"
ORACLE_DIR="$R3E_DIR/neo-morpheus-oracle"
QUICK="${1:-}"

fail=0
pass_n=0
note() { printf '  %s\n' "$1"; }
gate() { printf '\n\033[1m▶ %s\033[0m\n' "$1"; }
ok() { printf '  \033[32m✓ %s\033[0m\n' "$1"; pass_n=$((pass_n+1)); }
bad() { printf '  \033[31m✗ %s\033[0m\n' "$1"; fail=$((fail+1)); }

# ── Gate 1: shared design-system SCSS compiles ───────────────────────
gate "Gate 1 — shared SCSS compiles (Neo Soft token layer)"
if (cd "$PLATFORM_DIR/apps/shared/styles" \
    && npx -y sass index.scss /tmp/ns-audit-index.css --no-source-map --load-path=. >/tmp/ns-audit-scss.log 2>&1 \
    && npx -y sass theme.scss /tmp/ns-audit-theme.css --no-source-map --load-path=. >>/tmp/ns-audit-scss.log 2>&1); then
  ok "apps/shared/styles compiles"
else
  bad "shared SCSS compile failed (see /tmp/ns-audit-scss.log)"
fi

# ── Gate 2: no legacy (pre-Neo-Soft) brand colors leaked into source ─
gate "Gate 2 — legacy brand colors purged from UI source"
scan_legacy() {
  # $1 = label, $2 = dir, $3 = extended-regex of forbidden hexes
  local label="$1" dir="$2" rx="$3"
  [ -d "$dir" ] || { note "$label: dir missing, skip"; return; }
  local n
  n=$(grep -rniE "$rx" "$dir" \
        --include='*.vue' --include='*.tsx' --include='*.jsx' \
        --include='*.ts' --include='*.js' --include='*.css' --include='*.scss' \
        2>/dev/null \
        | grep -vE 'node_modules|/dist/|/\.next/|/\.git/|package-lock|/docs/|neo-soft-audit|__tests__|\.test\.|official-brand|brand-assets' \
        | wc -l | tr -d ' ')
  if [ "$n" = "0" ]; then ok "$label: clean"; else bad "$label: $n legacy-color hit(s) — grep -rniE '$rx'"; fi
}
# host/platform legacy brand: bright neo #00E599, electric purple #7000FF
scan_legacy "platform" "$PLATFORM_DIR/platform" '#00e599|#7000ff'
# AA legacy brand: burnt orange + old sky-blue accent
scan_legacy "neo-abstract-account" "$AA_DIR/frontend" '#c2410c|#9a3412|#ea580c|#00a3ff'
# oracle legacy brand: forest green, indigo purple, steel blue
scan_legacy "neo-morpheus-oracle" "$ORACLE_DIR/apps/web" '#006b49|#533afd|#2874ad'

# ── Gate 3: all 60 miniapps build green ──────────────────────────────
if [ "$QUICK" = "--quick" ]; then
  gate "Gate 3 — miniapp build (skipped: --quick)"
  note "skipped"
else
  gate "Gate 3 — all miniapps build green"
  if (cd "$PLATFORM_DIR" && node scripts/build-miniapp-dapps.mjs >/tmp/ns-audit-build.log 2>&1); then
    summary=$(grep -oE '"(built_count|failure_count)": [0-9]+' /tmp/ns-audit-build.log | tr '\n' ' ')
    ok "miniapps built — $summary"
  else
    bad "miniapp build failed (see /tmp/ns-audit-build.log)"
  fi
fi

# ── Gate 4: miniapp layout consistency audit ─────────────────────────
gate "Gate 4 — miniapp layout consistency"
if (cd "$PLATFORM_DIR" && npm run -s audit:miniapps:layout >/tmp/ns-audit-layout.log 2>&1); then
  summary=$(grep -oE '"(checked_count)": [0-9]+' /tmp/ns-audit-layout.log | tr '\n' ' ')
  ok "layout audit passed — $summary"
else
  bad "layout audit failed (see /tmp/ns-audit-layout.log)"
fi

# ── Summary ──────────────────────────────────────────────────────────
printf '\n\033[1m── Neo Soft audit summary ──\033[0m\n'
printf '  passed: %s   failed: %s\n' "$pass_n" "$fail"
[ "$fail" = "0" ] && { printf '\033[32mAUDIT GREEN\033[0m\n'; exit 0; } || { printf '\033[31mAUDIT RED\033[0m\n'; exit 1; }
