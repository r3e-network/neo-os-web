import { mergeMessages } from "@shared/locale/base-messages";

const appMessages = {
    // App translations
title: { en: "Neo Swap", zh: "Neo 兑换" },
  subtitle: { en: "Swap NEO ↔ GAS with route preview", zh: "通过路由预览兑换 NEO ↔ GAS" },
  from: { en: "From", zh: "从" },
  to: { en: "To", zh: "到" },
  balance: { en: "Balance", zh: "余额" },
  exchangeRate: { en: "Exchange Rate", zh: "兑换率" },
  priceImpact: { en: "Price Impact", zh: "价格影响" },
  notAvailable: { en: "Unavailable", zh: "不可用" },
  approxEqual: { en: "≈", zh: "≈" },
  slippage: { en: "Slippage Tolerance", zh: "滑点容差" },
  liquidityPool: { en: "Route Liquidity", zh: "路由流动性" },
  minReceived: { en: "Minimum Received", zh: "最少收到" },
  enterAmount: { en: "Enter amount", zh: "输入数量" },
  max: { en: "MAX", zh: "最大" },
  rateUnavailable: { en: "Rate unavailable", zh: "汇率不可用" },
  loadingRate: { en: "Loading rate...", zh: "正在加载汇率..." },
  refreshRate: { en: "Refresh rate", zh: "刷新汇率" },
  swapping: { en: "Swapping...", zh: "兑换中..." },
  selectToken: { en: "Select Token", zh: "选择代币" },
  selectTokenAria: { en: "Select {token}", zh: "选择 {token}" },
  balanceDefault: { en: "—", zh: "—" },
  swapSuccess: { en: "Swapped", zh: "兑换成功" },
  swapFailed: { en: "Swap failed", zh: "兑换失败" },
  swapRouterUnavailable: { en: "Swap router unavailable", zh: "兑换路由不可用" },
  tabSwap: { en: "Swap", zh: "兑换" },
  switchTokens: { en: "Switch tokens", zh: "切换代币" },
  swapArrow: { en: "→", zh: "→" },
  tabPool: { en: "Route", zh: "路由" },
  poolSubtitle: { en: "Review liquidity depth and route risk", zh: "查看流动性深度和路由风险" },
  poolInfo: {
    en: "Liquidity planning uses route previews and live price context before wallet submission.",
    zh: "流动性规划会在钱包提交前展示路由预览和实时价格上下文。",
  },
  routerLabel: { en: "Swap Router", zh: "兑换路由" },
  openDex: { en: "Open swap route", zh: "打开兑换路由" },
  yourPosition: { en: "Your Preview", zh: "您的预览" },
  poolShare: { en: "Route Depth", zh: "路由深度" },
  addLiquidity: { en: "Review Route", zh: "审阅路由" },
  tokenIcon: { en: "Token icon", zh: "代币图标" },
  docSubtitle: {
    en: "NEO/GAS swaps with route preview",
    zh: "带路由预览的 NEO/GAS 兑换",
  },
  docDescription: {
    en: "Neo Swap provides direct swaps between NEO and GAS. Prices are fetched through the data feed and settlement is staged through the shared wallet action console.",
    zh: "Neo Swap 提供 NEO 与 GAS 的直接兑换。价格通过数据源获取，结算通过共享钱包操作台发起。",
  },
  step1: {
    en: "Connect your Neo wallet and select tokens to swap",
    zh: "连接您的 Neo 钱包并选择要兑换的代币",
  },
  step2: {
    en: "Enter the amount and review the exchange rate and price impact",
    zh: "输入金额并查看汇率和价格影响",
  },
  step3: {
    en: "Confirm the swap transaction in your wallet",
    zh: "在钱包中确认兑换交易",
  },
  step4: {
    en: "Receive tokens instantly - no waiting period required",
    zh: "即时收到代币 - 无需等待期",
  },
  feature1Name: { en: "Best Rates", zh: "最佳汇率" },
  feature1Desc: {
    en: "Compares route context before the wallet transaction is staged.",
    zh: "在发起钱包交易前比较路由上下文。",
  },
  feature2Name: { en: "Low Slippage", zh: "低滑点" },
  feature2Desc: {
    en: "Deep liquidity pools ensure minimal price impact on your trades.",
    zh: "深度流动性池确保您的交易价格影响最小。",
  },
  feature3Name: { en: "On-Chain Routing", zh: "链上路由" },
  feature3Desc: {
    en: "Swaps are reviewed in the MiniApp and submitted through the shared wallet flow.",
    zh: "兑换先在小程序中审阅，再通过共享钱包流程提交。",
  },
  popularPairs: { en: "Popular Pairs", zh: "热门交易对" },
    sidebarRate: { en: "Rate", zh: "汇率" },
  tokenNeo: { en: "NEO", zh: "NEO" },
  neoGasRate: { en: "1 NEO ≈ 8.5 GAS", zh: "1 NEO ≈ 8.5 GAS" },
} as const;

export const messages = mergeMessages(appMessages);
