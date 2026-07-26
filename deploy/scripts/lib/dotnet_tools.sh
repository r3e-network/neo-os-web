#!/bin/bash
# Shared resolution of the .NET SDK root and of dotnet global tools.
#
# Neo contract work needs two things that live in different places depending on
# the machine: a runtime root (DOTNET_ROOT) and the dotnet global tools nccs and
# neoxp. CI images install under $HOME/.dotnet and leave $HOME/.dotnet/tools off
# PATH; Homebrew installs under .../opt/dotnet/libexec with the real files in
# .../Cellar/dotnet/<version>/libexec; Linux distributions use /usr/share/dotnet.
# Every build entrypoint used to carry its own copy of that search and the
# copies had drifted apart, so this file owns it.
#
# Search order for DOTNET_ROOT, first hit wins, and an inherited DOTNET_ROOT is
# always left alone:
#   1. $HOME/.dotnet                              (dotnet-install script, CI)
#   2. $DOTNET_SYSTEM_ROOTS                       (package managers)
#   3. newest version under $DOTNET_CELLAR_ROOTS  (Homebrew)
# A candidate only counts when it holds an executable `dotnet`. Testing for the
# directory alone matches a tools-only install - a machine with
# $HOME/.dotnet/tools whose runtime comes from Homebrew - and pointing
# DOTNET_ROOT at that directory breaks every build on such a machine.
#
# Both search lists are colon separated and overridable so a caller can point at
# an unusual install without editing this file.
#
# Source this file, then call:
#   ensure_dotnet_root
#   resolve_dotnet_tool <tool-name> <install-hint>

DOTNET_SYSTEM_ROOTS="${DOTNET_SYSTEM_ROOTS:-/usr/share/dotnet:/usr/lib/dotnet:/opt/homebrew/opt/dotnet/libexec:/usr/local/opt/dotnet/libexec}"
DOTNET_CELLAR_ROOTS="${DOTNET_CELLAR_ROOTS:-/opt/homebrew/Cellar/dotnet:/usr/local/Cellar/dotnet}"

# Prints the first entry of the colon separated list in $1 that holds an
# executable dotnet. Returns 1 when none does.
dotnet_first_root_with_runtime() {
    local list="${1:-}"
    [ -n "$list" ] || return 1

    local roots=()
    IFS=: read -r -a roots <<< "$list"

    local root
    for root in "${roots[@]}"; do
        [ -n "$root" ] || continue
        if [ -x "${root}/dotnet" ]; then
            echo "$root"
            return 0
        fi
    done
    return 1
}

# Prints the highest versioned <cellar>/<version>/libexec directory that holds an
# executable dotnet, searching the colon separated cellar parents in $1 in order.
# Returns 1 when none does.
dotnet_newest_cellar_root() {
    local list="${1:-}"
    [ -n "$list" ] || return 1

    local parents=()
    IFS=: read -r -a parents <<< "$list"

    local parent entry best
    for parent in "${parents[@]}"; do
        [ -n "$parent" ] || continue
        [ -d "$parent" ] || continue

        best=""
        for entry in "$parent"/*/libexec; do
            [ -x "${entry}/dotnet" ] || continue
            if [ -z "$best" ]; then
                best="$entry"
            else
                best="$(printf '%s\n%s\n' "$best" "$entry" | sort -V | tail -n 1)"
            fi
        done

        if [ -n "$best" ]; then
            echo "$best"
            return 0
        fi
    done
    return 1
}

# Prepends $1 to PATH unless it is already there, so repeated sourcing cannot
# grow PATH. The directory does not have to exist yet: global tools are often
# installed after the first build attempt has already printed its install hint.
dotnet_path_prepend() {
    local entry="${1:-}"
    [ -n "$entry" ] || return 0

    case ":${PATH}:" in
        *":${entry}:"*) return 0 ;;
    esac

    export PATH="${entry}:${PATH}"
}

# Exports DOTNET_ROOT when it can be discovered and puts the runtime and the
# global tools directories on PATH. Safe to call more than once.
ensure_dotnet_root() {
    if [ -z "${DOTNET_ROOT:-}" ]; then
        local candidate=""
        if [ -x "${HOME}/.dotnet/dotnet" ]; then
            candidate="${HOME}/.dotnet"
        else
            candidate="$(dotnet_first_root_with_runtime "$DOTNET_SYSTEM_ROOTS" || true)"
            if [ -z "$candidate" ]; then
                candidate="$(dotnet_newest_cellar_root "$DOTNET_CELLAR_ROOTS" || true)"
            fi
        fi

        if [ -n "$candidate" ]; then
            export DOTNET_ROOT="$candidate"
        fi
    fi

    # Global tools always live under $HOME/.dotnet/tools, whichever runtime root
    # won above, so they go on PATH either way.
    dotnet_path_prepend "${HOME}/.dotnet/tools"
    if [ -n "${DOTNET_ROOT:-}" ]; then
        dotnet_path_prepend "${DOTNET_ROOT}/tools"
        dotnet_path_prepend "${DOTNET_ROOT}"
    fi
}

# Prints the absolute path of the dotnet global tool named $1. An uppercase
# environment variable named after the tool (NCCS, NEOXP) overrides discovery and
# may name either a path or a command on PATH. On failure, prints the install
# hint in $2 and returns non-zero without printing anything on stdout.
resolve_dotnet_tool() {
    if [ "$#" -lt 2 ]; then
        echo "Usage: resolve_dotnet_tool <tool-name> <install-hint>" >&2
        return 2
    fi

    local name="$1"
    local install_hint="$2"

    case "$name" in
        ''|*[!A-Za-z0-9._-]*)
            echo "Error: invalid dotnet tool name: '${name}'" >&2
            return 2
            ;;
    esac

    local override_var override_value=""
    override_var="$(printf '%s' "$name" | tr 'a-z.-' 'A-Z__')"
    eval "override_value=\"\${${override_var}:-}\""

    local resolved=""
    if [ -n "$override_value" ]; then
        if [ -x "$override_value" ]; then
            echo "$override_value"
            return 0
        fi
        resolved="$(command -v "$override_value" 2>/dev/null || true)"
        case "$resolved" in
            /*)
                echo "$resolved"
                return 0
                ;;
        esac
        echo "Error: ${override_var} is set to '${override_value}', which is not executable" >&2
        return 1
    fi

    # command -v answers with a bare word for builtins and functions, so only an
    # absolute path counts as a hit here.
    resolved="$(command -v "$name" 2>/dev/null || true)"
    case "$resolved" in
        /*)
            echo "$resolved"
            return 0
            ;;
    esac

    local dotnet_tool="${HOME}/.dotnet/tools/${name}"
    if [ -x "$dotnet_tool" ]; then
        echo "$dotnet_tool"
        return 0
    fi

    echo "Error: ${name} is not installed" >&2
    echo "Install with: ${install_hint}" >&2
    echo "Then ensure ${HOME}/.dotnet/tools is on PATH." >&2
    return 1
}
