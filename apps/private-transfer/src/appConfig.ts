import { mergeMessages } from "@shared/locale/base-messages";
import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

export const appId = "miniapp-private-transfer";

export const manifest: MiniAppManifest = {
  name: "Confidential Transfer",
  description: "Private Neo N3 transfer intents sealed locally and verified by Morpheus confidential compute.",
  icon: "locked",
  category: "defi",
  shell: "console",
  theme: { family: "finance", accentColor: "#16c784", density: "comfortable" },
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
    payments: true,
    oracle: true,
    compute: true,
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
    en: "The MiniApp does not put zk curve verification inside Neo VM. It seals transfer details in the browser, stores only ciphertext through Morpheus, and uses confidential compute to produce an attestable settlement intent.",
    zh: "该小程序不会在 Neo VM 内直接做 zk 曲线验证，而是在浏览器本地封装转账细节，只通过 Morpheus 存储密文，并由隐私计算生成可验证的结算意图。",
  },
  feature1Name: { en: "Browser Sealed", zh: "浏览器封装" },
  feature1Desc: { en: "Recipient, amount, memo, and note secret are encrypted before they leave the page.", zh: "收款方、金额、备注和 note secret 在离开页面前完成加密。" },
  feature2Name: { en: "TEE Verified", zh: "TEE 校验" },
  feature2Desc: { en: "Morpheus confidential compute decrypts and validates the private payload inside the TEE.", zh: "Morpheus 隐私计算在 TEE 内解密并校验隐私载荷。" },
  feature3Name: { en: "No Neo zk Curve Assumption", zh: "不依赖 Neo zk 曲线" },
  feature3Desc: { en: "The workflow is designed for Neo N3 without requiring unsupported zk curve verification on-chain.", zh: "该流程面向 Neo N3 设计，不要求链上支持特定 zk 曲线验证。" },

  // Placeholder / status seeds
  digestPlaceholder: { en: "—", zh: "—" },
  statusSealed: { en: "Sealed", zh: "已封装" },
  privacyModeLabel: { en: "Morpheus TEE", zh: "Morpheus TEE" },

  // Network labels
  networkTestnet: { en: "Testnet", zh: "测试网" },
  networkMainnet: { en: "Mainnet", zh: "主网" },
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
    en: "Nothing is broken — you can fill in and preview the form now; live sealing just needs the runtime back online.",
    zh: "应用并未出错 — 您现在即可填写并预览表单；实时封装只需等待运行时恢复。",
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
  heroEyebrow: { en: "Neo N3 private payments", zh: "Neo N3 隐私支付" },
  heroTitle: { en: "Seal a private transfer intent", zh: "封装隐私转账意图" },
  heroBody: {
    en: "Seal recipient, amount, memo, and note secret in the browser for Morpheus confidential compute. This produces an encrypted intent reference — no funds are moved by this app.",
    zh: "在浏览器中封装收款方、金额、备注与 note secret，交由 Morpheus 隐私计算处理。本步骤生成一个加密意图引用 — 本应用不会转移任何资金。",
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
  composerTitle: { en: "Seal desk", zh: "封装台" },
  composerSubtitle: {
    en: "Choose the lane, fill the intent, then create the encrypted reference.",
    zh: "选择通道、填写意图，然后生成加密引用。",
  },

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
  validationHint: {
    en: "Add a valid recipient and positive amount to enable local sealing.",
    zh: "请填写有效的收款方与正数金额以启用本地封装。",
  },

  // Seal button + busy state
  sealButton: { en: "Seal private transfer intent", zh: "封装隐私转账意图" },
  sealing: { en: "Sealing...", zh: "封装中…" },
  sealAriaIdle: { en: "Seal private transfer intent", zh: "封装隐私转账意图" },
  sealAriaBusy: { en: "Sealing private transfer intent", zh: "正在封装隐私转账意图" },
  // Always-visible disclosure above the seal button: this app only seals an
  // encrypted intent; it has no contract and never moves funds.
  noFundsBanner: {
    en: "No funds were moved — this seals an encrypted intent for Morpheus confidential compute, not a payment.",
    zh: "未转移任何资金 — 本步骤为 Morpheus 隐私计算封装加密意图，并非一笔支付。",
  },

  // Pre-seal confirm summary — echoes the exact values being encrypted so the
  // user verifies recipient, amount + asset, and network before the seal.
  summaryTitle: { en: "You are about to seal", zh: "即将封装" },
  summaryRecipient: { en: "Recipient", zh: "收款方" },
  summaryAmount: { en: "Amount", zh: "金额" },
  summaryNetwork: { en: "Network", zh: "网络" },
  summaryEncryption: { en: "Encryption", zh: "加密方式" },
  summaryPending: {
    en: "Fill in a valid recipient and amount to preview the sealed intent.",
    zh: "填写有效的收款方与金额，即可预览将封装的意图。",
  },
  summaryAmountValue: { en: "{amount} {asset}", zh: "{amount} {asset}" },

  // Idle right-rail explainer (shown before the first seal) — replaces the
  // empty rail with a short marketing/how-it-works panel and the seal CTA hint.
  introTitle: { en: "Encrypted before it leaves your browser", zh: "在离开浏览器前完成加密" },
  introBody: {
    en: "Your recipient, amount, and memo are sealed locally with end-to-end encryption. Only ciphertext leaves this page — no funds move.",
    zh: "您的收款方、金额与备注在本地完成端到端加密封装。仅密文会离开此页面——不会转移任何资金。",
  },
  introPointLocal: { en: "Sealed locally", zh: "本地封装" },
  introPointLocalDesc: { en: "Private fields encrypted in your browser.", zh: "隐私字段在浏览器中加密。" },
  introPointTee: { en: "TEE verified", zh: "TEE 校验" },
  introPointTeeDesc: { en: "Only Morpheus confidential compute can decrypt.", zh: "仅 Morpheus 隐私计算可解密。" },
  introPointNoFunds: { en: "No funds moved", zh: "不转移资金" },
  introPointNoFundsDesc: { en: "This seals an intent, never a payment.", zh: "本步骤封装意图，而非支付。" },

  // Submit status
  statusInitial: { en: "Ready to seal private transfer details locally.", zh: "可在本地封装隐私转账细节。" },
  statusSealingProgress: {
    en: "Fetching Morpheus key, encrypting locally, and storing ciphertext.",
    zh: "正在获取 Morpheus 密钥、本地加密并存储密文。",
  },
  statusSealingShort: { en: "Sealing private transfer", zh: "正在封装隐私转账" },
  statusSealedToast: { en: "Private transfer sealed", zh: "隐私转账已封装" },
  statusStored: {
    en: "Intent sealed — ciphertext stored. Morpheus confidential compute can decrypt and validate this payload inside the TEE. No funds were moved by this app; the references below identify the sealed intent.",
    zh: "意图已封装 — 密文已存储。Morpheus 隐私计算可在 TEE 内解密并校验该载荷。本应用未转移任何资金；下方引用用于标识该已封装意图。",
  },
  statusBlockHeader: { en: "Morpheus confidential compute", zh: "Morpheus 隐私计算" },
  safeCopy: {
    en: "Nothing was sent on-chain. Fix the inputs or try again when the Morpheus service is available.",
    zh: "未在链上发送任何内容。请修正输入，或在 Morpheus 服务可用时重试。",
  },
  errorDetailLabel: { en: "Service detail", zh: "服务详情" },

  // Validation before seal (status thrown)
  errorMissingInputs: {
    en: "Enter a valid Neo N3 recipient and a positive transfer amount before sealing.",
    zh: "封装前请输入有效的 Neo N3 收款方和正数转账金额。",
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
    en: "Keep this to retrieve or settle the sealed intent later via Morpheus.",
    zh: "请保留此引用，以便稍后通过 Morpheus 找回或结算该已封装意图。",
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
    en: "Morpheus decrypts, checks nullifier reuse, and signs the settlement envelope.",
    zh: "Morpheus 解密、检查作废符复用并签署结算信封。",
  },
  step4Title: { en: "Release or refund", zh: "释放或退款" },
  step4Body: {
    en: "Handled by your wallet and the settlement service — this app does not release or refund funds.",
    zh: "由您的钱包与结算服务处理 — 本应用不会释放或退款资金。",
  },
  heroFacts: { en: "{network} · {asset}", zh: "{network} · {asset}" },
} as const;

export const messages = mergeMessages(appMessages);
