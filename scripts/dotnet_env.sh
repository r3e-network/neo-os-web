#!/usr/bin/env bash

if [ -z "${DOTNET_ROOT:-}" ]; then
  if [ -d "$HOME/.dotnet" ]; then
    export DOTNET_ROOT="$HOME/.dotnet"
  elif [ -d "/opt/homebrew/Cellar/dotnet" ]; then
    latest="$(ls -1 /opt/homebrew/Cellar/dotnet 2>/dev/null | sort -V | tail -n 1)"
    if [ -n "$latest" ]; then
      export DOTNET_ROOT="/opt/homebrew/Cellar/dotnet/${latest}/libexec"
    fi
  elif [ -d "/usr/local/Cellar/dotnet" ]; then
    latest="$(ls -1 /usr/local/Cellar/dotnet 2>/dev/null | sort -V | tail -n 1)"
    if [ -n "$latest" ]; then
      export DOTNET_ROOT="/usr/local/Cellar/dotnet/${latest}/libexec"
    fi
  fi
fi

if [ -n "${DOTNET_ROOT:-}" ]; then
  export PATH="${DOTNET_ROOT}:${DOTNET_ROOT}/tools:${PATH}"
fi
