import type { MiniAppInfo } from "../components/types";

/**
 * Built-in MiniApp catalog - all 60 uni-app MiniApps
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

// Gaming Apps (8)
const GAMING_APPS: MiniAppInfo[] = [
  {
    app_id: "miniapp-lottery",
    name: "Neo Lottery",
    name_zh: "Neo 彩票",
    description:
      "Experience the thrill of provably fair lottery draws powered by VRF randomness. Buy tickets with GAS and compete for massive jackpots with 100% transparent on-chain verification.",
    description_zh: "体验由 VRF 随机数驱动的公平彩票抽奖。使用 GAS 购买彩票，竞争巨额奖池，100% 链上透明验证。",
    icon: "/miniapps/lottery/static/icon.svg",
    category: "gaming",
    entry_url: "/miniapps/lottery/index.html",
    status: "active",
    permissions: { payments: true, randomness: true },
  },
  {
    app_id: "miniapp-coinflip",
    name: "Coin Flip",
    name_zh: "抛硬币",
    description:
      "Classic 50/50 betting reimagined on blockchain. Flip a coin, double your GAS instantly with cryptographically secure randomness ensuring fair outcomes every time.",
    description_zh: "经典 50/50 投注在区块链上重新演绎。抛硬币，使用加密安全随机数确保每次公平结果，即时翻倍您的 GAS。",
    icon: "/miniapps/coin-flip/static/icon.svg",
    category: "gaming",
    entry_url: "/miniapps/coin-flip/index.html",
    status: "active",
    permissions: { payments: true, randomness: true },
  },
  {
    app_id: "miniapp-dicegame",
    name: "Dice Game",
    name_zh: "骰子游戏",
    description:
      "Roll the dice and test your luck! Choose your winning range, place your bet, and watch the VRF-powered dice determine your fate with verifiable fairness.",
    description_zh: "掷骰子测试您的运气！选择获胜范围，下注，观看 VRF 驱动的骰子以可验证的公平性决定您的命运。",
    icon: "/miniapps/dice-game/static/icon.svg",
    category: "gaming",
    entry_url: "/miniapps/dice-game/index.html",
    status: "active",
    permissions: { payments: true, randomness: true },
  },
  {
    app_id: "miniapp-scratchcard",
    name: "Scratch Card",
    name_zh: "刮刮卡",
    description:
      "Instant gratification meets blockchain gaming. Scratch virtual cards to reveal prizes instantly, with every outcome cryptographically guaranteed and transparent.",
    description_zh: "即时赢取奖励的数字刮刮卡。刮开揭示您的奖品，奖励即时发放到您的钱包。",
    icon: "/miniapps/scratch-card/static/icon.svg",
    category: "gaming",
    entry_url: "/miniapps/scratch-card/index.html",
    status: "active",
    permissions: { payments: true, randomness: true },
  },
  {
    app_id: "miniapp-secretpoker",
    name: "Secret Poker",
    name_zh: "秘密扑克",
    description:
      "Play Texas Hold'em with true card privacy using zero-knowledge proofs. Your hand stays secret until showdown, eliminating cheating while preserving the poker experience.",
    description_zh: "使用零知识证明的隐私扑克游戏。您的手牌保密，同时确保游戏公平。",
    icon: "/miniapps/secret-poker/static/icon.svg",
    category: "gaming",
    entry_url: "/miniapps/secret-poker/index.html",
    status: "active",
    permissions: { payments: true, randomness: true },
  },
  {
    app_id: "miniapp-neocrash",
    name: "Neo Crash",
    name_zh: "Neo 崩盘",
    description:
      "Watch the multiplier climb and cash out before it crashes! This adrenaline-pumping game tests your nerve with real-time multipliers and instant payouts.",
    description_zh: "刺激的倍数游戏。观看倍数上升，在崩盘前及时提现！",
    icon: "/miniapps/neo-crash/static/icon.svg",
    category: "gaming",
    entry_url: "/miniapps/neo-crash/index.html",
    status: "active",
    permissions: { payments: true, randomness: true },
  },
  {
    app_id: "miniapp-cryptoriddle",
    name: "Crypto Riddle",
    name_zh: "加密谜题",
    description:
      "Crack cryptographic riddles and brain teasers to unlock GAS rewards. Daily challenges test your wit with puzzles ranging from ciphers to logic problems.",
    description_zh: "破解密码谜题和脑筋急转弯，解锁 GAS 奖励。",
    icon: "/miniapps/crypto-riddle/static/icon.svg",
    category: "gaming",
    entry_url: "/miniapps/crypto-riddle/index.html",
    status: "active",
    permissions: { payments: true },
  },
  {
    app_id: "miniapp-millionpiecemap",
    name: "Million Piece Map",
    name_zh: "百万像素地图",
    description:
      "Own and customize pixels on a massive collaborative canvas. Create art, advertise, or stake your claim on this permanent blockchain masterpiece.",
    description_zh: "在大型协作画布上拥有和自定义像素。",
    icon: "/miniapps/million-piece-map/static/icon.svg",
    category: "gaming",
    entry_url: "/miniapps/million-piece-map/index.html",
    status: "active",
    permissions: { payments: true },
  },
];

// DeFi Apps (7)
const DEFI_APPS: MiniAppInfo[] = [
  {
    app_id: "miniapp-neo-swap",
    name: "Neo Swap",
    name_zh: "Neo 兑换",
    description:
      "Swap NEO and GAS instantly via Flamingo DEX. Simple interface for quick token exchanges with real-time rates.",
    description_zh: "去中心化代币兑换。即时交换 NEO 生态系统中的代币，享受最优价格。",
    icon: "/miniapps/neo-swap/static/icon.svg",
    category: "defi",
    entry_url: "/miniapps/neo-swap/index.html",
    status: "active",
    permissions: { payments: true },
  },
  {
    app_id: "miniapp-flashloan",
    name: "Flash Loan",
    name_zh: "闪电贷",
    description:
      "Access instant uncollateralized loans that must be repaid within a single transaction. Perfect for arbitrage, liquidations, and complex DeFi strategies.",
    description_zh: "无抵押即时借贷。在单笔交易内借入、使用、归还，实现套利和清算。",
    icon: "/miniapps/flashloan/static/icon.svg",
    category: "defi",
    entry_url: "/miniapps/flashloan/index.html",
    status: "active",
    permissions: { payments: true },
  },
  {
    app_id: "miniapp-compoundcapsule",
    name: "Compound Capsule",
    name_zh: "复利胶囊",
    description:
      "Maximize your yields with automatic compounding. Deposit once and watch your earnings grow exponentially as rewards are reinvested continuously.",
    description_zh: "通过自动复投最大化您的收益。",
    icon: "/miniapps/compound-capsule/static/icon.svg",
    category: "defi",
    entry_url: "/miniapps/compound-capsule/index.html",
    status: "active",
    permissions: { payments: true },
  },
  {
    app_id: "miniapp-selfloan",
    name: "Self Loan",
    name_zh: "自助贷款",
    description:
      "Borrow against your own collateral with zero liquidation risk. Lock your assets, borrow up to 50%, and repay on your own schedule.",
    description_zh: "用自己的抵押品借款，零清算风险。",
    icon: "/miniapps/self-loan/static/icon.svg",
    category: "defi",
    entry_url: "/miniapps/self-loan/index.html",
    status: "active",
    permissions: { payments: true },
  },
  {
    app_id: "miniapp-neoburger",
    name: "NeoBurger",
    name_zh: "NeoBurger",
    description:
      "Stake NEO to earn GAS rewards with liquid staking. Receive bNEO tokens representing your staked NEO, allowing you to earn staking rewards while maintaining liquidity for DeFi activities.",
    description_zh: "Neo 质押聚合器。质押 NEO 获取 bNEO，自动复投最大化收益。",
    icon: "/miniapps/neoburger/static/icon.svg",
    category: "defi",
    entry_url: "/miniapps/neoburger/index.html",
    status: "active",
    permissions: { payments: true },
  },
  {
    app_id: "miniapp-gassponsor",
    name: "Gas Sponsor",
    name_zh: "GAS 赞助",
    description:
      "Sponsor GAS fees for other users or get your transactions sponsored. Enable gasless transactions for your dApp users with a decentralized gas sponsorship marketplace.",
    description_zh:
      "为其他用户赞助 GAS 费用或获得交易赞助。通过去中心化的 GAS 赞助市场为您的 dApp 用户启用无 GAS 交易。",
    icon: "/miniapps/gas-sponsor/static/icon.svg",
    category: "defi",
    entry_url: "/miniapps/gas-sponsor/index.html",
    status: "active",
    permissions: { payments: true },
  },
];

// Social Apps (4)
const SOCIAL_APPS: MiniAppInfo[] = [
  {
    app_id: "miniapp-grantshare",
    name: "GrantShare",
    name_zh: "资助分享",
    description:
      "Create and fund community grants with transparent on-chain tracking. Support open-source projects, education initiatives, and community development.",
    description_zh: "创建和资助社区资助项目，链上透明追踪。",
    icon: "/miniapps/grant-share/static/icon.svg",
    category: "social",
    entry_url: "/miniapps/grant-share/index.html",
    status: "active",
    permissions: { payments: true },
  },
  {
    app_id: "miniapp-redenvelope",
    name: "Red Envelope",
    name_zh: "红包",
    description:
      "Share the joy of giving with digital red envelopes! Send lucky GAS gifts to friends and groups with randomized amounts, perfect for celebrations and holidays.",
    description_zh: "发送幸运 GAS 红包给朋友。创建红包，分享链接，让朋友们抢红包！",
    icon: "/miniapps/red-envelope/static/icon.svg",
    category: "social",
    entry_url: "/miniapps/red-envelope/index.html",
    status: "active",
    permissions: { payments: true, randomness: true },
  },
  {
    app_id: "miniapp-devtipping",
    name: "Dev Tipping",
    name_zh: "开发者打赏",
    description:
      "Support open-source developers directly! Tip contributors for their work on GitHub repos, Stack Overflow answers, or any valuable code contribution.",
    description_zh: "直接支持开源开发者，为他们的贡献打赏。",
    icon: "/miniapps/dev-tipping/static/icon.svg",
    category: "social",
    entry_url: "/miniapps/dev-tipping/index.html",
    status: "active",
    permissions: { payments: true },
  },
  {
    app_id: "miniapp-breakupcontract",
    name: "Breakup Contract",
    name_zh: "分手合约",
    description:
      "Create immutable relationship agreements on-chain. Define terms for shared assets, responsibilities, and exit conditions with smart contract enforcement.",
    description_zh: "在链上创建不可变的关系协议，智能合约执行。",
    icon: "/miniapps/breakup-contract/static/icon.svg",
    category: "social",
    entry_url: "/miniapps/breakup-contract/index.html",
    status: "active",
    permissions: { payments: true },
  },
];

// NFT Apps (7)
const NFT_APPS: MiniAppInfo[] = [
  {
    app_id: "miniapp-canvas",
    name: "Canvas",
    name_zh: "协作画布",
    description:
      "Create collaborative NFT art with other artists in real-time. Each contribution is recorded on-chain, and the final piece is minted as a shared NFT.",
    description_zh: "链上协作像素画布。每个像素都是 NFT，与全球用户一起创作艺术。",
    icon: "/miniapps/canvas/static/icon.svg",
    category: "nft",
    entry_url: "/miniapps/canvas/index.html",
    status: "active",
    permissions: { payments: true },
  },
  {
    app_id: "miniapp-onchaintarot",
    name: "On-Chain Tarot",
    name_zh: "链上塔罗",
    description:
      "Receive mystical tarot readings powered by VRF randomness. Each reading is minted as a unique NFT capturing your fortune at that moment in time.",
    description_zh: "接收由 VRF 随机数驱动的神秘塔罗牌占卜。",
    icon: "/miniapps/on-chain-tarot/static/icon.svg",
    category: "nft",
    entry_url: "/miniapps/on-chain-tarot/index.html",
    status: "active",
    permissions: { payments: true, randomness: true },
  },
  {
    app_id: "miniapp-timecapsule",
    name: "Time Capsule",
    name_zh: "时间胶囊",
    description:
      "Lock messages, media, or assets in blockchain time capsules that unlock at a future date. Create digital legacies, schedule surprises, or preserve memories for future generations.",
    description_zh: "锁定消息或资产，在未来日期解锁。",
    icon: "/miniapps/time-capsule/static/icon.svg",
    category: "nft",
    entry_url: "/miniapps/time-capsule/index.html",
    status: "active",
    permissions: { payments: true },
  },
  {
    app_id: "miniapp-heritagetrust",
    name: "Heritage Trust",
    name_zh: "遗产信托",
    description:
      "Create smart inheritance plans that automatically transfer your digital assets to beneficiaries. Set conditions, add trustees, and ensure your crypto legacy passes on securely.",
    description_zh: "创建智能继承计划，自动转移资产。",
    icon: "/miniapps/heritage-trust/static/icon.svg",
    category: "nft",
    entry_url: "/miniapps/heritage-trust/index.html",
    status: "active",
    permissions: { payments: true },
  },
  {
    app_id: "miniapp-gardenofneo",
    name: "Garden of Neo",
    name_zh: "Neo 花园",
    description:
      "Cultivate your own virtual garden where plants grow based on your blockchain activity. Rare seeds, seasonal events, and cross-pollination create unique botanical NFTs.",
    description_zh: "培育虚拟花园，植物根据区块链活动生长。",
    icon: "/miniapps/garden-of-neo/static/icon.svg",
    category: "nft",
    entry_url: "/miniapps/garden-of-neo/index.html",
    status: "active",
    permissions: { payments: true },
  },
  {
    app_id: "miniapp-graveyard",
    name: "Graveyard",
    name_zh: "墓园",
    description:
      "Create permanent digital memorials for loved ones, pets, or even failed crypto projects. Mint tombstone NFTs with epitaphs, photos, and memories that live forever on-chain.",
    description_zh: "创建永久的数字纪念碑作为墓碑 NFT。",
    icon: "/miniapps/graveyard/static/icon.svg",
    category: "nft",
    entry_url: "/miniapps/graveyard/index.html",
    status: "active",
    permissions: { payments: true },
  },
];

// Governance Apps (7)
const GOVERNANCE_APPS: MiniAppInfo[] = [
  {
    app_id: "miniapp-govbooster",
    name: "Gov Booster",
    name_zh: "治理加速器",
    description:
      "Amplify your governance power through staking and delegation. Lock tokens for boosted voting weight, delegate to trusted representatives, and maximize your protocol influence.",
    description_zh: "通过质押和委托放大您的治理权力。",
    icon: "/miniapps/gov-booster/static/icon.svg",
    category: "governance",
    entry_url: "/miniapps/gov-booster/index.html",
    status: "active",
    permissions: { governance: true, payments: true },
  },
  {
    app_id: "miniapp-burnleague",
    name: "Burn League",
    name_zh: "销毁联盟",
    description:
      "Compete in token burning competitions where communities race to reduce supply. Climb leaderboards, earn burn badges, and prove your commitment to deflation.",
    description_zh: "参与代币销毁竞赛，减少供应量。",
    icon: "/miniapps/burn-league/static/icon.svg",
    category: "governance",
    entry_url: "/miniapps/burn-league/index.html",
    status: "active",
    permissions: { payments: true },
  },
  {
    app_id: "miniapp-doomsdayclock",
    name: "Doomsday Clock",
    name_zh: "末日时钟",
    description:
      "A community-controlled countdown that resets when people contribute. If it hits zero, locked funds redistribute. Keep the clock alive or watch it all burn.",
    description_zh: "社区控制的倒计时，有人贡献时重置。",
    icon: "/miniapps/doomsday-clock/static/icon.svg",
    category: "governance",
    entry_url: "/miniapps/doomsday-clock/index.html",
    status: "active",
    permissions: { payments: true },
  },
  {
    app_id: "miniapp-masqueradedao",
    name: "Masquerade DAO",
    name_zh: "假面 DAO",
    description:
      "Participate in governance wearing a digital mask. Propose and vote anonymously while still proving membership, enabling honest discourse without social pressure.",
    description_zh: "戴着数字面具匿名参与治理。",
    icon: "/miniapps/masquerade-dao/static/icon.svg",
    category: "governance",
    entry_url: "/miniapps/masquerade-dao/index.html",
    status: "active",
    permissions: { governance: true },
  },
  {
    app_id: "miniapp-govmerc",
    name: "Gov Merc",
    name_zh: "治理雇佣兵",
    description:
      "Hire governance mercenaries to vote on your behalf or sell your voting power to the highest bidder. A marketplace for delegation and influence in the DAO ecosystem.",
    description_zh: "雇佣治理雇佣兵或出售您的投票权。",
    icon: "/miniapps/gov-merc/static/icon.svg",
    category: "governance",
    entry_url: "/miniapps/gov-merc/index.html",
    status: "active",
    permissions: { governance: true, payments: true },
  },
  {
    app_id: "miniapp-candidate-vote",
    name: "Candidate Vote",
    name_zh: "候选人投票",
    description:
      "Vote for platform candidates and earn GAS rewards. Participate in governance by staking your tokens and supporting your preferred candidates with transparent on-chain voting.",
    description_zh: "为 Neo 共识节点候选人投票。参与网络治理，支持您信任的节点。",
    icon: "/miniapps/candidate-vote/static/icon.svg",
    category: "governance",
    entry_url: "/miniapps/candidate-vote/index.html",
    status: "active",
    permissions: { governance: true, payments: true },
  },
  {
    app_id: "miniapp-council-governance",
    name: "Council Governance",
    name_zh: "议会治理",
    description:
      "Create and vote on governance proposals as a council member. Submit text proposals or policy parameter changes, collect signatures, and execute approved decisions with multi-sig verification.",
    description_zh: "作为议会成员创建和投票治理提案。提交文本提案或策略参数变更，收集签名，执行已批准的决议。",
    icon: "/miniapps/council-governance/static/icon.svg",
    category: "governance",
    entry_url: "/miniapps/council-governance/index.html",
    status: "active",
    permissions: { governance: true, payments: true },
  },
];

// Utility Apps (4)
const UTILITY_APPS: MiniAppInfo[] = [
  {
    app_id: "miniapp-neons",
    name: "Neo Name Service",
    name_zh: "Neo 域名服务",
    description:
      "Register and manage human-readable .neo domain names for your wallet. Search availability, register domains, and manage your digital identity on Neo.",
    description_zh: "为您的钱包注册人类可读的 .neo 域名。",
    icon: "/miniapps/neo-ns/static/icon.svg",
    category: "utility",
    entry_url: "/miniapps/neo-ns/index.html",
    status: "active",
    permissions: { payments: true },
  },
  {
    app_id: "miniapp-explorer",
    name: "Neo Explorer",
    name_zh: "区块浏览器",
    description:
      "Explore the Neo N3 blockchain with real-time stats for both Mainnet and Testnet. Search transactions, addresses, and contracts with detailed execution traces.",
    description_zh: "探索 Neo 区块链。查看交易、区块、地址和智能合约详情。",
    icon: "/miniapps/explorer/static/icon.svg",
    category: "utility",
    entry_url: "/miniapps/explorer/index.html",
    status: "active",
    permissions: { datafeed: true },
  },
  {
    app_id: "miniapp-guardianpolicy",
    name: "Guardian Policy",
    name_zh: "守护策略",
    description:
      "Define and enforce smart contract policies for your wallet. Set spending limits, whitelist addresses, require multi-sig for large transfers, and protect your assets.",
    description_zh: "为您的钱包定义和执行智能合约策略。",
    icon: "/miniapps/guardian-policy/static/icon.svg",
    category: "utility",
    entry_url: "/miniapps/guardian-policy/index.html",
    status: "active",
    permissions: { payments: true },
  },
  {
    app_id: "miniapp-unbreakablevault",
    name: "Unbreakable Vault",
    name_zh: "坚不可摧保险库",
    description:
      "Store your most valuable assets in a time-locked vault with multiple security layers. Social recovery, hardware key support, and customizable unlock conditions.",
    description_zh: "在多层安全的时间锁定保险库中存储贵重资产。",
    icon: "/miniapps/unbreakable-vault/static/icon.svg",
    category: "utility",
    entry_url: "/miniapps/unbreakable-vault/index.html",
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

// Additional lookup map by short ID (without "miniapp-" prefix)
const BUILTIN_APPS_SHORT_MAP: Record<string, MiniAppInfo> = Object.fromEntries(
  BUILTIN_APPS.map((app) => {
    // Extract short ID from entry_url (e.g., "/miniapps/lottery/index.html" -> "lottery")
    // or from app_id (e.g., "miniapp-lottery" -> "lottery")
    let shortId = app.app_id.replace("miniapp-", "");
    if (app.entry_url) {
      const match = app.entry_url.match(/\/miniapps\/([^/]+)/);
      if (match) {
        shortId = match[1];
      }
    }
    return [shortId, app];
  }),
);

// Find a built-in app by ID (supports both full ID and short ID)
export function getBuiltinApp(appId: string): MiniAppInfo | undefined {
  // Try full ID first (e.g., "miniapp-lottery")
  if (BUILTIN_APPS_MAP[appId]) {
    return BUILTIN_APPS_MAP[appId];
  }
  // Try short ID (e.g., "lottery")
  return BUILTIN_APPS_SHORT_MAP[appId];
}

export { GAMING_APPS, DEFI_APPS, SOCIAL_APPS, NFT_APPS, GOVERNANCE_APPS, UTILITY_APPS };
