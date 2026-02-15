/**
 * Common i18n keys shared across all miniapps.
 * App-specific messages override these when provided to createUseI18n.
 *
 * These keys were identified by auditing 19+ miniapps and extracting
 * entries that appear in 15+ apps with identical values.
 */
export const baseMessages = {
  // --- Shared component keys (WalletPrompt, DocsPage, ErrorBoundary) ---
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

  // --- Common status / UI keys ---
  error: { en: "Error", zh: "错误" },
  loading: { en: "Loading...", zh: "加载中..." },
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

  // --- Common status keys ---
  success: { en: "Success", zh: "成功" },
  creating: { en: "Creating...", zh: "创建中..." },
  days: { en: "days", zh: "天" },
  insufficientBalance: { en: "Insufficient balance", zh: "余额不足" },

  // --- Common statistics keys ---
  statistics: { en: "Statistics", zh: "统计数据" },
  totalGames: { en: "Total Games", zh: "总游戏数" },

  // --- Common button / action keys ---
  confirm: { en: "Confirm", zh: "确认" },
  cancel: { en: "Cancel", zh: "取消" },
  close: { en: "Close", zh: "关闭" },
  retry: { en: "Retry", zh: "重试" },
  connectWallet: { en: "Connect Wallet", zh: "连接钱包" },
  copy: { en: "Copy", zh: "复制" },
  copied: { en: "Copied", zh: "已复制" },

  // --- Common tab / section keys ---
  game: { en: "Game", zh: "游戏" },
  history: { en: "History", zh: "历史" },
  settings: { en: "Settings", zh: "设置" },

  // --- Documentation keys ---
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
