#!/bin/bash
# Generate missing UniApp frontends

BASE_DIR="miniapps-uniapp/apps"

declare -A APPS=(
  ["gas-spin"]="Gas Spin|Spin the wheel to win GAS prizes|gaming"
  ["micro-predict"]="Micro Predict|Quick micro-prediction markets|gaming"
  ["mega-millions"]="Mega Millions|Large jackpot lottery game|gaming"
  ["price-predict"]="Price Predict|Predict crypto price movements|gaming"
  ["turbo-options"]="Turbo Options|Fast binary options trading|defi"
  ["throne-of-gas"]="Throne of Gas|King of the hill GAS competition|gaming"
)

for app in "${!APPS[@]}"; do
  IFS='|' read -r name desc category <<< "${APPS[$app]}"

  APP_DIR="$BASE_DIR/$app/src"
  mkdir -p "$APP_DIR/pages/index"
  mkdir -p "$APP_DIR/static"
  mkdir -p "$APP_DIR/shared/styles"
  mkdir -p "$APP_DIR/shared/utils"

  echo "Creating $app..."
done

echo "Directories created!"
