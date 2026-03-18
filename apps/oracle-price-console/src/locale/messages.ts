import { mergeMessages } from "@shared/locale/base-messages";
const appMessages = {
  appName: { en: "Oracle Price Console", zh: "预言机价格台" },
  asset: { en: "Asset", zh: "资产" },
  assetPlaceholder: { en: "NEO / GAS / BTC", zh: "NEO / GAS / BTC" },
  fetchPrice: { en: "Fetch Price", zh: "查询价格" },
  latestPrice: { en: "Latest Price", zh: "最新价格" },
  docsSubtitle: { en: "Query Morpheus price feed from MiniApps", zh: "在小程序里查询 Morpheus 价格源" },
  feature1Name: { en: "Feed Read", zh: "价格源读取" },
  feature1Desc: { en: "Reads canonical Morpheus feed pricing.", zh: "读取 Morpheus 标准价格源。" },
  feature2Name: { en: "Testnet", zh: "测试网" },
  feature2Desc: { en: "Aligned to the shared testnet feed endpoint.", zh: "对齐共享测试网价格源。" },
  feature3Name: { en: "Console", zh: "控制台" },
  feature3Desc: { en: "Fast operator-style inspection for asset prices.", zh: "面向运维的快速价格查询台。" }
} as const;
export const messages = mergeMessages(appMessages);
