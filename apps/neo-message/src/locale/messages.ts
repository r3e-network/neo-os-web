import { mergeMessages } from "@shared/locale/base-messages";

const appMessages = {
  title: { en: "App", zh: "应用" },
  // tabs / nav
  composeTab: { en: "Compose", zh: "撰写" },
  inboxTab: { en: "Inbox", zh: "收件箱" },
  deliveryTab: { en: "Delivery", zh: "投递" },
  workspaceTitle: { en: "Mail desk", zh: "信件工作台" },

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
  sealedDeskLabel: { en: "Sealed message desk", zh: "密封消息工作台" },
  sealedDeskCaption: {
    en: "Turn the note into an encrypted packet before it leaves this device.",
    zh: "在离开设备前，把这封信封装成加密消息包。",
  },
  messageStageAria: { en: "Live message sealing stage", zh: "实时消息封存舞台" },
  messageStageLabel: { en: "Message route", zh: "消息路径" },
  messageStageTitle: {
    en: "Write it, seal it, then send the packet",
    zh: "写下、封存，然后投递消息包",
  },
  messageStageBody: {
    en: "The desk reacts as the recipient, message body, delivery mode, and wallet readiness come together.",
    zh: "当收件人、正文、投递模式和钱包状态逐步就绪时，工作台会同步变化。",
  },
  messageStageStepWrite: { en: "Write", zh: "写信" },
  messageStageStepSeal: { en: "Seal", zh: "封存" },
  messageStageStepSend: { en: "Send", zh: "投递" },
  readinessLabel: { en: "Readiness", zh: "发送状态" },
  recipientDeskEmpty: { en: "Recipient pending", zh: "收件人待定" },
  deliveryDeskRecipient: { en: "Recipient-only seal", zh: "收件人私密封存" },
  deliveryDeskTimed: { en: "Timed public reveal", zh: "定时公开揭示" },
  readinessDeskNeedsDetails: { en: "Shorten note", zh: "请缩短信件" },
  readinessDeskNeedsDate: { en: "Reveal time pending", zh: "等待设置公开时间" },
  readinessDeskNeedsAck: { en: "Reveal consent pending", zh: "等待公开确认" },
  readinessDeskReady: { en: "Wallet ready", zh: "钱包可发送" },
  recipientLabel: { en: "Send to (Neo X address)", zh: "发送给（Neo X 地址）" },
  recipientNicknameLabel: { en: "Nickname (optional, just for you)", zh: "昵称（可选，仅你可见）" },
  recipientNicknamePlaceholder: { en: "e.g. Mom, Alex, my future self…", zh: "例如 妈妈、Alex、未来的我……" },
  messageLabel: { en: "Message", zh: "消息内容" },
  messagePlaceholder: { en: "Write your message…", zh: "输入你的消息……" },
  messagePreviewTitle: { en: "Sealed message preview", zh: "封存消息预览" },
  messageDraftEmpty: { en: "Your note preview appears here while you write.", zh: "你写下内容后，会在这里预览信件。" },
  recipientPreviewLabel: { en: "To", zh: "收件人" },
  recipientPreviewEmpty: { en: "No recipient yet", zh: "尚未选择收件人" },
  deliveryPreviewLabel: { en: "Delivery", zh: "投递方式" },
  characterBudgetLabel: { en: "Length", zh: "长度" },
  privateSealLabel: { en: "Private seal", zh: "私密封存" },
  publicRevealLabel: { en: "Public later", zh: "到时公开" },
  readinessNeedRecipient: { en: "Recipient seal pending", zh: "等待收件人封存" },
  readinessNeedMessage: { en: "Blank note draft", zh: "空白信件草稿" },
  readinessNeedAck: { en: "Reveal consent pending", zh: "等待公开确认" },
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
  connectingWallet: { en: "Connecting…", zh: "连接中……" },
  refresh: { en: "Refresh", zh: "刷新" },
  notConnected: { en: "Not connected", zh: "未连接" },
  connectToView: { en: "Connect your wallet to see notes sent your way.", zh: "连接钱包，看看寄给你的悄悄话。" },
  inboxEmpty: { en: "No notes yet — they'll appear here the moment someone writes to you.", zh: "还没有信件——有人写信给你时会出现在这里。" },
  outboxEmpty: { en: "No sent notes yet.", zh: "还没有已发送的信件。" },
  switchToNeoX: { en: "Switch to Neo X", zh: "切换到 Neo X" },
  loadOlder: { en: "Load older", zh: "加载更早" },
  bodyCounter: { en: "{count}/{max}", zh: "{count}/{max}" },

  // message states / actions
  statusBadgeRecipient: { en: "Sealed", zh: "已封存" },
  statusBadgeSealed: { en: "Sealed", zh: "已封存" },
  statusBadgeLocked: { en: "Locked", zh: "锁定中" },
  statusBadgeUnlockable: { en: "Ready", zh: "可解锁" },
  statusBadgeRevealed: { en: "Revealed", zh: "已揭示" },
  statusBadgePrivateOpen: { en: "Opened privately", zh: "已私密打开" },
  statusBadgeRevealPending: { en: "Reveal pending", zh: "揭示处理中" },
  revealForMe: { en: "Decrypt for me", zh: "为我解密" },
  revealOnChain: { en: "Reveal on-chain", zh: "在链上揭示" },
  onlyRecipientCanRead: { en: "Only the recipient can read this.", zh: "只有收件人能读取。" },
  notUnlockedYet: { en: "Not unlocked yet", zh: "尚未解锁" },
  readyToRevealBody: { en: "The reveal time has arrived. Publish this note on-chain when ready.", zh: "已到揭示时间；准备好后可将信件公开到链上。" },
  // After a recipient-only reveal the plaintext may be cached on this device;
  // another device must repeat the wallet proof and oracle reveal.
  decryptedOnDevice: {
    en: "Decrypted on this device. Re-open with your wallet to read again elsewhere.",
    zh: "已在本设备解密。在其他设备上需用钱包重新打开以再次读取。",
  },

  // statuses
  statusReady: { en: "Ready", zh: "就绪" },
  statusInboxLoaded: { en: "Messages loaded", zh: "消息已加载" },
  statusEncrypting: { en: "Encrypting message…", zh: "正在加密消息……" },
  statusSending: { en: "Sending transaction…", zh: "正在发送交易……" },
  statusVerifyingDelivery: { en: "Verifying message delivery…", zh: "正在核验消息投递……" },
  statusSent: { en: "Message sent", zh: "消息已发送" },
  statusDeliveryVerifiedCleanupPending: {
    en: "Delivery verified — retry recovery cleanup before sending again",
    zh: "投递已核验——再次发送前请重试清理恢复记录",
  },
  statusSentRefreshPending: {
    en: "Message verified — inbox refresh can be retried later",
    zh: "消息已核验——稍后可重试刷新列表",
  },
  statusSendPending: {
    en: "Delivery confirmation is pending — check the existing transaction before sending again",
    zh: "投递确认仍在处理中——再次发送前请先检查现有交易",
  },
  pendingDeliveryTitle: { en: "Delivery recovery", zh: "投递恢复" },
  pendingDeliveryBody: {
    en: "Transaction {txid} was broadcast, but exact delivery is not confirmed yet.",
    zh: "交易 {txid} 已广播，但准确投递尚未确认。",
  },
  pendingStorageWarning: {
    en: "This recovery record could not be verified in device storage. Keep this window open.",
    zh: "无法在设备存储中核验此恢复记录，请保持当前窗口打开。",
  },
  recoverDelivery: { en: "Check delivery", zh: "检查投递" },
  recoveringDelivery: { en: "Checking delivery…", zh: "正在检查投递……" },
  clearStaleDelivery: { en: "Clear 24h-old recovery", zh: "清除超过 24 小时的恢复记录" },
  pendingWalletMismatch: {
    en: "Reconnect the wallet that sent this pending message before checking delivery.",
    zh: "请重新连接发送此待确认消息的钱包后再检查投递。",
  },
  pendingReceiptInvalid: {
    en: "The receipt did not match this transaction, sender, or message contract. Recovery was kept.",
    zh: "交易回执与当前交易、发送者或消息合约不匹配，恢复记录已保留。",
  },
  pendingTransactionFault: {
    en: "The message transaction reverted. Sending is unlocked; any draft still in this window is unchanged.",
    zh: "消息交易已回滚，现已允许重新发送；当前窗口中的草稿保持不变。",
  },
  pendingCleanupFailed: {
    en: "The recovery record could not be cleared on this device. Retry before sending again.",
    zh: "无法清除本设备上的恢复记录，请在再次发送前重试。",
  },
  pendingFaultCleanupFailed: {
    en: "The transaction reverted, but its recovery record could not be cleared. Retry Check delivery.",
    zh: "交易已回滚，但恢复记录无法清除，请重试“检查投递”。",
  },
  statusDeliveryRecovered: { en: "Message delivery verified", zh: "消息投递已核验" },
  pendingTooRecentToClear: {
    en: "This transaction is still within its 24-hour recovery window.",
    zh: "此交易仍处于 24 小时恢复窗口内。",
  },
  pendingTransactionStillKnown: {
    en: "This transaction is still known to Neo X. Check delivery instead of clearing its recovery record.",
    zh: "Neo X 仍能查询到这笔交易，请检查投递状态，不要清除其恢复记录。",
  },
  pendingCleared: {
    en: "Old recovery record cleared. Verify the transaction in an explorer before resending.",
    zh: "旧恢复记录已清除；重新发送前请先在浏览器中核验交易。",
  },
  statusRevealing: { en: "Decrypting…", zh: "正在解密……" },
  statusPrivateOpened: { en: "Opened privately on this device", zh: "已在本设备私密打开" },
  statusRevealed: { en: "Revealed", zh: "已揭示" },
  statusRequestingReveal: { en: "Requesting reveal…", zh: "正在请求揭示……" },
  statusRevealRequestUnverified: {
    en: "The reveal transaction did not confirm this message. Check the transaction before retrying.",
    zh: "揭示交易未能核验当前消息，请检查交易后再重试。",
  },
  statusWaitingReveal: { en: "Waiting for the oracle to reveal…", zh: "等待预言机揭示……" },
  statusRevealPending: { en: "Reveal pending — check back shortly", zh: "揭示处理中——稍后再查看" },
  statusFailed: { en: "Something went wrong", zh: "出现问题" },
  messageReadInvalid: {
    en: "Message {id} returned invalid chain data. Your last verified mailbox was kept.",
    zh: "消息 {id} 返回了无效链上数据，已保留上次核验的邮箱内容。",
  },

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
  errorInvalidWalletAccount: {
    en: "The wallet returned an invalid or zero Neo X account. Reconnect a valid account and retry.",
    zh: "钱包返回了无效或零地址的 Neo X 账户，请重新连接有效账户后重试。",
  },
  errorNotRecipient: { en: "Connected wallet is not the recipient of this message.", zh: "当前钱包不是该消息的收件人。" },
  errorWalletChanged: {
    en: "The active wallet changed before sending. Review the recipient and try again.",
    zh: "发送前活动钱包已切换，请重新确认收件人后再试。",
  },
  errorOracleKeyUnavailable: {
    en: "Message sealing is temporarily unavailable. Retry when the Morpheus key service is ready.",
    zh: "消息封存暂时不可用，请在 Morpheus 密钥服务恢复后重试。",
  },
  errorOracleRevealUnavailable: {
    en: "Private open is temporarily unavailable. Your sealed message is unchanged; retry shortly.",
    zh: "私密打开暂时不可用，封存消息未发生变化，请稍后重试。",
  },
  statusSendUnverified: {
    en: "The transaction did not return a verifiable MessageSent receipt. Your draft was kept.",
    zh: "交易未返回可核验的 MessageSent 回执，草稿已保留。",
  },
  statusSendReadbackMismatch: {
    en: "The confirmed message does not match this sender, recipient, or unlock time. Your draft was kept.",
    zh: "已确认消息与当前发送者、收件人或解锁时间不一致，草稿已保留。",
  },
  messageReadIncomplete: {
    en: "{count} messages could not be read. The previous list was kept.",
    zh: "有 {count} 条消息读取失败，已保留之前的列表。",
  },
  invalidRecipient: { en: "Enter a valid non-zero Neo X (0x) recipient.", zh: "请输入有效且非零的 Neo X（0x）收件地址。" },
  emptyBody: { en: "Message cannot be empty.", zh: "消息不能为空。" },
  bodyTooLong: { en: "Message is too long.", zh: "消息过长。" },
  invalidRevealDate: { en: "Choose a valid reveal date.", zh: "请选择有效的解锁日期。" },
  revealDateInPast: { en: "Reveal date must be in the future.", zh: "解锁日期必须在未来。" },
} as const;

export const messages = mergeMessages(appMessages);
