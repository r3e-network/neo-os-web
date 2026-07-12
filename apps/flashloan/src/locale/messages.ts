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
  connectToRecover: { en: "Connect to recover", zh: "连接钱包以恢复" },
  signRequestFlashLoan: {
    en: "Sign atomic execution",
    zh: "签署原子执行",
  },
  walletRequired: { en: "Wallet required", zh: "需要钱包" },
  instructionMode: { en: "INSTRUCTIONAL MODE", zh: "教学模式" },
  instructionNote: {
    en: "Flash loans remain a power-user flow. This miniapp helps you inspect pool state and submit callback-based executions.",
    zh: "闪电贷仍然是高级用户流程。本应用用于查看池子状态并提交基于回调合约的执行。",
  },
  // Borrowing needs a deployed four-argument callback contract; non-developers
  // can still use the secondary liquidity-provider surface.
  instructionLpHint: {
    en: "Borrowing requires a deployed callback contract. No callback contract? Use the liquidity-provider desk instead.",
    zh: "借款需要已部署的回调合约。没有回调合约时，可改用流动性提供者操作台。",
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
    en: "Enter a valid callback method name",
    zh: "请输入有效的回调方法名",
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
    en: "Contract hash or address",
    zh: "合约哈希或地址",
  },
  callbackSocketLabel: { en: "Callback socket", zh: "回调插槽" },
  callbackSocketReady: { en: "Callback format ready", zh: "回调格式就绪" },
  callbackFormatReady: { en: "Address and method accepted", zh: "地址与方法格式已接受" },
  callbackMethodRequired: { en: "Method name required", zh: "需要填写方法名" },
  callbackSocketOpen: { en: "Socket awaiting contract", zh: "插槽等待合约" },
  callbackSocketHint: {
    en: "Target receives principal and must repay inside this transaction.",
    zh: "目标接收本金，并必须在本笔交易内归还。",
  },
  callbackMethodPlaceholder: { en: "execute", zh: "execute" },
  callbackMethodFixed: {
    en: "The deployed lender calls the selected method with four arguments.",
    zh: "已部署的放款合约会使用四个参数调用所选方法。",
  },
  callbackMethodSignature: {
    en: "Required ABI: method(borrower, amount, fee, loanId). This is the deployed Neo callback ABI, not ERC-3156.",
    zh: "所需 ABI：method(borrower, amount, fee, loanId)。这是已部署的 Neo 回调 ABI，并非 ERC-3156。",
  },
  callbackRiskTitle: { en: "Callback compatibility", zh: "回调兼容性" },
  callbackRiskTestnet: {
    en: "The bundled testnet harness is verified with execute. A different contract or method is only format-checked here and can still revert atomically.",
    zh: "测试网内置演示合约已验证 execute 方法。其他合约或方法在此仅检查格式，仍可能原子回滚。",
  },
  callbackRiskMainnet: {
    en: "Mainnet has no bundled sample callback. Verify the target contract exposes this exact four-argument method before signing.",
    zh: "主网未内置示例回调合约。签名前请确认目标合约暴露完全一致的四参数方法。",
  },
  verifiedHarnessTitle: { en: "Verified testnet callback harness", zh: "已验证的测试网回调合约" },
  verifiedHarnessHint: {
    en: "execute(borrower, amount, fee, loanId) simulated HALT on the deployed lender",
    zh: "execute(borrower, amount, fee, loanId) 已在部署合约上模拟 HALT",
  },
  useVerifiedHarness: { en: "Use harness", zh: "使用合约" },
  callbackInvocationSummary: {
    en: "Call {method}(borrower, amount, fee, loanId)",
    zh: "调用 {method}(borrower, amount, fee, loanId)",
  },
  callbackSetupRequired: { en: "Configure the callback target and method", zh: "请配置回调目标与方法" },
  duration: { en: "Duration", zh: "持续时间" },
  enterDuration: { en: "Enter duration in days", zh: "输入持续时间（天）" },
  loanCalculator: { en: "Loan Calculator", zh: "贷款计算器" },
  toolsDockEyebrow: { en: "Execution tools", zh: "执行工具" },
  toolsDockTitle: { en: "Open the desk you need", zh: "按需打开操作台" },
  toolsDockHint: {
    en: "Keep the signing path focused. Calculator, liquidity, lookup, and history stay one tap away.",
    zh: "保持签名路径清爽。计算器、流动性、查询和历史只需点一次即可打开。",
  },
  executionSetup: { en: "Execution setup", zh: "执行设置" },
  executionSetupHint: {
    en: "Set the callback target and its exact four-argument method before signing.",
    zh: "签名前请设置回调目标及其精确的四参数方法。",
  },
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
  customAmount: { en: "Custom", zh: "自定义" },
  exactAmount: { en: "Exact amount", zh: "精确金额" },
  capitalRouteTitle: { en: "Atomic capital route", zh: "原子资金路径" },
  capitalRouteHint: {
    en: "Follow principal, callback execution, and repayment guard before signing.",
    zh: "签名前核对本金、回调执行和还款守卫。",
  },
  simulationEyebrow: { en: "Preflight model", zh: "签名前预演" },
  simulationTitle: { en: "Atomic route simulation", zh: "原子路线预演" },
  simulationReady: { en: "Route checks ready", zh: "路线检查就绪" },
  simulationPrincipal: { en: "Principal out", zh: "借出本金" },
  simulationCallback: { en: "Callback", zh: "回调执行" },
  simulationRepayment: { en: "Required back", zh: "必须归还" },
  simulationDisclaimer: {
    en: "This is a local preflight model, not a broadcast, receipt, or successful loan.",
    zh: "这是本地签名前预演，不是广播、回执或贷款成功结果。",
  },
  atomicRevertRiskTitle: { en: "Atomic revert boundary", zh: "原子回滚边界" },
  atomicRevertRisk: {
    en: "The callback must return principal + the live {fee}% fee exactly; otherwise the transaction faults and the loan is not executed.",
    zh: "回调必须精确归还本金与链上 {fee}% 手续费；否则交易 FAULT，贷款不会执行。",
  },
  readinessWallet: { en: "Wallet", zh: "钱包" },
  readinessWalletReady: { en: "Connected", zh: "已连接" },
  readinessWalletAction: { en: "Connect before signing", zh: "签名前连接钱包" },
  readinessCallback: { en: "Callback", zh: "回调合约" },
  readinessCallbackReady: { en: "Contract target set", zh: "合约目标已设置" },
  readinessCallbackMissing: { en: "Socket awaiting contract", zh: "插槽等待合约" },
  readinessRepayment: { en: "Repayment guard", zh: "还款守卫" },
  readinessRepaymentGuard: {
    en: "Principal + fee must return in one tx",
    zh: "本金和手续费必须单笔归还",
  },
  readinessContract: { en: "Contract & pool", zh: "合约与资金池" },
  eligibilityReady: {
    en: "Eligible · {remaining} requests left today",
    zh: "资格有效 · 今日剩余 {remaining} 次",
  },
  eligibilityBlocked: { en: "Cooldown or daily limit active", zh: "冷却或每日限额生效中" },
  eligibilityChecking: { en: "Checking live eligibility", zh: "正在核验链上资格" },
  poolInsufficient: { en: "Confirmed pool cannot cover this amount", zh: "已确认资金池不足以覆盖该金额" },
  presetExceedsPool: { en: "This preset exceeds the confirmed pool", zh: "该预设金额超过已确认资金池" },
  atomicExecutionHint: { en: "Sign one atomic borrow → callback → repay transaction", zh: "签署一笔原子借款 → 回调 → 还款交易" },
  requestLoan: { en: "Request Loan", zh: "请求贷款" },
  requesting: { en: "Requesting...", zh: "请求中..." },
  loanRequested: {
    en: "Flash loan executed on-chain.",
    zh: "闪电贷已在链上执行。",
  },
  loanSubmitted: {
    en: "Flash loan executed on-chain.",
    zh: "闪电贷已在链上执行。",
  },
  confirmingOnChain: { en: "Confirming on-chain…", zh: "链上确认中……" },
  checkingOnChain: { en: "Checking on-chain…", zh: "正在链上查询……" },
  transactionIdLabel: { en: "Tx", zh: "交易" },
  actionInProgressShort: { en: "Financial action in progress", zh: "资金操作进行中" },
  actionInProgress: {
    en: "Another financial action is already in progress. Wait for its exact transaction result before starting a new one.",
    zh: "另一项资金操作正在进行。请等待其精确交易结果后再开始新操作。",
  },
  otherFinancialActionPending: {
    en: "Another submitted financial action is still awaiting exact confirmation. Resolve that transaction before opening a different loan or liquidity action.",
    zh: "另一项已提交资金操作仍在等待精确确认。请先处理该交易，再开始不同的借款或流动性操作。",
  },
  otherActionPendingShort: { en: "Resolve pending action", zh: "先处理待确认操作" },
  loanConfirmationPending: {
    en: "Transaction submitted. Waiting for the executed loan record — do not submit it again yet.",
    zh: "交易已提交，正在等待已执行贷款记录——请暂勿重复提交。",
  },
  loanConfirmationExpired: {
    en: "Confirmation is taking longer than expected. Review the submitted transaction before taking another action.",
    zh: "链上确认时间超出预期。执行其他操作前，请先核对已提交交易。",
  },
  loanConfirmationReview: {
    en: "Confirmation is delayed. This request remains locked until its exact transaction event and loan record are found; review the tx in your wallet.",
    zh: "链上确认延迟。找到该交易的精确事件与贷款记录前，请求将保持锁定；请在钱包中核对交易。",
  },
  loanRecovered: {
    en: "The previously submitted flash loan is now confirmed on-chain.",
    zh: "此前提交的闪电贷现已在链上确认。",
  },
  recoveredActionNotReplayed: {
    en: "The previous action was recovered and confirmed. This click did not submit a new transaction; review the recovered result before continuing.",
    zh: "此前操作已恢复并确认。本次点击没有提交新交易；请先核对恢复结果再继续。",
  },
  loanRequestUnavailable: {
    en: "The wallet did not return a transaction. Review the route and try again.",
    zh: "钱包未返回交易。请检查执行路径后重试。",
  },
  loanExceedsPool: {
    en: "The confirmed pool can lend at most {pool} GAS right now.",
    zh: "当前已确认资金池最多可借出 {pool} GAS。",
  },
  loanExceedsEligibility: {
    en: "Your current on-chain limit is {max} GAS.",
    zh: "你当前的链上可借上限为 {max} GAS。",
  },
  borrowerCooldown: {
    en: "Borrower cooldown is active for {seconds} more seconds.",
    zh: "借款冷却仍剩 {seconds} 秒。",
  },
  dailyLimitReached: { en: "The on-chain daily loan limit is reached.", zh: "已达到链上每日借款上限。" },
  flashloanFormIncomplete: {
    en: "Choose covered capital and bind a callback contract plus method before signing.",
    zh: "签名前请选择资金池可覆盖的金额，并绑定回调合约与方法。",
  },
  latestTx: { en: "Latest Tx", zh: "最新交易" },
  noRequestYet: {
    en: "No flash-loan transaction has been submitted in this session.",
    zh: "本次会话尚未提交闪电贷交易。",
  },
  docSubtitle: { en: "Understanding Flash Loans", zh: "理解闪电贷" },
  docDescription: {
    en: "Flash loans enable uncollateralized borrowing with repayment in one transaction. The deployed Neo contract transfers GAS, calls a selected four-argument callback, and verifies repayment atomically on-chain.",
    zh: "闪电贷支持无抵押借款，并在同一笔交易中完成归还。已部署的 Neo 合约会转出 GAS、调用所选四参数回调，并在链上原子校验还款。",
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
    en: "Selected four-argument callback method",
    zh: "所选的四参数回调方法",
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
    en: "Implement method(borrower, amount, fee, loanId) and repay principal plus fee before it returns.",
    zh: "实现 method(borrower, amount, fee, loanId)，并在返回前归还本金与手续费。",
  },
  callRequestLoanTitle: { en: "Call RequestLoan", zh: "调用 RequestLoan" },
  callRequestLoanDesc: {
    en: "Invoke requestLoan with a callback contract and the exact method it exposes.",
    zh: "调用 requestLoan，并提供回调合约及其精确暴露的方法名。",
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
    en: "Live contract state is unavailable. Last-known values may remain visible, but signing is disabled until a fresh read succeeds.",
    zh: "实时合约状态不可用。界面可能保留最近已知数值，但在重新读取成功前将禁用签名。",
  },
  walletDataUnavailable: {
    en: "Wallet-specific eligibility or liquidity data is unavailable. Borrowing and withdrawal remain disabled until a fresh account read succeeds.",
    zh: "钱包专属的借款资格或流动性数据暂不可用。在账户数据重新读取成功前，借款和提取将保持禁用。",
  },
  contractUnavailable: { en: "Live contract state unavailable", zh: "实时合约状态不可用" },
  contractPaused: { en: "Contract is paused", zh: "合约已暂停" },
  chainContextMismatch: {
    en: "Wallet network or contract binding does not match this app. Switch to the displayed Neo network before signing.",
    zh: "钱包网络或合约绑定与本应用不一致。签名前请切换到当前显示的 Neo 网络。",
  },
  recoveryStorageUnavailable: {
    en: "Durable recovery storage is unavailable. No wallet transaction was opened.",
    zh: "持久恢复存储不可用，未打开钱包交易。",
  },
  walletContextChanged: {
    en: "The active wallet changed after the confirmation prompt. Nothing new was submitted; review the wallet and try again.",
    zh: "确认提示后活动钱包发生变化。本次未提交新交易；请核对钱包后重试。",
  },
  transactionIdMismatch: {
    en: "The wallet reported conflicting transaction IDs. The first broadcast record remains locked for manual review; do not submit again.",
    zh: "钱包返回了相互冲突的交易 ID。首个广播记录将保持锁定并等待人工核对；请勿再次提交。",
  },
  pendingContextMismatch: {
    en: "A pending action belongs to another wallet, network, or contract. Restore that exact context before recovering or submitting again.",
    zh: "待处理操作属于其他钱包、网络或合约。恢复完全一致的上下文后，才能继续恢复或再次提交。",
  },
  eventMismatch: {
    en: "The confirmed transaction event does not match the reviewed flash-loan action. Keep the action locked and inspect the transaction.",
    zh: "已确认交易事件与签名前核对的闪电贷操作不一致。操作将保持锁定，请检查该交易。",
  },
  readbackMismatch: {
    en: "The transaction event and authoritative contract readback disagree. Keep the action locked for manual review.",
    zh: "交易事件与合约权威回读不一致。操作将保持锁定并等待人工核对。",
  },
  loanTransactionFault: {
    en: "The submitted loan transaction FAULTed. No loan was executed; review the callback and retry only as a new action.",
    zh: "已提交的贷款交易发生 FAULT，贷款未执行。请检查回调，并仅以新操作重新尝试。",
  },
  contractParametersVerified: { en: "Parameters read from the deployed contract", zh: "参数读取自已部署合约" },
  contractStatusChecking: { en: "Checking", zh: "核验中" },
  contractStatusReady: { en: "Ready", zh: "可用" },
  contractStatusPaused: { en: "Paused", zh: "已暂停" },
  contractStatusUnavailable: { en: "Unavailable", zh: "不可用" },
  notConfigured: { en: "Not configured", zh: "未配置" },
  mainnet: { en: "Mainnet", zh: "主网" },
  testnet: { en: "Testnet", zh: "测试网" },

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
    en: "Every loan needs a deployed contract exposing the selected method(borrower, amount, fee, loanId) and repaying principal + fee in the same transaction.",
    zh: "每笔贷款都需要已部署合约暴露所选 method(borrower, amount, fee, loanId)，并在同一笔交易中归还本金与手续费。",
  },
  viewCallbackExample: {
    en: "View callback example",
    zh: "查看回调示例",
  },

  // Liquidity provider surface
  liquidityTitle: { en: "Provide Liquidity", zh: "提供流动性" },
  liquidityInfo: {
    en: "Deposit GAS to back flash loans and earn a share of the 0.09% fee. You can withdraw up to what you deposited at any time.",
    zh: "存入 GAS 为闪电贷提供流动性，并赚取 0.09% 手续费的分成。你随时可以提取不超过存入金额的部分。",
  },
  depositUnavailableTitle: { en: "Deposits unavailable on this network", zh: "当前网络暂不可存入" },
  paymentHubUnavailable: {
    en: "Mainnet PaymentHub is not configured on the deployed contract, so receipt-based deposits are disabled. Pool reads and eligible withdrawals remain available.",
    zh: "已部署主网合约尚未配置 PaymentHub，因此已禁用基于凭证的存入。资金池读取和符合条件的提取仍可使用。",
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
  liquidityConfirmationPending: {
    en: "Liquidity transaction submitted. Waiting for the provider balance to confirm — do not resubmit yet.",
    zh: "流动性交易已提交，正在等待提供者余额确认——请暂勿重复提交。",
  },
  paymentConfirmationTitle: { en: "Confirming prepaid GAS", zh: "正在确认预付 GAS" },
  liquidityPaymentPending: {
    en: "The prepaid GAS transaction is still being verified. Do not pay again; finalization unlocks only after the exact transfer is confirmed.",
    zh: "预付 GAS 交易仍在核验。请勿再次付款；只有精确转账确认后才会开放完成入池。",
  },
  liquidityTransactionFault: {
    en: "The submitted liquidity transaction FAULTed. A confirmed testnet prepayment, if present, stays recoverable without another payment.",
    zh: "已提交的流动性交易发生 FAULT。若测试网预付款已确认，仍可在不重复付款的情况下恢复。",
  },
  liquidityConfirmationExpired: {
    en: "Confirmation is delayed. Review the submitted transaction before taking another liquidity action.",
    zh: "链上确认延迟。执行其他流动性操作前，请先核对已提交交易。",
  },
  liquidityConfirmationReview: {
    en: "The exact liquidity event is still missing. This action stays locked to prevent a duplicate deposit or withdrawal; review the tx in your wallet.",
    zh: "仍未找到精确的流动性事件。为避免重复存入或提取，此操作将保持锁定；请在钱包中核对交易。",
  },
  liquidityResumeRequired: {
    en: "The {amount} GAS prepayment was broadcast, but the testnet deposit call did not finish. Resume finalization without sending GAS again.",
    zh: "{amount} GAS 预付款已广播，但测试网存入调用尚未完成。请继续完成入池，不要再次发送 GAS。",
  },
  resumeLiquidityTitle: { en: "Prepayment needs finalization", zh: "预付款需要完成入池" },
  resumeLiquidityDeposit: { en: "Resume deposit — no new payment", zh: "继续存入——不再付款" },
  liquidityResumeUnavailable: {
    en: "No finalize-only testnet deposit is available.",
    zh: "当前没有可仅完成入池的测试网存入记录。",
  },
  recoveryWalletMismatch: {
    en: "Reconnect the same wallet that sent the prepayment before resuming.",
    zh: "继续操作前，请重新连接发送预付款的同一钱包。",
  },
  liquidityRecovered: {
    en: "The previously submitted liquidity change is now confirmed on-chain.",
    zh: "此前提交的流动性变更现已在链上确认。",
  },
  liquidityActionUnavailable: {
    en: "The wallet did not return a liquidity transaction. Review the amount and try again.",
    zh: "钱包未返回流动性交易。请检查金额后重试。",
  },
  withdrawExceedsBalance: {
    en: "Withdrawal exceeds your confirmed provider balance.",
    zh: "提取金额超过已确认的流动性余额。",
  },
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
