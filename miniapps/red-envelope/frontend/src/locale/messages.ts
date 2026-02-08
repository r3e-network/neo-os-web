export const messages = {
  // ── App Shell ─────────────────────────────────────
  title: { en: "Red Envelope", zh: "红包" },
  subtitle: { en: "Lucky red packets on Neo", zh: "Neo 链上幸运红包" },
  createTab: { en: "🎁 Create", zh: "🎁 创建" },
  myTab: { en: "🧧 My Envelopes", zh: "🧧 我的红包" },
  connectWallet: { en: "Connect Wallet", zh: "连接钱包" },

  // ── Create Form ───────────────────────────────────
  createEnvelope: { en: "Create Envelope", zh: "创建红包" },
  flowBanner: {
    en: "Send GAS → Mint NFT → Pass Along → Open for GAS → Auto-burn",
    zh: "发送 GAS → 铸造 NFT → 传递 → 打开领 GAS → 自动销毁",
  },
  amountSection: { en: "💰 Amount", zh: "💰 金额" },
  neoGateSection: { en: "🔒 NEO Gate", zh: "🔒 NEO 门槛" },
  settingsSection: { en: "⏰ Settings", zh: "⏰ 设置" },
  labelGasAmount: { en: "Total GAS to distribute", zh: "分发的 GAS 总量" },
  labelPacketCount: { en: "Number of packets", zh: "红包数量" },
  labelMinNeo: { en: "Minimum NEO required", zh: "最低 NEO 要求" },
  labelHoldDays: { en: "Minimum holding days", zh: "最低持有天数" },
  labelExpiry: { en: "Expiry (hours)", zh: "过期时长（小时）" },
  labelMessage: { en: "Blessing message", zh: "祝福语" },
  totalGasPlaceholder: { en: "e.g. 10", zh: "例如 10" },
  packetsPlaceholder: { en: "1–100", zh: "1–100" },
  expiryPlaceholder: { en: "168", zh: "168" },
  messagePlaceholder: { en: "Best wishes!", zh: "大吉大利！" },
  minNeoPlaceholder: { en: "100", zh: "100" },
  minHoldDaysPlaceholder: { en: "2", zh: "2" },
  summaryTitle: { en: "Summary", zh: "摘要" },
  summaryTotal: { en: "Total GAS", zh: "GAS 总量" },
  summaryPerPacket: { en: "~Per packet", zh: "~每个红包" },
  summaryExpiry: { en: "Expires in", zh: "过期时间" },
  summaryHours: { en: "{0}h", zh: "{0}小时" },
  summaryNeoGate: { en: "NEO Gate", zh: "NEO 门槛" },
  creating: { en: "Creating...", zh: "创建中..." },
  sendRedEnvelope: { en: "🧧 Send Red Envelope", zh: "🧧 发送红包" },
  defaultBlessing: { en: "Best Wishes", zh: "大吉大利" },

  // ── My Envelopes ──────────────────────────────────
  noEnvelopes: { en: "No envelopes yet", zh: "暂无红包" },
  youAreCreator: { en: "👑 Creator", zh: "👑 创建者" },
  youAreHolder: { en: "📦 Holder", zh: "📦 持有者" },
  openEnvelope: { en: "🧧 Open", zh: "🧧 打开" },
  transferEnvelope: { en: "📤 Transfer", zh: "📤 转让" },
  reclaimEnvelope: { en: "💰 Reclaim", zh: "💰 回收" },
  daysRemaining: { en: "{0}d {1}h left", zh: "剩余 {0}天 {1}小时" },
  expiredLabel: { en: "⚠️ Expired", zh: "⚠️ 已过期" },
  gasRemaining: { en: "💎 {0} GAS remaining", zh: "💎 剩余 {0} GAS" },

  // ── Opening Modal ─────────────────────────────────
  opening: { en: "Opening...", zh: "开启中..." },

  // ── Lucky Overlay ─────────────────────────────────
  congratulations: { en: "🎉 Congratulations!", zh: "🎉 恭喜发财！" },
  shareYourLuck: { en: "Share your luck!", zh: "分享你的好运！" },
  gas: { en: "GAS", zh: "GAS" },

  // ── Common ────────────────────────────────────────
  close: { en: "Close", zh: "关闭" },
  recipientAddress: { en: "Recipient address", zh: "接收地址" },
  confirm: { en: "Confirm", zh: "确认" },
  cancel: { en: "Cancel", zh: "取消" },
  transferSuccess: { en: "Transferred!", zh: "转让成功！" },
  reclaimSuccess: { en: "Reclaimed {0} GAS", zh: "已回收 {0} GAS" },
  expired: { en: "Expired", zh: "已过期" },
  depleted: { en: "All opened", zh: "已领完" },
  active: { en: "Active", zh: "进行中" },
  neoGate: { en: "🔒 {0} NEO, {1}d hold", zh: "🔒 {0} NEO, 持有 {1} 天" },
  packets: { en: "{0}/{1} opened", zh: "已打开 {0}/{1}" },
  invalidAddress: { en: "Invalid Neo N3 address", zh: "无效的 Neo N3 地址" },
  labelRecipient: { en: "Recipient address", zh: "接收方地址" },
  transferring: { en: "Transferring...", zh: "转让中..." },
  langToggle: { en: "中文", zh: "EN" },
  neoRequirement: { en: "NEO Requirement", zh: "NEO 要求" },
  insufficientNeo: { en: "Insufficient NEO", zh: "NEO 不足" },
  holdNotMet: { en: "Hold duration not met", zh: "持有时间不足" },
  neoBalance: { en: "NEO Balance", zh: "NEO 余额" },
  holdingDays: { en: "Holding Days", zh: "持有天数" },
};

export type MessageKey = keyof typeof messages;
