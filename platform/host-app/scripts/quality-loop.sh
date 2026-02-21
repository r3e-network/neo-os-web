#!/usr/bin/env bash
set -euo pipefail

ITERATIONS="${1:-1}"

if ! [[ "$ITERATIONS" =~ ^[0-9]+$ ]]; then
  echo "iterations must be a positive integer"
  exit 1
fi

if [ "$ITERATIONS" -lt 1 ]; then
  echo "iterations must be >= 1"
  exit 1
fi

for i in $(seq 1 "$ITERATIONS"); do
  echo "== Quality Loop $i/$ITERATIONS: typecheck =="
  npm exec -- tsc --noEmit -p tsconfig.json

  echo "== Quality Loop $i/$ITERATIONS: tests =="
  npm test -- --runInBand

done

echo "Quality loop complete: $ITERATIONS iteration(s)."
