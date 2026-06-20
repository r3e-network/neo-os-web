import { mergeMessages } from "@shared/locale/base-messages";

const appMessages = {
  // App translations
  title: { en: "Burn League", zh: "燃烧联盟" },
  subtitle: { en: "Burn tokens, earn rewards", zh: "燃烧代币，赚取奖励" },
  arenaAlt: {
    en: "Golden Burn League arena with GAS tokens flowing into a prize brazier",
    zh: "金色燃烧联盟竞技场，GAS 代币流向奖池燃烧台",
  },
  totalBurned: { en: "Total Burned", zh: "总燃烧量" },
  youBurned: { en: "You Burned", zh: "你的燃烧量" },
  yourBurns: { en: "Your Burns", zh: "你的燃烧量" },
  rewardPool: { en: "Reward Pool", zh: "奖励池" },
  rank: { en: "Rank", zh: "排名" },
  yourRank: { en: "Your Rank", zh: "你的排名" },
  outOf: { en: "of {total} players", zh: "共 {total} 名玩家" },
  burnTokens: { en: "Burn Tokens", zh: "燃烧代币" },
  amount: { en: "Amount", zh: "数量" },
  enterAmount: { en: "Amount to burn", zh: "燃烧数量" },
  amountPlaceholder: { en: "Amount to burn", zh: "燃烧数量" },
  estimatedReward: { en: "Est. Reward", zh: "预估奖励" },
  estimatedRewards: { en: "Estimated Rewards", zh: "预估奖励" },
  entryAmount: { en: "Entry amount", zh: "参赛燃烧量" },
  projectedTotal: { en: "Projected total", zh: "预计总燃烧量" },
  projectedRank: { en: "Projected rank", zh: "预计排名" },
  burnPresets: { en: "Burn amount presets", zh: "燃烧金额快捷选项" },
  burnRange: {
    en: "Burn range: {min}-{max} GAS",
    zh: "燃烧范围：{min}-{max} GAS",
  },
  burnRangeError: {
    en: "Enter a burn amount from {min} to {max} GAS.",
    zh: "请输入 {min} 到 {max} GAS 的燃烧数量。",
  },
  fuelConsole: { en: "Fuel console", zh: "燃料控制台" },
  fuelDialLabel: { en: "Burn fuel", zh: "燃烧燃料" },
  fuelMeter: { en: "Burn fuel meter", zh: "燃烧燃料仪表" },
  burnRouteLabel: {
    en: "Burn flow from entry amount to prize pool and projected rank",
    zh: "燃烧从参赛数量流向奖池与预计排名的路径",
  },
  seasonStatus: { en: "Season status", zh: "赛季状态" },
  liveLeague: { en: "Live league", zh: "实时联赛" },
  heroFirstBurnPrompt: {
    en: "Be the first to burn this season and top the leaderboard.",
    zh: "成为本赛季首位燃烧者，登上排行榜榜首。",
  },
  localPreview: { en: "Data pending", zh: "数据待同步" },
  seasonStatusHint: {
    en: "Stats refresh when the league service is available.",
    zh: "联赛服务可用后会刷新统计。",
  },
  projectedRankHint: {
    en: "Estimated from the visible leaderboard preview.",
    zh: "根据当前可见排行榜预估。",
  },
  // ── Season lifecycle (on-chain MiniAppBurnLeague) ──────────────────────
  seasonLabel: { en: "Season", zh: "赛季" },
  seasonActive: { en: "Live now", zh: "进行中" },
  seasonEnded: { en: "Ended — awaiting settle", zh: "已结束 — 待结算" },
  seasonDormant: { en: "Not started", zh: "尚未开始" },
  seasonDormantHint: {
    en: "No active season yet — the first burn starts a fresh season.",
    zh: "暂无进行中的赛季 — 第一次燃烧将开启新赛季。",
  },
  seasonDormantHintWithLength: {
    en: "No active season yet — the first burn starts a fresh {length} season. Only the top burner wins the pool; all other burns are forfeited to it.",
    zh: "暂无进行中的赛季 — 第一次燃烧将开启一个 {length} 的新赛季。只有燃烧榜首赢得奖池，其余燃烧将被并入奖池。",
  },
  seasonEndsIn: { en: "Ends in", zh: "剩余时间" },
  seasonEndedHint: {
    en: "The season has ended. Settle to award the {amount} pool to the top burner.",
    zh: "赛季已结束。结算后将把 {amount} 奖池发放给燃烧榜首。",
  },
  settleSeason: { en: "Settle season", zh: "结算赛季" },
  settleSuccess: {
    en: "Season settled — the pool was paid to the top burner.",
    zh: "赛季已结算 — 奖池已发放给燃烧榜首。",
  },
  burnSuccess: {
    en: "Burn confirmed — your season total is updated.",
    zh: "燃烧已确认 — 你的赛季总量已更新。",
  },
  // ── Season length disclosure (read from seasonDuration()) ─────────────
  seasonLengthLabel: { en: "Season length", zh: "赛季时长" },
  durationSeconds: { en: "{count}s", zh: "{count} 秒" },
  durationMinutes: { en: "{count} min", zh: "{count} 分钟" },
  durationHours: { en: "{count}h", zh: "{count} 小时" },
  durationDays: { en: "{count}d", zh: "{count} 天" },
  // ── Exit path (withdraw unused prepaid burn-credit) ───────────────────
  prepaidCreditLabel: { en: "Prepaid credit", zh: "预付额度" },
  prepaidCreditHint: {
    en: "Unused GAS from a burn that didn't complete. Reused on your next burn, or withdraw it now.",
    zh: "未完成的燃烧所剩的 GAS。下次燃烧会复用，也可立即提取。",
  },
  withdrawCredit: { en: "Withdraw credit", zh: "提取额度" },
  creditWithdrawn: { en: "Withdrew {amount} {tokenGas} prepaid credit", zh: "已提取预付额度 {amount} {tokenGas}" },
  noCredit: { en: "No prepaid credit to withdraw", zh: "没有可提取的预付额度" },
  settleBeforeBurn: {
    en: "The season has ended. Settle it before burning into a new season.",
    zh: "赛季已结束。请先结算，再燃烧进入新赛季。",
  },
  burnBlockedSettle: {
    en: "Burning is paused until the ended season is settled.",
    zh: "在已结束的赛季结算之前，燃烧将暂停。",
  },
  burnDepositHeld: {
    en: "Your GAS was deposited as reusable burn credit, but the burn did not complete. Try again — no funds were lost.",
    zh: "你的 GAS 已存入为可复用的燃烧额度，但燃烧未完成。请重试 — 资金未丢失。",
  },
  // ── Real prize model (whole pool → top burner) ────────────────────────
  prizePool: { en: "Prize pool", zh: "奖池" },
  currentLeader: { en: "Current leader", zh: "当前榜首" },
  noLeaderYet: { en: "No burns yet", zh: "暂无燃烧" },
  burnReview: { en: "Burn review checklist", zh: "燃烧确认清单" },
  reviewAmount: { en: "Confirm amount", zh: "确认数量" },
  reviewLeaderboard: { en: "Review rank impact", zh: "检查排名影响" },
  reviewWallet: { en: "Sign wallet intent", zh: "签名钱包意图" },
  resetBurn: { en: "Reset", zh: "重置" },
  points: { en: "GAS", zh: "GAS" },
  burning: { en: "Burning...", zh: "燃烧中..." },
  burn: { en: "Burn Now", zh: "立即燃烧" },
  burnNow: { en: "Burn Now", zh: "立即燃烧" },
  burnActionHint: {
    en: "Burning deposits GAS to the on-chain pool, then records your season total. Review the amount, projected leaderboard impact, and wallet confirmation before signing.",
    zh: "燃烧会将 GAS 存入链上奖池，并记录你的赛季总量。签名前请确认金额、排行榜影响和钱包确认内容。",
  },
  burnPreparing: {
    en: "Preparing a {amount} burn wallet confirmation. Keep this window open while the platform asks for approval.",
    zh: "正在准备 {amount} 燃烧钱包确认。平台请求确认时请保持此窗口打开。",
  },
  burnServiceUnavailableTitle: { en: "Burn league data unavailable", zh: "燃烧联赛数据暂不可用" },
  burnServiceUnavailable: {
    en: "Live burn stats could not be read from the chain right now. You can still prepare a burn, but the pool and ranking refresh once the node responds.",
    zh: "暂时无法从链上读取实时燃烧统计。你仍可准备燃烧，但奖池和排名将在节点恢复后刷新。",
  },
  burnActionUnavailable: {
    en: "The burn could not be submitted to the contract. Please try again.",
    zh: "无法将燃烧提交到合约。请重试。",
  },
  burnWalletUnavailable: {
    en: "Connect your wallet to confirm the burn transaction.",
    zh: "请连接钱包以确认燃烧交易。",
  },
  burnSubmitted: {
    en: "Burn confirmed on chain. Refreshing the pool and leaderboard.",
    zh: "燃烧已在链上确认，正在刷新奖池和排行榜。",
  },
  lastSubmitted: {
    en: "Last submitted burn: {amount}",
    zh: "上次提交燃烧：{amount}",
  },
  leaderboard: { en: "Leaderboard", zh: "排行榜" },
  noEntriesTitle: { en: "No leaderboard entries yet", zh: "暂无排行榜记录" },
  noEntries: { en: "Burns appear here with rank and burned GAS as soon as they confirm on chain for this season.", zh: "本赛季的燃烧在链上确认后，会以排名和 GAS 数量显示在这里。" },
  burned: { en: "Burned", zh: "已燃烧" },
  success: { en: "successfully!", zh: "成功！" },
  minBurn: { en: "Minimum burn is {amount} {tokenGas}", zh: "最低燃烧 {amount} {tokenGas}" },
  maxBurn: { en: "Maximum burn is {amount} {tokenGas}", zh: "最高燃烧 {amount} {tokenGas}" },
  missingContract: { en: "Contract not configured", zh: "合约未配置" },
  loadFailed: { en: "Failed to load burn data", zh: "燃烧数据加载失败" },
  docSubtitle: {
    en: "Competitive token burning with seasonal rewards",
    zh: "带有赛季奖励的竞争性代币销毁",
  },
  docDescription: {
    en: "Burn League is an all-pay seasonal contest: burn GAS into the season pool and climb the leaderboard. When the season is settled, ONLY the top burner wins the entire pool — every other burn is forfeited to the pool. It is winner-takes-all, not tiered rewards.",
    zh: "Burn League 是一个全员付费的赛季竞赛：将 GAS 燃烧进赛季奖池并攀登排行榜。赛季结算时，只有燃烧榜首赢得全部奖池——其余所有燃烧都将并入奖池。这是赢者通吃，而非分级奖励。",
  },
  step1: {
    en: "Connect your Neo wallet and join the current season",
    zh: "连接您的 Neo 钱包并加入当前赛季",
  },
  step2: {
    en: "Burn tokens to earn points and climb the leaderboard",
    zh: "销毁代币以赚取积分并攀登排行榜",
  },
  step3: {
    en: "Compete with others for top positions before season ends",
    zh: "在赛季结束前与他人竞争顶级位置",
  },
  step4: {
    en: "When the season ends, the single top burner wins the entire pool — everyone else forfeits their burn",
    zh: "赛季结束时，唯一的燃烧榜首赢得全部奖池——其他人的燃烧都将被没收",
  },
  feature1Name: { en: "Seasonal Competitions", zh: "赛季竞赛" },
  feature1Desc: {
    en: "Time-limited seasons with fresh leaderboards and prize pools.",
    zh: "限时赛季，全新排行榜和奖池。",
  },
  feature2Name: { en: "On-Chain Leaderboard", zh: "链上排行榜" },
  feature2Desc: {
    en: "All burns and rankings are transparently recorded on Neo N3.",
    zh: "所有销毁和排名都透明地记录在 Neo N3 上。",
  },
  feature3Name: { en: "Winner-Takes-All", zh: "赢者通吃" },
  feature3Desc: {
    en: "Only the season's top burner wins the entire pool; all other burns are forfeited to the pool.",
    zh: "只有赛季燃烧榜首赢得全部奖池；其余所有燃烧都将并入奖池。",
  },
  // ── Win / settle celebration ──────────────────────────────────────────
  settleWinTitle: { en: "You won the pool!", zh: "你赢得了奖池！" },
  settleWinBody: {
    en: "The season settled and {amount} was paid to your wallet as the top burner.",
    zh: "赛季已结算，作为燃烧榜首的 {amount} 已发放到你的钱包。",
  },
  settleDoneTitle: { en: "Season settled", zh: "赛季已结算" },
  settleDoneBody: {
    en: "The {amount} pool was awarded to the top burner. A fresh season is open — burn to climb.",
    zh: "{amount} 奖池已发放给燃烧榜首。新赛季已开启 — 燃烧即可攀升。",
  },
  celebrationDismiss: { en: "Continue", zh: "继续" },
  // ── Leader badge (live, active season) ────────────────────────────────
  youLeadBadge: { en: "You're #1 — defend the pool", zh: "你是第一名 — 守住奖池" },
  // ── Honest empty / dormant hero ───────────────────────────────────────
  heroPoolLabel: { en: "Prize pool", zh: "奖池" },
  heroPoolEmptyHint: {
    en: "Be the first burn and open a fresh season.",
    zh: "成为首次燃烧者，开启全新赛季。",
  },
  dashPlaceholder: { en: "—", zh: "—" },
  startTheSeason: { en: "Start the season", zh: "开启赛季" },
  impactPoolEmptyHint: {
    en: "No live pool yet — your first burn starts the season and fills these in.",
    zh: "暂无进行中的奖池 — 你的首次燃烧将开启赛季并填入这些数据。",
  },
  // ── How burning wins (inline 3-step rhythm) ───────────────────────────
  howItWorks: { en: "How burning wins", zh: "燃烧如何获胜" },
  howStepPick: { en: "Pick an amount", zh: "选择燃烧数量" },
  howStepBurn: { en: "Burn into the pool", zh: "燃烧进奖池" },
  howStepClimb: { en: "Climb the leaderboard", zh: "攀登排行榜" },
  howStepWin: { en: "Top burner takes it all", zh: "燃烧榜首赢得全部" },
  // App-specific sidebar keys
  ariaLeaderboard: { en: "Leaderboard", zh: "排行榜" },
  sidebarRank: { en: "Rank", zh: "排名" },
  sidebarBurns: { en: "Burns", zh: "燃烧次数" },
  sidebarRewardPool: { en: "Reward Pool", zh: "奖励池" },
  gasSuffix: { en: "GAS", zh: "GAS" },
  rankGold: { en: "1st place", zh: "第一名" },
  rankSilver: { en: "2nd place", zh: "第二名" },
  rankBronze: { en: "3rd place", zh: "第三名" },
} as const;

export const messages = mergeMessages(appMessages);
