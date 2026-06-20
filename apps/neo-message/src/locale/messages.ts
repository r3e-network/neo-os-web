import { mergeMessages } from "@shared/locale/base-messages";

const appMessages = {
  // tabs / nav
  composeTab: { en: "Compose", zh: "撰写" },
  inboxTab: { en: "Inbox", zh: "收件箱" },

  // hero
  heroEyebrow: { en: "Private messages", zh: "私密消息" },
  heroTitle: { en: "Send a note only they can open", zh: "写一封只有对方能打开的私信" },
  heroSubtitle: {
    en: "Write something just for one person, or seal a note that opens on its own at a moment you choose.",
    zh: "给某个人写下专属悄悄话，或封存一封在你选定的时刻自动开启的信。",
  },

  // compose
  composeTitle: { en: "Write a note", zh: "写一封信" },
  composeEyebrow: { en: "Secure compose", zh: "安全撰写" },
  composeLead: {
    en: "Choose who can open the note, review the sealed preview, then send it with your wallet.",
    zh: "先确认谁能打开这封信，查看封存预览，再用钱包发送。",
  },
  recipientLabel: { en: "Send to (Neo X address)", zh: "发送给（Neo X 地址）" },
  recipientNicknameLabel: { en: "Nickname (optional, just for you)", zh: "昵称（可选，仅你可见）" },
  recipientNicknamePlaceholder: { en: "e.g. Mom, Alex, my future self…", zh: "例如 妈妈、Alex、未来的我……" },
  messageLabel: { en: "Message", zh: "消息内容" },
  messagePlaceholder: { en: "Write your message…", zh: "输入你的消息……" },
  messagePreviewTitle: { en: "Sealed message preview", zh: "封存消息预览" },
  messageDraftEmpty: { en: "Your note preview appears here while you write.", zh: "你写下内容后，会在这里预览信件。" },
  recipientPreviewLabel: { en: "To", zh: "收件人" },
  recipientPreviewEmpty: { en: "Choose a recipient", zh: "选择收件人" },
  deliveryPreviewLabel: { en: "Delivery", zh: "投递方式" },
  characterBudgetLabel: { en: "Length", zh: "长度" },
  privateSealLabel: { en: "Private seal", zh: "私密封存" },
  publicRevealLabel: { en: "Public later", zh: "到时公开" },
  readinessNeedRecipient: { en: "Add a valid recipient", zh: "添加有效收件人" },
  readinessNeedMessage: { en: "Write a message", zh: "填写消息内容" },
  readinessNeedAck: { en: "Confirm public reveal", zh: "确认公开揭示" },
  readinessReady: { en: "Ready to send", zh: "可以发送" },
  deliveryModeLabel: { en: "Delivery mode", zh: "投递模式" },
  modeRecipient: { en: "Just for them", zh: "只给对方" },
  modeRecipientHint: { en: "Only the person you send it to can ever open it", zh: "只有你发送的对象能打开" },
  modeTimed: { en: "Open later", zh: "稍后开启" },
  modeTimedHint: { en: "Opens for everyone on-chain at a time you set", zh: "在你设定的时间于链上向所有人开启" },
  revealDateLabel: { en: "Reveal at", zh: "解锁时间" },
  recipientNote: {
    en: "Sealed for their eyes only. Your note is encrypted before it leaves your device and only the recipient, with their wallet, can open it — the words are never written on-chain in the clear. Secured by the Morpheus confidential oracle on Neo X.",
    zh: "只为对方加密封存。你的信在离开设备前已加密，只有收件人用其钱包才能打开——内容绝不会以明文写入链上。由 Neo X 上的 Morpheus 机密预言机保护。",
  },
  timedNote: {
    en: "The message stays sealed until the reveal time. After it, anyone can trigger the reveal and the oracle posts the plaintext on-chain for everyone.",
    zh: "消息在解锁时间前保持封存。到时之后，任何人都可触发揭示，预言机会将明文发布到链上供所有人查看。",
  },
  // Prominent public-reveal warning + explicit acknowledgement shown when the
  // user picks the time-locked mode (its privacy guarantee is the inverse of
  // recipient-only — the cleartext is posted on-chain for everyone).
  timedPublicWarning: {
    en: "Public reveal: after the unlock time the message body is posted on-chain in cleartext, readable by anyone — not just the recipient.",
    zh: "公开揭示：到达解锁时间后，消息正文将以明文发布到链上，任何人都可读取——不仅仅是收件人。",
  },
  timedAcknowledge: {
    en: "I understand this message will become public on-chain at the reveal time.",
    zh: "我了解这条消息将在解锁时间于链上公开。",
  },
  sendButton: { en: "Encrypt & send", zh: "加密并发送" },
  sendButtonTimed: { en: "Schedule public reveal", zh: "安排公开揭示" },
  sending: { en: "Sending…", zh: "发送中……" },

  // inbox / outbox
  inboxTitle: { en: "Inbox", zh: "收件箱" },
  outboxTitle: { en: "Sent", zh: "已发送" },
  networkCardTitle: { en: "Network", zh: "网络" },
  fromLabel: { en: "From", zh: "来自" },
  toLabel: { en: "To", zh: "发给" },
  savedNicknameNote: { en: "Saved as “{name}” on this device", zh: "已在本设备保存为“{name}”" },
  unlocksLabel: { en: "Unlocks", zh: "解锁于" },
  recipientOnlyHint: { en: "Just for them", zh: "只给对方" },
  connectWallet: { en: "Connect wallet", zh: "连接钱包" },
  refresh: { en: "Refresh", zh: "刷新" },
  notConnected: { en: "Not connected", zh: "未连接" },
  connectToView: { en: "Connect your wallet to see notes sent your way.", zh: "连接钱包，看看寄给你的悄悄话。" },
  inboxEmpty: { en: "No notes yet — they'll appear here the moment someone writes to you.", zh: "还没有信件——有人写信给你时会出现在这里。" },
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
  // After a recipient-only reveal the plaintext is cached on this device only —
  // it is re-derivable via a fresh wallet signature, not stored as readable text.
  decryptedOnDevice: {
    en: "Decrypted on this device. Re-open with your wallet to read again elsewhere.",
    zh: "已在本设备解密。在其他设备上需用钱包重新打开以再次读取。",
  },

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
