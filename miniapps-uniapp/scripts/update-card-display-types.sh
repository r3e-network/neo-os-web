#!/bin/bash
# Update MiniApp manifests with dynamic card display types

APPS_DIR="/home/neo/git/service_layer/miniapps-uniapp/apps"

# Define card display type mappings
declare -A CARD_TYPES=(
  # Countdown type (lottery, auctions)
  ["lottery"]="live_countdown"
  ["no-loss-lottery"]="live_countdown"
  ["dutch-auction"]="live_countdown"
  ["doomsday-clock"]="live_countdown"
  ["time-capsule"]="live_countdown"

  # Multiplier type (crash games)
  ["neo-crash"]="live_multiplier"
  ["candle-wars"]="live_multiplier"

  # Canvas type
  ["canvas"]="live_canvas"
  ["million-piece-map"]="live_canvas"

  # Stats type (red envelope, tipping)
  ["red-envelope"]="live_stats"
  ["dev-tipping"]="live_stats"
  ["bounty-hunter"]="live_stats"

  # Voting type (governance)
  ["gov-booster"]="live_voting"
  ["gov-merc"]="live_voting"
  ["secret-vote"]="live_voting"
  ["candidate-vote"]="live_voting"
  ["masquerade-dao"]="live_voting"

  # Price type (trading, DeFi)
  ["price-ticker"]="live_price"
  ["prediction-market"]="live_price"
  ["grid-bot"]="live_price"
  ["ai-trader"]="live_price"
  ["flashloan"]="live_price"
  ["dark-pool"]="live_price"
  ["quantum-swap"]="live_price"
)

echo "Updating MiniApp card display types..."

for app in "${!CARD_TYPES[@]}"; do
  manifest="$APPS_DIR/$app/src/manifest.json"
  card_type="${CARD_TYPES[$app]}"

  if [ -f "$manifest" ]; then
    # Update the card.display.type field using jq
    if command -v jq &> /dev/null; then
      tmp=$(mktemp)
      jq --arg type "$card_type" '.card.display.type = $type' "$manifest" > "$tmp"
      mv "$tmp" "$manifest"
      echo "✓ Updated $app -> $card_type"
    else
      # Fallback to sed if jq not available
      sed -i "s/\"type\": \"live_status\"/\"type\": \"$card_type\"/" "$manifest"
      echo "✓ Updated $app -> $card_type (sed)"
    fi
  else
    echo "✗ Manifest not found: $app"
  fi
done

echo ""
echo "Done! Updated ${#CARD_TYPES[@]} MiniApp manifests."
