import { mergeMessages } from "@shared/locale/base-messages";

const appMessages = {
  title: { en: "Neo Treasury", zh: "Neo 国库" },
  docSubtitle: { en: "Community treasury management", zh: "社区国库管理" },
  docDescription: {
    en: "Neo Treasury enables transparent community fund management with on-chain governance.",
    zh: "Neo 国库实现透明的社区资金管理，支持链上治理。",
  },
  feature1Name: { en: "Transparent Funds", zh: "透明资金" },
  feature1Desc: { en: "All transactions recorded on-chain.", zh: "所有交易链上可查。" },
  feature2Name: { en: "Community Governance", zh: "社区治理" },
  feature2Desc: { en: "Vote on fund allocation.", zh: "投票决定资金分配。" },
  feature3Name: { en: "Multi-sig Security", zh: "多签安全" },
  feature3Desc: { en: "Protected by multi-signature.", zh: "多重签名保护。" },
  balance: { en: "Balance", zh: "余额" },
  deposit: { en: "Deposit", zh: "存入" },
  withdraw: { en: "Withdraw", zh: "提取" },
  proposals: { en: "Proposals", zh: "提案" },
  loadFailed: { en: "Failed to load", zh: "加载失败" },
  refreshing: { en: "Refreshing...", zh: "刷新中..." },
  step1: { en: "Connect your wallet", zh: "连接您的钱包" },
  step2: { en: "View treasury balance", zh: "查看国库余额" },
  step3: { en: "Create or vote on proposals", zh: "创建或投票提案" },
  step4: { en: "Track fund allocations", zh: "追踪资金分配" },
  tabTotal: { en: "Total", zh: "总计" },
  tabDa: { en: "DA", zh: "开发" },
  tabErik: { en: "Erik", zh: "社区" },
  sidebarTotalUsd: { en: "Total USD", zh: "总美元" },
  sidebarTotalNeo: { en: "Total NEO", zh: "总 NEO" },
  sidebarTotalGas: { en: "Total GAS", zh: "总 GAS" },
  sidebarFounders: { en: "Founders", zh: "创始人" },
  treasuryInfo: { en: "Treasury Info", zh: "国库信息" },
  refreshData: { en: "Refresh Data", zh: "刷新数据" },
} as const;

export const messages = mergeMessages(appMessages);
