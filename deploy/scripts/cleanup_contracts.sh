#!/bin/bash
cd contracts

KEEP=(
  "AppRegistry"
  "AutomationAnchor"
  "Governance"
  "MiniAppBase"
  "MiniAppFactory"
  "MiniAppFactoryV2"
  "MiniAppTemplates"
  "PauseRegistry"
  "PaymentHub"
  "PriceFeed"
  "RandomnessLog"
  "MiniAppCoinFlip"
  "MiniAppDiceGame"
  "MiniAppGasCircle"
  "MiniAppLottery"
  "MiniAppPredictionMarket"
  "MiniAppRedEnvelope"
  "MiniAppSecretVote"
  "MiniAppCandidateVote"
  "MiniAppDevTipping"
  "__tests__"
  "build"
  "cmd"
  "security"
)

# Function to check if an item is in the KEEP array
containsElement () {
  local e match="$1"
  shift
  for e; do [[ "$e" == "$match" ]] && return 0; done
  return 1
}

for dir in */; do
  dir=${dir%/} # remove trailing slash
  if ! containsElement "$dir" "${KEEP[@]}"; then
    if [[ "$dir" == MiniApp* ]]; then
      echo "Deleting redundant contract: $dir"
      rm -rf "$dir"
    fi
  fi
done
