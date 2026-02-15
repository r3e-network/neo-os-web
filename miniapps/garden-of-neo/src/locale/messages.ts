import { mergeMessages } from "@shared/locale/base-messages";

const appMessages = {
  // App translations
  title: { en: "Garden of Neo", zh: "Neo花园" },
  subtitle: { en: "Grow blockchain plants and harvest rewards", zh: "种植区块链植物并收获奖励" },
  garden: { en: "Garden", zh: "花园" },
  yourGarden: { en: "Your Garden", zh: "你的花园" },
  availableSeeds: { en: "Available Seeds", zh: "可用种子" },
  hoursToGrow: { en: "blocks to mature", zh: "个区块成熟" },
  actions: { en: "Actions", zh: "操作" },
  refreshStatus: { en: "Refresh Status", zh: "刷新状态" },
  refreshing: { en: "Refreshing...", zh: "刷新中..." },
  harvesting: { en: "Harvesting...", zh: "收获中..." },
  plantFee: { en: "Plant fee: 0.1 GAS", zh: "种植费用：0.1 GAS" },
  harvestReady: { en: "Harvest Ready Plants", zh: "收获成熟植物" },
  gardenStats: { en: "Garden Stats", zh: "花园统计" },
  plants: { en: "Plants", zh: "植物" },
  ready: { en: "Ready", zh: "成熟" },
  harvested: { en: "Harvested", zh: "已收获" },
  noEmptyPlots: { en: "No empty plots available", zh: "没有空闲地块" },
  plantingSeed: { en: "Planting seed...", zh: "种植中..." },
  plantSuccess: { en: "Seed planted", zh: "种子已种植" },
  harvested2: { en: "Harvested", zh: "已收获" }, // cleanup dupes if needed but keeping safe
  harvestedPlants: { en: "plants!", zh: "株植物！" },
  noReady: { en: "No plants ready to harvest", zh: "没有可收获的植物" },
  missingContract: { en: "Contract not configured", zh: "合约未配置" },
  failedToLoad: { en: "Failed to load garden", zh: "加载花园失败" },
  harvestSuccess: { en: "Plant harvested", zh: "植物已收获" },
  seedFire: { en: "Fire Seed", zh: "火种" },
  seedIce: { en: "Ice Seed", zh: "冰种" },
  seedEarth: { en: "Earth Seed", zh: "土种" },
  seedWind: { en: "Wind Seed", zh: "风种" },
  seedLight: { en: "Light Seed", zh: "光种" },

  docSubtitle: {
    en: "Virtual garden where plants grow with blockchain activity",
    zh: "植物随区块链活动生长的虚拟花园",
  },
  docDescription: {
    en: "Plant elemental seeds for 0.1 GAS each, wait 100 blocks for maturity, and harvest GAS rewards (0.15-0.30) based on seed type.",
    zh: "每次种植花费 0.1 GAS，等待 100 个区块成熟后收获 GAS 奖励（0.15-0.30），奖励随种子类型变化。",
  },
  step1: { en: "Connect your wallet.", zh: "连接钱包。" },
  step2: { en: "Plant a seed and wait ~100 blocks.", zh: "种植种子并等待约 100 个区块。" },
  step3: { en: "Harvest when growth reaches 100%.", zh: "生长达到 100% 后收获。" },
  step4: { en: "Replant to keep your garden growing.", zh: "继续种植保持花园生长。" },
  feature1Name: { en: "Block-Based Growth", zh: "基于区块的生长" },
  feature1Desc: {
    en: "Plants mature after 100 blocks on Neo N3.",
    zh: "植物在 Neo N3 上经历 100 个区块成熟。",
  },
  feature2Name: { en: "Elemental Seeds", zh: "元素种子" },
  feature2Desc: {
    en: "Choose from Fire, Ice, Earth, Wind, and Light seeds.",
    zh: "从火、冰、土、风、光 5 种种子中选择。",
  },
  feature3Name: { en: "Harvest Rewards", zh: "收获奖励" },
  feature3Desc: {
    en: "Harvest mature plants to claim on-chain GAS rewards.",
    zh: "成熟后收获植物领取链上 GAS 奖励。",
  },
  sidebarHarvested: { en: "Harvested", zh: "已收获" },
  gardenActions: { en: "Garden Status", zh: "花园状态" },
} as const;

export const messages = mergeMessages(appMessages);
