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

  // --- Documentation footer (kept from DEFAULT_MESSAGES) ---
  docBadge: { en: "Documentation", zh: "文档" },
  docFooter: {
    en: "NeoHub MiniApp Protocol v2.4.0",
    zh: "NeoHub MiniApp Protocol v2.4.0",
  },
} as const;

export type BaseMessageKey = keyof typeof baseMessages;
