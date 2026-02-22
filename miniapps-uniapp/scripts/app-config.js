#!/usr/bin/env node
/**
 * Generate uni-app project template files for all MiniApps
 */
const path = require("path");

const APPS_DIR = path.join(__dirname, "../apps");

// All app definitions
const APPS = [
  { name: "lottery", title: "Neo Lottery", category: "gaming", appId: "miniapp-lottery" },
  { name: "coin-flip", title: "Coin Flip", category: "gaming", appId: "miniapp-coinflip" },
  { name: "million-piece-map", title: "Million Piece Map", category: "gaming", appId: "miniapp-millionpiecemap" },
  { name: "flashloan", title: "Flash Loan", category: "defi", appId: "miniapp-flashloan" },
  { name: "compound-capsule", title: "Compound Capsule", category: "defi", appId: "miniapp-compoundcapsule" },
  { name: "neo-swap", title: "Neo Swap", category: "defi", appId: "miniapp-neo-swap" },
  { name: "neoburger", title: "NeoBurger", category: "defi", appId: "miniapp-neoburger" },
  { name: "self-loan", title: "Self Loan", category: "defi", appId: "miniapp-selfloan" },
  { name: "red-envelope", title: "Red Envelope", category: "social", appId: "miniapp-redenvelope" },
  { name: "dev-tipping", title: "Dev Tipping", category: "social", appId: "miniapp-devtipping" },
  { name: "breakup-contract", title: "Breakup Contract", category: "social", appId: "miniapp-breakupcontract" },
  { name: "ex-files", title: "Ex Files", category: "social", appId: "miniapp-exfiles" },
  { name: "on-chain-tarot", title: "On-Chain Tarot", category: "nft", appId: "miniapp-onchaintarot" },
  { name: "time-capsule", title: "Time Capsule", category: "nft", appId: "miniapp-timecapsule" },
  { name: "heritage-trust", title: "Heritage Trust", category: "nft", appId: "miniapp-heritagetrust" },
  { name: "garden-of-neo", title: "Garden of Neo", category: "nft", appId: "miniapp-gardenofneo" },
  { name: "graveyard", title: "Graveyard", category: "nft", appId: "miniapp-graveyard" },
  { name: "prediction-market", title: "Prediction Market", category: "governance", appId: "miniapp-predictionmarket" },
  { name: "candidate-vote", title: "Candidate Vote", category: "governance", appId: "miniapp-candidate-vote" },
  { name: "burn-league", title: "Burn League", category: "governance", appId: "miniapp-burnleague" },
  { name: "doomsday-clock", title: "Doomsday Clock", category: "governance", appId: "miniapp-doomsdayclock" },
  { name: "masquerade-dao", title: "Masquerade DAO", category: "governance", appId: "miniapp-masqueradedao" },
  { name: "gov-merc", title: "Gov Merc", category: "governance", appId: "miniapp-govmerc" },
  { name: "explorer", title: "Neo Explorer", category: "tools", appId: "miniapp-explorer" },
  { name: "gas-sponsor", title: "Gas Sponsor", category: "utility", appId: "miniapp-gas-sponsor" },
  { name: "guardian-policy", title: "Guardian Policy", category: "utility", appId: "miniapp-guardianpolicy" },
  { name: "unbreakable-vault", title: "Unbreakable Vault", category: "utility", appId: "miniapp-unbreakablevault" },
];

module.exports = { APPS_DIR, APPS };

// Run if called directly
if (require.main === module) {
  const { generateAllApps } = require("./templates");
  generateAllApps(APPS_DIR, APPS);
}
