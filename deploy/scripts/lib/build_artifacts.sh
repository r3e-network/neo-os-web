#!/usr/bin/env bash
# Shared helpers for collecting Neo contract build artifacts.
#
# The Neo C# compiler (nccs) names its output after the project it compiled, so
# callers that want a different on-disk name have to compile into a scratch
# directory and rename whatever landed there. Doing that with `[ -f dir/*.nef ]`
# is unsafe: the test silently succeeds against the literal pattern when nothing
# matched, so a failed compile looks like a successful one. This helper globs
# into arrays instead, so the match count is checkable, and validates both
# artifacts before moving either one.

# Move the single .nef/.manifest.json pair in <src_dir> to <dest_dir>, renaming
# both to <contract_name>. Returns 2 on a usage error and 1 when the source
# directory does not hold exactly one of each artifact.
promote_contract_artifacts() {
    if [ "$#" -ne 3 ] || [ -z "$1" ] || [ -z "$2" ] || [ -z "$3" ]; then
        echo "Usage: promote_contract_artifacts <src_dir> <dest_dir> <contract_name>" >&2
        return 2
    fi

    local src_dir="$1"
    local dest_dir="$2"
    local contract_name="$3"

    if [ ! -d "$src_dir" ]; then
        echo "Compiler output directory not found: $src_dir" >&2
        return 1
    fi

    local nefs=()
    local manifests=()
    local candidate

    # An unmatched glob stays literal, so each candidate needs a real -f test.
    # `if` rather than `&&` because a failing AND-list would abort a `set -e`
    # caller.
    for candidate in "$src_dir"/*.nef; do
        if [ -f "$candidate" ]; then
            nefs+=("$candidate")
        fi
    done
    for candidate in "$src_dir"/*.manifest.json; do
        if [ -f "$candidate" ]; then
            manifests+=("$candidate")
        fi
    done

    if [ "${#nefs[@]}" -ne 1 ]; then
        echo "Expected exactly one .nef in $src_dir, found ${#nefs[@]}" >&2
        return 1
    fi
    if [ "${#manifests[@]}" -ne 1 ]; then
        echo "Expected exactly one .manifest.json in $src_dir, found ${#manifests[@]}" >&2
        return 1
    fi

    if ! mkdir -p "$dest_dir"; then
        echo "Unable to create artifact directory: $dest_dir" >&2
        return 1
    fi

    mv "${nefs[0]}" "$dest_dir/$contract_name.nef" || return 1
    mv "${manifests[0]}" "$dest_dir/$contract_name.manifest.json" || return 1

    echo "  ✓ $contract_name.nef"
    echo "  ✓ $contract_name.manifest.json"
}
