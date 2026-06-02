import { mergeMessages } from "@shared/locale/base-messages";

const appMessages = {
  // App translations
  title: { en: "Burn League", zh: "燃烧联盟" },
  subtitle: { en: "Burn tokens, earn rewards", zh: "燃烧代币，赚取奖励" },
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
  seasonStatus: { en: "Season status", zh: "赛季状态" },
  liveLeague: { en: "Live league", zh: "实时联赛" },
  localPreview: { en: "Data pending", zh: "数据待同步" },
  seasonStatusHint: {
    en: "Stats refresh when the league service is available.",
    zh: "联赛服务可用后会刷新统计。",
  },
  projectedRankHint: {
    en: "Estimated from the visible leaderboard preview.",
    zh: "根据当前可见排行榜预估。",
  },
  rewardModel: { en: "Reward model", zh: "奖励模型" },
  rewardModelHint: {
    en: "Preview uses the league's current 10% reward estimate.",
    zh: "预览使用当前 10% 奖励估算。",
  },
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
    en: "Burn submission creates an OS game-entry wallet intent. Review the amount, projected leaderboard impact, and wallet confirmation before signing.",
    zh: "提交燃烧会创建 OS 游戏参赛钱包意图。签名前请确认金额、排行榜影响和钱包确认内容。",
  },
  burnPreparing: {
    en: "Preparing a {amount} burn wallet confirmation. Keep this window open while the platform asks for approval.",
    zh: "正在准备 {amount} 燃烧钱包确认。平台请求确认时请保持此窗口打开。",
  },
  burnServiceUnavailableTitle: { en: "Burn league data unavailable", zh: "燃烧联赛数据暂不可用" },
  burnServiceUnavailable: {
    en: "Live burn stats are not available in this environment yet. You can still prepare the burn entry, but ranking refresh waits for the league service.",
    zh: "当前环境暂未接通实时燃烧统计。你仍可准备燃烧参赛项，但排名刷新需要等待联赛服务恢复。",
  },
  burnActionUnavailable: {
    en: "Burn submission services are not configured in this environment yet.",
    zh: "当前环境暂未配置燃烧提交服务。",
  },
  burnWalletUnavailable: {
    en: "Open this MiniApp from the platform workspace to confirm the burn wallet intent.",
    zh: "请从平台工作区打开此小程序，以确认燃烧钱包意图。",
  },
  burnSubmitted: {
    en: "Burn entry submitted. Refreshing the leaderboard state.",
    zh: "燃烧参赛项已提交，正在刷新排行榜状态。",
  },
  lastSubmitted: {
    en: "Last submitted burn: {amount}",
    zh: "上次提交燃烧：{amount}",
  },
  leaderboard: { en: "Leaderboard", zh: "排行榜" },
  noEntriesTitle: { en: "No leaderboard entries yet", zh: "暂无排行榜记录" },
  noEntries: { en: "Submitted burns will appear here with rank and burned GAS once the league service indexes them.", zh: "联赛服务索引后，已提交的燃烧会以排名和 GAS 数量显示在这里。" },
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
    en: "Burn League is a competitive token burning platform where participants compete to burn the most tokens during seasonal competitions. Climb the leaderboard, earn points, and win exclusive rewards.",
    zh: "Burn League 是一个竞争性代币销毁平台，参与者在赛季竞赛中竞争销毁最多的代币。攀登排行榜，赚取积分，赢取独家奖励。",
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
    en: "Claim your seasonal rewards based on final ranking",
    zh: "根据最终排名领取赛季奖励",
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
  feature3Name: { en: "Burn-to-Earn", zh: "销毁奖励" },
  feature3Desc: {
    en: "Earn seasonal rewards based on your burn contribution.",
    zh: "根据销毁贡献获取赛季奖励。",
  },
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
