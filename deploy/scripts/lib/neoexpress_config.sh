#!/bin/bash
# Shared bootstrap for the local Neo Express configuration.
#
# The config file holds the raw private keys of the devnet consensus and wallet
# accounts, so it is never tracked in git. Every caller that needs it must be
# able to regenerate it from nothing. It also has to cope with a config that
# exists but is unusable: clones made while the file was tracked carry a copy
# whose keys were replaced by redaction placeholders when they were purged from
# history, and an "exists?" test alone would keep that broken copy forever.
#
# Usability is therefore decided by key shape: the config must declare at least
# one private key and every declared key must be 64 hex characters. That catches
# redaction placeholders, empty strings, truncated values and non-JSON alike,
# without hardcoding any particular placeholder token.
#
# Source this file, then call:
#   ensure_neoexpress_config <config-path> <neoxp-binary>

# Prints nothing; returns 0 when the config at $1 can be used as-is.
neoexpress_config_is_usable() {
    local config_file="${1:-}"
    [ -n "$config_file" ] || return 1
    [ -s "$config_file" ] || return 1

    local declared valid
    declared="$( { grep -a -o -E '"private-key"[[:space:]]*:[[:space:]]*"[^"]*"' "$config_file" || true; } | wc -l | tr -d '[:space:]')"
    [ "$declared" -gt 0 ] || return 1

    valid="$( { grep -a -o -E '"private-key"[[:space:]]*:[[:space:]]*"[0-9A-Fa-f]{64}"' "$config_file" || true; } | wc -l | tr -d '[:space:]')"
    [ "$declared" = "$valid" ]
}

# Creates the config at $1 using the neoxp binary at $2 when it is absent or
# unusable. Never echoes key material. Propagates the generator's exit status.
ensure_neoexpress_config() {
    if [ "$#" -lt 2 ]; then
        echo "Usage: ensure_neoexpress_config <config-path> <neoxp-binary>" >&2
        return 2
    fi

    local config_file="$1"
    local neoxp="$2"

    if neoexpress_config_is_usable "$config_file"; then
        return 0
    fi

    if [ -e "$config_file" ]; then
        echo "Replacing unusable Neo Express configuration at ${config_file}..."
    else
        echo "Initializing Neo Express configuration at ${config_file}..."
    fi

    mkdir -p "$(dirname "$config_file")"

    local status=0
    "$neoxp" create -o "$config_file" -f || status=$?
    if [ "$status" -ne 0 ]; then
        echo "Error: failed to create Neo Express configuration at ${config_file}" >&2
        return "$status"
    fi

    if ! neoexpress_config_is_usable "$config_file"; then
        echo "Error: ${neoxp} produced a Neo Express configuration without usable account keys" >&2
        return 1
    fi
}
