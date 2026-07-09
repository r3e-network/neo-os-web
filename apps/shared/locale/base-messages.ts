/**
 * Common i18n keys shared across all miniapps.
 * App-specific messages override these when provided to createUseI18n.
 *
 * These keys were identified by auditing 19+ miniapps and extracting
 * entries that appear in 15+ apps with identical values.
 */
export const baseMessages = {
  // --- Shared component keys (WalletPrompt, DocsPage, ErrorBoundary) ---
  onChainStatus: { en: "ON-CHAIN STATUS", zh: "链上状态" },
  neoN3: { en: "Neo N3", zh: "Neo N3" },
  wpTitle: { en: "Wallet Required", zh: "需要钱包" },
  wpDescription: {
    en: "Please connect your wallet to continue.",
    zh: "请连接钱包以继续。",
  },
  wpConnect: { en: "Connect Wallet", zh: "连接钱包" },
  wpCancel: { en: "Cancel", zh: "取消" },
  docWhatItIs: { en: "What is it?", zh: "这是什么？" },
  docHowToUse: { en: "How to use", zh: "如何使用" },
  docOnChainFeatures: { en: "On-Chain Features", zh: "链上特性" },
  errorFallback: { en: "Something went wrong", zh: "出现错误" },

  // --- Two-mode game entry CTAs (launcher; opt-in via gamePage.modes.guest) ---
  entryGameFiCta: { en: "Earn GAS", zh: "赚取 GAS" },
  entryGuestCta: { en: "Play free", zh: "免费试玩" },

  // --- Common status / UI keys ---
  error: { en: "Error", zh: "错误" },
  loading: { en: "Loading...", zh: "加载中..." },
  notAvailable: { en: "N/A", zh: "不可用" },
  docs: { en: "Docs", zh: "文档" },
  stats: { en: "Stats", zh: "统计" },
  overview: { en: "Overview", zh: "概览" },

  // --- Chain validation ---
  wrongChain: { en: "Wrong Network", zh: "网络错误" },
  wrongChainMessage: {
    en: "This app requires Neo N3 network.",
    zh: "此应用需 Neo N3 网络。",
  },
  switchToNeo: { en: "Switch to Neo N3", zh: "切换到 Neo N3" },

  // --- Common error strings ---
  contractUnavailable: { en: "Contract unavailable", zh: "合约不可用" },
  receiptMissing: { en: "Payment receipt missing", zh: "支付凭证缺失" },

  // --- Chain error families (mapChainError in NotificationService) ---
  transactionFailed: {
    en: "Transaction failed. Please try again.",
    zh: "交易失败，请重试。",
  },
  networkTimeout: {
    en: "Network request timed out. Please check your connection and retry.",
    zh: "网络请求超时，请检查连接后重试。",
  },
  userRejected: {
    en: "Request cancelled in wallet.",
    zh: "已在钱包中取消请求。",
  },
  insufficientGas: {
    en: "Insufficient GAS to complete this action.",
    zh: "GAS 不足，无法完成此操作。",
  },

  // --- Common boolean labels ---
  yes: { en: "Yes", zh: "是" },
  no: { en: "No", zh: "否" },

  // --- Common status keys ---
  success: { en: "Success", zh: "成功" },
  creating: { en: "Creating...", zh: "创建中..." },
  days: { en: "days", zh: "天" },
  insufficientBalance: { en: "Insufficient balance", zh: "余额不足" },
  statusActive: { en: "Active", zh: "活跃" },
  statusPending: { en: "Pending", zh: "处理中" },
  statusCompleted: { en: "Completed", zh: "已完成" },
  statusError: { en: "Error", zh: "错误" },
  statusCancelled: { en: "Cancelled", zh: "已取消" },
  statusReady: { en: "Ready", zh: "就绪" },

  // --- Common statistics keys ---
  statistics: { en: "Statistics", zh: "统计数据" },
  totalGames: { en: "Total Games", zh: "总游戏数" },

  // --- Common button / action keys ---
  confirm: { en: "Confirm", zh: "确认" },
  cancel: { en: "Cancel", zh: "取消" },
  close: { en: "Close", zh: "关闭" },
  retry: { en: "Retry", zh: "重试" },
  reset: { en: "Reset", zh: "重置" },
  back: { en: "Back", zh: "返回" },
  connectWallet: { en: "Connect Wallet", zh: "连接钱包" },
  walletConnected: { en: "Wallet Connected", zh: "钱包已连接" },
  walletNotConnected: { en: "Wallet Not Connected", zh: "钱包未连接" },
  copy: { en: "Copy", zh: "复制" },
  copied: { en: "Copied", zh: "已复制" },
  copyFailed: { en: "Copy failed", zh: "复制失败" },
  previewWaiting: {
    en: "Build a preview package.",
    zh: "生成预览包。",
  },
  previewWaitingHint: {
    en: "The request summary and digest will appear here so you can review it before dispatch.",
    zh: "请求摘要和凭证摘要会显示在此处，便于您在派发前复核。",
  },
  consoleFlow: { en: "Request flow", zh: "请求流程" },
  consoleFlowInput: { en: "Input", zh: "输入" },
  consoleFlowPreview: { en: "Preview", zh: "预览" },
  consoleFlowVerify: { en: "Verify", zh: "验证" },
  consoleRequestHint: {
    en: "Keep every request readable before it is bound to an on-chain callback.",
    zh: "在绑定链上回调前，保持每个请求都可读、可检查。",
  },
  consoleConfigureEyebrow: { en: "Compose", zh: "编排" },
  consoleConfigureTitle: { en: "Request studio", zh: "请求工作台" },
  consoleParametersEyebrow: { en: "Parameters", zh: "参数" },
  consoleParametersTitle: { en: "Review request details", zh: "复核请求细节" },
  consoleParametersHint: {
    en: "Open only when you need to change the request inputs.",
    zh: "仅在需要修改请求输入时打开。",
  },
  consoleParametersEdit: { en: "Edit", zh: "编辑" },
  consoleSelectedValues: { en: "Selected request values", zh: "已选请求参数" },
  consolePreviewEyebrow: { en: "Credential", zh: "凭证" },
  consolePreviewTitle: { en: "Preview receipt", zh: "预览回执" },
  consoleSignal: { en: "Oracle signal", zh: "预言机信号" },
  consolePayload: { en: "Payload", zh: "载荷" },
  consolePreviewNotice: {
    en: "Preview mode — live dispatch requires a Morpheus runtime token.",
    zh: "预览模式 — 实时派发需要 Morpheus 运行时令牌。",
  },
  consoleExecuteAction: { en: "Send live request", zh: "发送实时请求" },
  errorTitle: { en: "Something went wrong", zh: "出现错误" },
  unexpectedError: { en: "An unexpected error occurred", zh: "发生了意外错误" },

  // --- Common tab / section keys ---
  game: { en: "Game", zh: "游戏" },
  history: { en: "History", zh: "历史" },
  settings: { en: "Settings", zh: "设置" },

  // --- Common price / token keys ---
  priceLabel: { en: "Price", zh: "价格" },
  tokenPrice: { en: "Token Price", zh: "代币价格" },
  tokenGas: { en: "GAS", zh: "GAS" },
  totalLabel: { en: "Total", zh: "总计" },
  balanceLabel: { en: "Balance", zh: "余额" },

  // --- Comments section keys ---
  commentsTitle: { en: "Discussion", zh: "讨论" },
  commentPlaceholder: { en: "Share your thoughts...", zh: "分享你的想法..." },
  noComments: { en: "No comments yet. Be the first!", zh: "还没有评论，来做第一个吧！" },
  post: { en: "Post", zh: "发布" },
  howToPlay: { en: "How to Play", zh: "如何玩" },
  keyFeatures: { en: "Key Features", zh: "核心特性" },

  // --- ItemList keys ---
  emptyText: { en: "No items found", zh: "未找到项目" },
  emptyStateHint: { en: "Nothing here yet", zh: "暂无内容" },
  getStarted: { en: "Get started", zh: "开始使用" },
  loadMore: { en: "Load more", zh: "加载更多" },
  listLabel: { en: "List", zh: "列表" },
  formLabel: { en: "Form", zh: "表单" },

  // --- Layout / navigation keys ---
  navigationSidebar: { en: "Navigation sidebar", zh: "导航侧边栏" },
  operationsPanel: { en: "Operations panel", zh: "操作面板" },
  detailsLabel: { en: "Details", zh: "详情" },

  // --- Operation panel keys ---
  operationsPanelEyebrow: { en: "Action", zh: "操作" },
  operationsPanelTitle: { en: "Choose what to do", zh: "选择要执行的操作" },
  operationWorkflowConfigure: { en: "Choose", zh: "选择" },
  operationWorkflowPreview: { en: "Review", zh: "复核" },
  operationWorkflowSubmit: { en: "Confirm", zh: "确认" },
  operationEmptyTitle: { en: "No transaction action required", zh: "无需交易操作" },
  operationEmptyDescription: { en: "This miniapp is ready to use from the workspace.", zh: "此迷你应用已可在工作区中直接使用。" },
  advancedOperations: { en: "More actions", zh: "更多操作" },
  operationSelectedAction: { en: "Selected action", zh: "已选操作" },
  operationChoiceLabel: { en: "Choose", zh: "选择" },
  operationDetailsLabel: { en: "Details", zh: "详情" },
  operationReady: { en: "Ready", zh: "就绪" },
  operationNoExtraFields: { en: "Ready when you are.", zh: "准备好后即可继续。" },
  operationClaimingReward: { en: "Claiming reward...", zh: "正在领取奖励……" },
  operationProcessing: { en: "Processing...", zh: "处理中……" },
  operationActionInProgress: { en: "{action}...", zh: "{action}……" },
  scrollRevealAriaLabel: { en: "Animated content", zh: "动画内容" },
  vaultLabel: { en: "Vault {id}", zh: "保险库 {id}" },

  // --- Documentation keys ---
  docsSubtitle: { en: "Documentation", zh: "文档" },
  docSubtitle: { en: "Documentation", zh: "文档" },
  docDescription: {
    en: "Learn how to use this miniapp",
    zh: "了解如何使用此迷你应用",
  },
  step1: { en: "Connect your Neo wallet", zh: "连接你的 Neo 钱包" },
  step2: { en: "Follow the on-screen instructions", zh: "按照屏幕指示操作" },
  step3: { en: "Confirm the transaction", zh: "确认交易" },
  step4: { en: "View results on-chain", zh: "在链上查看结果" },
  feature1Name: { en: "On-Chain", zh: "链上" },
  feature1Desc: { en: "All operations are recorded on Neo N3.", zh: "所有操作记录在 Neo N3 上。" },
  feature2Name: { en: "Transparent", zh: "透明" },
  feature2Desc: { en: "Fully auditable smart contract logic.", zh: "完全可审计的智能合约逻辑。" },
  feature3Name: { en: "Secure", zh: "安全" },
  feature3Desc: { en: "Protected by Neo N3 consensus.", zh: "受 Neo N3 共识保护。" },

  // --- Documentation footer (kept from DEFAULT_MESSAGES) ---
  docBadge: { en: "Documentation", zh: "文档" },
  docFooter: {
    en: "NeoHub MiniApp Protocol v2.4.0",
    zh: "NeoHub MiniApp Protocol v2.4.0",
  },

  // --- Form validation keys ---
  fieldRequired: { en: "This field is required", zh: "此字段为必填项" },
  fieldMinValue: { en: "Value must be at least {min}", zh: "值必须至少为 {min}" },
  fieldMaxValue: { en: "Value cannot exceed {max}", zh: "值不能超过 {max}" },
  invalidAddress: { en: "Invalid Neo N3 address (must start with N, 34 characters)", zh: "无效的 Neo N3 地址（必须以 N 开头，34 个字符）" },
  fieldInvalidFormat: { en: "Invalid format", zh: "格式无效" },
  select: { en: "Select", zh: "选择" },

  // --- Wallet connection error keys ---
  walletRejected: { en: "Wallet connection was rejected. Please approve the request in your wallet.", zh: "钱包连接被拒绝。请在钱包中批准请求。" },
  walletNotDetected: { en: "Wallet not detected. Please install a compatible Neo wallet.", zh: "未检测到钱包。请安装兼容的 Neo 钱包。" },
  walletTimeout: { en: "Connection timed out. Please check your wallet is unlocked.", zh: "连接超时。请检查钱包是否已解锁。" },
  walletGenericError: { en: "Could not connect wallet. Please try again.", zh: "无法连接钱包。请重试。" },

  // --- Error class user messages (for i18n-capable error classes) ---
  walletConnectionError: { en: "Please connect your wallet to continue.", zh: "请连接钱包以继续。" },
  contractError: { en: "Contract operation failed. Please try again.", zh: "合约操作失败，请重试。" },
  transactionError: { en: "Transaction failed. Please check your balance and try again.", zh: "交易失败，请检查余额后重试。" },
  insufficientBalanceError: { en: "Insufficient balance.", zh: "余额不足。" },
  networkError: { en: "Network error. Please check your connection and try again.", zh: "网络错误，请检查连接后重试。" },
  validationError: { en: "Invalid input. Please check and try again.", zh: "输入无效，请检查后重试。" },
  // --- Error handler messages ---
  errorHandlerWallet: { en: "Please connect your wallet and try again", zh: "请连接钱包后重试" },
  errorHandlerNetwork: { en: "Network error. Please check your connection and retry", zh: "网络错误，请检查连接后重试" },
  errorHandlerContract: { en: "Contract interaction failed. Please try again later", zh: "合约交互失败，请稍后重试" },
  errorHandlerValidation: { en: "Invalid input. Please check your entries and try again", zh: "输入无效，请检查后重试" },
  errorHandlerTimeout: { en: "Operation timed out. Please try again", zh: "操作超时，请重试" },
  errorHandlerUnknown: { en: "An unexpected error occurred. Please try again", zh: "发生意外错误，请重试" },
} as const;

export type BaseMessageKey = keyof typeof baseMessages;

/**
 * Merge base messages with app-specific messages.
 * App-specific keys override base keys on conflict.
 *
 * This is the same merge that `createUseI18n` performs internally,
 * exposed here for cases where the merged map is needed before
 * the composable is called (e.g. type inference, testing).
 *
 * @example
 * ```ts
 * import { mergeMessages } from "@shared/locale/base-messages";
 * const allMessages = mergeMessages(appMessages);
 * ```
 */
export function mergeMessages<T extends Record<string, unknown>>(appMessages: T): typeof baseMessages & T {
  return { ...baseMessages, ...appMessages } as typeof baseMessages & T;
}
