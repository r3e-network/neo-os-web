#!/bin/bash
# Setup complete uni-app project structure for all MiniApps
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APPS_DIR="$SCRIPT_DIR/../apps"
SHARED_DIR="$SCRIPT_DIR/../shared"

# App definitions: name|title|category|appId
APPS=(
  "lottery|Neo Lottery|gaming|miniapp-lottery"
  "coin-flip|Coin Flip|gaming|miniapp-coinflip"
  "dice-game|Dice Game|gaming|miniapp-dicegame"
  "scratch-card|Scratch Card|gaming|miniapp-scratchcard"
  "secret-poker|Secret Poker|gaming|miniapp-secretpoker"
  "neo-crash|Neo Crash|gaming|miniapp-neocrash"
  "candle-wars|Candle Wars|gaming|miniapp-candlewars"
  "algo-battle|Algo Battle|gaming|miniapp-algobattle"
  "fog-chess|Fog Chess|gaming|miniapp-fogchess"
  "fog-puzzle|Fog Puzzle|gaming|miniapp-fogpuzzle"
  "crypto-riddle|Crypto Riddle|gaming|miniapp-cryptoriddle"
  "world-piano|World Piano|gaming|miniapp-worldpiano"
  "million-piece-map|Million Piece Map|gaming|miniapp-millionpiecemap"
  "puzzle-mining|Puzzle Mining|gaming|miniapp-puzzlemining"
  "scream-to-earn|Scream to Earn|gaming|miniapp-screamtoearn"
  "flashloan|Flash Loan|defi|miniapp-flashloan"
  "ai-trader|AI Trader|defi|miniapp-aitrader"
  "grid-bot|Grid Bot|defi|miniapp-gridbot"
  "bridge-guardian|Bridge Guardian|defi|miniapp-bridgeguardian"
  "gas-circle|Gas Circle|defi|miniapp-gascircle"
  "il-guard|IL Guard|defi|miniapp-ilguard"
  "compound-capsule|Compound Capsule|defi|miniapp-compoundcapsule"
  "dark-pool|Dark Pool|defi|miniapp-darkpool"
  "dutch-auction|Dutch Auction|defi|miniapp-dutchauction"
  "no-loss-lottery|No Loss Lottery|defi|miniapp-nolosslottery"
  "quantum-swap|Quantum Swap|defi|miniapp-quantumswap"
  "self-loan|Self Loan|defi|miniapp-selfloan"
  "ai-soulmate|AI Soulmate|social|miniapp-aisoulmate"
  "red-envelope|Red Envelope|social|miniapp-redenvelope"
  "dark-radio|Dark Radio|social|miniapp-darkradio"
  "dev-tipping|Dev Tipping|social|miniapp-devtipping"
  "bounty-hunter|Bounty Hunter|social|miniapp-bountyhunter"
  "breakup-contract|Breakup Contract|social|miniapp-breakupcontract"
  "ex-files|Ex Files|social|miniapp-exfiles"
  "geo-spotlight|Geo Spotlight|social|miniapp-geospotlight"
  "whisper-chain|Whisper Chain|social|miniapp-whisperchain"
  "canvas|Canvas|nft|miniapp-canvas"
  "nft-evolve|NFT Evolve|nft|miniapp-nftevolve"
  "nft-chimera|NFT Chimera|nft|miniapp-nftchimera"
  "schrodinger-nft|Schrodinger NFT|nft|miniapp-schrodingernft"
  "melting-asset|Melting Asset|nft|miniapp-meltingasset"
  "on-chain-tarot|On-Chain Tarot|nft|miniapp-onchaintarot"
  "time-capsule|Time Capsule|nft|miniapp-timecapsule"
  "heritage-trust|Heritage Trust|nft|miniapp-heritagetrust"
  "garden-of-neo|Garden of Neo|nft|miniapp-gardenofneo"
  "graveyard|Graveyard|nft|miniapp-graveyard"
  "parasite|Parasite|nft|miniapp-parasite"
  "pay-to-view|Pay to View|nft|miniapp-paytoview"
  "dead-switch|Dead Switch|nft|miniapp-deadswitch"
  "secret-vote|Secret Vote|governance|miniapp-secretvote"
  "gov-booster|Gov Booster|governance|miniapp-govbooster"
  "prediction-market|Prediction Market|governance|miniapp-predictionmarket"
  "burn-league|Burn League|governance|miniapp-burnleague"
  "doomsday-clock|Doomsday Clock|governance|miniapp-doomsdayclock"
  "masquerade-dao|Masquerade DAO|governance|miniapp-masqueradedao"
  "gov-merc|Gov Merc|governance|miniapp-govmerc"
  "price-ticker|Price Ticker|utility|miniapp-priceticker"
  "guardian-policy|Guardian Policy|utility|miniapp-guardianpolicy"
  "unbreakable-vault|Unbreakable Vault|utility|miniapp-unbreakablevault"
  "zk-badge|ZK Badge|utility|miniapp-zkbadge"
)

echo "Setting up ${#APPS[@]} uni-app projects..."

for entry in "${APPS[@]}"; do
  IFS='|' read -r name title category appId <<< "$entry"
  APP_DIR="$APPS_DIR/$name"

  if [ ! -d "$APP_DIR/src/pages/index" ]; then
    echo "Skipping $name - no Vue component found"
    continue
  fi

  echo "[$name] Setting up..."

  # Create directories
  mkdir -p "$APP_DIR/src/static"

  # Copy shared folder if not exists
  if [ ! -d "$APP_DIR/src/shared" ]; then
    cp -r "$SHARED_DIR" "$APP_DIR/src/shared"
  fi
done

echo "Done! Run node scripts/generate-templates.js to create config files."
