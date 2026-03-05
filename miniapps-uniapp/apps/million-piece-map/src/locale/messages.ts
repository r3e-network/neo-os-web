import { mergeMessages } from "@shared/locale/base-messages";

const appMessages = {
  // App translations
  title: { en: "Million Piece Map", zh: "百万像素地图" },
  subtitle: { en: "Pixel territory conquest", zh: "像素领土征服" },
  territoryMap: { en: "Map", zh: "地图" },
  claimTerritory: { en: "Claim", zh: "占领" },
  territoryStats: { en: "Stats", zh: "统计" },
  coordinates: { en: "Coordinates", zh: "坐标" },
  position: { en: "Position", zh: "位置" },
  status: { en: "Status", zh: "状态" },
  tile: { en: "Tile", zh: "地块" },
  price: { en: "Price", zh: "价格" },
  available: { en: "Available", zh: "可用" },
  occupied: { en: "Occupied", zh: "已占领" },
  yourTerritory: { en: "Your Territory", zh: "你的领土" },
  othersTerritory: { en: "Others' Territory", zh: "他人领土" },
  claiming: { en: "Claiming...", zh: "占领中..." },
  claimNow: { en: "Claim Now", zh: "立即占领" },
  alreadyClaimed: { en: "Already Claimed", zh: "已被占领" },
  tilesOwned: { en: "Tiles Owned", zh: "拥有地块" },
  mapControl: { en: "Map Control", zh: "地图控制" },
  gasSpent: { en: "GAS Spent", zh: "GAS 花费" },
  yourStats: { en: "Your Stats", zh: "您的统计" },
  owned: { en: "Owned", zh: "拥有" },
  spent: { en: "Spent", zh: "花费" },
  coverage: { en: "Coverage", zh: "覆盖率" },
  tileAlreadyOwned: { en: "Territory already claimed!", zh: "领土已被占领！" },
  tilePurchased: { en: "Territory claimed successfully!", zh: "领土占领成功！" },
  claimPending: { en: "Claim pending", zh: "占领确认中" },
  map: { en: "Map", zh: "地图" },
  docSubtitle: {
    en: "Claim and own pixels on a blockchain-powered territory map",
    zh: "在区块链驱动的领土地图上占领和拥有像素",
  },
  docDescription: {
    en: "Million Piece Map lets you claim pixels on an 8x8 grid territory map. Each pixel is a unique on-chain asset. Build your digital empire by purchasing tiles with GAS and watch your territory grow!",
    zh: "百万像素地图让您在 8x8 网格领土地图上占领像素。每个像素都是独特的链上资产。使用 GAS 购买地块建立您的数字帝国，观察您的领土增长！",
  },
  step1: { en: "Connect your Neo wallet and explore the territory map.", zh: "连接 Neo 钱包并探索领土地图。" },
  step2: { en: "Select an available pixel tile on the grid.", zh: "在网格上选择一个可用的像素地块。" },
  step3: { en: "Pay 0.1 GAS to claim ownership of the tile.", zh: "支付 0.1 GAS 占领该地块的所有权。" },
  step4: { en: "Track your territory stats and expand your empire.", zh: "跟踪您的领土统计并扩展您的帝国。" },
  feature1Name: { en: "True Ownership", zh: "真正所有权" },
  feature1Desc: {
    en: "Each pixel is recorded on-chain as your permanent property.",
    zh: "每个像素都作为您的永久财产记录在链上。",
  },
  feature2Name: { en: "Territory Visualization", zh: "领土可视化" },
  feature2Desc: {
    en: "Color-coded map shows your tiles vs others at a glance.",
    zh: "颜色编码的地图一目了然地显示您的地块与他人的地块。",
  },
  feature3Name: { en: "Open Trading", zh: "开放交易" },
  feature3Desc: {
    en: "Tiles can be traded as on-chain assets.",
    zh: "地块可作为链上资产进行交易。",
  },
  wrongChain: { en: "Wrong Chain", zh: "链错误" },
  wrongChainMessage: {
    en: "This app requires Neo N3. Please switch networks.",
    zh: "此应用需要 Neo N3 网络，请切换网络。",
  },
  sidebarTilePrice: { en: "Tile Price", zh: "地块价格" },
} as const;

export const messages = mergeMessages(appMessages);
