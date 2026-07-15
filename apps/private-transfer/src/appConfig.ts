import { mergeMessages } from "@shared/locale/base-messages";
import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

export const appId = "miniapp-private-transfer";

export const manifest: MiniAppManifest = {
  name: "Confidential Transfer",
  description: "Encrypt a Neo N3 transfer intent locally and store its ciphertext for downstream Morpheus processing. This app does not move funds or verify settlement.",
  icon: "locked",
  category: "defi",
  shell: "console",
  theme: { family: "finance", accentColor: "#07966f", density: "comfortable" },
  tabs: [{ key: "transfer", labelKey: "tabTransfer", icon: "locked", default: true }],
  stats: [
    { labelKey: "statPrivacy", valueKey: "privacyMode", format: "text", icon: "locked" },
    { labelKey: "statNetwork", valueKey: "networkLabel", format: "text", icon: "globe" },
    { labelKey: "statRequests", valueKey: "requestCount", format: "number", icon: "activity" },
    { labelKey: "statDigest", valueKey: "lastDigest", format: "text", icon: "key" },
  ],
  sidebar: {
    titleKey: "sidebarTitle",
    items: [
      { labelKey: "statPrivacy", valueKey: "privacyMode", format: "text" },
      { labelKey: "lastStatus", valueKey: "lastStatus", format: "text" },
      { labelKey: "statDigest", valueKey: "lastDigest", format: "text" },
    ],
  },
  features: { walletRequired: false, chainWarning: true },
  permissions: {
    payments: false,
    oracle: true,
    compute: false,
    confidential: true,
  },
  docs: [
    { titleKey: "docsTitle", contentKey: "docsBody", type: "text" },
    { titleKey: "feature1Name", contentKey: "feature1Desc", type: "features" },
    { titleKey: "feature2Name", contentKey: "feature2Desc", type: "features" },
    { titleKey: "feature3Name", contentKey: "feature3Desc", type: "features" },
  ],
};

const appMessages = {
  appName: { en: "Confidential Transfer", zh: "隐私转账" },
  title: { en: "Confidential Transfer", zh: "隐私转账" },
  tabTransfer: { en: "Transfer", zh: "转账" },
  sidebarTitle: { en: "Privacy Status", zh: "隐私状态" },
  statPrivacy: { en: "Privacy", zh: "隐私" },
  statNetwork: { en: "Network", zh: "网络" },
  statRequests: { en: "Sealed Requests", zh: "封装请求" },
  statDigest: { en: "Commitment", zh: "承诺" },
  lastStatus: { en: "Last Status", zh: "最近状态" },
  docsTitle: { en: "How it works", zh: "工作方式" },
  docsBody: {
    en: "This MiniApp encrypts transfer-intent fields in the browser and submits only ciphertext for Morpheus storage. It does not lock funds, verify a TEE attestation, or execute settlement.",
    zh: "本小程序在浏览器中加密转账意图字段，仅向 Morpheus 存储提交密文。它不会锁定资金、验证 TEE 证明或执行结算。",
  },
  feature1Name: { en: "Browser Sealed", zh: "浏览器封装" },
  feature1Desc: { en: "Recipient, amount, memo, and note secret are encrypted before they leave the page.", zh: "收款方、金额、备注和 note secret 在离开页面前完成加密。" },
  feature2Name: { en: "TEE Delivery Target", zh: "TEE 交付目标" },
  feature2Desc: { en: "Stored ciphertext is prepared for downstream Morpheus processing; this app does not attest or verify that execution.", zh: "保存后的密文用于后续 Morpheus 处理；本应用不会证明或验证该执行过程。" },
  feature3Name: { en: "No Neo zk Curve Assumption", zh: "不依赖 Neo zk 曲线" },
  feature3Desc: { en: "The workflow is designed for Neo N3 without requiring unsupported zk curve verification on-chain.", zh: "该流程面向 Neo N3 设计，不要求链上支持特定 zk 曲线验证。" },

  // Placeholder / status seeds
  digestPlaceholder: { en: "—", zh: "—" },
  statusSealed: { en: "Sealed", zh: "已封装" },
  privacyModeLabel: { en: "Local ciphertext", zh: "本地密文" },

  // Network labels
  networkTestnet: { en: "Testnet", zh: "测试网" },
  networkMainnet: { en: "Mainnet", zh: "主网" },
  networkChecking: { en: "Checking network", zh: "正在检查网络" },
  networkUnknown: { en: "Unknown network", zh: "未知网络" },
  networkTestnetOnly: {
    en: "New encrypted intents are enabled only on Neo N3 Testnet.",
    zh: "新建加密意图仅在 Neo N3 测试网开放。",
  },
  networkStatusLive: { en: "Live", zh: "可用" },
  networkStatusDegraded: { en: "Degraded", zh: "降级" },
  networkStatusChecking: { en: "Checking", zh: "检查中" },
  networkDegradedHint: {
    en: "Oracle key unavailable on this network — sealing is paused.",
    zh: "该网络上预言机密钥不可用——封装已暂停。",
  },
  // Plain-language reassurance paired with the degraded chip so a first-time
  // user reads it as "a runtime token is needed", not "the app is broken".
  networkDegradedNote: {
    en: "Your draft stays local. New encrypted intents remain paused until the runtime is verified again.",
    zh: "草稿仍保留在本地；重新验证运行时之前，不会创建新的加密意图。",
  },
  // Actionable nudge shown when the selected lane is degraded but the other one
  // is live, so the default-path user can switch to a working lane in one tap
  // instead of being dead-ended on the paused network.
  networkSwitchCta: {
    en: "Switch to {network} (live)",
    zh: "切换到{network}（可用）",
  },
  networkSwitchAria: {
    en: "Switch to the live {network} lane",
    zh: "切换到可用的{network}网络",
  },

  // Hero
  heroEyebrow: { en: "Neo N3 encrypted intent", zh: "Neo N3 加密意图" },
  heroTitle: { en: "Create a confidential transfer intent", zh: "创建隐私转账意图" },
  heroBody: {
    en: "Encrypt locally. Store ciphertext for Morpheus. No wallet signature or funds move here.",
    zh: "本地加密，向 Morpheus 保存密文。本应用不请求钱包签名，也不转移资金。",
  },
  heroBadge: { en: "No on-chain zk curve dependency", zh: "无需链上 zk 曲线依赖" },
  heroStageAria: {
    en: "Private transfer sealed package preview",
    zh: "隐私转账封装包预览",
  },
  heroStageTitle: {
    en: "Recipient details stay sealed until Morpheus opens the intent inside confidential compute.",
    zh: "收款细节会保持封装，直到 Morpheus 在隐私计算中打开该意图。",
  },
  composerTitle: { en: "Encrypted intent", zh: "加密意图" },
  composerLead: { en: "Set the private transfer", zh: "设置隐私转账" },
  composerSubtitle: {
    en: "Choose the asset, amount, and recipient. They are encrypted before storage.",
    zh: "选择资产、金额和收款方；保存前会先完成加密。",
  },
  packetDraft: { en: "Assemble a sealed packet", zh: "组装加密封装包" },
  packetDraftGas: { en: "Assemble a sealed GAS packet", zh: "组装加密 GAS 封装包" },
  packetDraftNeo: { en: "Assemble a sealed NEO packet", zh: "组装加密 NEO 封装包" },
  packetReady: { en: "Packet ready to seal", zh: "封装包已就绪" },
  packetSealed: { en: "Private packet sealed", zh: "隐私封装包已完成" },
  packetRailGas: { en: "GAS packet", zh: "GAS 封装包" },
  packetRailNeo: { en: "NEO packet", zh: "NEO 封装包" },
  packetRailPrivate: { en: "Local encryption lane", zh: "本地加密通道" },

  // Form
  formNetworkLabel: { en: "Network", zh: "网络" },
  formAssetLabel: { en: "Asset", zh: "资产" },
  formRecipientLabel: { en: "Recipient", zh: "收款方" },
  formRecipientPlaceholder: { en: "N...", zh: "N..." },
  formAmountLabel: { en: "Amount", zh: "金额" },
  formMemoLabel: { en: "Private memo", zh: "隐私备注" },
  formMemoOptional: { en: "Optional", zh: "选填" },
  presetsLabel: { en: "Amount presets", zh: "金额预设" },
  assetGasMeta: { en: "8 decimal places", zh: "最多 8 位小数" },
  assetNeoMeta: { en: "Whole units only", zh: "仅整数单位" },
  // Persistent precision helper under the Amount field — states the per-asset
  // settlement rule up front rather than only after an invalid value triggers
  // the error. Values are informational; they do not change validation.
  amountHintGas: {
    en: "GAS settles at up to 8 decimal places.",
    zh: "GAS 最多支持 8 位小数结算。",
  },
  amountHintNeo: {
    en: "NEO is indivisible — whole numbers only.",
    zh: "NEO 不可分割——仅支持整数。",
  },

  // Field validation
  errorInvalidAddress: { en: "Enter a valid Neo N3 address.", zh: "请输入有效的 Neo N3 地址。" },
  errorInvalidNeoAmount: {
    en: "NEO is indivisible — enter a whole number greater than zero.",
    zh: "NEO 不可分割——请输入大于零的整数。",
  },
  errorInvalidAmount: { en: "Enter an amount greater than zero.", zh: "请输入大于零的金额。" },
  errorInvalidAsset: { en: "Choose GAS or NEO before sealing.", zh: "封装前请选择 GAS 或 NEO。" },
  recipientValid: { en: "Valid Neo N3 address", zh: "有效的 Neo N3 地址" },
  recipientHint: { en: "A full Neo N3 address beginning with N", zh: "请输入以 N 开头的完整 Neo N3 地址" },

  // Seal button + busy state
  sealButton: { en: "Seal private transfer intent", zh: "封装隐私转账意图" },
  sealCtaShort: { en: "Seal encrypted intent", zh: "封装加密意图" },
  sealing: { en: "Sealing...", zh: "封装中…" },
  sealAriaIdle: { en: "Seal private transfer intent", zh: "封装隐私转账意图" },
  sealAriaBusy: { en: "Sealing private transfer intent", zh: "正在封装隐私转账意图" },
  // Always-visible disclosure above the seal button: this app only seals an
  // encrypted intent; it has no contract and never moves funds.
  noFundsBanner: {
    en: "No funds were moved — this seals an encrypted intent for Morpheus confidential compute, not a payment.",
    zh: "未转移任何资金 — 本步骤为 Morpheus 隐私计算封装加密意图，并非一笔支付。",
  },
  boundaryTitle: { en: "Wallet fee 0 GAS · no payment is sent", zh: "钱包费用 0 GAS · 不会发起支付" },
  boundaryBody: {
    en: "No wallet signature or funds are involved. TEE execution and settlement are outside this app.",
    zh: "本应用不请求钱包签名、不涉及资金；TEE 执行与结算不在本应用内。",
  },

  // Pre-seal confirm summary — echoes the exact values being encrypted so the
  // user verifies recipient, amount + asset, and network before the seal.
  summaryTitle: { en: "You are about to seal", zh: "即将封装" },
  summaryRecipient: { en: "Recipient", zh: "收款方" },
  summaryAmount: { en: "Amount", zh: "金额" },
  summaryNetwork: { en: "Network", zh: "网络" },
  summaryEncryption: { en: "Encryption", zh: "加密方式" },
  summaryPending: {
    en: "Recipient and amount are still local draft slots.",
    zh: "收款方与金额仍是本地草稿槽位。",
  },
  summaryPendingAsset: {
    en: "Recipient and {asset} amount are still local draft slots.",
    zh: "收款方与 {asset} 金额仍是本地草稿槽位。",
  },
  sealPreviewPending: {
    en: "Commitment appears after sealing.",
    zh: "封装后显示承诺。",
  },
  summaryAmountValue: { en: "{amount} {asset}", zh: "{amount} {asset}" },

  // Idle right-rail explainer (shown before the first seal) — replaces the
  // empty rail with a short marketing/how-it-works panel and the seal CTA hint.
  introTitle: { en: "Encrypted before it leaves your browser", zh: "在离开浏览器前完成加密" },
  introBody: {
    en: "Your recipient, amount, and memo are encrypted locally for the current Morpheus key. Only ciphertext leaves this page — no funds move.",
    zh: "您的收款方、金额与备注会在本地使用当前 Morpheus 密钥加密。仅密文会离开此页面——不会转移任何资金。",
  },
  introPointLocal: { en: "Sealed locally", zh: "本地封装" },
  introPointLocalDesc: { en: "Private fields encrypted in your browser.", zh: "隐私字段在浏览器中加密。" },
  introPointTee: { en: "TEE target", zh: "TEE 目标" },
  introPointTeeDesc: { en: "Downstream execution is not verified by this app.", zh: "后续执行不会由本应用验证。" },
  introPointNoFunds: { en: "No funds moved", zh: "不转移资金" },
  introPointNoFundsDesc: { en: "This seals an intent, never a payment.", zh: "本步骤封装意图，而非支付。" },
  routeAria: { en: "Private transfer sealing route", zh: "隐私转账封装路线" },
  routeTitle: { en: "Watch the sealed route", zh: "查看封装路线" },
  routeBody: {
    en: "The lane reacts to your recipient, amount, network health, and sealing result.",
    zh: "这条路线会根据收款方、金额、网络健康状态与封装结果实时变化。",
  },
  routeRecipientPending: { en: "Recipient slot", zh: "收款方槽位" },
  routeRecipientInvalid: { en: "Invalid recipient", zh: "收款方无效" },
  routeAmountPending: { en: "Amount slot", zh: "金额槽位" },
  routeAmountPendingGas: { en: "GAS amount slot", zh: "GAS 金额槽位" },
  routeAmountPendingNeo: { en: "NEO amount slot", zh: "NEO 金额槽位" },
  routeStepCompose: { en: "Compose intent", zh: "填写意图" },
  routeStepEncrypt: { en: "Encrypt locally", zh: "本地加密" },
  routeStepMorpheus: { en: "Store for Morpheus", zh: "交给 Morpheus" },
  routeKeyTitle: { en: "Check fresh Oracle key", zh: "检查新鲜 Oracle 密钥" },
  routeKeyBody: { en: "Require the current testnet contract key.", zh: "必须取得当前测试网合约密钥。" },
  routeEncryptTitle: { en: "Encrypt locally", zh: "本地加密" },
  routeEncryptBody: { en: "Private fields stay on this device.", zh: "隐私字段保留在本设备。" },
  routeStoreTitle: { en: "Store ciphertext", zh: "保存密文" },
  routeStoreBody: { en: "Success requires a secret reference.", zh: "仅取得密文引用才算成功。" },
  routeTeeTitle: { en: "Downstream TEE", zh: "后续 TEE" },
  routeTeeBody: { en: "Not verified by this app.", zh: "本应用不验证此阶段。" },
  visualCaption: { en: "Ciphertext packet — plaintext stays local", zh: "密文封装包 — 明文保留在本地" },

  // Submit status
  statusInitial: { en: "Local lane idle. Details stay on this device until you seal.", zh: "本地通道待命。封装前细节只保留在此设备上。" },
  statusSealingProgress: {
    en: "Fetching Morpheus key, encrypting locally, and storing ciphertext.",
    zh: "正在获取 Morpheus 密钥、本地加密并存储密文。",
  },
  statusSealingShort: { en: "Sealing private transfer", zh: "正在封装隐私转账" },
  statusSealedToast: { en: "Ciphertext stored", zh: "密文已保存" },
  statusCheckingRuntime: { en: "Checking network and a fresh Morpheus Oracle key…", zh: "正在检查网络与新鲜 Morpheus Oracle 密钥…" },
  statusRuntimeReady: { en: "Fresh testnet Oracle key is ready. Storage is checked on submit.", zh: "测试网新鲜 Oracle 密钥已就绪；密文存储将在提交时检查。" },
  statusRuntimeUnavailable: { en: "The private sealing lane is not ready", zh: "隐私封装通道尚未就绪" },
  statusAwaitingHostTitle: { en: "Connect to seal privately", zh: "连接后进行隐私封装" },
  statusAwaitingHost: {
    en: "Connect your wallet to open the sealing lane. Your draft stays on this device until you do.",
    zh: "连接钱包即可开启封装通道。在此之前，草稿仅保存在本机。",
  },
  connectCta: { en: "Connect wallet", zh: "连接钱包" },
  statusRecoveryReady: { en: "A saved ciphertext packet is ready to retry.", zh: "已有本地密文封装包可安全重试。" },
  statusCiphertextStored: { en: "Ciphertext stored and secret reference confirmed. No payment occurred.", zh: "密文已保存并确认引用；未发生支付。" },
  statusStoredToast: { en: "Ciphertext reference confirmed", zh: "密文引用已确认" },
  statusRetryingStorage: { en: "Retrying the exact saved ciphertext packet…", zh: "正在重试同一份已保存密文封装包…" },
  statusStored: {
    en: "Intent sealed — ciphertext stored for downstream Morpheus processing. This app did not verify TEE execution or move funds; the references below identify only the stored intent.",
    zh: "意图已封装 — 密文已保存，供后续 Morpheus 处理。本应用未验证 TEE 执行，也未转移资金；下方引用仅标识已保存的意图。",
  },
  statusBlockHeader: { en: "Morpheus confidential compute", zh: "Morpheus 隐私计算" },
  safeCopy: {
    en: "Nothing was sent on-chain. Fix the inputs or try again when the Morpheus service is available.",
    zh: "未在链上发送任何内容。请修正输入，或在 Morpheus 服务可用时重试。",
  },
  errorDetailLabel: { en: "Service detail", zh: "服务详情" },

  // Validation before seal (status thrown)
  errorMissingInputs: {
    en: "Enter a valid Neo N3 recipient and a valid positive transfer amount before sealing.",
    zh: "封装前请输入有效的 Neo N3 收款方和有效的正数转账金额。",
  },

  // Seal error messages (user-facing)
  sealErrorKey: {
    en: "Morpheus sealing is unavailable for this network. Your transfer details remain local.",
    zh: "该网络上的 Morpheus 封装当前不可用。您的转账细节仍保留在本地。",
  },
  sealErrorAlgorithm: {
    en: "The selected Morpheus key cannot be used by this client. Your transfer details remain local.",
    zh: "此客户端无法使用所选的 Morpheus 密钥。您的转账细节仍保留在本地。",
  },
  sealErrorStore: {
    en: "Morpheus confidential storage is temporarily unavailable. Your transfer details remain local.",
    zh: "Morpheus 隐私存储暂时不可用。您的转账细节仍保留在本地。",
  },
  sealErrorTimeout: {
    en: "Morpheus did not respond in time. Any prepared ciphertext remains on this device for retry.",
    zh: "Morpheus 未及时响应；已生成的密文会保留在本设备，供稍后重试。",
  },
  sealErrorGeneric: {
    en: "Private transfer sealing is unavailable right now. Your transfer details remain local.",
    zh: "隐私转账封装当前不可用。您的转账细节仍保留在本地。",
  },

  // Result row labels
  resultSecretRef: { en: "Secret ref", zh: "密文引用" },
  resultCommitment: { en: "Commitment", zh: "承诺" },
  resultNullifier: { en: "Nullifier", zh: "作废符" },
  // One-line purpose captions so the sealed-intent output is legible.
  resultSecretRefHint: {
    en: "Keep this to retrieve the stored ciphertext later via Morpheus.",
    zh: "请保留此引用，以便稍后通过 Morpheus 找回已保存的密文。",
  },
  resultCommitmentHint: {
    en: "Public anchor a verifier can check without seeing the private fields.",
    zh: "公开锚点，验证方无需查看隐私字段即可核验。",
  },
  resultNullifierHint: {
    en: "Prevents the same sealed intent from being used twice.",
    zh: "防止同一已封装意图被重复使用。",
  },
  copyAction: { en: "Copy", zh: "复制" },
  copiedAction: { en: "Copied", zh: "已复制" },
  copyAria: { en: "Copy {label}", zh: "复制 {label}" },
  copiedAria: { en: "{label} copied", zh: "{label} 已复制" },

  // Sealed-intents history
  historyTitle: { en: "Sealed intents", zh: "已封装意图" },
  historySubtitle: {
    en: "Saved locally on this device so you can recover each secret reference later.",
    zh: "本地保存在此设备上，方便您稍后找回每个密文引用。",
  },
  historyEmpty: {
    en: "Sealed transfer intents will appear here after you seal one.",
    zh: "封装一次后，已封装的转账意图会显示在这里。",
  },
  historyCount: { en: "{count} stored ciphertext references on this device", zh: "本设备保存了 {count} 条密文引用" },
  historyClear: { en: "Clear history", zh: "清除历史" },
  historyClearAria: { en: "Clear sealed intents history", zh: "清除已封装意图历史" },
  historyMetaNetwork: { en: "Network", zh: "网络" },
  historyMetaAsset: { en: "Asset", zh: "资产" },

  // Steps explainer. Steps 1 and 4 are NOT performed in this app (it has no
  // contract and moves no funds) — they are badged so the user is not told to
  // act on a button that does not exist.
  stepsTitle: { en: "Where a confidential transfer fits", zh: "隐私转账的流程定位" },
  stepInApp: { en: "In this app", zh: "本应用内" },
  stepNotInApp: { en: "Not in this app", zh: "不在本应用内" },
  step1Title: { en: "Deposit or wallet intent", zh: "存入或钱包意图" },
  step1Body: {
    en: "Handled by your wallet and the settlement service — this app does not lock funds or sign a payment.",
    zh: "由您的钱包与结算服务处理 — 本应用不会锁定资金或签署支付。",
  },
  step2Title: { en: "Local encryption", zh: "本地加密" },
  step2Body: {
    en: "The private fields are sealed in your browser with X25519-HKDF-SHA256-AES-256-GCM.",
    zh: "隐私字段在您的浏览器中使用 X25519-HKDF-SHA256-AES-256-GCM 封装。",
  },
  step3Title: { en: "TEE validation", zh: "TEE 校验" },
  step3Body: {
    en: "A downstream Morpheus service may decrypt and validate the packet. This app does not receive or verify a TEE attestation.",
    zh: "后续 Morpheus 服务可能解密并校验封装包；本应用不会接收或验证 TEE 证明。",
  },
  step4Title: { en: "Release or refund", zh: "释放或退款" },
  step4Body: {
    en: "Handled by your wallet and the settlement service — this app does not release or refund funds.",
    zh: "由您的钱包与结算服务处理 — 本应用不会释放或退款资金。",
  },
  heroFacts: { en: "{network} · {asset}", zh: "{network} · {asset}" },

  // Runtime boundary, recovery, and tucked-away technical details.
  serviceStatusTitle: { en: "Private lane status", zh: "隐私通道状态" },
  serviceNetworkDetail: { en: "New intents: testnet only", zh: "新建意图：仅测试网" },
  serviceOracleReady: { en: "Oracle key matches contract", zh: "Oracle 密钥与合约一致" },
  serviceOracleChecking: { en: "Checking Oracle key", zh: "正在检查 Oracle 密钥" },
  serviceOracleAwaiting: { en: "Oracle key ready on connect", zh: "连接后取得 Oracle 密钥" },
  serviceOracleAwaitingDetail: { en: "Fetched when you connect", zh: "连接时自动获取" },
  serviceOracleBlocked: { en: "Oracle key unavailable", zh: "Oracle 密钥不可用" },
  serviceFreshKeyRequired: { en: "Fresh contract key required", zh: "必须取得新鲜合约密钥" },
  serviceStorageStored: { en: "Ciphertext stored", zh: "密文已保存" },
  serviceStorageWorking: { en: "Saving ciphertext", zh: "正在保存密文" },
  serviceStorageRecoverable: { en: "Retry available", zh: "可恢复重试" },
  serviceStorageSubmit: { en: "Storage checked on submit", zh: "提交时检查存储" },
  serviceStorageDetail: { en: "Storage reference required", zh: "必须取得存储引用" },
  pendingTitle: { en: "Pending encrypted intent", zh: "待恢复的加密意图" },
  pendingBody: {
    en: "The exact {asset} ciphertext packet is saved locally. Storage attempts: {attempts}.",
    zh: "同一份 {asset} 密文封装包已保存在本地。存储尝试：{attempts} 次。",
  },
  pendingRetry: { en: "Retry storage", zh: "重试存储" },
  pendingDiscard: { en: "Discard packet", zh: "丢弃封装包" },
  pendingDiscardConfirm: { en: "Confirm discard", zh: "确认丢弃" },
  pendingMustResolve: { en: "Retry or discard the pending encrypted packet before creating another.", zh: "创建新意图前，请先重试或丢弃待恢复密文封装包。" },
  pendingMissing: { en: "No recoverable ciphertext packet was found.", zh: "未找到可恢复的密文封装包。" },
  pendingWrongNetwork: { en: "This encrypted packet belongs to another network.", zh: "此密文封装包属于其他网络。" },
  pendingDiscarded: { en: "Pending ciphertext packet discarded from this device.", zh: "待恢复密文封装包已从本设备移除。" },
  errorOperationInProgress: { en: "A sealing operation is already in progress.", zh: "已有封装操作正在进行。" },
  retryRuntime: { en: "Check service again", zh: "重新检查服务" },
  detailsRecovery: { en: "Details & recovery", zh: "详情与恢复" },
  memoPlaceholder: { en: "Optional private note", zh: "选填的隐私备注" },
  memoHint: { en: "Up to 160 characters; encrypted locally and never persisted as plaintext.", zh: "最多 160 个字符；本地加密，不以明文持久化。" },
  privacyBoundaryTitle: { en: "What is and is not private", zh: "隐私边界" },
  privacyBoundarySubtitle: { en: "Exact fields exposed by this envelope", zh: "此封装包实际暴露的字段" },
  privacyPrivateFields: { en: "Encrypted fields", zh: "加密字段" },
  privacyPrivateFieldsValue: { en: "Recipient, amount, memo, note secret", zh: "收款方、金额、备注、note secret" },
  privacyPublicFields: { en: "Public metadata", zh: "公开元数据" },
  privacyPublicFieldsValue: { en: "Network, asset, commitment, nullifier", zh: "网络、资产、承诺、作废符" },
  privacyNotVerified: { en: "Not verified here", zh: "本应用不验证" },
  privacyNotVerifiedValue: { en: "TEE execution, settlement, payment, anonymity", zh: "TEE 执行、结算、支付、匿名性" },
  cryptoDetailsTitle: { en: "Encryption & source", zh: "加密与来源" },
  oracleSourceContract: { en: "Oracle key contract", zh: "Oracle 密钥合约" },
  oracleNefChecksum: { en: "Pinned Oracle NEF checksum", zh: "固定 Oracle NEF 校验和" },
  walletStatus: { en: "Wallet", zh: "钱包" },
  walletNotRequested: { en: "Not connected · no signature or fee", zh: "不连接 · 无签名、无费用" },
  latestReceiptTitle: { en: "Latest stored reference", zh: "最近保存的引用" },
} as const;

export const messages = mergeMessages(appMessages);
