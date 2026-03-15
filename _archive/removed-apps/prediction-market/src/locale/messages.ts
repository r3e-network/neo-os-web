import { mergeMessages } from "@shared/locale/base-messages";

const appMessages = {
  // App translations
  title: { en: "Prediction Market", zh: "预测市场" },
  markets: { en: "Markets", zh: "市场" },
  portfolio: { en: "Portfolio", zh: "投资组合" },
  create: { en: "Create", zh: "创建" },

  // Market List
  browseMarkets: { en: "Browse Markets", zh: "浏览市场" },
  activeMarkets: { en: "Active Markets", zh: "活跃市场" },
  resolvedMarkets: { en: "Resolved Markets", zh: "已解决市场" },
  noMarkets: { en: "No markets available", zh: "暂无市场" },
  marketCategories: { en: "Categories", zh: "分类" },
  categoryAll: { en: "All", zh: "全部" },
  categoryCrypto: { en: "Crypto", zh: "加密货币" },
  categorySports: { en: "Sports", zh: "体育" },
  categoryPolitics: { en: "Politics", zh: "政治" },
  categoryEconomics: { en: "Economics", zh: "经济" },
  categoryEntertainment: { en: "Entertainment", zh: "娱乐" },
  categoryOther: { en: "Other", zh: "其他" },

  // Market Card
  yesShares: { en: "YES", zh: "是" },
  noShares: { en: "NO", zh: "否" },
  currentPrice: { en: "Current Price", zh: "当前价格" },
  totalVolume: { en: "Total Volume", zh: "总交易量" },
  endsIn: { en: "Ends in", zh: "结束于" },
  viewDetails: { en: "View Details", zh: "查看详情" },
  hours: { en: "hours", zh: "小时" },
  minutes: { en: "minutes", zh: "分钟" },

  // Market Details
  marketDetails: { en: "Market Details", zh: "市场详情" },
  description: { en: "Description", zh: "描述" },
  resolutionSource: { en: "Resolution Source", zh: "解决来源" },
  endTime: { en: "End Time", zh: "结束时间" },
  createdAt: { en: "Created", zh: "创建时间" },
  creator: { en: "Creator", zh: "创建者" },
  marketStatus: { en: "Status", zh: "状态" },
  statusOpen: { en: "Open", zh: "开放" },
  statusClosed: { en: "Closed", zh: "已关闭" },
  statusResolved: { en: "Resolved", zh: "已解决" },
  statusCancelled: { en: "Cancelled", zh: "已取消" },

  // Trading
  trading: { en: "Trading", zh: "交易" },
  buy: { en: "Buy", zh: "买入" },
  sell: { en: "Sell", zh: "卖出" },
  amount: { en: "Amount", zh: "数量" },
  cost: { en: "Cost", zh: "费用" },
  shares: { en: "shares", zh: "份" },
  totalPrice: { en: "Total Price", zh: "总价格" },
  confirmTrade: { en: "Confirm Trade", zh: "确认交易" },
  invalidAmount: { en: "Invalid amount", zh: "无效数量" },
  tradeSuccess: { en: "Trade successful", zh: "交易成功" },
  tradeError: { en: "Trade failed", zh: "交易失败" },

  // Web detail layout
  marketDescriptionFallback: {
    en: "No additional market description has been published yet.",
    zh: "该市场暂未发布更多说明。",
  },
  coreLogicTitle: { en: "Core Logic", zh: "核心逻辑" },
  logicResolutionRule: { en: "Resolution Rule", zh: "判定规则" },
  logicSettlementAt: { en: "Settlement Time", zh: "结算时间" },
  logicOracle: { en: "Oracle / Resolver", zh: "预言机 / 解析器" },
  commentsTab: { en: "Comments", zh: "评论" },
  reviewsTab: { en: "Reviews", zh: "复盘" },
  commentPlaceholder: { en: "Share your thesis...", zh: "写下你的判断依据..." },
  publishComment: { en: "Publish", zh: "发布" },
  noReviewsYet: { en: "No review entries yet", zh: "暂无复盘记录" },
  operationPanelTitle: { en: "Operation Panel", zh: "操作面板" },
  operationPanelHint: {
    en: "Configure transaction parameters clearly before signing on-chain.",
    zh: "在链上签名之前，清晰配置交易参数。",
  },
  chooseOutcome: { en: "Choose Outcome", zh: "选择结果" },
  workflowStepConfig: { en: "1. Configure", zh: "1. 配置" },
  workflowStepReview: { en: "2. Review", zh: "2. 预览" },
  workflowStepSign: { en: "3. Sign", zh: "3. 签名" },
  txEdge: { en: "Vs Market", zh: "相对市场" },
  txContract: { en: "Contract", zh: "合约" },
  txContractValue: { en: "PredictionMarket", zh: "PredictionMarket" },
  txCallData: { en: "Call Data", zh: "调用数据" },
  txPreview: { en: "Transaction Preview", zh: "交易预览" },
  txMethod: { en: "Method", zh: "方法" },
  txNetwork: { en: "Network", zh: "网络" },
  txSubtotal: { en: "Subtotal", zh: "小计" },
  txFee: { en: "Estimated Fee", zh: "预估手续费" },
  txTotal: { en: "Total", zh: "总计" },
  txMaxPayout: { en: "Max Payout", zh: "最大回报" },
  signAndSubmit: { en: "Sign & Submit", zh: "签名并提交" },
  txFootnote: {
    en: "Submitting confirms the transaction details and wallet signature intent.",
    zh: "提交即表示你确认交易详情并准备发起钱包签名。",
  },
  commentTimeNow: { en: "now", zh: "刚刚" },
  commentTimeHour: { en: "1h ago", zh: "1 小时前" },
  commentTimeTwoHours: { en: "2h ago", zh: "2 小时前" },
  commentTimeFourHours: { en: "4h ago", zh: "4 小时前" },
  commentSeedOne: {
    en: "If regulators release a formal notice, YES reprices quickly.",
    zh: "若监管机构发布正式公告，YES 价格会迅速重估。",
  },
  commentSeedTwo: {
    en: "I am waiting for stronger primary sources before scaling in.",
    zh: "我在等待更强的一手信号再加仓。",
  },
  commentSeedThree: {
    en: "Volatility is high near deadlines, so risk size matters more than conviction.",
    zh: "临近截止波动很大，仓位管理比主观判断更重要。",
  },
  reviewPositionTitle: { en: "Position Snapshot", zh: "持仓快照" },
  reviewPositionBody: {
    en: "Holding {shares} shares with average entry {avgPrice}.",
    zh: "当前持有 {shares} 份，平均建仓价格 {avgPrice}。",
  },
  reviewOrderTitle: { en: "Recent Order", zh: "最近订单" },
  reviewOrderBody: {
    en: "Executed/placed {shares} shares at {price}.",
    zh: "以 {price} 成交或挂单 {shares} 份。",
  },
  youLabel: { en: "You", zh: "你" },

  // Order Book
  orderBook: { en: "Order Book", zh: "订单簿" },
  yourOrders: { en: "Your Orders", zh: "您的订单" },
  noOrders: { en: "No orders", zh: "暂无订单" },
  orderType: { en: "Type", zh: "类型" },
  orderPrice: { en: "Price", zh: "价格" },
  orderShares: { en: "Shares", zh: "数量" },
  orderTotal: { en: "Total", zh: "总计" },
  cancelOrder: { en: "Cancel", zh: "取消" },
  orderCancelled: { en: "Order cancelled", zh: "订单已取消" },

  // Portfolio
  yourPortfolio: { en: "Your Portfolio", zh: "您的投资组合" },
  totalValue: { en: "Total Value", zh: "总价值" },
  totalProfit: { en: "Total Profit/Loss", zh: "总盈亏" },
  yourPositions: { en: "Your Positions", zh: "您的持仓" },
  noPositions: { en: "No positions", zh: "暂无持仓" },
  positionMarket: { en: "Market", zh: "市场" },
  positionShares: { en: "Shares", zh: "持仓" },
  positionAvgPrice: { en: "Avg Price", zh: "平均价格" },
  positionCurrentPrice: { en: "Current Price", zh: "当前价格" },
  positionValue: { en: "Value", zh: "价值" },
  positionPnL: { en: "Profit/Loss", zh: "盈亏" },
  claimWinnings: { en: "Claim Winnings", zh: "领取奖金" },
  winningsClaimed: { en: "Winnings claimed", zh: "奖金已领取" },

  // Create Market
  createMarket: { en: "Create Market", zh: "创建市场" },
  question: { en: "Question", zh: "问题" },
  questionPlaceholder: {
    en: "e.g., Will BTC exceed $100k by end of 2025?",
    zh: "例如：2025 年底 BTC 会超过 10 万美元吗？",
  },
  descriptionPlaceholder: {
    en: "Provide additional details about this prediction market...",
    zh: "提供关于此预测市场的额外详情...",
  },
  category: { en: "Category", zh: "分类" },
  selectCategory: { en: "Select a category", zh: "选择分类" },
  endDate: { en: "End Date", zh: "结束日期" },
  oracle: { en: "Oracle", zh: "预言机" },
  selectOracle: { en: "Select an oracle", zh: "选择预言机" },
  resolutionTime: { en: "Resolution Time", zh: "解决时间" },
  initialLiquidity: { en: "Initial Liquidity", zh: "初始流动性" },
  liquidityInfo: {
    en: "Initial liquidity to seed the market (minimum 10 GAS)",
    zh: "初始流动性用于启动市场（最少 10 GAS）",
  },
  createMarketSuccess: { en: "Market created successfully", zh: "市场创建成功" },
  fillAllFields: { en: "Please fill all required fields", zh: "请填写所有必填字段" },
  invalidEndDate: { en: "End date must be in the future", zh: "结束日期必须是未来时间" },
  marketCreationFailed: { en: "Failed to create market", zh: "市场创建失败" },

  // Resolution
  resolveMarket: { en: "Resolve Market", zh: "解决市场" },
  resolveTo: { en: "Resolve to", zh: "解决为" },
  resolveYes: { en: "YES - Outcome occurred", zh: "是 - 事件发生" },
  resolveNo: { en: "NO - Outcome did not occur", zh: "否 - 事件未发生" },
  confirmResolution: { en: "Confirm Resolution", zh: "确认解决" },
  resolutionWarning: {
    en: "This action cannot be undone. Make sure the oracle has confirmed the outcome.",
    zh: "此操作无法撤销。请确保预言机已确认结果。",
  },
  marketResolved: { en: "Market resolved", zh: "市场已解决" },
  resolutionFailed: { en: "Resolution failed", zh: "解决失败" },

  // Errors
  connectWallet: { en: "Connect wallet to continue", zh: "请连接钱包" },
  contractUnavailable: { en: "Contract not configured", zh: "合约未配置" },
  failedToLoad: { en: "Failed to load", zh: "加载失败" },

  // Docs
  docSubtitle: {
    en: "Decentralized prediction markets with oracle settlement",
    zh: "基于预言机结算的去中心化预测市场",
  },
  docDescription: {
    en: "Prediction Market allows users to create and bet on real-world events. Markets are resolved through decentralized oracles, with transparent order books and automatic payouts.",
    zh: "预测市场允许用户创建并就现实世界事件进行投注。市场通过去中心化预言机解决，具有透明的订单簿和自动支付。",
  },
  step1: {
    en: "Browse active markets or create your own prediction market",
    zh: "浏览活跃市场或创建您自己的预测市场",
  },
  step2: {
    en: "Buy YES or NO shares based on your prediction",
    zh: "根据您的预测买入 YES 或 NO 份额",
  },
  step3: {
    en: "Wait for the event to conclude and oracle resolution",
    zh: "等待事件结束和预言机解决",
  },
  step4: {
    en: "Claim your winnings if your prediction was correct",
    zh: "如果您的预测正确，领取奖金",
  },
  feature1Name: { en: "Oracle Resolution", zh: "预言机解决" },
  feature1Desc: {
    en: "Markets are resolved automatically through decentralized oracles.",
    zh: "市场通过去中心化预言机自动解决。",
  },
  feature2Name: { en: "Order Book Trading", zh: "订单簿交易" },
  feature2Desc: {
    en: "Trade with limit orders at your desired price points.",
    zh: "在您期望的价格点使用限价单交易。",
  },
  feature3Name: { en: "Transparent Payouts", zh: "透明支付" },
  feature3Desc: {
    en: "All winnings are automatically distributed via smart contract.",
    zh: "所有奖金通过智能合约自动分发。",
  },
  feature4Name: { en: "Market Categories", zh: "市场分类" },
  feature4Desc: {
    en: "Create markets for crypto, sports, politics, and more.",
    zh: "为加密货币、体育、政治等创建市场。",
  },

  avgLabel: { en: "Avg", zh: "均价" },
  ariaOrders: { en: "Orders", zh: "订单" },
  ariaPositions: { en: "Positions", zh: "持仓" },
  sidebarVolume: { en: "Volume", zh: "交易量" },
  sidebarTraders: { en: "Traders", zh: "交易者" },
  portfolioValue: { en: "Portfolio Value", zh: "投资组合价值" },
  totalPnL: { en: "Total P&L", zh: "总盈亏" },
  sortByVolume: { en: "By Volume", zh: "按交易量" },
  sortByNewest: { en: "By Newest", zh: "按最新" },
  sortByEnding: { en: "By Ending", zh: "按结束时间" },
} as const;

export const messages = mergeMessages(appMessages);
