import { mergeMessages } from "@shared/locale/base-messages";

const appMessages = {
  // App translations
  title: { en: "Burn League", zh: "燃烧联盟" },
  subtitle: { en: "Burn tokens, earn rewards", zh: "燃烧代币，赚取奖励" },
  totalBurned: { en: "Total Burned", zh: "总燃烧量" },
  youBurned: { en: "You Burned", zh: "你的燃烧量" },
  rank: { en: "Rank", zh: "排名" },
  burnTokens: { en: "Burn Tokens", zh: "燃烧代币" },
  amountPlaceholder: { en: "Amount to burn", zh: "燃烧数量" },
  estimatedRewards: { en: "Estimated Rewards", zh: "预估奖励" },
  points: { en: "GAS", zh: "GAS" },
  burning: { en: "Burning...", zh: "燃烧中..." },
  burnNow: { en: "Burn Now", zh: "立即燃烧" },
  leaderboard: { en: "Leaderboard", zh: "排行榜" },
  burned: { en: "Burned", zh: "已燃烧" },
  success: { en: "successfully!", zh: "成功！" },
  minBurn: { en: "Minimum burn is {amount} GAS", zh: "最低燃烧 {amount} GAS" },
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
} as const;

export const messages = mergeMessages(appMessages);
