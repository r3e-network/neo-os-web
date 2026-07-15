import { mergeMessages } from "@shared/locale/base-messages";

const appMessages = {
    // App translations
title: { en: "Neo Swap — NEO/GAS liquidity desk", zh: "Neo 兑换 — NEO/GAS 流动性工作台" },
  subtitle: {
    en: "Preview a timestamped NEO ↔ GAS quote and review settlement guards before a route is enabled",
    zh: "预览带时间戳的 NEO ↔ GAS 报价，并在路由启用前核对结算保护",
  },
  from: { en: "From", zh: "从" },
  to: { en: "To", zh: "到" },
  balance: { en: "Balance", zh: "余额" },
  balanceUnavailable: { en: "Balance unavailable", zh: "余额不可用" },
  balanceLoading: { en: "Checking balance...", zh: "正在核验余额..." },
  connectForBalance: { en: "Connect to view", zh: "连接后查看" },
  connectForBalances: { en: "Connect wallet to view balances", zh: "连接钱包查看余额" },
  retryBalance: { en: "Retry wallet balances", zh: "重新读取钱包余额" },
  exchangeRate: { en: "Exchange Rate", zh: "兑换率" },
  exchangeRateShort: { en: "Rate", zh: "汇率" },
  priceImpact: { en: "Route impact (router required)", zh: "路由影响（需启用路由）" },
  notAvailable: { en: "Unavailable", zh: "不可用" },
  approxEqual: { en: "≈", zh: "≈" },
  slippage: { en: "Slippage Tolerance", zh: "滑点容差" },
  slippageShort: { en: "Slippage", zh: "滑点" },
  liquidityPool: { en: "Settlement Route", zh: "结算路由" },
  minReceived: { en: "Minimum Received", zh: "最少收到" },
  minReceivedShort: { en: "Min received", zh: "最少收到" },
  planningFloor: { en: "Planning floor (not enforced)", zh: "规划下限（未执行）" },
  enterAmount: { en: "Enter amount", zh: "输入数量" },
  // Readout zero-state for the estimated receive amount and the planning floor.
  // Distinct from `enterAmount`, which is the engine's action-label for the same
  // condition: this one stands where a value would be, so it reads as a value
  // ("Awaiting amount") rather than as an instruction on a button.
  awaitingAmount: { en: "Awaiting amount", zh: "等待输入数量" },
  max: { en: "MAX", zh: "最大" },
  rateUnavailable: { en: "Rate unavailable", zh: "汇率不可用" },
  loadingRate: { en: "Loading rate...", zh: "正在加载汇率..." },
  refreshRate: { en: "Refresh rate", zh: "刷新汇率" },
  rateRefreshFailed: {
    en: "The live quote could not be verified. Refresh to try again.",
    zh: "暂时无法核验实时报价，请刷新后重试。",
  },
  rateRetryHint: {
    en: "No cached value is shown. Refresh when the data feed is available.",
    zh: "不会展示缓存数值。数据源恢复后请刷新重试。",
  },
  swapping: { en: "Swapping...", zh: "兑换中..." },
  insufficientBalance: { en: "Insufficient balance", zh: "余额不足" },
  neoIntegerOnly: { en: "NEO is indivisible — enter a whole number", zh: "NEO 不可分割 — 请输入整数" },
  invalidAmount: { en: "Enter a valid amount", zh: "请输入有效金额" },
  quoteRoundsToZero: {
    en: "Amount is too small for the receiving token",
    zh: "数量过小，无法换算为接收资产的最小单位",
  },
  tokenPrecisionExceeded: {
    en: "{token} supports at most {decimals} decimal places",
    zh: "{token} 最多支持 {decimals} 位小数",
  },
  selectToken: { en: "Select Token", zh: "选择代币" },
  selectTokenAria: { en: "Select {token}", zh: "选择 {token}" },
  balanceDefault: { en: "—", zh: "—" },
  swapSuccess: { en: "Swapped", zh: "兑换成功" },
  swapFailed: { en: "Swap failed", zh: "兑换失败" },
  swapFailedRecoveryHint: {
    en: "The wallet did not return a verified submission. Review the wallet and route status before trying again.",
    zh: "钱包未返回可核验的提交结果。请先检查钱包与路由状态，再决定是否重试。",
  },
  swapConfirmationPending: {
    en: "The transaction was broadcast but SwapExecuted is not verified yet. Keep the quote and check the transaction before retrying.",
    zh: "交易已广播，但尚未核验到 SwapExecuted。请保留当前报价并先检查交易，再决定是否重试。",
  },
  checkPendingSwap: { en: "Check pending swap", zh: "检查待确认兑换" },
  swapStillPending: {
    en: "The exact transaction is still unverified. Check again before submitting another swap.",
    zh: "该笔交易仍未核验。请再次检查后再提交新的兑换。",
  },
  swapRecoveryFailed: {
    en: "The pending transaction could not be checked. Your swap details are still saved on this device.",
    zh: "暂时无法检查待确认交易；兑换详情仍保存在此设备上。",
  },
  swapRecovered: { en: "Swap confirmed", zh: "兑换已确认" },
  swapRouterUnavailable: { en: "Swap router unavailable", zh: "兑换路由不可用" },
  // Same reframing as `routeModePreviewBody`: state the capability first, then
  // the boundary. Both facts are unchanged.
  swapRouterUnavailableHint: {
    en: "Quotes here are live. On-chain settlement opens once a swap router is deployed for this network.",
    zh: "此处的报价为实时数据。待本网络部署兑换路由后，即可开放链上结算。",
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
    en: "This desk verifies quote freshness and settlement guards. It does not claim pool depth while no router is deployed.",
    zh: "本工作台核验报价新鲜度与结算保护；在未部署路由时，不会声称存在池深度。",
  },
  swapPortfolioLabel: { en: "Wallet balances", zh: "钱包余额" },
  tradeTicket: { en: "Swap ticket", zh: "兑换票据" },
  payWith: { en: "Pay with", zh: "支付资产" },
  payAmountLabel: { en: "Amount to pay", zh: "支付数量" },
  quoteSummary: { en: "Quote summary", zh: "报价摘要" },
  swapRouteStatus: { en: "Route status", zh: "路由状态" },
  swapRouteReady: { en: "Route ready", zh: "路由就绪" },
  swapRouteSyncing: { en: "Syncing quote", zh: "正在同步报价" },
  swapRouteNeedsAttention: { en: "Quote unavailable", zh: "报价不可用" },
  swapRouteUnavailable: { en: "Planning only", zh: "仅规划" },
  quoteNetwork: { en: "Quote network", zh: "报价网络" },
  walletNetwork: { en: "Wallet network", zh: "钱包网络" },
  walletNetworkMismatch: {
    en: "Switch wallet to Neo N3 {network}",
    zh: "请将钱包切换到 Neo N3 {network}",
  },
  networkMatched: { en: "Network matched", zh: "网络一致" },
  walletNotChecked: { en: "Connect to verify", zh: "连接后核验" },
  settlementChecklist: { en: "Settlement checklist", zh: "结算检查" },
  approvalLabel: { en: "Token authorization", zh: "代币授权" },
  approvalNotRequested: { en: "Not requested — no router", zh: "未请求 — 暂无路由" },
  approvalWalletTransaction: {
    en: "Inside the wallet-signed NEP-17 transaction",
    zh: "在钱包签名的 NEP-17 交易内完成",
  },
  priceImpactUnavailable: {
    en: "Unavailable until a verified liquidity route provides depth",
    zh: "需已验证流动性路由提供深度后才可计算",
  },
  transactionLabel: { en: "Transaction", zh: "交易状态" },
  transactionIdle: { en: "Not submitted", zh: "尚未提交" },
  transactionSigning: { en: "Awaiting wallet signature", zh: "等待钱包签名" },
  transactionPending: { en: "Broadcast — checking confirmation", zh: "已广播 — 正在核验确认" },
  transactionUnverified: { en: "Broadcast — confirmation unverified", zh: "已广播 — 尚未核验确认" },
  transactionConfirmed: { en: "Confirmed by SwapExecuted", zh: "已由 SwapExecuted 确认" },
  transactionFailed: { en: "Submission not confirmed", zh: "提交状态未确认" },
  pendingTxLabel: { en: "Pending transaction", zh: "待确认交易" },
  swapSafetyTitle: { en: "Wallet review", zh: "钱包复核" },
  swapSafetyCopy: {
    en: "Slippage and minimum received stay visible before the wallet confirmation.",
    zh: "钱包确认前始终展示滑点和最少收到数量。",
  },
  slippageControl: { en: "Slippage guard", zh: "滑点保护" },
  routeReview: { en: "Route review", zh: "路由复核" },
  routeReviewShort: { en: "Route", zh: "路由" },
  routeModeLive: { en: "Ready for wallet settlement", zh: "可在钱包中结算" },
  routeModePreview: { en: "Planning mode only", zh: "仅规划模式" },
  routeModeLiveBody: {
    en: "A router is configured for this network. Review the route and sign only if every figure matches your intent.",
    zh: "本网络已配置兑换路由。请复核路线，并仅在每一项数据符合预期时签名。",
  },
  // Store-facing: this opens the Route review panel on a cold visit. Leading
  // with "No router is deployed on this network yet" advertised the app as
  // non-functional before saying what it does. The gate is real and stays
  // stated — just after the capability, in product voice.
  routeModePreviewBody: {
    en: "Compare the live quote and prepare the trade here. Settlement signing opens once a swap router is configured for this network.",
    zh: "在这里比较实时报价并规划交易。待本网络配置兑换路由后，即可开放结算签名。",
  },
  routeSourceMorpheus: { en: "Morpheus quote loaded", zh: "Morpheus 报价已加载" },
  routeSourceAwaiting: { en: "Refresh to load the quote", zh: "刷新以加载报价" },
  routeStepQuote: { en: "Oracle quote", zh: "预言机报价" },
  routeStepPair: { en: "Direct pair", zh: "直接交易对" },
  routeStepWallet: { en: "Wallet review", zh: "钱包复核" },
  marketPairs: { en: "Market", zh: "市场" },
  quoteHealth: { en: "Quote health", zh: "报价状态" },
  routerLabel: { en: "Swap Router", zh: "兑换路由" },
  openDex: { en: "Open swap route", zh: "打开兑换路由" },
  yourPosition: { en: "Your Preview", zh: "您的预览" },
  poolShare: { en: "Route Availability", zh: "路由可用性" },
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
    en: "Select NEO or GAS and refresh the public quote; a wallet is optional for balance reads",
    zh: "选择 NEO 或 GAS 并刷新公开报价；只有读取余额时才需要连接钱包",
  },
  step2: {
    en: "Enter the amount and review the timestamped exchange rate",
    zh: "输入数量并核对带时间戳的汇率",
  },
  step3: {
    en: "Review the live rate, slippage, and minimum received",
    zh: "查看实时汇率、滑点与最少收到数量",
  },
  step4: {
    en: "Settle in your wallet or a DEX when a swap route is available — no router is deployed here yet",
    zh: "待兑换路由可用后，在您的钱包或 DEX 中结算 — 本应用尚未部署路由",
  },
  feature1Name: { en: "Timestamped Quote", zh: "带时间戳的报价" },
  feature1Desc: {
    en: "Shows the Morpheus cross-rate only when both price legs can be read, with freshness metadata.",
    zh: "仅在两个价格数据均可读取时展示 Morpheus 交叉汇率，并附带新鲜度信息。",
  },
  feature2Name: { en: "Explicit Slippage Floor", zh: "明确的滑点下限" },
  feature2Desc: {
    en: "Calculates minimum received from the selected tolerance without inventing liquidity or price-impact data.",
    zh: "根据所选容差计算最少收到数量，不虚构流动性或价格影响数据。",
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

  // -- Interactive slippage control -----------------------------------------
  slippageHint: {
    en: "This tolerance calculates the planning floor below. A verified router must enforce the same integer minimum at signing.",
    zh: "该容差用于计算下方规划下限；启用经核验的路由后，签名时必须执行同一整数最少到账值。",
  },
  slippageCustom: { en: "Custom", zh: "自定义" },
  slippageCustomLabel: { en: "Custom slippage in percent", zh: "自定义滑点（百分比）" },
  slippagePreset: { en: "Set slippage to {pct}", zh: "将滑点设为 {pct}" },
  slippageHigh: {
    en: "High slippage — you may receive notably less than quoted.",
    zh: "滑点较高 — 实际收到可能明显少于报价。",
  },

  // -- Quote / preview transparency ------------------------------------------
  pricePreviewOnly: {
    en: "Review quote — confirm every figure in your wallet before signing.",
    zh: "复核报价 — 签名前请在钱包中确认每一项数据。",
  },
  estSettlement: { en: "Est. settlement", zh: "预计结算" },
  estSettlementValue: { en: "Provided by the enabled wallet route", zh: "由启用的钱包路由提供" },
  networkFeeLabel: { en: "Network fee", zh: "网络手续费" },
  networkFeeValue: { en: "Paid in GAS at signing", zh: "签名时以 GAS 支付" },
  networkLabel: { en: "Network", zh: "网络" },
  routeLabel: { en: "Route", zh: "路由" },
  routeDirectValue: { en: "Direct {pair}", zh: "直接 {pair}" },

  // -- Quote-only "live price preview" focus (no router deployed) -------------
  // When settlement is unavailable, quoting is the real capability — these lead
  // the screen so the price is the focus instead of five disabled signals.
  pricePreviewTitle: { en: "Live price preview", zh: "实时价格预览" },
  pricePreviewBody: {
    en: "On-chain settlement is not enabled on this network yet, so this is a planning quote. Settle in your wallet or a DEX when a route is available.",
    zh: "本网络尚未启用链上结算，因此这是规划报价。待路由可用后，请在您的钱包或 DEX 中结算。",
  },
  pricePreviewRate: { en: "1 {from} buys", zh: "1 {from} 兑换" },
  pricePreviewAwaiting: { en: "Refresh to load the live rate", zh: "刷新以加载实时汇率" },
  // Disclosure that folds the full From/To/slippage apparatus away until a route
  // exists, keeping the preview compact.
  setupTradeSummary: { en: "Set up the trade (settles when a route is enabled)", zh: "设置交易（路由启用后可结算）" },
  // Collapsible wrapper for the four transaction-detail rows, to cut first-screen density.
  txDetailsSummary: { en: "Transaction details", zh: "交易详情" },
  // Read-only output relabel so it reads as a result, not a dead input.
  receiveEstimated: { en: "You receive (estimated)", zh: "您将收到（预估）" },

  // -- Disconnected / how-it-works empty state -------------------------------
  introHeading: { en: "Preview a NEO ↔ GAS trade before you sign", zh: "签名前预览 NEO ↔ GAS 兑换" },
  introBody: {
    en: "Refresh the public cross-rate without a wallet. Connect only to read your balances or, once a verified router exists, review a transaction before signing.",
    zh: "无需钱包即可刷新公开交叉汇率。仅在读取余额，或未来存在已验证路由并需要签名前复核交易时连接钱包。",
  },
  introStepRate: { en: "Live cross-rate", zh: "实时交叉汇率" },
  introStepRateBody: { en: "Pulled from the Morpheus data feed, timestamped so you know how fresh it is.", zh: "来自 Morpheus 数据源，带时间戳以便您了解数据新鲜度。" },
  introStepSlippage: { en: "Adjustable slippage", zh: "可调滑点" },
  introStepSlippageBody: { en: "Pick your tolerance; the minimum received updates instantly.", zh: "选择您的容差，最少收到数量会即时更新。" },
  introStepSettle: { en: "Settle in your wallet", zh: "在钱包中结算" },
  introStepSettleBody: { en: "You review the amount, asset, and network before signing.", zh: "您在签名前核对数量、资产和网络。" },
  connectToPreview: { en: "Connect wallet", zh: "连接钱包" },
} as const;

export const messages = mergeMessages(appMessages);
