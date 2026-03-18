import { mergeMessages } from "@shared/locale/base-messages";
const appMessages = {
  appName: { en: "AA Market Hub", zh: "AA 市场看板" },
  marketHash: { en: "Market Hash", zh: "市场合约哈希" },
  loadListings: { en: "Load Listings", zh: "加载 Listings" },
  totalListings: { en: "Total Listings", zh: "总 Listings" },
  docsSubtitle: { en: "Read on-chain AA market listings", zh: "读取链上 AA 市场 listing" },
  feature1Name: { en: "Read Only", zh: "只读" },
  feature1Desc: { en: "Pull listings directly from the AA market contract.", zh: "直接从 AA 市场合约读取 listing。" },
  feature2Name: { en: "Portable", zh: "可移植" },
  feature2Desc: { en: "Works with any configured market hash.", zh: "适用于任意输入的 market hash。" },
  feature3Name: { en: "AA Focused", zh: "AA 专用" },
  feature3Desc: { en: "Shows accountId, seller, buyer, and price state.", zh: "展示 accountId、卖家、买家与价格状态。" }
} as const;
export const messages = mergeMessages(appMessages);
