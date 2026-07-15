import { mergeMessages } from "@shared/locale/base-messages";
import { getNetwork, type NeoNetwork } from "@shared/constants/rpc";
import type { MiniAppManifest } from "@shared/types/miniapp-manifest";
import { ORACLE_SEAL_APP_ID } from "./seal";

export const appId = ORACLE_SEAL_APP_ID;

/** The seal client is configured before setup, so bind it to the launch URL. */
export function configuredNetwork(): NeoNetwork {
  return getNetwork();
}

export const manifest: MiniAppManifest = {
  name: "Oracle Seal Console",
  description:
    "Encrypt a non-empty JSON object locally with the current Neo N3 Morpheus Oracle key, then store only its ciphertext. Storage returns a reference, not an attestation or transaction.",
  icon: "locked",
  category: "oracle",
  shell: "console",
  theme: { family: "default", accentColor: "#0f766e", density: "comfortable" },
  tabs: [{ key: "seal", labelKey: "tabSeal", icon: "locked", default: true }],
  stats: [
    { labelKey: "statNetwork", valueKey: "networkLabel", format: "text", icon: "globe" },
    { labelKey: "statService", valueKey: "runtimeStateLabel", format: "text", icon: "activity" },
    { labelKey: "statStored", valueKey: "sealCount", format: "number", icon: "archive" },
    { labelKey: "statFingerprint", valueKey: "lastFingerprint", format: "text", icon: "key" },
  ],
  sidebar: {
    titleKey: "sidebarTitle",
    items: [
      { labelKey: "statNetwork", valueKey: "networkLabel", format: "text" },
      { labelKey: "statService", valueKey: "runtimeStateLabel", format: "text" },
      { labelKey: "lastStatus", valueKey: "lastStatus", format: "text" },
      { labelKey: "statFingerprint", valueKey: "lastFingerprint", format: "text" },
    ],
  },
  features: { walletRequired: false, chainWarning: true },
  permissions: {
    payments: false,
    oracle: true,
    compute: false,
    confidential: true,
    storage: true,
  },
  docs: [
    { titleKey: "docsTitle", contentKey: "docsBody", type: "text" },
    { titleKey: "feature1Name", contentKey: "feature1Desc", type: "features" },
    { titleKey: "feature2Name", contentKey: "feature2Desc", type: "features" },
    { titleKey: "feature3Name", contentKey: "feature3Desc", type: "features" },
  ],
};

const appMessages = {
  appName: { en: "Oracle Seal Console", zh: "预言机密封控制台" },
  title: { en: "Oracle Seal", zh: "预言机密封" },
  tabSeal: { en: "Seal", zh: "密封" },
  sidebarTitle: { en: "Seal status", zh: "密封状态" },

  panelEyebrow: { en: "Morpheus confidential storage", zh: "Morpheus 机密存储" },
  panelTitle: { en: "Confidential Seal Studio", zh: "机密密封工作室" },
  panelDescription: {
    en: "Prepare a JSON object, encrypt it in this browser with the current Oracle contract key, then store only the exact ciphertext packet.",
    zh: "准备 JSON 对象，使用当前预言机合约密钥在浏览器本地加密，再只存储完全相同的密文封装包。",
  },
  heroCopy: {
    en: "The source stays in component memory. A storage receipt identifies ciphertext only; it is not a transaction, TEE attestation, or execution result.",
    zh: "源数据只停留在组件内存中。存储回执只标识密文；它不是交易、TEE 证明或执行结果。",
  },

  statNetwork: { en: "Network", zh: "网络" },
  statService: { en: "Seal lane", zh: "密封通道" },
  statStored: { en: "Stored", zh: "已存储" },
  statFingerprint: { en: "Ciphertext", zh: "密文标识" },
  lastStatus: { en: "Last status", zh: "最近状态" },
  fingerprintEmpty: { en: "None yet", zh: "暂无" },
  // "Mainnet"/"Testnet", not "MainNet"/"TestNet": the fleet's visible network
  // chips ("Morpheus Mainnet", "Neo N3 Mainnet") settle on this casing, and a
  // reviewer reading three consoles side by side should not see three
  // spellings of one network.
  networkMainnet: { en: "Neo N3 Mainnet", zh: "Neo N3 主网" },
  networkTestnet: { en: "Neo N3 Testnet", zh: "Neo N3 测试网" },
  networkUnknown: { en: "Unsupported network", zh: "不支持的网络" },
  runtimeChecking: { en: "Checking key", zh: "正在核对密钥" },
  runtimeReady: { en: "Contract key verified", zh: "合约密钥已核验" },
  runtimeUnavailable: { en: "Unavailable", zh: "不可用" },
  runtimeRecovery: { en: "Ciphertext recoverable", zh: "密文可恢复" },
  runtimeCompletion: { en: "Receipt cleanup", zh: "回执整理" },
  runtimeRecoveryInvalid: { en: "Recovery needs cleanup", zh: "恢复记录需清理" },

  statusCheckingRuntime: {
    en: "Reading the Oracle encryption key and comparing it with the selected Neo N3 contract.",
    zh: "正在读取预言机加密密钥，并与所选 Neo N3 合约进行比对。",
  },
  statusRuntimeReady: {
    en: "Current Oracle contract key verified. New seals are enabled.",
    zh: "当前预言机合约密钥已核验，可以创建新密封包。",
  },
  /**
   * Reserved for a seal the visitor actually asked for and that was blocked
   * before encryption (main.tsx `sealPayload`). "No new ciphertext was created"
   * is honest reassurance THERE, because something was in fact attempted.
   * It must never be the first thing the console says: see
   * `statusRuntimeUnverified` for the passive probe.
   */
  statusRuntimeUnavailable: {
    en: "The current Oracle key could not be verified. No new ciphertext was created.",
    zh: "当前预言机密钥无法核验，未创建任何新密文。",
  },
  /**
   * The passive probe that runs on load has not reached the Oracle key yet —
   * the expected cold first paint, not a failure and not a seal outcome. The
   * copy this replaced ("could not be verified. No new ciphertext was created")
   * told a visitor who had opened the studio one second ago that a seal of
   * theirs had failed. State the pending fact and the next step instead.
   */
  statusRuntimeUnverified: {
    en: "The Oracle encryption key is not verified yet. Run Check service to enable new seals.",
    zh: "预言机加密密钥尚未核验。运行“检查服务”后即可创建新密封包。",
  },
  statusKey: { en: "Verifying the current Oracle contract key…", zh: "正在核验当前预言机合约密钥…" },
  statusEncrypt: { en: "Encrypting the JSON object in this browser…", zh: "正在此浏览器中加密 JSON 对象…" },
  statusStore: { en: "Ciphertext saved locally; requesting confidential storage…", zh: "密文已在本地保存，正在请求机密存储…" },
  statusStored: {
    en: "Ciphertext stored. The receipt proves only that a storage reference was returned.",
    zh: "密文已存储。该回执只证明存储服务返回了引用。",
  },
  statusRecoveryReady: {
    en: "An exact ciphertext packet is saved on this device and ready to retry.",
    zh: "本设备已保存一份完全相同的密文封装包，可直接重试。",
  },
  statusCompletionReady: {
    en: "Storage already returned a receipt. Finish device cleanup without sending the ciphertext again.",
    zh: "存储服务已返回回执。请完成设备端整理，不会再次发送密文。",
  },
  statusRecoveryInvalid: {
    en: "A device recovery record is unreadable. It cannot be sent or presented as a valid ciphertext packet.",
    zh: "设备上的恢复记录无法读取，不能发送，也不会被展示为有效密文封装包。",
  },
  statusReceiptLocalWarning: {
    en: "Ciphertext storage returned a valid reference, but this device could not retain the receipt history.",
    zh: "密文存储已返回有效引用，但本设备未能保留回执历史。",
  },
  statusStorageCritical: {
    en: "Storage returned a receipt, but device recovery cleanup is unavailable. Keep this tab open and finish cleanup before another seal.",
    zh: "存储服务已返回回执，但设备恢复记录暂时无法整理。请保持此页面打开，并在创建下一份密封前完成整理。",
  },
  statusRetrying: { en: "Retrying storage with the exact saved ciphertext…", zh: "正在使用完全相同的已保存密文重试存储…" },
  statusDiscarded: { en: "The pending ciphertext packet was removed from this device.", zh: "待处理密文封装包已从本设备移除。" },

  stageTitle: { en: "Seal chamber", zh: "密封舱" },
  stageIdle: { en: "Awaiting a private JSON object", zh: "等待私密 JSON 对象" },
  stageReady: { en: "Ready to seal", zh: "可以密封" },
  stageWorking: { en: "Seal in progress", zh: "正在密封" },
  stageStored: { en: "Storage receipt ready", zh: "存储回执已就绪" },
  stageRecovery: { en: "Recovery packet protected", zh: "恢复封装包已保护" },
  artworkLabel: { en: "Local encryption chamber", zh: "本地加密舱" },

  flowTitle: { en: "Prepare → seal → receipt", zh: "准备 → 密封 → 回执" },
  flowPrepare: { en: "Prepare", zh: "准备" },
  flowPrepareDesc: { en: "Validate a non-empty JSON object locally.", zh: "在本地校验非空 JSON 对象。" },
  flowSeal: { en: "Seal", zh: "密封" },
  flowSealDesc: { en: "X25519/HKDF/AES-GCM encryption in your browser.", zh: "在浏览器中进行 X25519/HKDF/AES-GCM 加密。" },
  flowReceipt: { en: "Receipt", zh: "回执" },
  flowReceiptDesc: { en: "Accept only a non-empty confidential-store reference.", zh: "只接受非空的机密存储引用。" },
  flowRecovery: { en: "Recovery", zh: "恢复" },
  flowRecoveryDesc: { en: "A failed store keeps the exact ciphertext for retry.", zh: "存储失败时保留完全相同的密文供重试。" },

  purposeTitle: { en: "Seal purpose", zh: "密封用途" },
  purposeInput: { en: "Oracle input", zh: "预言机输入" },
  purposeInputHint: { en: "Confidential input for a downstream Oracle workflow.", zh: "供后续预言机工作流使用的机密输入。" },
  purposeCallback: { en: "Callback secret", zh: "回调密钥" },
  purposeCallbackHint: { en: "A callback-bound secret stored as ciphertext for a separate authorized integration.", zh: "以密文形式存储、供独立授权集成使用的回调密钥。" },
  purposeCompute: { en: "Private compute", zh: "隐私计算" },
  purposeComputeHint: { en: "Inputs prepared for a separate confidential-compute request.", zh: "为独立的机密计算请求准备输入。" },

  draftTitle: { en: "Seal object", zh: "密封对象" },
  draftCopy: { en: "The main stage shows the object and its journey; source fields stay in the detail drawer.", zh: "主舞台展示对象及其流程；源字段收在详情抽屉中。" },
  publicRoute: { en: "Public route", zh: "公开路由" },
  publicRoutePlaceholder: { en: "Optional public label, e.g. oracle://policy/check", zh: "可选公开标签，例如 oracle://policy/check" },
  publicRouteHint: { en: "Optional. This label is stored as public metadata; never put a secret here.", zh: "可选。此标签会作为公开元数据存储，请勿在此填写秘密。" },
  confidentialPayload: { en: "Confidential JSON", zh: "机密 JSON" },
  payloadPlaceholder: { en: "Enter a non-empty JSON object", zh: "输入非空 JSON 对象" },
  payloadEmpty: { en: "Add a JSON object in Details", zh: "请在详情中添加 JSON 对象" },
  payloadValid: { en: "Valid private object", zh: "有效私密对象" },
  payloadInvalid: { en: "Needs a non-empty JSON object", zh: "需要非空 JSON 对象" },
  payloadTooLarge: { en: "Exceeds the 64 KiB limit", zh: "超过 64 KiB 限制" },
  payloadSize: { en: "{count} bytes", zh: "{count} 字节" },
  plaintextBoundary: { en: "Plaintext boundary", zh: "明文边界" },
  plaintextBoundaryCopy: {
    en: "JSON remains in React component memory and is never written to app storage, a receipt, or public metadata.",
    zh: "JSON 只保留在 React 组件内存中，绝不会写入应用存储、回执或公开元数据。",
  },

  sealAction: { en: "Seal & store ciphertext", zh: "密封并存储密文" },
  sealActionWorking: { en: "Sealing ciphertext", zh: "正在密封密文" },
  retryAction: { en: "Retry exact ciphertext", zh: "重试同一密文" },
  retryActionWorking: { en: "Retrying storage", zh: "正在重试存储" },
  finalizeAction: { en: "Finish receipt cleanup", zh: "完成回执整理" },
  finalizeActionWorking: { en: "Finishing receipt", zh: "正在整理回执" },
  clearInvalidAction: { en: "Clear unreadable recovery", zh: "清理不可读恢复记录" },
  confirmClearInvalid: { en: "Confirm recovery cleanup", zh: "确认清理恢复记录" },
  refreshRuntime: { en: "Check service", zh: "检查服务" },
  editPayload: { en: "Details & source", zh: "详情与源数据" },
  resetDraft: { en: "Clear draft", zh: "清空草稿" },

  drawerReceipt: { en: "Receipt", zh: "回执" },
  drawerFlow: { en: "Workflow", zh: "流程" },
  drawerSource: { en: "Private source", zh: "私密源数据" },
  receiptTitle: { en: "Confidential-store receipt", zh: "机密存储回执" },
  receiptEmpty: { en: "No storage receipt yet", zh: "尚无存储回执" },
  receiptEmptyCopy: { en: "A receipt appears only after the store returns a valid non-zero reference.", zh: "只有存储服务返回有效且非零的引用后，才会显示回执。" },
  receiptSecretRef: { en: "Storage reference", zh: "存储引用" },
  receiptFingerprint: { en: "Ciphertext SHA-256", zh: "密文 SHA-256" },
  receiptContract: { en: "Oracle key contract", zh: "预言机密钥合约" },
  receiptAlgorithm: { en: "Local encryption", zh: "本地加密" },
  receiptBoundary: { en: "No transaction or attestation", zh: "无交易或证明" },
  receiptBoundaryCopy: {
    en: "This MiniApp does not submit a Neo transaction, run confidential compute, or verify a TEE attestation. A storage reference is not proof of account ownership.",
    zh: "本小程序不会提交 Neo 交易、运行机密计算或验证 TEE 证明。存储引用也不是账户所有权证明。",
  },

  recoveryTitle: { en: "Recover pending ciphertext", zh: "恢复待处理密文" },
  recoveryCopy: { en: "The exact encrypted packet is saved locally. Retry does not parse the source or encrypt again.", zh: "完全相同的加密封装包已保存在本地。重试不会解析源数据，也不会再次加密。" },
  recoveryStoredTitle: { en: "Receipt returned", zh: "回执已返回" },
  recoveryStoredCopy: {
    en: "The external store already returned a valid reference. This step only saves the receipt and clears the local journal; it never sends ciphertext again.",
    zh: "外部存储已返回有效引用。此步骤只保存回执并清理本地记录，绝不会再次发送密文。",
  },
  pendingMalformedTitle: { en: "Unreadable recovery record", zh: "恢复记录不可读" },
  pendingMalformedCopy: {
    en: "The saved record failed structural checks, so it is blocked from recovery. Clear it before creating a new seal.",
    zh: "已保存记录未通过结构校验，因此无法恢复。请先清理，再创建新的密封包。",
  },
  recoveryAttempts: { en: "Storage attempts", zh: "存储尝试次数" },
  recoveryCreated: { en: "Saved locally", zh: "本地保存时间" },
  discardPending: { en: "Discard ciphertext", zh: "丢弃密文" },
  confirmDiscard: { en: "Confirm discard", zh: "确认丢弃" },
  pendingMustResolve: { en: "Retry or discard the pending ciphertext before creating another seal.", zh: "创建新密封包前，请先重试或丢弃待处理密文。" },
  pendingMissing: { en: "No recoverable ciphertext packet was found.", zh: "未找到可恢复的密文封装包。" },
  pendingWrongNetwork: { en: "The saved ciphertext belongs to another Neo N3 network.", zh: "已保存密文属于另一个 Neo N3 网络。" },
  operationInProgress: { en: "A seal operation is already in progress.", zh: "密封操作正在进行中。" },

  sealErrorInput: { en: "Enter a non-empty valid JSON object before sealing.", zh: "密封前请输入有效且非空的 JSON 对象。" },
  sealErrorTooLarge: { en: "The confidential JSON exceeds the 64 KiB limit.", zh: "机密 JSON 超过 64 KiB 限制。" },
  sealErrorKey: { en: "The Oracle encryption key could not be verified against the selected contract.", zh: "无法根据所选合约核验预言机加密密钥。" },
  sealErrorAlgorithm: { en: "The required X25519/HKDF/AES-GCM encryption lane is unavailable.", zh: "所需的 X25519/HKDF/AES-GCM 加密通道不可用。" },
  sealErrorEncrypt: { en: "Local encryption failed. No storage receipt was created.", zh: "本地加密失败，未创建存储回执。" },
  sealErrorService: {
    en: "Confidential storage is not configured for this network. No ciphertext was created or sent.",
    zh: "当前网络尚未配置机密存储通道，未创建或发送任何密文。",
  },
  sealErrorStore: { en: "Storage did not return a valid reference. The exact ciphertext remains available for retry.", zh: "存储服务未返回有效引用，完全相同的密文仍可重试。" },
  sealErrorStorage: {
    en: "This device could not durably save or clear recovery state. No missing step is treated as complete.",
    zh: "本设备无法可靠保存或清理恢复状态，任何缺失步骤都不会被视为完成。",
  },
  sealErrorTimeout: { en: "The service timed out. Any prepared ciphertext remains available for retry.", zh: "服务超时，任何已准备密文仍可重试。" },
  sealErrorGeneric: { en: "The seal could not be completed. No result was assumed.", zh: "密封未能完成，系统不会假定任何结果。" },

  docsTitle: { en: "Production boundary", zh: "生产边界" },
  docsBody: {
    en: "The app verifies the current Oracle X25519 key with a direct read from the selected Neo N3 RPC, encrypts locally, persists ciphertext before storage, and records a receipt only for a valid store reference.",
    zh: "应用会直接读取所选 Neo N3 RPC 来核验当前预言机 X25519 密钥，在本地加密，在存储前持久化密文，并且只在获得有效存储引用后记录回执。",
  },
  feature1Name: { en: "Local plaintext", zh: "本地明文" },
  feature1Desc: { en: "Source JSON stays in component memory and is excluded from recovery and receipt records.", zh: "源 JSON 只停留在组件内存中，不会进入恢复记录或回执。" },
  feature2Name: { en: "Exact recovery", zh: "精确恢复" },
  feature2Desc: { en: "A failed store retries the same validated ciphertext packet instead of encrypting a second object.", zh: "存储失败时重试同一份已校验密文，而不是再次加密生成另一个对象。" },
  feature3Name: { en: "Honest receipt", zh: "诚实回执" },
  feature3Desc: { en: "A store reference is never presented as a transaction, execution result, or TEE attestation.", zh: "存储引用绝不会被描述为交易、执行结果或 TEE 证明。" },
} as const;

export const messages = mergeMessages(appMessages);
