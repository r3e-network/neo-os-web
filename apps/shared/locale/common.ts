/**
 * Common i18n messages shared across all miniapps
 *
 * These messages can be imported and merged into individual miniapp message files.
 *
 * @example
 * ```ts
 * import { commonMessages } from "@shared/locale/common";
 * import { appMessages } from "./messages";
 *
 * export const messages = { ...commonMessages, ...appMessages };
 * ```
 */

export const commonMessages = {
  // Chain validation messages
  wrongChain: { en: "Wrong Network", zh: "网络错误" },
  wrongChainMessage: {
    en: "Switch to Neo N3 Mainnet to continue.",
    zh: "切换到 Neo N3 主网以继续。",
  },
  switchToNeo: { en: "Switch Network", zh: "切换网络" },

  // Common error messages
  connectWalletPrompt: { en: "Please connect your wallet", zh: "请连接钱包" },
  contractUnavailable: { en: "Contract unavailable", zh: "合约不可用" },
  transactionFailed: { en: "Transaction failed", zh: "交易失败" },
  insufficientBalance: { en: "Insufficient balance", zh: "余额不足" },
  loading: { en: "Loading...", zh: "加载中..." },
  error: { en: "Error", zh: "错误" },

  // Common UI labels
  main: { en: "Main", zh: "主页" },
  game: { en: "Game", zh: "游戏" },
  games: { en: "Games", zh: "游戏" },
  stats: { en: "Stats", zh: "统计" },
  statistics: { en: "Statistics", zh: "统计数据" },
  docsTab: { en: "Docs", zh: "文档" },
  settings: { en: "Settings", zh: "设置" },
  about: { en: "About", zh: "关于" },

  // Documentation labels
  docsSubtitle: { en: "Documentation", zh: "文档" },
  docDescription: {
    en: "Learn how to use this miniapp",
    zh: "了解如何使用此迷你应用",
  },
  docWhatItIs: { en: "What is it?", zh: "这是什么？" },
  docHowToUse: { en: "How to use", zh: "如何使用" },
  docOnChainFeatures: { en: "On-Chain Features", zh: "链上特性" },

  // Common button labels
  confirm: { en: "Confirm", zh: "确认" },
  cancel: { en: "Cancel", zh: "取消" },
  close: { en: "Close", zh: "关闭" },
  continue: { en: "Continue", zh: "继续" },
  retry: { en: "Retry", zh: "重试" },
  back: { en: "Back", zh: "返回" },

  // Wallet labels
  walletRequired: { en: "Wallet Required", zh: "需要钱包" },
  walletDescription: {
    en: "Please connect your wallet to continue.",
    zh: "请连接钱包以继续。",
  },
  connectWallet: { en: "Connect Wallet", zh: "连接钱包" },
  // WalletPrompt component keys
  wpTitle: { en: "Wallet Required", zh: "需要钱包" },
  wpDescription: {
    en: "Please connect your wallet to continue.",
    zh: "请连接钱包以继续。",
  },
  wpConnect: { en: "Connect Wallet", zh: "连接钱包" },
  wpCancel: { en: "Cancel", zh: "取消" },

  // Status messages
  success: { en: "Success", zh: "成功" },
  failed: { en: "Failed", zh: "失败" },
  pending: { en: "Pending", zh: "处理中" },
  completed: { en: "Completed", zh: "已完成" },

  // Common verbs
  buy: { en: "Buy", zh: "购买" },
  sell: { en: "Sell", zh: "出售" },
  swap: { en: "Swap", zh: "交换" },
  transfer: { en: "Transfer", zh: "转账" },
  claim: { en: "Claim", zh: "领取" },

  // Common placeholders
  enterAmount: { en: "Enter amount", zh: "请输入数量" },
  selectOption: { en: "Select an option", zh: "请选择" },
  search: { en: "Search", zh: "搜索" },

  // Documentation footer (shared across all apps)
  docBadge: { en: "Documentation", zh: "文档" },
  docFooter: {
    en: "NeoHub MiniApp Protocol v2.4.0",
    zh: "NeoHub MiniApp Protocol v2.4.0",
  },

  // Accessibility labels
  heroStatsAriaLabel: { en: "Hero statistics", zh: "英雄数据统计" },
  heroSectionAriaLabel: { en: "Hero section", zh: "英雄区域" },
  dialogAriaLabel: { en: "Dialog", zh: "对话框" },
  bridgeLeftDefault: { en: "N3", zh: "N3" },
  bridgeRightDefault: { en: "X", zh: "X" },
  heroMarkDefault: { en: "F", zh: "F" },
  iconFallbackLabel: { en: "Icon", zh: "图标" },
  postComment: { en: "Post comment", zh: "发布评论" },
  likeComment: { en: "Like comment", zh: "点赞评论" },

  // MiniAppPage labels
  commentsTitle: { en: "Comments", zh: "评论" },
  commentPlaceholder: { en: "Write a comment...", zh: "写评论..." },
  noComments: { en: "No comments yet", zh: "暂无评论" },
  post: { en: "Post", zh: "发布" },
  navigationSidebar: { en: "Navigation sidebar", zh: "导航侧边栏" },
  operationsPanel: { en: "Operations panel", zh: "操作面板" },
  notAvailable: { en: "N/A", zh: "不可用" },
  errorFallback: { en: "Something went wrong", zh: "出错了" },
  howToPlay: { en: "How to play", zh: "如何参与" },
  keyFeatures: { en: "Key Features", zh: "关键特性" },
  neoN3: { en: "Neo N3", zh: "Neo N3" },
  docSubtitle: { en: "Documentation", zh: "文档" },
  subtitle: { en: "Subtitle", zh: "副标题" },
  formLabel: { en: "Form", zh: "表单" },
  countdownDefault: { en: "Countdown", zh: "倒计时" },
  detailsLabel: { en: "Details", zh: "详情" },
  listLabel: { en: "List", zh: "列表" },
  emptyText: { en: "No items", zh: "暂无内容" },
  loadMore: { en: "Load more", zh: "加载更多" },
} as const;

/**
 * Type for common message keys
 */
export type CommonMessageKey = keyof typeof commonMessages;
