#!/usr/bin/env node
/**
 * Generate uni-app project template files for all MiniApps
 */
const fs = require("fs");
const path = require("path");

const APPS_DIR = path.join(__dirname, "../apps");

// All app definitions
const APPS = [
  { name: "lottery", title: "Neo Lottery", category: "gaming", appId: "miniapp-lottery" },
  { name: "coin-flip", title: "Coin Flip", category: "gaming", appId: "miniapp-coinflip" },
  { name: "dice-game", title: "Dice Game", category: "gaming", appId: "miniapp-dicegame" },
  { name: "scratch-card", title: "Scratch Card", category: "gaming", appId: "miniapp-scratchcard" },
  { name: "secret-poker", title: "Secret Poker", category: "gaming", appId: "miniapp-secretpoker" },
  { name: "neo-crash", title: "Neo Crash", category: "gaming", appId: "miniapp-neocrash" },
  { name: "candle-wars", title: "Candle Wars", category: "gaming", appId: "miniapp-candlewars" },
  { name: "algo-battle", title: "Algo Battle", category: "gaming", appId: "miniapp-algobattle" },
  { name: "fog-chess", title: "Fog Chess", category: "gaming", appId: "miniapp-fogchess" },
  { name: "fog-puzzle", title: "Fog Puzzle", category: "gaming", appId: "miniapp-fogpuzzle" },
  { name: "crypto-riddle", title: "Crypto Riddle", category: "gaming", appId: "miniapp-cryptoriddle" },
  { name: "world-piano", title: "World Piano", category: "gaming", appId: "miniapp-worldpiano" },
  { name: "million-piece-map", title: "Million Piece Map", category: "gaming", appId: "miniapp-millionpiecemap" },
  { name: "puzzle-mining", title: "Puzzle Mining", category: "gaming", appId: "miniapp-puzzlemining" },
  { name: "scream-to-earn", title: "Scream to Earn", category: "gaming", appId: "miniapp-screamtoearn" },
  { name: "flashloan", title: "Flash Loan", category: "defi", appId: "miniapp-flashloan" },
  { name: "ai-trader", title: "AI Trader", category: "defi", appId: "miniapp-aitrader" },
  { name: "grid-bot", title: "Grid Bot", category: "defi", appId: "miniapp-gridbot" },
  { name: "bridge-guardian", title: "Bridge Guardian", category: "defi", appId: "miniapp-bridgeguardian" },
  { name: "gas-circle", title: "Gas Circle", category: "defi", appId: "miniapp-gascircle" },
  { name: "il-guard", title: "IL Guard", category: "defi", appId: "miniapp-ilguard" },
  { name: "compound-capsule", title: "Compound Capsule", category: "defi", appId: "miniapp-compoundcapsule" },
  { name: "dark-pool", title: "Dark Pool", category: "defi", appId: "miniapp-darkpool" },
  { name: "dutch-auction", title: "Dutch Auction", category: "defi", appId: "miniapp-dutchauction" },
  { name: "no-loss-lottery", title: "No Loss Lottery", category: "defi", appId: "miniapp-nolosslottery" },
  { name: "quantum-swap", title: "Quantum Swap", category: "defi", appId: "miniapp-quantumswap" },
  { name: "self-loan", title: "Self Loan", category: "defi", appId: "miniapp-selfloan" },
  { name: "ai-soulmate", title: "AI Soulmate", category: "social", appId: "miniapp-aisoulmate" },
  { name: "red-envelope", title: "Red Envelope", category: "social", appId: "miniapp-redenvelope" },
  { name: "dark-radio", title: "Dark Radio", category: "social", appId: "miniapp-darkradio" },
  { name: "dev-tipping", title: "Dev Tipping", category: "social", appId: "miniapp-devtipping" },
  { name: "bounty-hunter", title: "Bounty Hunter", category: "social", appId: "miniapp-bountyhunter" },
  { name: "breakup-contract", title: "Breakup Contract", category: "social", appId: "miniapp-breakupcontract" },
  { name: "ex-files", title: "Ex Files", category: "social", appId: "miniapp-exfiles" },
  { name: "geo-spotlight", title: "Geo Spotlight", category: "social", appId: "miniapp-geospotlight" },
  { name: "whisper-chain", title: "Whisper Chain", category: "social", appId: "miniapp-whisperchain" },
  { name: "canvas", title: "Canvas", category: "nft", appId: "miniapp-canvas" },
  { name: "nft-evolve", title: "NFT Evolve", category: "nft", appId: "miniapp-nftevolve" },
  { name: "nft-chimera", title: "NFT Chimera", category: "nft", appId: "miniapp-nftchimera" },
  { name: "schrodinger-nft", title: "Schrodinger NFT", category: "nft", appId: "miniapp-schrodingernft" },
  { name: "melting-asset", title: "Melting Asset", category: "nft", appId: "miniapp-meltingasset" },
  { name: "on-chain-tarot", title: "On-Chain Tarot", category: "nft", appId: "miniapp-onchaintarot" },
  { name: "time-capsule", title: "Time Capsule", category: "nft", appId: "miniapp-timecapsule" },
  { name: "heritage-trust", title: "Heritage Trust", category: "nft", appId: "miniapp-heritagetrust" },
  { name: "garden-of-neo", title: "Garden of Neo", category: "nft", appId: "miniapp-gardenofneo" },
  { name: "graveyard", title: "Graveyard", category: "nft", appId: "miniapp-graveyard" },
  { name: "parasite", title: "Parasite", category: "nft", appId: "miniapp-parasite" },
  { name: "pay-to-view", title: "Pay to View", category: "nft", appId: "miniapp-paytoview" },
  { name: "dead-switch", title: "Dead Switch", category: "nft", appId: "miniapp-deadswitch" },
  { name: "secret-vote", title: "Secret Vote", category: "governance", appId: "miniapp-secretvote" },
  { name: "gov-booster", title: "Gov Booster", category: "governance", appId: "miniapp-govbooster" },
  { name: "prediction-market", title: "Prediction Market", category: "governance", appId: "miniapp-predictionmarket" },
  { name: "burn-league", title: "Burn League", category: "governance", appId: "miniapp-burnleague" },
  { name: "doomsday-clock", title: "Doomsday Clock", category: "governance", appId: "miniapp-doomsdayclock" },
  { name: "masquerade-dao", title: "Masquerade DAO", category: "governance", appId: "miniapp-masqueradedao" },
  { name: "gov-merc", title: "Gov Merc", category: "governance", appId: "miniapp-govmerc" },
  { name: "price-ticker", title: "Price Ticker", category: "utility", appId: "miniapp-priceticker" },
  { name: "guardian-policy", title: "Guardian Policy", category: "utility", appId: "miniapp-guardianpolicy" },
  { name: "unbreakable-vault", title: "Unbreakable Vault", category: "utility", appId: "miniapp-unbreakablevault" },
  { name: "zk-badge", title: "ZK Badge", category: "utility", appId: "miniapp-zkbadge" },
];

module.exports = { APPS_DIR, APPS };

// Run if called directly
if (require.main === module) {
  const { generateAllApps } = require("./templates");
  generateAllApps(APPS_DIR, APPS);
}
