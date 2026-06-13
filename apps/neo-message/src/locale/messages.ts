import { mergeMessages } from "@shared/locale/base-messages";

const appMessages = {
  // tabs / nav
  composeTab: { en: "Compose", zh: "撰写" },
  inboxTab: { en: "Inbox", zh: "收件箱" },

  // hero
  heroTitle: { en: "Encrypted & time-locked messages", zh: "加密与定时解锁消息" },
  heroSubtitle: {
    en: "Send a message only the recipient can read, or seal one that unlocks on-chain at a future time — secured by the Morpheus confidential oracle on Neo X.",
    zh: "发送只有收件人能读取的消息，或封存一条在未来某个时间于链上解锁的消息——由 Neo X 上的 Morpheus 机密预言机保护。",
  },

  // compose
  composeTitle: { en: "New message", zh: "新建消息" },
  recipientLabel: { en: "Recipient (Neo X address)", zh: "收件人（Neo X 地址）" },
  messageLabel: { en: "Message", zh: "消息内容" },
  messagePlaceholder: { en: "Write your message…", zh: "输入你的消息……" },
  deliveryModeLabel: { en: "Delivery mode", zh: "投递模式" },
  modeRecipient: { en: "Recipient-only", zh: "仅收件人" },
  modeRecipientHint: { en: "Only the recipient can ever decrypt it", zh: "只有收件人能解密" },
  modeTimed: { en: "Time-locked", zh: "定时解锁" },
  modeTimedHint: { en: "Revealed publicly on-chain at a set time", zh: "在设定时间于链上公开揭示" },
  revealDateLabel: { en: "Reveal at", zh: "解锁时间" },
  recipientNote: {
    en: "The message is encrypted to the oracle key and stored on-chain. Only the recipient, proving their wallet, can decrypt it. The plaintext is never written on-chain.",
    zh: "消息以预言机密钥加密并存储在链上。只有收件人通过其钱包证明身份后才能解密。明文绝不会写入链上。",
  },
  timedNote: {
    en: "The message stays sealed until the reveal time. After it, anyone can trigger the reveal and the oracle posts the plaintext on-chain for everyone.",
    zh: "消息在解锁时间前保持封存。到时之后，任何人都可触发揭示，预言机会将明文发布到链上供所有人查看。",
  },
  sendButton: { en: "Encrypt & send", zh: "加密并发送" },
  sending: { en: "Sending…", zh: "发送中……" },

  // inbox / outbox
  inboxTitle: { en: "Inbox", zh: "收件箱" },
  outboxTitle: { en: "Sent", zh: "已发送" },
  networkCardTitle: { en: "Network", zh: "网络" },
  fromLabel: { en: "From", zh: "来自" },
  toLabel: { en: "To", zh: "发给" },
  unlocksLabel: { en: "Unlocks", zh: "解锁于" },
  recipientOnlyHint: { en: "Recipient-only", zh: "仅收件人" },
  connectWallet: { en: "Connect wallet", zh: "连接钱包" },
  refresh: { en: "Refresh", zh: "刷新" },
  notConnected: { en: "Not connected", zh: "未连接" },
  connectToView: { en: "Connect your wallet to view your messages.", zh: "连接钱包以查看你的消息。" },
  inboxEmpty: { en: "No messages yet.", zh: "暂无消息。" },
  switchToNeoX: { en: "Switch to Neo X", zh: "切换到 Neo X" },
  loadOlder: { en: "Load older", zh: "加载更早" },
  bodyCounter: { en: "{count}/{max}", zh: "{count}/{max}" },

  // message states / actions
  statusBadgeSealed: { en: "Sealed", zh: "已封存" },
  statusBadgeLocked: { en: "Locked", zh: "锁定中" },
  statusBadgeUnlockable: { en: "Ready", zh: "可解锁" },
  statusBadgeRevealed: { en: "Revealed", zh: "已揭示" },
  revealForMe: { en: "Decrypt for me", zh: "为我解密" },
  revealOnChain: { en: "Reveal on-chain", zh: "在链上揭示" },
  onlyRecipientCanRead: { en: "Only the recipient can read this.", zh: "只有收件人能读取。" },
  notUnlockedYet: { en: "Not unlocked yet", zh: "尚未解锁" },

  // statuses
  statusReady: { en: "Ready", zh: "就绪" },
  statusInboxLoaded: { en: "Messages loaded", zh: "消息已加载" },
  statusEncrypting: { en: "Encrypting message…", zh: "正在加密消息……" },
  statusSending: { en: "Sending transaction…", zh: "正在发送交易……" },
  statusSent: { en: "Message sent", zh: "消息已发送" },
  statusRevealing: { en: "Decrypting…", zh: "正在解密……" },
  statusRevealed: { en: "Revealed", zh: "已揭示" },
  statusRequestingReveal: { en: "Requesting reveal…", zh: "正在请求揭示……" },
  statusWaitingReveal: { en: "Waiting for the oracle to reveal…", zh: "等待预言机揭示……" },
  statusRevealPending: { en: "Reveal pending — check back shortly", zh: "揭示处理中——稍后再查看" },
  statusFailed: { en: "Something went wrong", zh: "出现问题" },

  // errors
  error: { en: "Error", zh: "错误" },
  errorWrongNetwork: {
    en: "Neo Message runs on Neo X Mainnet. Switch your wallet to Neo X Mainnet to continue.",
    zh: "Neo Message 运行于 Neo X 主网。请将钱包切换到 Neo X 主网后继续。",
  },
  errorNoEvmWallet: {
    en: "No EVM wallet detected. Install MetaMask (or any EVM wallet) and connect to Neo X Mainnet.",
    zh: "未检测到 EVM 钱包。请安装 MetaMask（或任意 EVM 钱包）并连接到 Neo X 主网。",
  },
  errorNotRecipient: { en: "Connected wallet is not the recipient of this message.", zh: "当前钱包不是该消息的收件人。" },
  invalidRecipient: { en: "Enter a valid Neo X (0x) address.", zh: "请输入有效的 Neo X（0x）地址。" },
  emptyBody: { en: "Message cannot be empty.", zh: "消息不能为空。" },
  bodyTooLong: { en: "Message is too long.", zh: "消息过长。" },
  invalidRevealDate: { en: "Choose a valid reveal date.", zh: "请选择有效的解锁日期。" },
  revealDateInPast: { en: "Reveal date must be in the future.", zh: "解锁日期必须在未来。" },
} as const;

export const messages = mergeMessages(appMessages);
