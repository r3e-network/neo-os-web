import { mergeMessages } from "@shared/locale/base-messages";

const appMessages = {
    // App translations
title: { en: "Neo Swap — live NEO/GAS rate & trade preview", zh: "Neo 兑换 — 实时 NEO/GAS 汇率与交易预览" },
  subtitle: {
    en: "Preview the live NEO ↔ GAS rate, slippage, and minimum received — settle in your wallet/DEX when a route is available",
    zh: "预览实时 NEO ↔ GAS 汇率、滑点与最少收到数量 — 待路由可用后在您的钱包/DEX 中结算",
  },
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
  insufficientBalance: { en: "Insufficient balance", zh: "余额不足" },
  neoIntegerOnly: { en: "NEO is indivisible — enter a whole number", zh: "NEO 不可分割 — 请输入整数" },
  invalidAmount: { en: "Enter a valid amount", zh: "请输入有效金额" },
  selectToken: { en: "Select Token", zh: "选择代币" },
  selectTokenAria: { en: "Select {token}", zh: "选择 {token}" },
  balanceDefault: { en: "—", zh: "—" },
  swapSuccess: { en: "Swapped", zh: "兑换成功" },
  swapFailed: { en: "Swap failed", zh: "兑换失败" },
  swapRouterUnavailable: { en: "Swap router unavailable", zh: "兑换路由不可用" },
  swapRouterUnavailableHint: {
    en: "No on-chain swap router is deployed for this network yet. Quotes are live, but on-chain settlement is not available.",
    zh: "本网络尚未部署链上兑换路由。报价为实时数据，但暂时无法在链上结算。",
  },
  rateStale: { en: "Rate may be stale", zh: "汇率可能已过期" },
  rateAsOf: { en: "Rate as of {time}", zh: "汇率截至 {time}" },
  rateStaleAsOf: {
    en: "Rate as of {time} — may be out of date",
    zh: "汇率截至 {time} — 可能已过期",
  },
  pairUnavailable: { en: "Pair {pair} is unavailable", zh: "交易对 {pair} 不可用" },
  dismiss: { en: "Close", zh: "关闭" },
  tabSwap: { en: "Swap", zh: "兑换" },
  switchTokens: { en: "Switch tokens", zh: "切换代币" },
  swapArrow: { en: "→", zh: "→" },
  tabPool: { en: "Route", zh: "路由" },
  poolSubtitle: { en: "Review liquidity depth and route risk", zh: "查看流动性深度和路由风险" },
  poolInfo: {
    en: "Liquidity planning uses route previews and live price context before wallet submission.",
    zh: "流动性规划会在钱包提交前展示路由预览和实时价格上下文。",
  },
  swapPortfolioLabel: { en: "Wallet balances", zh: "钱包余额" },
  swapRouteStatus: { en: "Route status", zh: "路由状态" },
  swapRouteReady: { en: "Route ready", zh: "路由就绪" },
  swapRouteSyncing: { en: "Syncing quote", zh: "正在同步报价" },
  swapRouteUnavailable: { en: "Quote pending", zh: "等待报价" },
  swapSafetyTitle: { en: "Wallet review", zh: "钱包复核" },
  swapSafetyCopy: {
    en: "Slippage and minimum received stay visible before the wallet confirmation.",
    zh: "钱包确认前始终展示滑点和最少收到数量。",
  },
  marketPairs: { en: "Market", zh: "市场" },
  quoteHealth: { en: "Quote health", zh: "报价状态" },
  routerLabel: { en: "Swap Router", zh: "兑换路由" },
  openDex: { en: "Open swap route", zh: "打开兑换路由" },
  yourPosition: { en: "Your Preview", zh: "您的预览" },
  poolShare: { en: "Route Depth", zh: "路由深度" },
  addLiquidity: { en: "Review Route", zh: "审阅路由" },
  tokenIcon: { en: "Token icon", zh: "代币图标" },
  docSubtitle: {
    en: "Live NEO/GAS rate & trade preview",
    zh: "实时 NEO/GAS 汇率与交易预览",
  },
  docDescription: {
    en: "Neo Swap previews the live NEO/GAS rate from the Morpheus data feed with slippage and minimum-received context. No on-chain swap router is deployed yet, so this app shows a planning quote — execute the trade in your wallet or a DEX when a route is available.",
    zh: "Neo 兑换基于 Morpheus 数据源预览实时 NEO/GAS 汇率，并展示滑点与最少收到数量。当前尚未部署链上兑换路由，因此本应用提供的是规划报价 — 待路由可用后请在您的钱包或 DEX 中执行交易。",
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
    en: "Review the live rate, slippage, and minimum received",
    zh: "查看实时汇率、滑点与最少收到数量",
  },
  step4: {
    en: "Settle in your wallet or a DEX when a swap route is available — no router is deployed here yet",
    zh: "待兑换路由可用后，在您的钱包或 DEX 中结算 — 本应用尚未部署路由",
  },
  feature1Name: { en: "Best Rates", zh: "最佳汇率" },
  feature1Desc: {
    en: "Compares route context before the wallet transaction is prepared.",
    zh: "在发起钱包交易前比较路由上下文。",
  },
  feature2Name: { en: "Low Slippage", zh: "低滑点" },
  feature2Desc: {
    en: "Deep liquidity pools ensure minimal price impact on your trades.",
    zh: "深度流动性池确保您的交易价格影响最小。",
  },
  feature3Name: { en: "Live Data-Feed Quotes", zh: "实时数据源报价" },
  feature3Desc: {
    en: "Quotes come from the Morpheus data feed; on-chain settlement is pending a deployed swap router.",
    zh: "报价来自 Morpheus 数据源；链上结算需待部署兑换路由后方可进行。",
  },
  popularPairs: { en: "Popular Pairs", zh: "热门交易对" },
    sidebarRate: { en: "Rate", zh: "汇率" },
  tokenNeo: { en: "NEO", zh: "NEO" },
  // Shown on the (disabled) Swap button when no router is deployed so the CTA
  // reads as an honest "cannot settle here" state instead of a teasing action.
  settlementUnavailable: { en: "Settlement unavailable", zh: "暂不可结算" },
  // Names the quote's price source so the quote-only product is transparent
  // about where its single deliverable comes from.
  rateSourceAsOf: {
    en: "Rate via Morpheus data feed, as of {time}",
    zh: "汇率来自 Morpheus 数据源，截至 {time}",
  },
  rateSourceStaleAsOf: {
    en: "Rate via Morpheus data feed, as of {time} — may be out of date",
    zh: "汇率来自 Morpheus 数据源，截至 {time} — 可能已过期",
  },
} as const;

export const messages = mergeMessages(appMessages);
