import { mergeMessages } from "@shared/locale/base-messages";
import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

export const appId = "miniapp-neodid-passport";

export const DEFAULT_SUBJECT_DID = "did:morpheus:neo_n3:service:neodid";

export const appMeta = {
  networkLabel: "Morpheus Testnet",
  endpointLabel: "NeoDID resolver",
};

export const manifest: MiniAppManifest = {
  name: "NeoDID Passport",
  description: "Resolve NeoDID documents and prepare wallet-signable identity passports.",
  icon: "did",
  category: "tool",
  shell: "console",
  theme: { family: "social", accentColor: "#0ea5a3", density: "comfortable" },
  tabs: [{ key: "passport", labelKey: "tabPassport", icon: "did", default: true }],
  stats: [
    { labelKey: "statNetwork", valueKey: "networkLabel", format: "text", icon: "globe" },
    { labelKey: "statEndpoint", valueKey: "endpointLabel", format: "text", icon: "verified" },
    { labelKey: "statRequests", valueKey: "requestCount", format: "number", icon: "activity" },
    { labelKey: "statDigest", valueKey: "lastDigest", format: "text", icon: "key" },
  ],
  sidebar: {
    titleKey: "appName",
    items: [
      { labelKey: "statNetwork", valueKey: "networkLabel", format: "text" },
      { labelKey: "lastStatus", valueKey: "lastStatus", format: "text" },
      { labelKey: "statDigest", valueKey: "lastDigest", format: "text" },
      { labelKey: "proofStatus", valueKey: "proofStatus", format: "text" },
    ],
  },
  features: { walletRequired: false, chainWarning: true },
  // The custom PlayArea form is the single Passport Builder surface. A
  // manifest.operations entry rendered a SECOND, unsynced copy of the same form
  // in the focus-mode sidebar (and on mobile) whose independent state
  // contradicted the center form — removed to keep one source of truth.
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
  title: { en: "NeoDID Passport", zh: "NeoDID 身份护照" },
  tabPassport: { en: "Passport", zh: "护照" },
  panelTitle: { en: "NeoDID Passport Builder", zh: "NeoDID 身份护照构建器" },
  panelDescription: {
    en: "Resolve a Morpheus NeoDID document, build a portable credential payload, and optionally bind it to the connected wallet signature.",
    zh: "解析 Morpheus NeoDID 文档，构建可携带凭证载荷，并可选择绑定已连接钱包签名。",
  },
  // Up-front no-transaction mental model: signing is off-chain and the passport
  // is a portable JSON handed to a relying party, not an on-chain registration.
  offChainNote: {
    en: "Builds a portable credential and an off-chain wallet proof — nothing is broadcast on-chain.",
    zh: "生成可携带凭证和链下钱包证明——不会向链上广播任何交易。",
  },
  heroVisualAlt: {
    en: "A bright identity passport desk with verified credential cards.",
    zh: "明亮的身份护照工作台与已验证凭证卡片。",
  },
  runAction: { en: "Resolve and Build", zh: "解析并生成" },
  signAction: { en: "Sign Passport", zh: "签名护照" },
  copyAction: { en: "Copy Payload", zh: "复制载荷" },
  reset: { en: "Reset", zh: "重置" },
  subject: { en: "Subject DID", zh: "主体 DID" },
  subjectPlaceholder: { en: "did:morpheus:neo_n3:service:neodid", zh: "did:morpheus:neo_n3:service:neodid" },
  provider: { en: "Proof Provider", zh: "证明提供方" },
  walletProvider: { en: "Wallet signature", zh: "钱包签名" },
  emailProvider: { en: "Email attestation", zh: "邮箱证明" },
  githubProvider: { en: "GitHub attestation", zh: "GitHub 证明" },
  walletProviderTile: {
    en: "Sign in-app with the connected OneGate wallet.",
    zh: "用已连接的 OneGate 钱包在应用内签名。",
  },
  githubProviderTile: {
    en: "Prepare a package for a GitHub verifier.",
    zh: "准备提交给 GitHub 验证器的证明包。",
  },
  emailProviderTile: {
    en: "Prepare a package for an email verifier.",
    zh: "准备提交给邮箱验证器的证明包。",
  },
  claim: { en: "Claim", zh: "声明" },
  claimPlaceholder: { en: "wallet-ownership", zh: "wallet-ownership" },
  audience: { en: "Audience", zh: "受众" },
  audiencePlaceholder: { en: "miniapp-id or relying party", zh: "小程序 ID 或依赖方" },
  passportReady: { en: "Passport payload ready", zh: "身份护照载荷已生成" },
  passportSigned: { en: "Wallet proof attached", zh: "钱包证明已附加" },
  passportInvalidDid: { en: "Enter a valid Morpheus NeoDID.", zh: "请输入有效的 Morpheus NeoDID。" },
  passportMissingClaim: { en: "Enter the claim to include in the passport.", zh: "请输入要写入护照的声明。" },
  passportNoPayload: { en: "Build a passport payload before signing.", zh: "请先生成护照载荷再签名。" },
  passportNoWalletProvider: { en: "Switch provider to wallet signature before signing.", zh: "请先切换为钱包签名提供方。" },
  resolverFailed: { en: "NeoDID resolver did not return a usable document.", zh: "NeoDID 解析器没有返回可用文档。" },
  resolverUnavailable: {
    en: "Resolver unavailable in this standalone preview. Open from the host platform to resolve live NeoDID data.",
    zh: "当前独立预览无法访问解析器。请从平台宿主打开以解析实时 NeoDID 数据。",
  },
  walletSignFailed: { en: "Wallet signature was not completed.", zh: "钱包签名未完成。" },
  resolvedStatus: { en: "DID resolved", zh: "DID 已解析" },
  preparedStatus: { en: "Prepared", zh: "已准备" },
  signedStatus: { en: "Signed", zh: "已签名" },
  notSignedStatus: { en: "Not signed", zh: "未签名" },
  resolverStatus: { en: "Resolver", zh: "解析器" },
  documentId: { en: "Document ID", zh: "文档 ID" },
  documentVersion: { en: "Version", zh: "版本" },
  services: { en: "Services", zh: "服务" },
  payloadDigest: { en: "Payload Digest", zh: "载荷摘要" },
  signature: { en: "Signature", zh: "签名" },
  emptyPayloadTitle: { en: "Awaiting DID resolution", zh: "等待 DID 解析" },
  emptyPayloadCopy: {
    en: "Resolve a DID to inspect the document, digest, and proof package before handing it to another miniapp.",
    zh: "解析 DID 后，可在交给其他小程序前复核文档、摘要和证明包。",
  },
  identityRoute: { en: "Identity route", zh: "身份路径" },
  routeResolve: { en: "Resolve DID", zh: "解析 DID" },
  routeBuild: { en: "Build credential", zh: "构建凭证" },
  routeSign: { en: "Optional wallet proof", zh: "可选钱包证明" },
  liveResolver: { en: "Morpheus NeoDID API", zh: "Morpheus NeoDID API" },
  passportWorkspaceTitle: { en: "Credential studio", zh: "凭证工作台" },
  passportPreview: { en: "Passport preview", zh: "护照预览" },
  credentialCardTitle: { en: "Identity passport", zh: "身份护照" },
  credentialFlowCopy: {
    en: "Resolve the DID, review the payload, then attach a proof only when the lane matches the relying party.",
    zh: "先解析 DID 并复核载荷，再按依赖方要求选择证明方式。",
  },
  previewSubjectFallback: { en: "Subject DID pending", zh: "等待主体 DID" },
  previewClaimLabel: { en: "Claim", zh: "声明" },
  previewAudienceLabel: { en: "Audience", zh: "受众" },
  proofLaneTitle: { en: "Choose proof lane", zh: "选择证明路径" },
  proofLaneHint: { en: "No chain transaction", zh: "不会发链上交易" },
  walletProofHint: {
    en: "Wallet signatures do not broadcast a transaction. They bind the passport payload to the current wallet address.",
    zh: "钱包签名不会广播交易，而是把护照载荷绑定到当前钱包地址。",
  },
  apiProofHint: {
    en: "Email and GitHub providers prepare an unsigned attestation package for an external verifier.",
    zh: "邮箱和 GitHub 提供方会生成供外部验证器使用的未签名证明包。",
  },
  statNetwork: { en: "Network", zh: "网络" },
  statEndpoint: { en: "Resolver", zh: "解析器" },
  statRequests: { en: "Passports", zh: "护照数" },
  statDigest: { en: "Digest", zh: "摘要" },
  lastStatus: { en: "Last Status", zh: "最近状态" },
  proofStatus: { en: "Proof", zh: "证明" },
  copied: { en: "Copied", zh: "已复制" },
  digestPlaceholder: { en: "—", zh: "—" },
  statistics: { en: "Passport metrics", zh: "护照指标" },
  // Degraded-runtime warning chip shown when the resolved document's versionId
  // is "unversioned" (the live TEE runtime metadata was unavailable).
  degradedRuntimeWarning: {
    en: "Runtime attestation metadata unavailable — this passport lacks the TEE verification key a relying party may require.",
    zh: "运行时证明元数据不可用——此护照缺少依赖方可能需要的 TEE 验证密钥。",
  },
  degradedRuntimeBadge: { en: "Degraded", zh: "降级" },
  // External-verifier guidance for the github/email providers, which only
  // prepare an attestation package — they have no in-app completion lane.
  externalVerifierTitle: { en: "Submit to an external verifier", zh: "提交到外部验证器" },
  externalVerifierCopy: {
    en: "GitHub and email proofs are not completed in this miniapp. Build the passport, copy the prepared package, then follow the attestation docs to submit it to the Morpheus web3auth verifier for a signed attestation. Switch to Wallet signature to sign in-app instead.",
    zh: "GitHub 与邮箱证明不会在此小程序内完成。请构建护照、复制已准备的包，然后按证明文档将其提交到 Morpheus web3auth 验证器以获取已签名证明。如需在小程序内签名，请切换为钱包签名。",
  },
  externalVerifierLink: { en: "Open attestation docs", zh: "打开证明文档" },
  docsSubtitle: {
    en: "A functional NeoDID passport workbench for resolving identity documents and preparing wallet-signable credentials.",
    zh: "用于解析身份文档并准备可钱包签名凭证的 NeoDID 身份护照工作台。",
  },
  docSubtitle: {
    en: "A functional NeoDID passport workbench for resolving identity documents and preparing wallet-signable credentials.",
    zh: "用于解析身份文档并准备可钱包签名凭证的 NeoDID 身份护照工作台。",
  },
  feature1Name: { en: "Live Resolve", zh: "实时解析" },
  feature1Desc: { en: "The workbench calls the Morpheus NeoDID resolver instead of fabricating a local preview.", zh: "工作台调用 Morpheus NeoDID 解析器，而不是伪造本地预览。" },
  feature2Name: { en: "Reviewable Payload", zh: "可复核载荷" },
  feature2Desc: { en: "Every passport exposes subject, provider, claim, audience, document metadata, and digest.", zh: "每份护照都会展示主体、提供方、声明、受众、文档元数据和摘要。" },
  feature3Name: { en: "Wallet Proof", zh: "钱包证明" },
  feature3Desc: { en: "Wallet providers can sign the canonical passport payload without broadcasting a transaction.", zh: "钱包提供方可签名标准护照载荷且不广播交易。" },
} as const;

export const messages = mergeMessages(appMessages);
