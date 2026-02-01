export const messages = {
  // App translations
  title: { en: "Prediction Market", zh: "预测市场" },
  markets: { en: "Markets", zh: "市场" },
  portfolio: { en: "Portfolio", zh: "投资组合" },
  create: { en: "Create", zh: "创建" },
  docs: { en: "Docs", zh: "文档" },

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
  days: { en: "days", zh: "天" },
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
  insufficientBalance: { en: "Insufficient balance", zh: "余额不足" },
  invalidAmount: { en: "Invalid amount", zh: "无效数量" },
  tradeSuccess: { en: "Trade successful", zh: "交易成功" },
  tradeError: { en: "Trade failed", zh: "交易失败" },

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
  wrongChain: { en: "Wrong Network", zh: "网络错误" },
  wrongChainMessage: { en: "This app requires Neo N3 network.", zh: "此应用需 Neo N3 网络。" },
  switchToNeo: { en: "Switch to Neo N3", zh: "切换到 Neo N3" },
  error: { en: "Error", zh: "错误" },
  loading: { en: "Loading...", zh: "加载中..." },
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
  docWhatItIs: { en: "What is it?", zh: "这是什么？" },
  docHowToUse: { en: "How to use", zh: "如何使用" },
  docOnChainFeatures: { en: "On-Chain Features", zh: "链上特性" },

  // Shared component keys
  wpTitle: { en: "Wallet Required", zh: "需要钱包" },
  wpDescription: { en: "Please connect your wallet to continue.", zh: "请连接钱包以继续。" },
  wpConnect: { en: "Connect Wallet", zh: "连接钱包" },
  wpCancel: { en: "Cancel", zh: "取消" },
  docBadge: { en: "Documentation", zh: "文档" },
  docFooter: { en: "NeoHub MiniApp Protocol v2.4.0", zh: "NeoHub MiniApp Protocol v2.4.0" },
};
