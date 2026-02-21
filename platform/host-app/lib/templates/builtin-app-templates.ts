import type { MiniAppDetailTemplate, OperationEntry, OperationParam } from "@/components/types";

type AppTemplate = { detail_template: MiniAppDetailTemplate; operations: OperationEntry[] };
type KV = { key: string; value: string };

// --- Param helpers ---
const amt = (name = "amount", label = "Amount (GAS)", ph = "1"): OperationParam =>
  ({ name, type: "amount", label, required: true, placeholder: ph });
const str = (name: string, label: string, ph = ""): OperationParam =>
  ({ name, type: "string", label, required: true, placeholder: ph });
const sel = (name: string, label: string, opts: string[]): OperationParam =>
  ({ name, type: "select", label, required: true, options: opts.map(o => ({ label: o, value: o.toLowerCase().replace(/\s+/g, "_") })) });
const int = (name: string, label: string, ph = ""): OperationParam =>
  ({ name, type: "integer", label, required: true, placeholder: ph });
const addr = (name: string, label: string): OperationParam =>
  ({ name, type: "address", label, required: true });
const hash = (name: string, label: string): OperationParam =>
  ({ name, type: "hash256", label, required: true });

// --- Operation helper ---
const op = (name: string, method: string, style: OperationEntry["button_style"] = "primary", params: OperationParam[] = []): OperationEntry =>
  ({ name, method, button_style: style, params });

// --- Category template factories ---

function gaming(notice: string, kvExtra: KV[], steps: string[], ops: OperationEntry[]): AppTemplate {
  return {
    detail_template: {
      layout: "default",
      tabs: [
        { id: "overview", label: "Overview", type: "content", blocks: [
          { type: "notice", tone: "info", content: notice },
          { type: "key_value", title: "Quick Facts", items: [{ key: "Category", value: "Gaming" }, { key: "Asset", value: "GAS" }, ...kvExtra] },
          { type: "bullet_list", title: "How To Play", items: steps },
        ]},
        { id: "leaderboard", label: "Leaderboard", type: "content" },
        { id: "reviews", label: "Reviews", type: "reviews" },
        { id: "news", label: "News", type: "news" },
      ],
      operation_panel: { title: "Play", subtitle: "Configure game parameters and start playing.", cta_label: "Launch Game", operations: [] },
    },
    operations: ops,
  };
}

function defi(notice: string, kvExtra: KV[], steps: string[], ops: OperationEntry[]): AppTemplate {
  return {
    detail_template: {
      layout: "default",
      tabs: [
        { id: "overview", label: "Overview", type: "content", blocks: [
          { type: "notice", tone: "info", content: notice },
          { type: "key_value", title: "Protocol Info", items: [{ key: "Category", value: "DeFi" }, { key: "Asset", value: "GAS" }, ...kvExtra] },
          { type: "bullet_list", title: "How It Works", items: steps },
        ]},
        { id: "positions", label: "Positions", type: "content" },
        { id: "reviews", label: "Reviews", type: "reviews" },
        { id: "activity", label: "Activity", type: "news" },
      ],
      operation_panel: { title: "Manage Position", subtitle: "Deposit, withdraw, or manage your position.", cta_label: "Open DeFi App", operations: [] },
    },
    operations: ops,
  };
}

function social(notice: string, kvExtra: KV[], steps: string[], ops: OperationEntry[]): AppTemplate {
  return {
    detail_template: {
      layout: "default",
      tabs: [
        { id: "overview", label: "Overview", type: "content", blocks: [
          { type: "notice", tone: "info", content: notice },
          { type: "key_value", title: "Quick Facts", items: [{ key: "Category", value: "Social" }, { key: "Asset", value: "GAS" }, ...kvExtra] },
          { type: "bullet_list", title: "How It Works", items: steps },
        ]},
        { id: "community", label: "Community", type: "forum" },
        { id: "reviews", label: "Reviews", type: "reviews" },
        { id: "news", label: "News", type: "news" },
      ],
      operation_panel: { title: "Actions", subtitle: "Interact with the community.", cta_label: "Launch App", operations: [] },
    },
    operations: ops,
  };
}

function nft(notice: string, kvExtra: KV[], steps: string[], ops: OperationEntry[]): AppTemplate {
  return {
    detail_template: {
      layout: "default",
      tabs: [
        { id: "overview", label: "Overview", type: "content", blocks: [
          { type: "notice", tone: "info", content: notice },
          { type: "key_value", title: "Collection Info", items: [{ key: "Category", value: "NFT" }, { key: "Asset", value: "GAS" }, ...kvExtra] },
          { type: "bullet_list", title: "How It Works", items: steps },
        ]},
        { id: "collection", label: "Collection", type: "content" },
        { id: "reviews", label: "Reviews", type: "reviews" },
        { id: "forum", label: "Forum", type: "forum" },
      ],
      operation_panel: { title: "NFT Actions", subtitle: "Mint, trade, or interact with NFTs.", cta_label: "Open Collection", operations: [] },
    },
    operations: ops,
  };
}

function governance(notice: string, kvExtra: KV[], steps: string[], ops: OperationEntry[]): AppTemplate {
  return {
    detail_template: {
      layout: "default",
      tabs: [
        { id: "overview", label: "Overview", type: "content", blocks: [
          { type: "notice", tone: "info", content: notice },
          { type: "key_value", title: "Governance Info", items: [{ key: "Category", value: "Governance" }, { key: "Asset", value: "BNEO" }, ...kvExtra] },
          { type: "bullet_list", title: "How To Participate", items: steps },
        ]},
        { id: "proposals", label: "Proposals", type: "content" },
        { id: "reviews", label: "Reviews", type: "reviews" },
        { id: "news", label: "News", type: "news" },
      ],
      operation_panel: { title: "Governance", subtitle: "Vote, propose, and participate.", cta_label: "Participate", operations: [] },
    },
    operations: ops,
  };
}

function utility(notice: string, kvExtra: KV[], steps: string[], ops: OperationEntry[]): AppTemplate {
  return {
    detail_template: {
      layout: "default",
      tabs: [
        { id: "overview", label: "Overview", type: "content", blocks: [
          { type: "notice", tone: "info", content: notice },
          { type: "key_value", title: "Tool Info", items: [{ key: "Category", value: "Utility" }, { key: "Asset", value: "GAS" }, ...kvExtra] },
          { type: "bullet_list", title: "How To Use", items: steps },
        ]},
        { id: "tools", label: "Tools", type: "content" },
        { id: "reviews", label: "Reviews", type: "reviews" },
        { id: "news", label: "News", type: "news" },
      ],
      operation_panel: { title: "Tools", subtitle: "Configure and use the tool.", cta_label: "Open Tool", operations: [] },
    },
    operations: ops,
  };
}

// =============================================================================
// Per-App Templates
// =============================================================================

// --- GAMING (15) ---

const T_LOTTERY = gaming(
  "Provably fair lottery draws powered by VRF randomness with 100% on-chain verification.",
  [{ key: "Randomness", value: "VRF" }],
  ["Buy one or more tickets with GAS.", "Wait for the on-chain draw powered by VRF.", "Winners are paid automatically to their wallet."],
  [op("Buy Ticket", "buyTicket", "primary", [amt("amount", "Ticket Price (GAS)", "5")]), op("Check Draw", "checkDraw", "secondary")],
);
const T_COINFLIP = gaming(
  "Classic 50/50 coin flip with cryptographically secure randomness.",
  [{ key: "Randomness", value: "VRF" }],
  ["Choose Heads or Tails.", "Set your wager amount.", "Flip and win double if correct."],
  [op("Flip", "flip", "primary", [sel("side", "Side", ["Heads", "Tails"]), amt("amount", "Wager (GAS)", "1")])],
);
const T_DICE = gaming(
  "Roll the dice and choose your winning range for variable payouts.",
  [{ key: "Randomness", value: "VRF" }],
  ["Set a target number (1-99).", "Place your bet in GAS.", "Roll — win if the result is under your target."],
  [op("Roll", "roll", "primary", [int("target", "Target (1-99)", "50"), amt("amount", "Bet (GAS)", "1")])],
);
const T_SCRATCHCARD = gaming(
  "Instant-win scratch cards with every outcome cryptographically guaranteed.",
  [{ key: "Randomness", value: "VRF" }],
  ["Purchase a scratch card with GAS.", "Scratch to reveal your prize.", "Winnings are credited instantly."],
  [op("Buy Card", "buyCard", "primary", [amt("amount", "Card Price (GAS)", "2")])],
);
const T_SECRETPOKER = gaming(
  "Texas Hold'em with true card privacy using zero-knowledge proofs.",
  [{ key: "Randomness", value: "VRF" }, { key: "Privacy", value: "ZK Proofs" }],
  ["Join a table with a buy-in.", "Play hands — cards stay secret until showdown.", "Win the pot and withdraw anytime."],
  [op("Join Table", "joinTable", "primary", [amt("amount", "Buy-in (GAS)", "10")]), op("Place Bet", "placeBet", "secondary", [amt("amount", "Bet (GAS)", "1")])],
);
const T_NEOCRASH = gaming(
  "Watch the multiplier climb and cash out before it crashes.",
  [{ key: "Randomness", value: "VRF" }],
  ["Place your bet before the round starts.", "Watch the multiplier increase in real-time.", "Cash out before the crash to lock in your winnings."],
  [op("Place Bet", "placeBet", "primary", [amt("amount", "Bet (GAS)", "1")]), op("Cash Out", "cashOut", "success")],
);
const T_CANDLEWARS = gaming(
  "Predict whether the next price candle will be green or red.",
  [{ key: "Data Feed", value: "Real-time Oracle" }],
  ["Choose Green (up) or Red (down).", "Set your stake amount.", "Win if the next 1-minute candle matches your prediction."],
  [op("Predict", "predict", "primary", [sel("direction", "Direction", ["Green", "Red"]), amt("amount", "Stake (GAS)", "1")])],
);
const T_ALGOBATTLE = gaming(
  "Deploy trading algorithms and compete against other bots in live competitions.",
  [{ key: "Data Feed", value: "Real-time Oracle" }],
  ["Write and deploy your trading strategy.", "Compete in timed battle rounds.", "Top performers earn GAS rewards."],
  [op("Deploy Strategy", "deployStrategy", "primary", [str("strategy_name", "Strategy Name", "my-strategy")]), op("Withdraw", "withdraw", "secondary")],
);
const T_FOGCHESS = gaming(
  "Strategic chess with fog of war — only see pieces within your vision range.",
  [{ key: "Randomness", value: "VRF" }],
  ["Start a game with a wager.", "Move pieces — fog hides opponent positions.", "Checkmate to win the pot."],
  [op("Start Game", "startGame", "primary", [amt("amount", "Wager (GAS)", "5")]), op("Claim Reward", "claimReward", "success")],
);
const T_FOGPUZZLE = gaming(
  "Solve puzzles shrouded in fog — reveal tiles strategically and race the clock.",
  [{ key: "Randomness", value: "VRF" }],
  ["Start a puzzle with an entry fee.", "Reveal tiles and solve the puzzle.", "Submit your solution to claim rewards."],
  [op("Start Puzzle", "startPuzzle", "primary", [amt("amount", "Entry (GAS)", "1")]), op("Submit Solution", "submitSolution", "success", [str("solution", "Solution")])],
);
const T_CRYPTORIDDLE = gaming(
  "Crack cryptographic riddles and brain teasers to unlock GAS rewards.",
  [],
  ["Read the daily riddle challenge.", "Submit your answer with a stake.", "Correct answers earn the reward pool."],
  [op("Submit Answer", "submitAnswer", "primary", [str("answer", "Your Answer"), amt("amount", "Stake (GAS)", "1")])],
);
const T_WORLDPIANO = gaming(
  "Collaborative piano where every keystroke is recorded on-chain.",
  [],
  ["Play notes on the shared piano.", "Record a session of your performance.", "Mint your recording as an on-chain NFT."],
  [op("Record Session", "recordSession", "primary"), op("Mint Recording", "mintRecording", "success", [amt("amount", "Mint Fee (GAS)", "1")])],
);
const T_MILLIONPIECEMAP = gaming(
  "Own and customize pixels on a massive collaborative blockchain canvas.",
  [],
  ["Choose coordinates on the map.", "Pick a color and claim the pixel.", "Your pixel is permanently recorded on-chain."],
  [op("Claim Pixel", "claimPixel", "primary", [int("x", "X Coordinate", "0"), int("y", "Y Coordinate", "0"), str("color", "Color Hex", "#00e599"), amt("amount", "Price (GAS)", "0.1")])],
);
const T_PUZZLEMINING = gaming(
  "Mine GAS by solving increasingly difficult puzzles — faster solutions earn more.",
  [{ key: "Randomness", value: "VRF" }],
  ["Start a mining session with a deposit.", "Solve puzzles as fast as you can.", "Claim accumulated GAS rewards."],
  [op("Start Mining", "startMining", "primary", [amt("amount", "Deposit (GAS)", "1")]), op("Claim Reward", "claimReward", "success")],
);
const T_SCREAMTOEARN = gaming(
  "Use your voice to earn — the louder and longer you scream, the more GAS you mine.",
  [],
  ["Allow microphone access.", "Scream into your device.", "Submit your recording to claim rewards."],
  [op("Submit Recording", "submitRecording", "primary"), op("Claim Reward", "claimReward", "success")],
);

// --- DEFI (13) ---

const T_NEO_SWAP = defi(
  "Swap NEO ecosystem tokens instantly via Flamingo DEX with real-time rates.",
  [{ key: "DEX", value: "Flamingo" }],
  ["Select the token pair to swap.", "Enter the amount and review the rate.", "Confirm the swap transaction."],
  [op("Swap", "swap", "primary", [str("from_token", "From Token", "NEO"), str("to_token", "To Token", "GAS"), amt("amount", "Amount", "10")])],
);
const T_FLASHLOAN = defi(
  "Instant uncollateralized loans repaid within a single transaction.",
  [{ key: "Type", value: "Flash Loan" }],
  ["Specify the loan amount.", "Provide a callback contract for the strategy.", "Loan is executed and repaid atomically."],
  [op("Execute Loan", "executeLoan", "primary", [amt("amount", "Loan Amount (GAS)", "100"), addr("callback_contract", "Callback Contract")])],
);
const T_AITRADER = defi(
  "AI-powered trading signals and copy-trade strategies.",
  [{ key: "Data Feed", value: "Oracle" }],
  ["Browse available AI strategies.", "Copy-trade with your chosen amount.", "Monitor performance and withdraw anytime."],
  [op("Copy Trade", "copyTrade", "primary", [str("strategy_id", "Strategy ID"), amt("amount", "Amount (GAS)", "10")]), op("Stop Strategy", "stopStrategy", "danger", [str("strategy_id", "Strategy ID")])],
);
const T_GRIDBOT = defi(
  "Automated grid trading that profits from market volatility 24/7.",
  [{ key: "Data Feed", value: "Oracle" }],
  ["Set price range and number of grid levels.", "Deposit GAS to fund the bot.", "Bot trades automatically within your range."],
  [op("Create Grid", "createGrid", "primary", [str("lower_price", "Lower Price"), str("upper_price", "Upper Price"), int("grids", "Grid Levels", "10"), amt("amount", "Deposit (GAS)", "50")]), op("Stop Grid", "stopGrid", "danger")],
);
const T_BRIDGEGUARDIAN = defi(
  "Monitor cross-chain bridges in real-time with instant anomaly alerts.",
  [{ key: "Data Feed", value: "Oracle" }],
  ["Select a bridge to monitor.", "Set alert thresholds for anomalies.", "Receive notifications on suspicious activity."],
  [op("Monitor", "monitor", "primary", [str("bridge_id", "Bridge ID")]), op("Set Alert", "setAlert", "secondary", [amt("threshold", "Threshold (GAS)", "1000")])],
);
const T_GASCIRCLE = defi(
  "Community savings circles — members pool GAS and take turns receiving the pot.",
  [{ key: "Type", value: "ROSCA" }],
  ["Join or create a savings circle.", "Contribute your share each round.", "Receive the full pot on your turn."],
  [op("Join Circle", "joinCircle", "primary", [str("circle_id", "Circle ID"), amt("amount", "Contribution (GAS)", "10")]), op("Contribute", "contribute", "secondary", [amt("amount", "Amount (GAS)", "10")])],
);
const T_ILGUARD = defi(
  "Protect liquidity positions from impermanent loss with smart hedging.",
  [{ key: "Data Feed", value: "Oracle" }],
  ["Select your liquidity pool position.", "Set hedge parameters and deposit.", "IL Guard automatically rebalances your hedge."],
  [op("Hedge", "hedge", "primary", [str("pool_id", "Pool ID"), amt("amount", "Hedge Amount (GAS)", "10")]), op("Withdraw", "withdraw", "secondary", [amt("amount", "Amount (GAS)")])],
);
const T_COMPOUNDCAPSULE = defi(
  "Maximize yields with automatic compounding — deposit once, grow exponentially.",
  [{ key: "Type", value: "Auto-Compound" }],
  ["Deposit GAS into a capsule.", "Rewards are auto-compounded continuously.", "Withdraw your principal plus earnings anytime."],
  [op("Deposit", "deposit", "primary", [amt("amount", "Deposit (GAS)", "10")]), op("Withdraw", "withdraw", "secondary", [amt("amount", "Amount (GAS)")])],
);
const T_DARKPOOL = defi(
  "Execute large trades privately — orders matched off-chain, settled on-chain.",
  [{ key: "Privacy", value: "Off-chain Matching" }],
  ["Place a buy or sell order with price and amount.", "Orders are matched privately off-chain.", "Settlement happens transparently on-chain."],
  [op("Place Order", "placeOrder", "primary", [sel("side", "Side", ["Buy", "Sell"]), amt("amount", "Amount (GAS)", "100"), str("price", "Price")])],
);
const T_DUTCHAUCTION = defi(
  "Descending price auctions for fair token distribution and optimal price discovery.",
  [{ key: "Type", value: "Dutch Auction" }],
  ["View the current descending price.", "Place a bid when the price is right.", "Tokens are distributed at the clearing price."],
  [op("Place Bid", "placeBid", "primary", [amt("amount", "Bid Amount (GAS)", "10")])],
);
const T_NOLOSSLOTTERY = defi(
  "Enter the lottery without risking your principal — interest funds the prize pool.",
  [{ key: "Randomness", value: "VRF" }],
  ["Deposit GAS into the lottery pool.", "Your deposit earns yield; interest funds prizes.", "Withdraw your full deposit anytime."],
  [op("Deposit", "deposit", "primary", [amt("amount", "Deposit (GAS)", "10")]), op("Withdraw", "withdraw", "secondary", [amt("amount", "Amount (GAS)")])],
);
const T_QUANTUMSWAP = defi(
  "MEV-protected swaps using commit-reveal to shield from sandwich attacks.",
  [{ key: "Privacy", value: "Commit-Reveal" }],
  ["Commit your swap with an encrypted order.", "Wait for the commit period to end.", "Reveal and execute at the fair price."],
  [op("Commit Swap", "commitSwap", "primary", [amt("amount", "Amount (GAS)", "10"), str("min_received", "Min Received")]), op("Reveal Swap", "revealSwap", "success", [hash("commit_hash", "Commit Hash")])],
);
const T_SELFLOAN = defi(
  "Borrow against your own collateral with zero liquidation risk.",
  [{ key: "Type", value: "Self-Collateralized" }],
  ["Lock collateral in the contract.", "Borrow up to 50% of your collateral value.", "Repay on your own schedule to unlock."],
  [op("Borrow", "borrow", "primary", [amt("collateral", "Collateral (GAS)", "20"), amt("borrow_amount", "Borrow (GAS)", "10")]), op("Repay", "repay", "secondary", [amt("amount", "Repay Amount (GAS)")])],
);
const T_NEOBURGER = defi(
  "Liquid staking — stake NEO, receive bNEO, earn GAS rewards while staying liquid.",
  [{ key: "Type", value: "Liquid Staking" }],
  ["Stake NEO to receive bNEO tokens.", "Use bNEO in DeFi while earning staking rewards.", "Unstake anytime to get your NEO back."],
  [op("Stake", "stake", "primary", [amt("amount", "NEO Amount", "10")]), op("Unstake", "unstake", "secondary", [amt("amount", "bNEO Amount", "10")])],
);

// --- SOCIAL (9) ---

const T_AISOULMATE = social(
  "AI companion that learns your personality and provides meaningful conversations.",
  [{ key: "Type", value: "AI Chat" }],
  ["Start a conversation with your AI companion.", "The AI learns and adapts to your personality.", "Tip your companion to unlock premium interactions."],
  [op("Start Chat", "startChat", "primary"), op("Tip Companion", "tipCompanion", "secondary", [amt("amount", "Tip (GAS)", "1")])],
);
const T_REDENVELOPE = social(
  "Send lucky GAS gifts in digital red envelopes with randomized amounts.",
  [{ key: "Randomness", value: "VRF" }],
  ["Create a red envelope with GAS and set recipient count.", "Share the envelope link with friends.", "Recipients claim random portions of the total."],
  [op("Create Envelope", "createEnvelope", "primary", [amt("amount", "Total (GAS)", "10"), int("recipients", "Recipients", "5")]), op("Claim", "claimEnvelope", "success", [str("envelope_id", "Envelope ID")])],
);
const T_DARKRADIO = social(
  "Broadcast anonymously — share thoughts or music without revealing your identity.",
  [],
  ["Start an anonymous broadcast with a title.", "Listeners tune in and interact.", "Earn tips from your audience."],
  [op("Start Broadcast", "startBroadcast", "primary", [str("title", "Broadcast Title")]), op("Tip DJ", "tipDJ", "secondary", [amt("amount", "Tip (GAS)", "1")])],
);
const T_DEVTIPPING = social(
  "Support open-source developers directly with GAS tips for their contributions.",
  [],
  ["Find a developer by their wallet address.", "Set the tip amount.", "GAS is sent directly to the developer."],
  [op("Tip Developer", "tip", "primary", [addr("developer", "Developer Address"), amt("amount", "Tip (GAS)", "5")])],
);
const T_BOUNTYHUNTER = social(
  "Post and claim bug bounties with smart contract escrow protection.",
  [{ key: "Type", value: "Bug Bounty" }],
  ["Post a bounty with a title and reward.", "Developers submit fixes and claim bounties.", "Escrow releases funds upon verification."],
  [op("Post Bounty", "postBounty", "primary", [str("title", "Bounty Title"), amt("amount", "Reward (GAS)", "50")]), op("Claim Bounty", "claimBounty", "success", [str("bounty_id", "Bounty ID")])],
);
const T_BREAKUPCONTRACT = social(
  "Create immutable relationship agreements with smart contract enforcement.",
  [],
  ["Define terms and conditions with your partner.", "Both parties sign the on-chain contract.", "Smart contract enforces exit conditions automatically."],
  [op("Create Contract", "createContract", "primary", [addr("partner", "Partner Address"), str("terms", "Terms"), amt("amount", "Deposit (GAS)", "10")])],
);
const T_EXFILES = social(
  "Secure vault for shared memories with mutual consent access controls.",
  [],
  ["Upload a file hash to the shared vault.", "Grant access to your partner.", "Both parties must consent to view contents."],
  [op("Upload File", "uploadFile", "primary", [hash("file_hash", "File Hash")]), op("Grant Access", "grantAccess", "secondary", [addr("partner", "Partner Address")])],
);
const T_GEOSPOTLIGHT = social(
  "Leave digital notes and art at real-world locations for others to discover.",
  [],
  ["Post a message tied to your current location.", "Others discover your spotlight when nearby.", "Earn tips from people who enjoy your content."],
  [op("Post Spotlight", "postSpotlight", "primary", [str("message", "Message"), amt("amount", "Stake (GAS)", "1")]), op("Discover", "discover", "secondary")],
);
const T_WHISPERCHAIN = social(
  "Encrypted self-destructing messages for completely private communication.",
  [{ key: "Privacy", value: "End-to-End Encrypted" }],
  ["Compose an encrypted message.", "Send to a recipient's wallet address.", "Message self-destructs after reading."],
  [op("Send Message", "sendMessage", "primary", [addr("recipient", "Recipient"), str("message", "Message"), amt("amount", "Fee (GAS)", "0.1")])],
);

// --- NFT (13) ---

const T_CANVAS = nft(
  "Collaborative NFT art — each contribution is recorded on-chain.",
  [{ key: "Type", value: "Collaborative Art" }],
  ["Join a canvas and contribute your artwork.", "Each stroke is permanently recorded.", "Mint the final piece as a shared NFT."],
  [op("Contribute", "contribute", "primary", [str("canvas_id", "Canvas ID")]), op("Mint Canvas", "mintCanvas", "success", [amt("amount", "Mint Fee (GAS)", "5")])],
);
const T_NFTEVOLVE = nft(
  "NFTs that grow and evolve over time based on interactions and random mutations.",
  [{ key: "Randomness", value: "VRF" }],
  ["Feed your NFT to increase its experience.", "Trigger evolution when ready.", "Rare mutations unlock special traits."],
  [op("Feed", "feed", "primary", [str("token_id", "Token ID"), amt("amount", "Feed Cost (GAS)", "1")]), op("Evolve", "evolve", "success", [str("token_id", "Token ID")])],
);
const T_NFTCHIMERA = nft(
  "Combine two NFTs to create a unique hybrid with merged traits.",
  [],
  ["Select two NFTs from your collection.", "Pay the merge fee.", "Receive a one-of-a-kind chimera NFT."],
  [op("Merge", "merge", "primary", [str("token_a", "Token A ID"), str("token_b", "Token B ID"), amt("amount", "Merge Fee (GAS)", "5")])],
);
const T_SCHRODINGERNFT = nft(
  "NFTs in quantum superposition — traits unknown until observed.",
  [{ key: "Randomness", value: "VRF" }],
  ["Mint a mystery NFT in superposition.", "Observe to collapse into a random final form.", "Rarer outcomes have higher value."],
  [op("Mint", "mint", "primary", [amt("amount", "Mint Price (GAS)", "5")]), op("Observe", "observe", "success", [str("token_id", "Token ID")])],
);
const T_MELTINGASSET = nft(
  "NFTs that decay over time unless maintained — a commentary on digital permanence.",
  [],
  ["Mint a melting NFT artwork.", "Watch it slowly transform over time.", "Pay to preserve its current state."],
  [op("Mint", "mint", "primary", [amt("amount", "Mint Price (GAS)", "3")]), op("Preserve", "preserve", "secondary", [str("token_id", "Token ID"), amt("amount", "Preservation Fee (GAS)", "1")])],
);
const T_ONCHAINTAROT = nft(
  "Mystical tarot readings powered by VRF — each reading minted as a unique NFT.",
  [{ key: "Randomness", value: "VRF" }],
  ["Request a tarot reading.", "VRF selects your cards.", "Your reading is minted as a permanent NFT."],
  [op("Draw Reading", "drawReading", "primary", [amt("amount", "Reading Fee (GAS)", "2")])],
);
const T_TIMECAPSULE = nft(
  "Lock messages and assets in blockchain time capsules that unlock at a future date.",
  [],
  ["Create a capsule with a message and unlock date.", "Lock GAS or assets inside.", "Capsule opens automatically at the set time."],
  [op("Create Capsule", "createCapsule", "primary", [str("unlock_date", "Unlock Date (YYYY-MM-DD)"), str("message", "Message"), amt("amount", "Deposit (GAS)", "5")]), op("Open Capsule", "openCapsule", "success", [str("capsule_id", "Capsule ID")])],
);
const T_HERITAGETRUST = nft(
  "Smart inheritance plans that automatically transfer digital assets to beneficiaries.",
  [],
  ["Create a trust with beneficiary addresses.", "Deposit assets into the trust.", "Assets transfer automatically per your conditions."],
  [op("Create Trust", "createTrust", "primary", [addr("beneficiary", "Beneficiary Address"), amt("amount", "Deposit (GAS)", "100")]), op("Add Beneficiary", "addBeneficiary", "secondary", [str("trust_id", "Trust ID"), addr("beneficiary", "Beneficiary Address")])],
);
const T_GARDENOFNEO = nft(
  "Virtual garden where plants grow based on your blockchain activity.",
  [{ key: "Type", value: "Virtual Garden" }],
  ["Plant a seed in your garden plot.", "Your plants grow with your on-chain activity.", "Harvest mature plants as botanical NFTs."],
  [op("Plant Seed", "plantSeed", "primary", [sel("seed_type", "Seed Type", ["Common", "Rare", "Legendary"]), amt("amount", "Seed Cost (GAS)", "1")]), op("Harvest", "harvest", "success", [str("plot_id", "Plot ID")])],
);
const T_GRAVEYARD = nft(
  "Permanent digital memorials minted as tombstone NFTs on-chain.",
  [],
  ["Create a memorial with name and epitaph.", "Mint it as a permanent tombstone NFT.", "Visit and leave tributes anytime."],
  [op("Create Memorial", "createMemorial", "primary", [str("name", "Name"), str("epitaph", "Epitaph"), amt("amount", "Mint Fee (GAS)", "2")])],
);
const T_PARASITE = nft(
  "NFTs that attach to and feed off other NFTs in your wallet.",
  [],
  ["Attach a parasite to a host NFT.", "Feed it to make it grow stronger.", "Watch it drain traits from the host."],
  [op("Attach", "attach", "primary", [str("host_token", "Host Token ID"), str("parasite_token", "Parasite Token ID")]), op("Feed", "feed", "secondary", [str("token_id", "Token ID"), amt("amount", "Feed Cost (GAS)", "1")])],
);
const T_PAYTOVIEW = nft(
  "Monetize exclusive content with pay-per-view NFTs and automatic revenue splits.",
  [],
  ["Publish content with a set price.", "Viewers pay to unlock access.", "Revenue is split automatically via smart contract."],
  [op("Publish", "publish", "primary", [hash("content_hash", "Content Hash"), amt("price", "Price (GAS)", "1")]), op("Unlock", "unlock", "success", [str("content_id", "Content ID"), amt("amount", "Price (GAS)", "1")])],
);
const T_DEADSWITCH = nft(
  "Dead man's switch — triggers actions automatically if you stop checking in.",
  [],
  ["Create a switch with a check-in interval.", "Define the action to trigger on timeout.", "Check in regularly to keep the switch alive."],
  [op("Create Switch", "createSwitch", "primary", [int("interval_days", "Check-in Interval (days)", "30"), str("action", "Trigger Action"), amt("amount", "Deposit (GAS)", "10")]), op("Check In", "checkIn", "success")],
);

// --- GOVERNANCE (6, skip predictionmarket) ---

const T_SECRETVOTE = governance(
  "Cast votes privately using zero-knowledge proofs for truly anonymous governance.",
  [{ key: "Privacy", value: "ZK Proofs" }],
  ["Select a proposal to vote on.", "Choose your vote — it stays hidden via ZK proof.", "Results are tallied without revealing individual votes."],
  [op("Cast Vote", "castVote", "primary", [str("proposal_id", "Proposal ID"), sel("vote", "Vote", ["For", "Against", "Abstain"])])],
);
const T_GOVBOOSTER = governance(
  "Amplify governance power through staking and delegation for boosted voting weight.",
  [],
  ["Stake tokens to boost your voting power.", "Delegate to trusted representatives if desired.", "Vote with amplified weight on proposals."],
  [op("Stake", "stake", "primary", [amt("amount", "Stake (GAS)", "10")]), op("Delegate", "delegate", "secondary", [addr("delegate", "Delegate Address"), amt("amount", "Amount")])],
);
const T_BURNLEAGUE = governance(
  "Compete in token burning competitions — climb leaderboards and earn burn badges.",
  [],
  ["Choose an amount of tokens to burn.", "Burn transaction is recorded on the leaderboard.", "Earn badges for reaching burn milestones."],
  [op("Burn", "burn", "danger", [amt("amount", "Burn Amount (GAS)", "1")]), op("Claim Badge", "claimBadge", "success")],
);
const T_DOOMSDAYCLOCK = governance(
  "Community countdown that resets when people contribute — if it hits zero, funds redistribute.",
  [],
  ["View the current countdown timer.", "Contribute GAS to reset the clock.", "If the clock hits zero, locked funds are redistributed."],
  [op("Contribute", "contribute", "primary", [amt("amount", "Contribution (GAS)", "1")]), op("Check Timer", "checkTimer", "secondary")],
);
const T_MASQUERADEDAO = governance(
  "Anonymous governance — propose and vote while wearing a digital mask.",
  [{ key: "Privacy", value: "Anonymous" }],
  ["Submit a proposal anonymously.", "Vote on proposals without revealing identity.", "Membership is proven via ZK without exposing who you are."],
  [op("Propose", "propose", "primary", [str("title", "Proposal Title"), str("description", "Description")]), op("Vote", "vote", "secondary", [str("proposal_id", "Proposal ID"), sel("vote", "Vote", ["For", "Against"])])],
);
const T_GOVMERC = governance(
  "Marketplace for governance delegation — hire mercenaries or sell your voting power.",
  [],
  ["List your voting power for sale.", "Or hire a mercenary to vote on your behalf.", "Payments are escrowed until votes are cast."],
  [op("List Votes", "listVotes", "primary", [amt("price", "Price (GAS)", "5")]), op("Hire", "hire", "success", [str("merc_id", "Mercenary ID"), amt("amount", "Payment (GAS)", "5")])],
);
const T_CANDIDATEVOTE = governance(
  "Vote for platform candidates and earn GAS rewards through transparent on-chain voting.",
  [],
  ["Browse candidates and their platforms.", "Stake tokens and cast your vote.", "Earn rewards for participating in governance."],
  [op("Vote", "vote", "primary", [str("candidate_id", "Candidate ID"), amt("amount", "Stake (GAS)", "10")]), op("Stake", "stake", "secondary", [amt("amount", "Amount (GAS)", "10")])],
);

// --- UTILITY (5) ---

const T_EXPLORER = utility(
  "Explore the Neo N3 blockchain with real-time stats, transaction search, and execution traces.",
  [{ key: "Networks", value: "Mainnet / Testnet" }],
  ["Enter a transaction hash, address, or contract hash.", "View detailed execution traces and events.", "Switch between Mainnet and Testnet."],
  [op("Search", "search", "primary", [str("query", "TX Hash / Address / Contract")])],
);
const T_PRICETICKER = utility(
  "Track real-time cryptocurrency prices with customizable watchlists and alerts.",
  [{ key: "Data Feed", value: "Oracle" }],
  ["Add tokens to your watchlist.", "Set price alerts for target levels.", "Receive notifications when targets hit."],
  [op("Add to Watchlist", "addWatchlist", "primary", [str("token", "Token Symbol", "NEO")]), op("Set Alert", "setAlert", "secondary", [str("token", "Token"), str("price", "Target Price")])],
);
const T_GUARDIANPOLICY = utility(
  "Define and enforce smart contract policies — spending limits, whitelists, and multi-sig.",
  [],
  ["Create a policy with your desired rules.", "Attach the policy to your wallet.", "Transactions are enforced automatically."],
  [op("Create Policy", "createPolicy", "primary", [sel("policy_type", "Policy Type", ["Spending Limit", "Whitelist", "Multi-sig"]), str("params", "Parameters (JSON)")]), op("Update Policy", "updatePolicy", "secondary", [str("policy_id", "Policy ID"), str("params", "New Parameters")])],
);
const T_UNBREAKABLEVAULT = utility(
  "Time-locked vault with social recovery, hardware key support, and custom unlock conditions.",
  [{ key: "Security", value: "Multi-layer" }],
  ["Deposit assets into the vault.", "Set time-lock and unlock conditions.", "Withdraw when conditions are met."],
  [op("Deposit", "deposit", "primary", [amt("amount", "Amount (GAS)", "10")]), op("Withdraw", "withdraw", "secondary", [amt("amount", "Amount (GAS)")]), op("Set Conditions", "setConditions", "secondary", [str("conditions", "Conditions (JSON)")])],
);
const T_ZKBADGE = utility(
  "Earn verifiable credentials without revealing personal data using zero-knowledge proofs.",
  [{ key: "Privacy", value: "ZK Proofs" }],
  ["Select a badge type to claim.", "ZK proof verifies your eligibility.", "Display your badge without exposing private data."],
  [op("Claim Badge", "claimBadge", "primary", [sel("badge_type", "Badge Type", ["Whale", "Early Adopter", "Community Member"])]), op("Verify", "verify", "secondary", [str("badge_id", "Badge ID")])],
);

export const BUILTIN_APP_TEMPLATES: Record<string, AppTemplate> = {
  // Gaming
  "miniapp-lottery": T_LOTTERY,
  "miniapp-coinflip": T_COINFLIP,
  "miniapp-dicegame": T_DICE,
  "miniapp-scratchcard": T_SCRATCHCARD,
  "miniapp-secretpoker": T_SECRETPOKER,
  "miniapp-neocrash": T_NEOCRASH,
  "miniapp-candlewars": T_CANDLEWARS,
  "miniapp-algobattle": T_ALGOBATTLE,
  "miniapp-fogchess": T_FOGCHESS,
  "miniapp-fogpuzzle": T_FOGPUZZLE,
  "miniapp-cryptoriddle": T_CRYPTORIDDLE,
  "miniapp-worldpiano": T_WORLDPIANO,
  "miniapp-millionpiecemap": T_MILLIONPIECEMAP,
  "miniapp-puzzlemining": T_PUZZLEMINING,
  "miniapp-screamtoearn": T_SCREAMTOEARN,
  // DeFi
  "miniapp-neo-swap": T_NEO_SWAP,
  "miniapp-flashloan": T_FLASHLOAN,
  "miniapp-aitrader": T_AITRADER,
  "miniapp-gridbot": T_GRIDBOT,
  "miniapp-bridgeguardian": T_BRIDGEGUARDIAN,
  "miniapp-gascircle": T_GASCIRCLE,
  "miniapp-ilguard": T_ILGUARD,
  "miniapp-compoundcapsule": T_COMPOUNDCAPSULE,
  "miniapp-darkpool": T_DARKPOOL,
  "miniapp-dutchauction": T_DUTCHAUCTION,
  "miniapp-nolosslottery": T_NOLOSSLOTTERY,
  "miniapp-quantumswap": T_QUANTUMSWAP,
  "miniapp-selfloan": T_SELFLOAN,
  "miniapp-neoburger": T_NEOBURGER,
  // Social
  "miniapp-aisoulmate": T_AISOULMATE,
  "miniapp-redenvelope": T_REDENVELOPE,
  "miniapp-darkradio": T_DARKRADIO,
  "miniapp-devtipping": T_DEVTIPPING,
  "miniapp-bountyhunter": T_BOUNTYHUNTER,
  "miniapp-breakupcontract": T_BREAKUPCONTRACT,
  "miniapp-exfiles": T_EXFILES,
  "miniapp-geospotlight": T_GEOSPOTLIGHT,
  "miniapp-whisperchain": T_WHISPERCHAIN,
  // NFT
  "miniapp-canvas": T_CANVAS,
  "miniapp-nftevolve": T_NFTEVOLVE,
  "miniapp-nftchimera": T_NFTCHIMERA,
  "miniapp-schrodingernft": T_SCHRODINGERNFT,
  "miniapp-meltingasset": T_MELTINGASSET,
  "miniapp-onchaintarot": T_ONCHAINTAROT,
  "miniapp-timecapsule": T_TIMECAPSULE,
  "miniapp-heritagetrust": T_HERITAGETRUST,
  "miniapp-gardenofneo": T_GARDENOFNEO,
  "miniapp-graveyard": T_GRAVEYARD,
  "miniapp-parasite": T_PARASITE,
  "miniapp-paytoview": T_PAYTOVIEW,
  "miniapp-deadswitch": T_DEADSWITCH,
  // Governance (skip predictionmarket - already has inline template)
  "miniapp-secretvote": T_SECRETVOTE,
  "miniapp-govbooster": T_GOVBOOSTER,
  "miniapp-burnleague": T_BURNLEAGUE,
  "miniapp-doomsdayclock": T_DOOMSDAYCLOCK,
  "miniapp-masqueradedao": T_MASQUERADEDAO,
  "miniapp-govmerc": T_GOVMERC,
  "miniapp-candidate-vote": T_CANDIDATEVOTE,
  // Utility
  "miniapp-explorer": T_EXPLORER,
  "miniapp-priceticker": T_PRICETICKER,
  "miniapp-guardianpolicy": T_GUARDIANPOLICY,
  "miniapp-unbreakablevault": T_UNBREAKABLEVAULT,
  "miniapp-zkbadge": T_ZKBADGE,
};
