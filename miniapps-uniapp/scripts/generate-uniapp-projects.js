#!/usr/bin/env node
/**
 * Generate complete uni-app project structure for all MiniApps
 */
const fs = require("fs");
const path = require("path");

const APPS_DIR = path.join(__dirname, "../apps");
const SHARED_DIR = path.join(__dirname, "../shared");

// App metadata
const APPS = [
  {
    name: "lottery",
    title: "Neo Lottery",
    category: "gaming",
    desc: "Provably fair lottery draws",
    appId: "miniapp-lottery",
  },
  {
    name: "coin-flip",
    title: "Coin Flip",
    category: "gaming",
    desc: "Simple 50/50 betting game",
    appId: "miniapp-coinflip",
  },
  {
    name: "dice-game",
    title: "Dice Game",
    category: "gaming",
    desc: "Roll dice and win prizes",
    appId: "miniapp-dicegame",
  },
  {
    name: "scratch-card",
    title: "Scratch Card",
    category: "gaming",
    desc: "Instant win scratch cards",
    appId: "miniapp-scratchcard",
  },
  {
    name: "secret-poker",
    title: "Secret Poker",
    category: "gaming",
    desc: "Private poker with hidden cards",
    appId: "miniapp-secretpoker",
  },
  {
    name: "neo-crash",
    title: "Neo Crash",
    category: "gaming",
    desc: "Multiplier crash game",
    appId: "miniapp-neocrash",
  },
  {
    name: "candle-wars",
    title: "Candle Wars",
    category: "gaming",
    desc: "Predict price movements",
    appId: "miniapp-candlewars",
  },
  {
    name: "algo-battle",
    title: "Algo Battle",
    category: "gaming",
    desc: "Algorithm trading competition",
    appId: "miniapp-algobattle",
  },
  {
    name: "fog-chess",
    title: "Fog Chess",
    category: "gaming",
    desc: "Chess with fog of war",
    appId: "miniapp-fogchess",
  },
  {
    name: "fog-puzzle",
    title: "Fog Puzzle",
    category: "gaming",
    desc: "Hidden puzzle solving",
    appId: "miniapp-fogpuzzle",
  },
  {
    name: "crypto-riddle",
    title: "Crypto Riddle",
    category: "gaming",
    desc: "Solve riddles for rewards",
    appId: "miniapp-cryptoriddle",
  },
  {
    name: "world-piano",
    title: "World Piano",
    category: "gaming",
    desc: "Collaborative music creation",
    appId: "miniapp-worldpiano",
  },
  {
    name: "million-piece-map",
    title: "Million Piece Map",
    category: "gaming",
    desc: "Collaborative pixel art",
    appId: "miniapp-millionpiecemap",
  },
  {
    name: "puzzle-mining",
    title: "Puzzle Mining",
    category: "gaming",
    desc: "Mine by solving puzzles",
    appId: "miniapp-puzzlemining",
  },
  {
    name: "scream-to-earn",
    title: "Scream to Earn",
    category: "gaming",
    desc: "Voice-powered earnings",
    appId: "miniapp-screamtoearn",
  },
];

const DEFI_APPS = [
  {
    name: "flashloan",
    title: "Flash Loan",
    category: "defi",
    desc: "Instant uncollateralized loans",
    appId: "miniapp-flashloan",
  },
  {
    name: "ai-trader",
    title: "AI Trader",
    category: "defi",
    desc: "AI-powered trading signals",
    appId: "miniapp-aitrader",
  },
  { name: "grid-bot", title: "Grid Bot", category: "defi", desc: "Automated grid trading", appId: "miniapp-gridbot" },
  {
    name: "bridge-guardian",
    title: "Bridge Guardian",
    category: "defi",
    desc: "Cross-chain bridge monitor",
    appId: "miniapp-bridgeguardian",
  },
  {
    name: "gas-circle",
    title: "Gas Circle",
    category: "defi",
    desc: "GAS savings circles",
    appId: "miniapp-gascircle",
  },
  {
    name: "il-guard",
    title: "IL Guard",
    category: "defi",
    desc: "Impermanent loss protection",
    appId: "miniapp-ilguard",
  },
  {
    name: "compound-capsule",
    title: "Compound Capsule",
    category: "defi",
    desc: "Auto-compounding yields",
    appId: "miniapp-compoundcapsule",
  },
  { name: "dark-pool", title: "Dark Pool", category: "defi", desc: "Private large trades", appId: "miniapp-darkpool" },
  {
    name: "dutch-auction",
    title: "Dutch Auction",
    category: "defi",
    desc: "Descending price auctions",
    appId: "miniapp-dutchauction",
  },
  {
    name: "no-loss-lottery",
    title: "No Loss Lottery",
    category: "defi",
    desc: "Yield-based lottery",
    appId: "miniapp-nolosslottery",
  },
  {
    name: "quantum-swap",
    title: "Quantum Swap",
    category: "defi",
    desc: "MEV-resistant swaps",
    appId: "miniapp-quantumswap",
  },
  {
    name: "self-loan",
    title: "Self Loan",
    category: "defi",
    desc: "Self-collateralized loans",
    appId: "miniapp-selfloan",
  },
];

const ALL_APPS = [...APPS, ...DEFI_APPS];

module.exports = { APPS_DIR, SHARED_DIR, ALL_APPS };
