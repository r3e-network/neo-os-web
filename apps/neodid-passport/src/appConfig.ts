import { mergeMessages } from "@shared/locale/base-messages";
import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

export const appId = "miniapp-neodid-passport";
export const DEFAULT_SUBJECT_DID = "did:morpheus:neo_n3:service:neodid";

export const appMeta = {
  networkLabel: "Morpheus Testnet",
  endpointLabel: "Host NeoDID resolver + Neo RPC",
};

export const manifest: MiniAppManifest = {
  name: "NeoDID Passport",
  description:
    "Inspect a Morpheus NeoDID document, create a self-authored review envelope, and optionally attach an unverified wallet signature.",
  icon: "did",
  category: "tool",
  shell: "console",
  theme: { family: "social", accentColor: "#0b8f83", density: "comfortable" },
  tabs: [{ key: "passport", labelKey: "tabPassport", icon: "did", default: true }],
  stats: [],
  operations: [],
  sidebar: { titleKey: "appName", items: [] },
  features: { walletRequired: false, chainWarning: true },
  docs: [
    { titleKey: "appName", contentKey: "docsSubtitle", type: "text" },
    { titleKey: "feature1Name", contentKey: "feature1Desc", type: "features" },
    { titleKey: "feature2Name", contentKey: "feature2Desc", type: "features" },
    { titleKey: "feature3Name", contentKey: "feature3Desc", type: "features" },
  ],
  permissions: { oracle: true },
};

const appMessages = {
  appName: { en: "NeoDID Passport", zh: "NeoDID 身份护照" },
  title: { en: "NeoDID Passport Review", zh: "NeoDID 身份护照核对" },
  tabPassport: { en: "Passport", zh: "护照" },
  passportProductSubtitle: {
    en: "Inspect a DID document, review a short-lived local envelope, and attach a wallet signature only when useful.",
    zh: "检查 DID 文档、核对短期本地复核包，并仅在需要时附加钱包签名。",
  },
  mainnet: { en: "Mainnet", zh: "主网" },
  testnet: { en: "Testnet", zh: "测试网" },
  // The entry surface used to carry the bare network name twice — as the
  // stage-head badge and again as the hero chip — so a cold visit (no host
  // network param -> the `normalizeNetwork` testnet default) opened under two
  // TESTNET staleness chips before the visitor did anything.
  //
  // The head badge now states this app's scope in product voice. The network
  // is NOT hidden: it stays on the hero chip, where it is load-bearing (it
  // selects the resolver and the registry probe, and a signing wallet on the
  // other network is rejected), but labelled with its role so it reads as
  // information rather than a build stamp.
  reviewScopeBadge: { en: "Local review", zh: "本地核对" },
  resolverNetwork: { en: "Resolver · {network}", zh: "解析网络 · {network}" },
  details: { en: "Review details", zh: "核对详情" },
  reviewDetailsTitle: { en: "Passport review details", zh: "护照核对详情" },
  heroVisualAlt: {
    en: "A bright identity desk with a floating digital ID card.",
    zh: "明亮身份工作台上的悬浮数字证件。",
  },
  localReviewBoundary: {
    en: "Local review — not identity issuance",
    zh: "本地核对——不是身份签发",
  },
  credentialCardTitle: { en: "NeoDID review passport", zh: "NeoDID 核对护照" },
  passportPreview: { en: "NeoDID passport preview", zh: "NeoDID 护照预览" },
  claimContext: { en: "Self-authored context", zh: "自述场景" },
  audience: { en: "Relying audience", zh: "依赖方受众" },
  reviewExpiry: { en: "Review expires", zh: "核对包到期" },
  tenMinuteReview: { en: "10 minutes after creation", zh: "创建后 10 分钟" },
  documentVersion: { en: "Resolver version", zh: "解析器版本" },
  services: { en: "Services", zh: "服务" },
  verificationMethods: { en: "Verification methods", zh: "验证方法" },

  passportWorkspaceTitle: { en: "Review purpose", zh: "核对用途" },
  passportTemplateTitle: { en: "Choose a review context", zh: "选择核对场景" },
  passportTemplateWallet: { en: "Wallet signature context", zh: "钱包签名场景" },
  passportTemplateWalletHint: {
    en: "Prepare a message a connected wallet may sign; DID ownership is not checked.",
    zh: "准备用于钱包签名的消息；不会检查 DID 所有权。",
  },
  passportTemplateRelying: { en: "App audience context", zh: "应用受众场景" },
  passportTemplateRelyingHint: {
    en: "Name a relying app for review; this does not grant access.",
    zh: "填写依赖应用供核对；不会授予访问权限。",
  },
  passportTemplateDeveloper: { en: "Developer context", zh: "开发者场景" },
  passportTemplateDeveloperHint: {
    en: "Describe a developer-use context; no developer status is verified.",
    zh: "描述开发者使用场景；不会验证开发者身份。",
  },
  passportCustomCredential: { en: "Custom review context", zh: "自定义核对场景" },
  selfAuthoredClaimNote: {
    en: "Claims and audiences are user-entered labels. Resolution does not verify them.",
    zh: "声明与受众均由用户填写，DID 解析不会验证这些内容。",
  },

  assuranceTitle: { en: "Evidence boundary", zh: "证据边界" },
  assuranceSubtitle: { en: "What this passport can actually show", zh: "此护照实际能够证明什么" },
  assuranceDocument: { en: "DID document", zh: "DID 文档" },
  assuranceRuntime: { en: "Runtime metadata", zh: "运行时元数据" },
  assuranceRegistry: { en: "Registry deployment", zh: "注册表部署" },
  assuranceWallet: { en: "Wallet signature", zh: "钱包签名" },
  assuranceRecovery: { en: "Local recovery", zh: "本地恢复" },
  resolverNotCheckedStatus: { en: "Not resolved", zh: "尚未解析" },
  resolvingStatus: { en: "Resolving DID document…", zh: "正在解析 DID 文档…" },
  documentReturnedStatus: { en: "Document returned — identity not verified", zh: "文档已返回——身份未验证" },
  runtimeNotCheckedStatus: { en: "Not checked", zh: "尚未检查" },
  runtimeMetadataAvailable: { en: "Verifier metadata present", zh: "存在验证器元数据" },
  runtimeMetadataUnavailable: { en: "Verifier metadata unavailable", zh: "验证器元数据不可用" },
  registryNotChecked: { en: "Not checked", zh: "尚未检查" },
  registryChecking: { en: "Checking deployment…", zh: "正在检查部署…" },
  registryDeploymentVerified: { en: "Contract deployment found on the selected network", zh: "已在所选网络找到合约部署" },
  registryNoDeployment: { en: "No NeoDID registry deployment for this network", zh: "该网络没有 NeoDID 注册表部署" },
  registryAnchorMissing: { en: "Resolver did not declare the canonical registry", zh: "解析器未声明规范注册表" },
  registryAnchorMismatch: { en: "Resolver anchor differs from the canonical registry", zh: "解析器锚点与规范注册表不一致" },
  registryContractMismatch: { en: "Contract state is not the expected NeoDIDRegistry", zh: "合约状态不是预期的 NeoDIDRegistry" },
  registryUnavailable: { en: "Registry deployment could not be checked", zh: "暂时无法检查注册表部署" },
  registryNetworkMismatch: { en: "RPC network does not match this passport", zh: "RPC 网络与当前护照不匹配" },
  proofNotAttachedStatus: { en: "No wallet proof attached", zh: "尚未附加钱包证明" },
  proofAttachedUnverifiedStatus: { en: "Wallet signature returned — convention unconfirmed", zh: "钱包已返回签名——签名约定未确认" },
  storageAvailable: { en: "Available on this device", zh: "此设备可用" },
  storageUnavailableStatus: { en: "Local recovery unavailable; keep a copied JSON", zh: "本地恢复不可用，请保存复制的 JSON" },
  reviewEnvelopeReady: { en: "Local review envelope ready", zh: "本地核对包已就绪" },
  reviewNotBuilt: { en: "Awaiting DID resolution", zh: "等待 DID 解析" },
  passportExpiredStatus: { en: "Review envelope expired", zh: "核对包已过期" },

  routeBuild: { en: "Resolve & create review", zh: "解析并创建核对包" },
  signAction: { en: "Attach wallet signature", zh: "附加钱包签名" },
  waitingWalletStatus: { en: "Waiting for wallet signature…", zh: "正在等待钱包签名…" },
  copyAction: { en: "Copy review JSON", zh: "复制核对包 JSON" },
  retryStorageAction: { en: "Retry local recovery", zh: "重试本地恢复" },
  reset: { en: "Reset passport", zh: "重置护照" },
  copied: { en: "Review JSON copied", zh: "已复制核对包 JSON" },
  copyFailed: { en: "Review JSON could not be copied.", zh: "无法复制核对包 JSON。" },
  storageRecoveryRestored: {
    en: "Local recovery restored and read back successfully",
    zh: "本地恢复已写入并成功回读",
  },
  storageRecoveryFailed: {
    en: "Local recovery is still unavailable; keep a copied JSON",
    zh: "本地恢复仍不可用，请保存复制的 JSON",
  },

  proofLaneHint: { en: "No chain transaction", zh: "不会发链上交易" },
  offChainNote: {
    en: "This app reads resolver and registry metadata, creates a local envelope, and optionally requests an off-chain wallet signature. It never registers a DID, verifies a claim, or broadcasts a transaction.",
    zh: "本应用读取解析器与注册表元数据、创建本地核对包，并可请求链下钱包签名。它不会注册 DID、验证声明或广播交易。",
  },
  advancedFieldsTitle: { en: "Advanced review fields", zh: "高级核对字段" },
  advancedFieldsCopy: {
    en: "Use exact values supplied by the relying party. Editing them invalidates the current review envelope.",
    zh: "请使用依赖方提供的精确值；修改这些字段会使当前核对包失效。",
  },
  subject: { en: "Subject DID", zh: "主体 DID" },
  subjectPlaceholder: { en: DEFAULT_SUBJECT_DID, zh: DEFAULT_SUBJECT_DID },
  claimPlaceholder: { en: "wallet-signature-context", zh: "wallet-signature-context" },
  audiencePlaceholder: { en: "miniapp id or relying party", zh: "小程序 ID 或依赖方" },
  reviewEvidenceTitle: { en: "Review and proof data", zh: "核对与证明数据" },
  reviewEvidenceCopy: {
    en: "The digest can be recomputed from the export. Signature verification also needs wallet-adapter preimage rules that this host does not expose.",
    zh: "可根据导出内容重新计算摘要；验证签名还需要宿主未提供的钱包适配器预映像规则。",
  },
  payloadDigest: { en: "Review digest", zh: "核对摘要" },
  anchorContract: { en: "Resolver-declared anchor", zh: "解析器声明的锚定合约" },
  reviewNonce: { en: "Nonce", zh: "Nonce" },
  registryObservation: { en: "Registry observation", zh: "注册表观察结果" },
  registryCheckedAt: { en: "Registry checked at", zh: "注册表检查时间" },
  proofAddress: { en: "Signing address", zh: "签名地址" },
  messageDigest: { en: "Signed-message digest", zh: "签名消息摘要" },
  proofVerification: { en: "Signature verification", zh: "签名验证" },
  proofNotVerifiedHere: { en: "Not performed — wallet preimage convention unavailable", zh: "未执行——缺少钱包预映像约定" },
  byteLimitHint: { en: "{count}/{max} UTF-8 bytes", zh: "{count}/{max} UTF-8 字节" },

  statusReady: { en: "Passport review ready", zh: "护照核对已就绪" },
  // First-paint status. Distinct from both `statusReady` (a review exists) and
  // the passport stamp's `reviewNotBuilt` ("Awaiting DID resolution", which
  // names the card's state): this line names the visitor's next step, so the
  // two chips on screen say different, true things instead of contradicting.
  statusIdle: { en: "Resolve a DID to build a passport review", zh: "解析 DID 以生成护照核对记录" },
  passportReviewReady: {
    en: "Review envelope created; resolver and registry metadata are available",
    zh: "核对包已创建；解析器与注册表元数据可用",
  },
  passportReviewReadyDegraded: {
    en: "Review envelope created with missing runtime or registry evidence",
    zh: "核对包已创建，但缺少运行时或注册表证据",
  },
  passportReviewReadyStorageUnavailable: {
    en: "Review envelope created, but local recovery is unavailable; copy the JSON now",
    zh: "核对包已创建，但本地恢复不可用；请立即复制 JSON",
  },
  passportProofAttached: {
    en: "Wallet returned a signature; DID binding and cryptographic verification were not performed",
    zh: "钱包已返回签名；未执行 DID 绑定与密码学验证",
  },
  passportProofAttachedStorageUnavailable: {
    en: "Wallet signature attached, but local recovery is unavailable; copy the JSON now",
    zh: "钱包签名已附加，但本地恢复不可用；请立即复制 JSON",
  },
  draftChangedStatus: { en: "Draft changed; previous review evidence cleared", zh: "草稿已修改；旧核对证据已清除" },
  draftChangedStorageUnavailable: {
    en: "Draft changed, but old local recovery could not be removed",
    zh: "草稿已修改，但无法删除旧的本地恢复数据",
  },
  resetStorageUnavailable: {
    en: "Passport reset in memory, but local recovery could not be removed",
    zh: "护照已在内存中重置，但无法删除本地恢复数据",
  },
  recoveryFound: { en: "Recoverable operation found", zh: "发现可恢复操作" },
  recoveryResuming: { en: "Resuming the interrupted resolver read…", zh: "正在恢复中断的解析器读取…" },
  signingInterrupted: {
    en: "The wallet prompt was interrupted. The review envelope was recovered; retry signing when ready.",
    zh: "钱包签名提示已中断。核对包已恢复，可在准备好后重新签名。",
  },
  signingRecoveryUnavailable: {
    en: "The wallet prompt was interrupted and no current review envelope could be recovered. Create a fresh review.",
    zh: "钱包签名提示已中断，且无法恢复当前核对包。请重新创建核对包。",
  },
  passportRecovered: { en: "Recovered the local review envelope", zh: "已恢复本地核对包" },
  passportRecoveredAttached: { en: "Recovered a review envelope with an attached signature", zh: "已恢复带签名的核对包" },

  passportInvalidDid: {
    en: "Enter a valid did:morpheus:neo_n3 service, vault, or AA identifier.",
    zh: "请输入有效的 did:morpheus:neo_n3 服务、Vault 或 AA 标识。",
  },
  passportClaimInvalid: { en: "Enter a claim context of 1–96 UTF-8 bytes without control characters.", zh: "请输入 1–96 个 UTF-8 字节且不含控制字符的声明场景。" },
  passportAudienceInvalid: { en: "Enter an audience of 1–160 UTF-8 bytes without control characters.", zh: "请输入 1–160 个 UTF-8 字节且不含控制字符的受众。" },
  passportNoPayload: { en: "Create a current review envelope first.", zh: "请先创建当前核对包。" },
  passportPayloadChanged: { en: "The draft no longer matches this review envelope. Create a fresh one before signing.", zh: "草稿已与核对包不一致，请重新创建后再签名。" },
  passportAlreadySigned: { en: "A wallet signature is already attached. Create a fresh review to sign again.", zh: "已附加钱包签名；如需重新签名，请创建新的核对包。" },
  passportExpired: { en: "This review envelope expired. Create a fresh one before signing.", zh: "此核对包已过期，请重新创建后再签名。" },
  passportTimeInvalid: { en: "The review timestamp is invalid.", zh: "核对时间无效。" },
  resolverFailed: { en: "NeoDID resolver did not return a usable document.", zh: "NeoDID 解析器没有返回可用文档。" },
  resolverSubjectMismatch: { en: "The resolver returned a different DID document. No review was created.", zh: "解析器返回了不同的 DID 文档，因此未创建核对包。" },
  resolverUnavailable: { en: "The same-origin NeoDID resolver is unavailable. Try again from the host platform.", zh: "同源 NeoDID 解析器不可用，请从宿主平台重试。" },
  shaUnavailable: { en: "SHA-256 is unavailable in this runtime, so no review digest was created.", zh: "当前运行环境不支持 SHA-256，因此未创建核对摘要。" },
  nonceUnavailable: { en: "Secure randomness is unavailable, so no review envelope was created.", zh: "当前无法使用安全随机数，因此未创建核对包。" },
  walletNetworkUnknown: { en: "Confirm a Neo N3 wallet network before signing.", zh: "签名前请确认 Neo N3 钱包网络。" },
  walletNetworkMismatch: { en: "The wallet network does not match this passport review.", zh: "钱包网络与当前护照核对不匹配。" },
  walletAddressInvalid: { en: "The connected wallet did not provide a valid Neo N3 address.", zh: "已连接钱包未提供有效的 Neo N3 地址。" },
  walletSignFailed: { en: "The wallet did not return a usable Neo N3 signature.", zh: "钱包未返回可用的 Neo N3 签名。" },

  digestPlaceholder: { en: "—", zh: "—" },
  statistics: { en: "Evidence", zh: "证据" },
  degradedRuntimeWarning: {
    en: "Runtime verifier metadata is unavailable; the returned DID document is not an identity verification.",
    zh: "运行时验证器元数据不可用；返回的 DID 文档不代表身份已验证。",
  },
  degradedRuntimeBadge: { en: "Limited runtime evidence", zh: "运行时证据有限" },
  externalVerifierTitle: { en: "Wallet-specific verification metadata required", zh: "需要钱包专用验证元数据" },
  externalVerifierLink: { en: "Recompute the digest; treat the signature as an opaque wallet artifact", zh: "重新计算摘要；将签名视为不透明的钱包产物" },
  docsSubtitle: {
    en: "A NeoDID document inspector and short-lived local review-envelope tool. It is not an issuer or identity verifier.",
    zh: "NeoDID 文档检查与短期本地核对包工具；它不是身份签发方或验证方。",
  },
  feature1Name: { en: "Document inspection", zh: "文档检查" },
  feature1Desc: { en: "Reads the host resolver and rejects a returned document whose DID does not match the request.", zh: "读取宿主解析器，并拒绝 DID 与请求不匹配的返回文档。" },
  feature2Name: { en: "Registry boundary", zh: "注册表边界" },
  feature2Desc: { en: "Checks the selected Neo network and verifies a resolver-declared registry deployment when one exists.", zh: "检查所选 Neo 网络，并在存在部署时核验解析器声明的注册表合约。" },
  feature3Name: { en: "Optional wallet envelope", zh: "可选钱包核对包" },
  feature3Desc: { en: "Records the exact requested text and wallet-returned signature while labeling the undisclosed adapter preimage convention.", zh: "记录精确请求文本与钱包返回的签名，并明确标注适配器预映像约定未提供。" },
} as const;

export const messages = mergeMessages(appMessages);
