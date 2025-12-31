import type { MiniAppInfo } from "../components/types";

/**
 * Built-in MiniApp catalog - all 62 uni-app MiniApps
 *
 * Entry URL Migration:
 * - Legacy apps (60): Use `/miniapps/{app-name}/` format (served from static H5 builds)
 * - New apps (2): Use `mf://builtin?app={app-id}` format (module federation protocol)
 *
 * Migration Path:
 * - Both URL schemes are supported for backward compatibility
 * - New apps should use the `mf://` protocol for better performance and hot-reload support
 * - Legacy apps will be gradually migrated to the new protocol in future releases
 */

// Gaming Apps (15)
const GAMING_APPS: MiniAppInfo[] = [
  {
    app_id: "miniapp-lottery",
    name: "Neo Lottery",
    description:
      "Experience the thrill of provably fair lottery draws powered by VRF randomness. Buy tickets with GAS and compete for massive jackpots with 100% transparent on-chain verification.",
    icon: "🎰",
    category: "gaming",
    entry_url: "/miniapps/lottery",
    status: "active",
    permissions: { payments: true, randomness: true },
  },
  {
    app_id: "miniapp-coinflip",
    name: "Coin Flip",
    description:
      "Classic 50/50 betting reimagined on blockchain. Flip a coin, double your GAS instantly with cryptographically secure randomness ensuring fair outcomes every time.",
    icon: "🪙",
    category: "gaming",
    entry_url: "/miniapps/coin-flip",
    status: "active",
    permissions: { payments: true, randomness: true },
  },
  {
    app_id: "miniapp-dicegame",
    name: "Dice Game",
    description:
      "Roll the dice and test your luck! Choose your winning range, place your bet, and watch the VRF-powered dice determine your fate with verifiable fairness.",
    icon: "🎲",
    category: "gaming",
    entry_url: "/miniapps/dice-game",
    status: "active",
    permissions: { payments: true, randomness: true },
  },
  {
    app_id: "miniapp-scratchcard",
    name: "Scratch Card",
    description:
      "Instant gratification meets blockchain gaming. Scratch virtual cards to reveal prizes instantly, with every outcome cryptographically guaranteed and transparent.",
    icon: "🎫",
    category: "gaming",
    entry_url: "/miniapps/scratch-card",
    status: "active",
    permissions: { payments: true, randomness: true },
  },
  {
    app_id: "miniapp-secretpoker",
    name: "Secret Poker",
    description:
      "Play Texas Hold'em with true card privacy using zero-knowledge proofs. Your hand stays secret until showdown, eliminating cheating while preserving the poker experience.",
    icon: "🃏",
    category: "gaming",
    entry_url: "/miniapps/secret-poker",
    status: "active",
    permissions: { payments: true, randomness: true },
  },
  {
    app_id: "miniapp-neocrash",
    name: "Neo Crash",
    description:
      "Watch the multiplier climb and cash out before it crashes! This adrenaline-pumping game tests your nerve with real-time multipliers and instant payouts.",
    icon: "📈",
    category: "gaming",
    entry_url: "/miniapps/neo-crash",
    status: "active",
    permissions: { payments: true, randomness: true },
  },
  {
    app_id: "miniapp-candlewars",
    name: "Candle Wars",
    description:
      "Predict whether the next candle will be green or red using real-time price feeds. Compete against other traders in fast-paced 1-minute prediction rounds.",
    icon: "🕯️",
    category: "gaming",
    entry_url: "/miniapps/candle-wars",
    status: "active",
    permissions: { payments: true, datafeed: true },
  },
  {
    app_id: "miniapp-algobattle",
    name: "Algo Battle",
    description:
      "Deploy your trading algorithms and compete for supremacy! Write strategies, backtest against historical data, and battle other bots in live trading competitions.",
    icon: "🤖",
    category: "gaming",
    entry_url: "/miniapps/algo-battle",
    status: "active",
    permissions: { payments: true, datafeed: true },
  },
  {
    app_id: "miniapp-fogchess",
    name: "Fog Chess",
    description:
      "Strategic chess reimagined with fog of war mechanics. Only see pieces within your vision range, adding a thrilling layer of uncertainty to every move.",
    icon: "♟️",
    category: "gaming",
    entry_url: "/miniapps/fog-chess",
    status: "active",
    permissions: { payments: true, randomness: true },
  },
  {
    app_id: "miniapp-fogpuzzle",
    name: "Fog Puzzle",
    description:
      "Solve intricate puzzles shrouded in mystery. Reveal tiles strategically, race against time, and compete on global leaderboards for the fastest solutions.",
    icon: "🧩",
    category: "gaming",
    entry_url: "/miniapps/fog-puzzle",
    status: "active",
    permissions: { payments: true, randomness: true },
  },
  {
    app_id: "miniapp-cryptoriddle",
    name: "Crypto Riddle",
    description:
      "Crack cryptographic riddles and brain teasers to unlock GAS rewards. Daily challenges test your wit with puzzles ranging from ciphers to logic problems.",
    icon: "❓",
    category: "gaming",
    entry_url: "/miniapps/crypto-riddle",
    status: "active",
    permissions: { payments: true },
  },
  {
    app_id: "miniapp-worldpiano",
    name: "World Piano",
    description:
      "Join a global collaborative piano where every keystroke is recorded on-chain. Create music together with players worldwide in real-time jam sessions.",
    icon: "🎹",
    category: "gaming",
    entry_url: "/miniapps/world-piano",
    status: "active",
    permissions: { payments: true },
  },
  {
    app_id: "miniapp-millionpiecemap",
    name: "Million Piece Map",
    description:
      "Own and customize pixels on a massive collaborative canvas. Create art, advertise, or stake your claim on this permanent blockchain masterpiece.",
    icon: "🗺️",
    category: "gaming",
    entry_url: "/miniapps/million-piece-map",
    status: "active",
    permissions: { payments: true },
  },
  {
    app_id: "miniapp-puzzlemining",
    name: "Puzzle Mining",
    description:
      "Mine GAS by solving increasingly difficult puzzles. The faster you solve, the more you earn. Compete in mining pools or go solo for bigger rewards.",
    icon: "⛏️",
    category: "gaming",
    entry_url: "/miniapps/puzzle-mining",
    status: "active",
    permissions: { payments: true, randomness: true },
  },
  {
    app_id: "miniapp-screamtoearn",
    name: "Scream to Earn",
    description:
      "Use your voice to earn! Scream, sing, or make noise into your microphone. The louder and longer, the more GAS you mine in this unique audio-powered game.",
    icon: "🗣️",
    category: "gaming",
    entry_url: "/miniapps/scream-to-earn",
    status: "active",
    permissions: { payments: true },
  },
];

// DeFi Apps (13)
const DEFI_APPS: MiniAppInfo[] = [
  {
    app_id: "miniapp-neo-swap",
    name: "Neo Swap",
    description:
      "Swap NEO and GAS instantly via Flamingo DEX. Simple interface for quick token exchanges with real-time rates.",
    icon: "🔄",
    category: "defi",
    entry_url: "/miniapps/neo-swap",
    status: "active",
    permissions: { payments: true },
  },
  {
    app_id: "miniapp-flashloan",
    name: "Flash Loan",
    description:
      "Access instant uncollateralized loans that must be repaid within a single transaction. Perfect for arbitrage, liquidations, and complex DeFi strategies.",
    icon: "⚡",
    category: "defi",
    entry_url: "/miniapps/flashloan",
    status: "active",
    permissions: { payments: true },
  },
  {
    app_id: "miniapp-aitrader",
    name: "AI Trader",
    description:
      "Let artificial intelligence analyze markets and generate trading signals. Copy-trade AI strategies or use insights to inform your own decisions.",
    icon: "🤖",
    category: "defi",
    entry_url: "/miniapps/ai-trader",
    status: "active",
    permissions: { payments: true, datafeed: true },
  },
  {
    app_id: "miniapp-gridbot",
    name: "Grid Bot",
    description:
      "Deploy automated grid trading strategies that profit from market volatility. Set your range, grid levels, and let the bot trade 24/7 while you sleep.",
    icon: "📊",
    category: "defi",
    entry_url: "/miniapps/grid-bot",
    status: "active",
    permissions: { payments: true, datafeed: true },
  },
  {
    app_id: "miniapp-bridgeguardian",
    name: "Bridge Guardian",
    description:
      "Monitor cross-chain bridges in real-time with instant alerts. Track your bridged assets, detect anomalies, and protect against bridge exploits.",
    icon: "🌉",
    category: "defi",
    entry_url: "/miniapps/bridge-guardian",
    status: "active",
    permissions: { payments: true, datafeed: true },
  },
  {
    app_id: "miniapp-gascircle",
    name: "Gas Circle",
    description:
      "Join community savings circles where members pool GAS and take turns receiving the pot. Traditional ROSCA model meets blockchain transparency.",
    icon: "⭕",
    category: "defi",
    entry_url: "/miniapps/gas-circle",
    status: "active",
    permissions: { payments: true },
  },
  {
    app_id: "miniapp-ilguard",
    name: "IL Guard",
    description:
      "Protect your liquidity positions from impermanent loss with smart hedging strategies. Real-time IL tracking and automated protection triggers.",
    icon: "🛡️",
    category: "defi",
    entry_url: "/miniapps/il-guard",
    status: "active",
    permissions: { payments: true, datafeed: true },
  },
  {
    app_id: "miniapp-compoundcapsule",
    name: "Compound Capsule",
    description:
      "Maximize your yields with automatic compounding. Deposit once and watch your earnings grow exponentially as rewards are reinvested continuously.",
    icon: "💊",
    category: "defi",
    entry_url: "/miniapps/compound-capsule",
    status: "active",
    permissions: { payments: true },
  },
  {
    app_id: "miniapp-darkpool",
    name: "Dark Pool",
    description:
      "Execute large trades privately without moving markets. Your orders are matched off-chain and settled on-chain, protecting you from front-running.",
    icon: "🌑",
    category: "defi",
    entry_url: "/miniapps/dark-pool",
    status: "active",
    permissions: { payments: true },
  },
  {
    app_id: "miniapp-dutchauction",
    name: "Dutch Auction",
    description:
      "Participate in descending price auctions for fair token distribution. Price drops until demand meets supply, ensuring optimal price discovery.",
    icon: "🔨",
    category: "defi",
    entry_url: "/miniapps/dutch-auction",
    status: "active",
    permissions: { payments: true },
  },
  {
    app_id: "miniapp-nolosslottery",
    name: "No Loss Lottery",
    description:
      "Enter the lottery without risking your principal. Your deposited GAS earns yield, and the interest funds the prize pool. Everyone gets their deposit back!",
    icon: "🎯",
    category: "defi",
    entry_url: "/miniapps/no-loss-lottery",
    status: "active",
    permissions: { payments: true, randomness: true },
  },
  {
    app_id: "miniapp-quantumswap",
    name: "Quantum Swap",
    description:
      "Swap tokens with MEV protection using commit-reveal schemes. Your trades are shielded from sandwich attacks and front-running bots.",
    icon: "⚛️",
    category: "defi",
    entry_url: "/miniapps/quantum-swap",
    status: "active",
    permissions: { payments: true },
  },
  {
    app_id: "miniapp-selfloan",
    name: "Self Loan",
    description:
      "Borrow against your own collateral with zero liquidation risk. Lock your assets, borrow up to 50%, and repay on your own schedule.",
    icon: "🔄",
    category: "defi",
    entry_url: "/miniapps/self-loan",
    status: "active",
    permissions: { payments: true },
  },
  {
    app_id: "miniapp-neoburger",
    name: "NeoBurger",
    description:
      "Stake NEO to earn GAS rewards with liquid staking. Receive bNEO tokens representing your staked NEO, allowing you to earn staking rewards while maintaining liquidity for DeFi activities.",
    icon: "🍔",
    category: "defi",
    entry_url: "/miniapps/neoburger",
    status: "active",
    permissions: { payments: true },
  },
];

// Social Apps (9)
const SOCIAL_APPS: MiniAppInfo[] = [
  {
    app_id: "miniapp-aisoulmate",
    name: "AI Soulmate",
    description:
      "Your personalized AI companion that learns your personality and provides meaningful conversations. Build a unique relationship with an AI that truly understands you.",
    icon: "💕",
    category: "social",
    entry_url: "/miniapps/ai-soulmate",
    status: "active",
    permissions: { payments: true },
  },
  {
    app_id: "miniapp-redenvelope",
    name: "Red Envelope",
    description:
      "Share the joy of giving with digital red envelopes! Send lucky GAS gifts to friends and groups with randomized amounts, perfect for celebrations and holidays.",
    icon: "🧧",
    category: "social",
    entry_url: "/miniapps/red-envelope",
    status: "active",
    permissions: { payments: true, randomness: true },
  },
  {
    app_id: "miniapp-darkradio",
    name: "Dark Radio",
    description:
      "Broadcast anonymously to the world. Share thoughts, music, or messages without revealing your identity. Listeners can tip their favorite anonymous DJs.",
    icon: "📻",
    category: "social",
    entry_url: "/miniapps/dark-radio",
    status: "active",
    permissions: { payments: true },
  },
  {
    app_id: "miniapp-devtipping",
    name: "Dev Tipping",
    description:
      "Support open-source developers directly! Tip contributors for their work on GitHub repos, Stack Overflow answers, or any valuable code contribution.",
    icon: "💰",
    category: "social",
    entry_url: "/miniapps/dev-tipping",
    status: "active",
    permissions: { payments: true },
  },
  {
    app_id: "miniapp-bountyhunter",
    name: "Bounty Hunter",
    description:
      "Post and claim bug bounties with escrow protection. Developers earn rewards for finding vulnerabilities, while projects get security audits from the community.",
    icon: "🎯",
    category: "social",
    entry_url: "/miniapps/bounty-hunter",
    status: "active",
    permissions: { payments: true },
  },
  {
    app_id: "miniapp-breakupcontract",
    name: "Breakup Contract",
    description:
      "Create immutable relationship agreements on-chain. Define terms for shared assets, responsibilities, and exit conditions with smart contract enforcement.",
    icon: "💔",
    category: "social",
    entry_url: "/miniapps/breakup-contract",
    status: "active",
    permissions: { payments: true },
  },
  {
    app_id: "miniapp-exfiles",
    name: "Ex Files",
    description:
      "A secure vault for shared memories that both parties can access. Store photos, messages, and mementos from relationships with mutual consent controls.",
    icon: "📁",
    category: "social",
    entry_url: "/miniapps/ex-files",
    status: "active",
    permissions: { payments: true },
  },
  {
    app_id: "miniapp-geospotlight",
    name: "Geo Spotlight",
    description:
      "Discover and share location-based content. Leave digital notes, art, or messages at real-world locations for others to find and interact with.",
    icon: "📍",
    category: "social",
    entry_url: "/miniapps/geo-spotlight",
    status: "active",
    permissions: { payments: true },
  },
  {
    app_id: "miniapp-whisperchain",
    name: "Whisper Chain",
    description:
      "Send encrypted messages that self-destruct after reading. Perfect for sensitive communications with complete privacy and no permanent traces.",
    icon: "🤫",
    category: "social",
    entry_url: "/miniapps/whisper-chain",
    status: "active",
    permissions: { payments: true },
  },
];

// NFT Apps (13)
const NFT_APPS: MiniAppInfo[] = [
  {
    app_id: "miniapp-canvas",
    name: "Canvas",
    description:
      "Create collaborative NFT art with other artists in real-time. Each contribution is recorded on-chain, and the final piece is minted as a shared NFT.",
    icon: "🎨",
    category: "nft",
    entry_url: "/miniapps/canvas",
    status: "active",
    permissions: { payments: true },
  },
  {
    app_id: "miniapp-nftevolve",
    name: "NFT Evolve",
    description:
      "Watch your NFTs grow and evolve over time! Traits change based on interactions, time held, and random mutations. Rare evolutions unlock special abilities.",
    icon: "🦋",
    category: "nft",
    entry_url: "/miniapps/nft-evolve",
    status: "active",
    permissions: { payments: true, randomness: true },
  },
  {
    app_id: "miniapp-nftchimera",
    name: "NFT Chimera",
    description:
      "Combine two NFTs to create a unique hybrid! Merge traits, abilities, and aesthetics from different collections into one-of-a-kind chimera NFTs.",
    icon: "🐉",
    category: "nft",
    entry_url: "/miniapps/nft-chimera",
    status: "active",
    permissions: { payments: true },
  },
  {
    app_id: "miniapp-schrodingernft",
    name: "Schrodinger NFT",
    description:
      "Own NFTs in quantum superposition - their traits remain unknown until observed. Opening the box collapses the state into a random final form.",
    icon: "🐱",
    category: "nft",
    entry_url: "/miniapps/schrodinger-nft",
    status: "active",
    permissions: { payments: true, randomness: true },
  },
  {
    app_id: "miniapp-meltingasset",
    name: "Melting Asset",
    description:
      "NFTs that decay over time unless maintained. Watch the artwork slowly transform, or pay to preserve it. A commentary on digital permanence.",
    icon: "🧊",
    category: "nft",
    entry_url: "/miniapps/melting-asset",
    status: "active",
    permissions: { payments: true },
  },
  {
    app_id: "miniapp-onchaintarot",
    name: "On-Chain Tarot",
    description:
      "Receive mystical tarot readings powered by VRF randomness. Each reading is minted as a unique NFT capturing your fortune at that moment in time.",
    icon: "🔮",
    category: "nft",
    entry_url: "/miniapps/on-chain-tarot",
    status: "active",
    permissions: { payments: true, randomness: true },
  },
  {
    app_id: "miniapp-timecapsule",
    name: "Time Capsule",
    description:
      "Lock messages, media, or assets in blockchain time capsules that unlock at a future date. Create digital legacies, schedule surprises, or preserve memories for future generations.",
    icon: "⏳",
    category: "nft",
    entry_url: "/miniapps/time-capsule",
    status: "active",
    permissions: { payments: true },
  },
  {
    app_id: "miniapp-heritagetrust",
    name: "Heritage Trust",
    description:
      "Create smart inheritance plans that automatically transfer your digital assets to beneficiaries. Set conditions, add trustees, and ensure your crypto legacy passes on securely.",
    icon: "📜",
    category: "nft",
    entry_url: "/miniapps/heritage-trust",
    status: "active",
    permissions: { payments: true },
  },
  {
    app_id: "miniapp-gardenofneo",
    name: "Garden of Neo",
    description:
      "Cultivate your own virtual garden where plants grow based on your blockchain activity. Rare seeds, seasonal events, and cross-pollination create unique botanical NFTs.",
    icon: "🌱",
    category: "nft",
    entry_url: "/miniapps/garden-of-neo",
    status: "active",
    permissions: { payments: true },
  },
  {
    app_id: "miniapp-graveyard",
    name: "Graveyard",
    description:
      "Create permanent digital memorials for loved ones, pets, or even failed crypto projects. Mint tombstone NFTs with epitaphs, photos, and memories that live forever on-chain.",
    icon: "🪦",
    category: "nft",
    entry_url: "/miniapps/graveyard",
    status: "active",
    permissions: { payments: true },
  },
  {
    app_id: "miniapp-parasite",
    name: "Parasite",
    description:
      "Own NFTs that attach to and feed off other NFTs in your wallet. Watch your parasite grow stronger as it drains traits from host NFTs in this dark experimental collection.",
    icon: "🦠",
    category: "nft",
    entry_url: "/miniapps/parasite",
    status: "active",
    permissions: { payments: true },
  },
  {
    app_id: "miniapp-paytoview",
    name: "Pay to View",
    description:
      "Monetize exclusive content with pay-per-view NFTs. Creators set prices, viewers pay to unlock, and smart contracts handle revenue splits automatically.",
    icon: "👁️",
    category: "nft",
    entry_url: "/miniapps/pay-to-view",
    status: "active",
    permissions: { payments: true },
  },
  {
    app_id: "miniapp-deadswitch",
    name: "Dead Switch",
    description:
      "Set up a dead man's switch that triggers actions if you stop checking in. Release secrets, transfer assets, or send messages automatically when you go silent.",
    icon: "💀",
    category: "nft",
    entry_url: "/miniapps/dead-switch",
    status: "active",
    permissions: { payments: true },
  },
];

// Governance Apps (7)
const GOVERNANCE_APPS: MiniAppInfo[] = [
  {
    app_id: "miniapp-secretvote",
    name: "Secret Vote",
    description:
      "Cast votes privately using zero-knowledge proofs. Your vote counts but your choice stays hidden, enabling truly anonymous governance without compromising verifiability.",
    icon: "🗳️",
    category: "governance",
    entry_url: "/miniapps/secret-vote",
    status: "active",
    permissions: { governance: true },
  },
  {
    app_id: "miniapp-govbooster",
    name: "Gov Booster",
    description:
      "Amplify your governance power through staking and delegation. Lock tokens for boosted voting weight, delegate to trusted representatives, and maximize your protocol influence.",
    icon: "🚀",
    category: "governance",
    entry_url: "/miniapps/gov-booster",
    status: "active",
    permissions: { governance: true, payments: true },
  },
  {
    app_id: "miniapp-predictionmarket",
    name: "Prediction Market",
    description:
      "Bet on real-world outcomes from elections to sports to crypto prices. Create markets, provide liquidity, and profit from your predictions with oracle-verified results.",
    icon: "📊",
    category: "governance",
    entry_url: "/miniapps/prediction-market",
    status: "active",
    permissions: { payments: true, datafeed: true },
  },
  {
    app_id: "miniapp-burnleague",
    name: "Burn League",
    description:
      "Compete in token burning competitions where communities race to reduce supply. Climb leaderboards, earn burn badges, and prove your commitment to deflation.",
    icon: "🔥",
    category: "governance",
    entry_url: "/miniapps/burn-league",
    status: "active",
    permissions: { payments: true },
  },
  {
    app_id: "miniapp-doomsdayclock",
    name: "Doomsday Clock",
    description:
      "A community-controlled countdown that resets when people contribute. If it hits zero, locked funds redistribute. Keep the clock alive or watch it all burn.",
    icon: "⏰",
    category: "governance",
    entry_url: "/miniapps/doomsday-clock",
    status: "active",
    permissions: { payments: true },
  },
  {
    app_id: "miniapp-masqueradedao",
    name: "Masquerade DAO",
    description:
      "Participate in governance wearing a digital mask. Propose and vote anonymously while still proving membership, enabling honest discourse without social pressure.",
    icon: "🎭",
    category: "governance",
    entry_url: "/miniapps/masquerade-dao",
    status: "active",
    permissions: { governance: true },
  },
  {
    app_id: "miniapp-govmerc",
    name: "Gov Merc",
    description:
      "Hire governance mercenaries to vote on your behalf or sell your voting power to the highest bidder. A marketplace for delegation and influence in the DAO ecosystem.",
    icon: "⚔️",
    category: "governance",
    entry_url: "/miniapps/gov-merc",
    status: "active",
    permissions: { governance: true, payments: true },
  },
  {
    app_id: "miniapp-candidate-vote",
    name: "Candidate Vote",
    description:
      "Vote for platform candidates and earn GAS rewards. Participate in governance by staking your tokens and supporting your preferred candidates with transparent on-chain voting.",
    icon: "🗳️",
    category: "governance",
    entry_url: "/miniapps/candidate-vote",
    status: "active",
    permissions: { governance: true, payments: true },
  },
];

// Utility Apps (5)
const UTILITY_APPS: MiniAppInfo[] = [
  {
    app_id: "miniapp-explorer",
    name: "Neo Explorer",
    description:
      "Explore the Neo N3 blockchain with real-time stats for both Mainnet and Testnet. Search transactions, addresses, and contracts with detailed execution traces.",
    icon: "🔍",
    category: "utility",
    entry_url: "/miniapps/explorer",
    status: "active",
    permissions: { datafeed: true },
  },
  {
    app_id: "miniapp-priceticker",
    name: "Price Ticker",
    description:
      "Track real-time cryptocurrency prices with customizable watchlists and alerts. Get instant notifications when your targets hit, powered by decentralized oracle feeds.",
    icon: "💹",
    category: "utility",
    entry_url: "/miniapps/price-ticker",
    status: "active",
    permissions: { datafeed: true },
  },
  {
    app_id: "miniapp-guardianpolicy",
    name: "Guardian Policy",
    description:
      "Define and enforce smart contract policies for your wallet. Set spending limits, whitelist addresses, require multi-sig for large transfers, and protect your assets.",
    icon: "📋",
    category: "utility",
    entry_url: "/miniapps/guardian-policy",
    status: "active",
    permissions: { payments: true },
  },
  {
    app_id: "miniapp-unbreakablevault",
    name: "Unbreakable Vault",
    description:
      "Store your most valuable assets in a time-locked vault with multiple security layers. Social recovery, hardware key support, and customizable unlock conditions.",
    icon: "🔐",
    category: "utility",
    entry_url: "/miniapps/unbreakable-vault",
    status: "active",
    permissions: { payments: true },
  },
  {
    app_id: "miniapp-zkbadge",
    name: "ZK Badge",
    description:
      "Earn and display verifiable credentials without revealing personal data. Prove you're a whale, early adopter, or community member using zero-knowledge proofs.",
    icon: "🏅",
    category: "utility",
    entry_url: "/miniapps/zk-badge",
    status: "active",
    permissions: { payments: true },
  },
];

// Combined list of all apps
export const BUILTIN_APPS: MiniAppInfo[] = [
  ...GAMING_APPS,
  ...DEFI_APPS,
  ...SOCIAL_APPS,
  ...NFT_APPS,
  ...GOVERNANCE_APPS,
  ...UTILITY_APPS,
];

// Lookup map by app_id
export const BUILTIN_APPS_MAP: Record<string, MiniAppInfo> = Object.fromEntries(
  BUILTIN_APPS.map((app) => [app.app_id, app]),
);

// Find a built-in app by ID
export function getBuiltinApp(appId: string): MiniAppInfo | undefined {
  return BUILTIN_APPS_MAP[appId];
}

export { GAMING_APPS, DEFI_APPS, SOCIAL_APPS, NFT_APPS, GOVERNANCE_APPS, UTILITY_APPS };
