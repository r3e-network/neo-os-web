import { mergeMessages } from "@shared/locale/base-messages";

const appMessages = {
  // App translations
  title: { en: "Flash Loan", zh: "闪电贷" },
  appName: { en: "Flash Loan", zh: "闪电贷" },

  // Section eyebrows (uppercase + tracked per Neo Soft convention)
  eyebrow: { en: "Atomic liquidity", zh: "原子流动性" },
  requestLoanEyebrow: { en: "Atomic liquidity", zh: "原子流动性" },
  loanCalculatorEyebrow: { en: "Calculator", zh: "计算器" },
  statusLookupEyebrow: { en: "On-chain lookup", zh: "链上查询" },
  recentLoansEyebrow: { en: "History", zh: "历史记录" },
  liquidityEyebrow: { en: "Provide liquidity", zh: "提供流动性" },
  connectWalletToUse: {
    en: "Connect wallet to use Flash Loan",
    zh: "连接钱包使用闪电贷",
  },
  connectAndSign: { en: "Connect and Sign", zh: "连接并签名" },
  signRequestFlashLoan: {
    en: "Sign requestFlashLoan",
    zh: "签名 requestFlashLoan",
  },
  walletRequired: { en: "Wallet required", zh: "需要钱包" },
  instructionMode: { en: "INSTRUCTIONAL MODE", zh: "教学模式" },
  instructionNote: {
    en: "Flash loans remain a power-user flow. This miniapp helps you inspect pool state and submit callback-based executions.",
    zh: "闪电贷仍然是高级用户流程。本应用用于查看池子状态并提交基于回调合约的执行。",
  },
  // Borrowing needs a deployed onFlashLoan callback contract; non-developers
  // can still use the Provide Liquidity card below to earn fees.
  instructionLpHint: {
    en: "Borrowing requires a deployed contract that implements onFlashLoan. No callback contract? Provide liquidity below instead to earn a share of the loan fees.",
    zh: "借款需要已部署并实现 onFlashLoan 的合约。没有回调合约？可改为在下方提供流动性，赚取借款手续费分成。",
  },
  flashLoanFlow: { en: "Flash Loan Flow", zh: "闪电贷流程" },
  borrow: { en: "Borrow", zh: "借款" },
  execute: { en: "Execute", zh: "执行" },
  repay: { en: "Repay", zh: "还款" },
  flowNote: {
    en: "All operations execute atomically in a single transaction",
    zh: "所有操作在单笔交易中原子化执行",
  },
  statusLookup: { en: "Loan Status Lookup", zh: "贷款状态查询" },
  loanId: { en: "Loan ID", zh: "贷款 ID" },
  loanIdPlaceholder: { en: "Enter loan ID", zh: "输入贷款 ID" },
  checkStatus: { en: "Check Status", zh: "查询状态" },
  checking: { en: "Checking...", zh: "查询中..." },
  statusLabel: { en: "Status", zh: "状态" },
  statusHint: {
    en: "Enter a loan ID to fetch its on-chain status.",
    zh: "输入贷款 ID 以查询链上状态。",
  },
  statusPending: { en: "Pending", zh: "待处理" },
  statusSuccess: { en: "Executed", zh: "已执行" },
  statusFailed: { en: "Failed", zh: "失败" },
  borrower: { en: "Borrower", zh: "借款人" },
  callbackContract: { en: "Callback Contract", zh: "回调合约" },
  callbackMethod: { en: "Callback Method", zh: "回调方法" },
  timestamp: { en: "Timestamp", zh: "时间" },
  amount: { en: "Amount", zh: "金额" },
  feeShort: { en: "Fee", zh: "手续费" },
  poolBalance: { en: "Pool Balance", zh: "池子余额" },
  poolBalanceNote: {
    en: "Available liquidity for flash loans",
    zh: "可用于闪电贷的流动性",
  },
  statistics: { en: "Loan Activity", zh: "贷款活动" },
  totalLoans: { en: "Loans Executed", zh: "已执行贷款" },
  totalVolume: { en: "Total Volume (GAS)", zh: "总交易量 (GAS)" },
  totalFees: { en: "Total Fees (GAS)", zh: "总手续费 (GAS)" },
  avgLoanSize: { en: "Avg Loan Size (GAS)", zh: "平均额度 (GAS)" },
  recentLoans: { en: "Recent Executions", zh: "最近执行" },
  noHistory: { en: "No executions yet", zh: "暂无执行记录" },
  loanStatusLoaded: { en: "Loan status loaded", zh: "贷款状态已加载" },
  loanNotFound: { en: "Loan not found", zh: "未找到该贷款" },
  invalidLoanId: { en: "Invalid loan ID", zh: "无效贷款 ID" },
  invalidLoanAmount: { en: "Invalid loan amount", zh: "无效贷款金额" },
  loanAmountBelowMin: {
    en: "Amount is below the minimum of {min} GAS",
    zh: "金额低于最小额度 {min} GAS",
  },
  loanAmountAboveMax: {
    en: "Amount exceeds the maximum of {max} GAS",
    zh: "金额超过最大额度 {max} GAS",
  },
  invalidCallbackContract: {
    en: "Invalid callback contract address",
    zh: "无效回调合约地址",
  },
  invalidCallbackMethod: {
    en: "Callback method must be onFlashLoan",
    zh: "回调方法必须是 onFlashLoan",
  },
  main: { en: "Status", zh: "状态" },
  stats: { en: "Activity", zh: "活动" },
  docs: { en: "Learn", zh: "学习" },

  // Create Loan
  tabLookup: { en: "Lookup", zh: "查询" },
  tabCreate: { en: "Request Loan", zh: "请求贷款" },
  requestLoanTitle: { en: "Request Flash Loan", zh: "请求闪电贷" },
  loanAmount: { en: "Loan Amount", zh: "贷款金额" },
  amountPlaceholder: { en: "Enter amount in GAS", zh: "输入 GAS 金额" },
  amountPresets: { en: "Amount presets", zh: "金额预设" },
  loanPackageDeck: { en: "Loan package deck", zh: "贷款包牌组" },
  loanPackageProbe: { en: "Callback probe", zh: "回调探针" },
  loanPackageRoute: { en: "Route rehearsal", zh: "路径排练" },
  loanPackageScale: { en: "Scale execution", zh: "规模执行" },
  callbackContractPlaceholder: {
    en: "Enter callback contract address",
    zh: "输入回调合约地址",
  },
  callbackMethodPlaceholder: { en: "onFlashLoan", zh: "onFlashLoan" },
  callbackMethodFixed: {
    en: "Callback method is fixed to onFlashLoan for safety.",
    zh: "为保证安全，回调方法固定为 onFlashLoan。",
  },
  duration: { en: "Duration", zh: "持续时间" },
  enterDuration: { en: "Enter duration in days", zh: "输入持续时间（天）" },
  loanCalculator: { en: "Loan Calculator", zh: "贷款计算器" },
  estimatedFee: { en: "Estimated Fee", zh: "预估手续费" },
  totalRepayment: { en: "Total Repayment", zh: "总还款额" },
  flashloanInfo: {
    en: "The callback contract receives the principal, executes your logic, and must return principal + fee before the transaction finishes.",
    zh: "回调合约会先收到本金、执行你的逻辑，并且必须在交易结束前归还本金和手续费。",
  },
  flashloanHeroImageAlt: {
    en: "Bright DeFi liquidity desk with GAS flowing through an atomic flash-loan route",
    zh: "明亮的 DeFi 流动性控制台，GAS 沿原子闪电贷路径流动",
  },
  flashloanHeroArtKicker: { en: "Live pool route", zh: "实时资金路径" },
  flashloanHeroArtTitle: {
    en: "Borrow, execute, repay",
    zh: "借入、执行、归还",
  },
  requestTicketEyebrow: { en: "Execution ticket", zh: "执行票据" },
  requestTicketTitle: {
    en: "Flash-loan execution ticket",
    zh: "闪电贷执行票据",
  },
  amountTicketHint: {
    en: "Principal routed atomically through the callback",
    zh: "本金通过回调合约原子路由",
  },
  readinessWallet: { en: "Wallet", zh: "钱包" },
  readinessWalletReady: { en: "Connected", zh: "已连接" },
  readinessWalletAction: { en: "Connect before signing", zh: "签名前连接钱包" },
  readinessCallback: { en: "Callback", zh: "回调合约" },
  readinessCallbackReady: { en: "Contract target set", zh: "合约目标已设置" },
  readinessCallbackMissing: { en: "Add callback contract", zh: "填写回调合约" },
  readinessRepayment: { en: "Repayment guard", zh: "还款守卫" },
  readinessRepaymentGuard: {
    en: "Principal + fee must return in one tx",
    zh: "本金和手续费必须单笔归还",
  },
  requestLoan: { en: "Request Loan", zh: "请求贷款" },
  requesting: { en: "Requesting...", zh: "请求中..." },
  loanRequested: {
    en: "Flash loan transaction submitted.",
    zh: "闪电贷交易已提交。",
  },
  loanSubmitted: {
    en: "Flash loan transaction submitted.",
    zh: "闪电贷交易已提交。",
  },
  flashloanFormIncomplete: {
    en: "Enter amount and callback contract.",
    zh: "请输入金额和回调合约。",
  },
  latestTx: { en: "Latest Tx", zh: "最新交易" },
  noRequestYet: {
    en: "No flash-loan transaction has been submitted in this session.",
    zh: "本次会话尚未提交闪电贷交易。",
  },
  docSubtitle: { en: "Understanding Flash Loans", zh: "理解闪电贷" },
  docDescription: {
    en: "Flash loans enable uncollateralized borrowing with instant repayment in one transaction. The live testnet contract is self-contained: pool funding, callback execution, and repayment checks all happen on-chain.",
    zh: "闪电贷支持无抵押借款，并在同一笔交易中即时归还。当前测试网合约已经自洽：资金池入金、回调执行与还款校验全部在链上完成。",
  },
  docTitle: { en: "Flash Loan Documentation", zh: "闪电贷文档" },
  contractInfo: { en: "Contract Information", zh: "合约信息" },
  contractName: { en: "Contract Name", zh: "合约名称" },
  version: { en: "Version", zh: "版本" },
  minLoan: { en: "Min Loan", zh: "最小贷款" },
  maxLoan: { en: "Max Loan", zh: "最大贷款" },
  cooldown: { en: "Cooldown", zh: "冷却时间" },
  minutes: { en: "minutes", zh: "分钟" },
  dailyLimit: { en: "Daily Limit", zh: "每日限制" },
  loansPerDay: { en: "loans/day", zh: "笔/天" },
  network: { en: "Network", zh: "网络" },
  neoN3Mainnet: { en: "Neo N3 Mainnet", zh: "Neo N3 主网" },
  neoN3Testnet: { en: "Neo N3 Testnet", zh: "Neo N3 测试网" },
  neoN3Network: { en: "Neo N3", zh: "Neo N3" },
  protocolFee: { en: "Protocol Fee", zh: "协议费" },
  contractHash: { en: "Contract Hash", zh: "合约哈希" },
  contractMethods: { en: "Contract Methods", zh: "合约方法" },
  write: { en: "WRITE", zh: "写入" },
  read: { en: "READ", zh: "读取" },
  parameters: { en: "Parameters", zh: "参数" },
  returns: { en: "Returns", zh: "返回" },
  requestLoanDesc: {
    en: "Request and execute an atomic flash loan against the on-chain pool",
    zh: "针对链上资金池请求并执行原子闪电贷",
  },
  borrowerDesc: { en: "Your wallet address", zh: "你的钱包地址" },
  amountDesc: {
    en: "Loan amount in GAS (8 decimals)",
    zh: "GAS 贷款金额（8位小数）",
  },
  callbackContractDesc: {
    en: "Contract to receive and repay loan",
    zh: "接收和偿还贷款的合约",
  },
  callbackMethodDesc: {
    en: "Fixed callback method: onFlashLoan",
    zh: "固定回调方法：onFlashLoan",
  },
  getLoanDesc: { en: "Get loan details by ID", zh: "通过 ID 获取贷款详情" },
  loanIdentifier: { en: "Loan identifier", zh: "贷款标识" },
  getPoolBalanceDesc: {
    en: "Get current liquidity pool balance",
    zh: "获取当前流动性池余额",
  },
  depositDesc: {
    en: "Deposit liquidity to the flash loan pool",
    zh: "向闪电贷池存入流动性",
  },
  depositorDesc: { en: "Depositor address", zh: "存入地址" },
  events: { en: "Contract Events", zh: "合约事件" },
  howToUse: { en: "How to Use Flash Loans", zh: "如何使用闪电贷" },
  deployCallbackTitle: { en: "Deploy Callback Contract", zh: "部署回调合约" },
  deployCallbackDesc: {
    en: "Implement onFlashLoan so it repays the principal plus fee within the same transaction.",
    zh: "实现 onFlashLoan，并在同一笔交易中偿还本金与手续费。",
  },
  callRequestLoanTitle: { en: "Call RequestLoan", zh: "调用 RequestLoan" },
  callRequestLoanDesc: {
    en: "Invoke `requestLoan` with a callback contract that exposes onFlashLoan.",
    zh: "调用 `requestLoan`，并提供实现 onFlashLoan 的回调合约。",
  },
  teeVerificationTitle: { en: "Atomic Callback", zh: "原子回调" },
  teeVerificationDesc: {
    en: "The flash-loan contract transfers GAS to your callback contract and then immediately calls the callback method in the same transaction.",
    zh: "闪电贷合约会先把 GAS 转给你的回调合约，再在同一笔交易里立刻调用回调方法。",
  },
  repayCallbackTitle: { en: "Repay in Callback", zh: "在回调中偿还" },
  repayCallbackDesc: {
    en: "Your callback contract must return principal + 0.09% fee before control returns to the lender contract.",
    zh: "你的回调合约必须在控制权回到放款合约前归还本金与 0.09% 手续费。",
  },
  warningText: {
    en: "Flash loans still require a programmable callback contract. If the callback does not return principal + fee exactly, the whole transaction reverts.",
    zh: "闪电贷仍然需要可编程回调合约。如果回调没有精确归还本金与手续费，整笔交易会回滚。",
  },
  step5: {
    en: "Ensure your callback contract repays loan + 0.09% fee atomically",
    zh: "确保你的回调合约原子化偿还贷款 + 0.09% 手续费",
  },
  notAvailable: { en: "Unavailable", zh: "不可用" },
  walletNotConnected: { en: "Not connected", zh: "未连接" },
  statsStaleTitle: { en: "Stats unavailable", zh: "数据不可用" },
  live: { en: "LIVE", zh: "实时" },

  // Service-state notice (read failure — keep last good snapshot, never zeros)
  statsUnavailable: {
    en: "Live pool stats are temporarily unavailable. Showing the last known values.",
    zh: "实时池子数据暂时不可用。当前显示最近一次的已知数值。",
  },

  // Pre-flight loan constraints
  cooldownLabel: { en: "Cooldown", zh: "冷却时间" },
  cooldownValue: {
    en: "{minutes} min between loans",
    zh: "每次借款间隔 {minutes} 分钟",
  },
  dailyLimitLabel: { en: "Daily Limit", zh: "每日上限" },
  dailyLimitValue: { en: "{count} loans / day", zh: "{count} 笔 / 天" },

  // Callback-contract prerequisite
  callbackPrerequisite: {
    en: "Every loan needs a deployed contract that implements onFlashLoan(borrower, amount, fee, loanId) and repays principal + fee in the same transaction.",
    zh: "每笔贷款都需要一个已部署的合约，实现 onFlashLoan(borrower, amount, fee, loanId) 并在同一笔交易中归还本金与手续费。",
  },
  viewCallbackExample: {
    en: "View onFlashLoan example",
    zh: "查看 onFlashLoan 示例",
  },

  // Liquidity provider surface
  liquidityTitle: { en: "Provide Liquidity", zh: "提供流动性" },
  liquidityInfo: {
    en: "Deposit GAS to back flash loans and earn a share of the 0.09% fee. You can withdraw up to what you deposited at any time.",
    zh: "存入 GAS 为闪电贷提供流动性，并赚取 0.09% 手续费的分成。你随时可以提取不超过存入金额的部分。",
  },
  // LP fee economics: providers get providerFeeShare% of each fee; the rest is
  // protocol revenue. Fees are credited to providers when distributeFees runs,
  // so "Fees Earned" can lag pool activity until distribution.
  liquidityFeeShareNote: {
    en: "Liquidity providers earn {share}% of each 0.09% loan fee ({protocol}% is protocol revenue). Fees are credited to providers when distributeFees runs, so Fees Earned can lag recent loans.",
    zh: "流动性提供者可获得每笔 0.09% 手续费的 {share}%（其余 {protocol}% 为协议收入）。手续费在调用 distributeFees 时结算给提供者，因此“已赚取手续费”可能滞后于近期借款。",
  },
  poolReservoir: { en: "Pool reservoir", zh: "资金池储备" },
  providerShare: { en: "Provider Share", zh: "LP 分成" },
  protocolShare: { en: "Protocol Share", zh: "协议分成" },
  liquidityAmount: { en: "Amount", zh: "金额" },
  liquidityAmountPlaceholder: { en: "Enter GAS amount", zh: "输入 GAS 金额" },
  yourLiquidity: { en: "Your Liquidity", zh: "你的流动性" },
  feesEarned: { en: "Fees Earned", zh: "已赚取手续费" },
  deposit: { en: "Deposit", zh: "存入" },
  withdraw: { en: "Withdraw", zh: "提取" },
  invalidLiquidityAmount: {
    en: "Enter a valid GAS amount",
    zh: "请输入有效的 GAS 金额",
  },
  receiptIdLabel: { en: "Payment Receipt ID", zh: "支付凭证 ID" },
  receiptIdPlaceholder: {
    en: "Receipt ID from your GAS transfer",
    zh: "来自 GAS 转账的凭证 ID",
  },
  receiptIdRequired: {
    en: "On mainnet, transfer GAS to the contract first, then enter the receipt ID.",
    zh: "在主网上，请先向合约转入 GAS，然后填写凭证 ID。",
  },
  liquidityDeposited: { en: "Liquidity deposited.", zh: "流动性已存入。" },
  liquidityWithdrawn: { en: "Liquidity withdrawn.", zh: "流动性已提取。" },
  feature1Name: { en: "Atomic Execution", zh: "原子执行" },
  feature1Desc: {
    en: "Borrow and repay in a single transaction.",
    zh: "在单笔交易中借还。",
  },
  feature2Name: { en: "Pool Monitoring", zh: "池子监控" },
  feature2Desc: {
    en: "Track liquidity and loan history on-chain.",
    zh: "链上追踪流动性与贷款历史。",
  },
  sidebarPoolBalance: { en: "Pool Balance", zh: "池余额" },
  sidebarRecentLoans: { en: "Recent Loans", zh: "近期贷款" },
  sidebarTotalLoans: { en: "Total Loans", zh: "贷款总数" },
  sidebarTotalVolume: { en: "Total Volume", zh: "总交易量" },
  flashloanErrorFallback: { en: "Something went wrong", zh: "出现错误" },
  error: { en: "Error", zh: "错误" },
} as const;

export const messages = mergeMessages(appMessages);
