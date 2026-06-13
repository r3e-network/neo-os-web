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

  // Hero
  heroEyebrow: { en: "Neo N3 private payments", zh: "Neo N3 隐私支付" },
  heroTitle: { en: "Confidential transfer desk", zh: "隐私转账工作台" },
  heroBody: {
    en: "Seal recipient, amount, memo, and note secret in the browser, then Morpheus runs the private compute path.",
    zh: "在浏览器中封装收款方、金额、备注与 note secret，随后由 Morpheus 执行隐私计算路径。",
  },
  heroBadge: { en: "No on-chain zk curve dependency", zh: "无需链上 zk 曲线依赖" },

  // Form
  formNetworkLabel: { en: "Network", zh: "网络" },
  formAssetLabel: { en: "Asset", zh: "资产" },
  formRecipientLabel: { en: "Recipient", zh: "收款方" },
  formRecipientPlaceholder: { en: "N...", zh: "N..." },
  formAmountLabel: { en: "Amount", zh: "金额" },
  formMemoLabel: { en: "Private memo", zh: "隐私备注" },
  presetsLabel: { en: "Amount presets", zh: "金额预设" },

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
  sealButton: { en: "Seal private transfer", zh: "封装隐私转账" },
  sealing: { en: "Sealing...", zh: "封装中…" },
  sealAriaIdle: { en: "Seal private transfer", zh: "封装隐私转账" },
  sealAriaBusy: { en: "Sealing private transfer", zh: "正在封装隐私转账" },

  // Submit status
  statusInitial: { en: "Ready to seal private transfer details locally.", zh: "可在本地封装隐私转账细节。" },
  statusSealingProgress: {
    en: "Fetching Morpheus key, encrypting locally, and storing ciphertext.",
    zh: "正在获取 Morpheus 密钥、本地加密并存储密文。",
  },
  statusSealingShort: { en: "Sealing private transfer", zh: "正在封装隐私转账" },
  statusSealedToast: { en: "Private transfer sealed", zh: "隐私转账已封装" },
  statusStored: {
    en: "Ciphertext stored. Morpheus confidential compute can now decrypt and validate the private transfer payload inside the TEE.",
    zh: "密文已存储。Morpheus 隐私计算可在 TEE 内解密并校验隐私转账载荷。",
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

  // Steps explainer
  stepsTitle: { en: "How a confidential transfer settles", zh: "隐私转账如何结算" },
  step1Title: { en: "Deposit or wallet intent", zh: "存入或钱包意图" },
  step1Body: {
    en: "The public side only needs an asset lock or signed payment intent.",
    zh: "公开侧仅需一笔资产锁定或一份已签名的支付意图。",
  },
  step2Title: { en: "Local encryption", zh: "本地加密" },
  step2Body: {
    en: "The private fields are sealed with X25519-HKDF-SHA256-AES-256-GCM.",
    zh: "隐私字段使用 X25519-HKDF-SHA256-AES-256-GCM 封装。",
  },
  step3Title: { en: "TEE validation", zh: "TEE 校验" },
  step3Body: {
    en: "Morpheus decrypts, checks nullifier reuse, and signs the settlement envelope.",
    zh: "Morpheus 解密、检查作废符复用并签署结算信封。",
  },
  step4Title: { en: "Release or refund", zh: "释放或退款" },
  step4Body: {
    en: "The user submits the returned settlement intent through the wallet.",
    zh: "用户通过钱包提交返回的结算意图。",
  },
  heroFacts: { en: "{network} · {asset}", zh: "{network} · {asset}" },
} as const;

export const messages = mergeMessages(appMessages);
