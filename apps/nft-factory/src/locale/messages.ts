import { mergeMessages } from "@shared/locale/base-messages";
import { factoryMessages } from "@shared/factory/messages";

const appMessages = {
  ...factoryMessages,
  title: { en: "NFT Collection Studio", zh: "NFT 藏品工作室" },
  // Honest headline: v1 is a collection-package and owner-signature product.
  // The live Factory's creator-unique artifact deployment is not implemented.
  subtitle: {
    en: "Shape the collection and lock the exact creator package. This release supports export and owner signing; contract deployment remains intentionally locked.",
    zh: "塑造藏品并锁定精确的创作者发行包。本版本支持导出与 Owner 签名，合约部署仍明确保持锁定。",
  },
  subtitleShort: {
    en: "Design, validate, export, and sign the collection package.",
    zh: "设计、校验、导出并签署藏品发行包。",
  },
  factoryOverview: { en: "NEP-11 collection atelier", zh: "NEP-11 藏品工坊" },
  activeTemplate: { en: "Governed collection template", zh: "受治理藏品模板" },
  collectionStudioLabel: {
    en: "NFT collection design and provenance studio",
    zh: "NFT 藏品设计与来源工作室",
  },
  releaseScopeHint: {
    en: "Keep the artwork central while the collection package and its live verification state update around it.",
    zh: "作品始终位于主位，藏品发行包与实时核验状态围绕作品同步更新。",
  },
  releaseIncludedLabel: { en: "Package output", zh: "发行包输出" },
  releaseIncludedValue: {
    en: "Identity · supply · royalty policy · transfer policy · metadata origin · owner signature",
    zh: "标识 · 供应量 · 版税策略 · 转让策略 · 元数据来源 · Owner 签名",
  },
  releaseDeferredLabel: { en: "Requires collection v2", zh: "需要 Collection v2" },
  releaseDeferredValue: {
    en: "Traits · mint price · creator-unique deploy + transaction recovery",
    zh: "属性 · 铸造价格 · 创作者独立部署 + 交易恢复",
  },
  dropStudio: { en: "Collection wall", zh: "藏品展示墙" },
  dropStudioHint: {
    en: "Every {symbol} edition updates here as you shape the drop.",
    zh: "你调整发行时，每个 {symbol} 版本都会在这里同步更新。",
  },
  dropComposer: { en: "Edition desk", zh: "版本工作台" },
  dropComposerHint: {
    en: "Name the collection, choose its edition size, then set collector rights.",
    zh: "先命名藏品、选择发行规模，再确定持有人权利。",
  },
  deploymentSetup: { en: "Provenance & ownership", zh: "来源与所有权" },
  // The target network is a constant for this release and the NETWORK fact tile
  // already states it, so naming it again here only doubled the testnet stamp on
  // the first screen — the same reasoning that removed the pipeline chip in
  // acec39136. This panel is about the metadata origin and the owner; let it say
  // that.
  deploymentSetupHint: {
    en: "An HTTPS metadata origin ending in '/', and the collection owner. Token #1 is read before signing is enabled.",
    zh: "以“/”结尾的 HTTPS 元数据来源，以及藏品 Owner。启用签名前会实际读取 Token #1。",
  },
  previewTitle: { en: "Collector preview", zh: "收藏者预览" },
  previewHint: {
    en: "The collector-facing card mirrors the package draft; local artwork is a visual preview and is not uploaded.",
    zh: "面向收藏者的藏品卡会同步发行包草稿；本地作品仅用于视觉预览，不会上传。",
  },
  generatePlan: { en: "Verify & lock package", zh: "核验并锁定发行包" },
  signPlanAction: { en: "Sign creator commitment", zh: "签署创作者承诺" },
  publishPackage: { en: "Collection package", zh: "藏品发行包" },
  planDetails: { en: "Package details", zh: "发行包细节" },
  planDetailsHint: {
    en: "Digest, validation result, template read, and raw payload.",
    zh: "摘要、校验结果、模板读取状态和原始载荷。",
  },
  // Royalty consequence: a marketplace-honored, owner-routed cut on secondary
  // sales, fixed at deploy. Keep the {bps}/{percent} placeholders intact.
  royaltyHelper: {
    en: "{bps} bps requests a {percent}% secondary-sale royalty in this package. Actual enforcement depends on the future compatible contract and marketplace.",
    zh: "{bps} bps 表示发行包请求 {percent}% 的二次销售版税；实际执行取决于后续兼容合约与市场。",
  },
  // Soulbound toggle consequence at the control: off = permanently bound.
  transferable: {
    en: "Requested transfer policy (off = soulbound in a compatible deployment)",
    zh: "期望转让策略（关闭 = 在兼容部署中设为灵魂绑定）",
  },
  metadataBoundaryLabel: { en: "Metadata read", zh: "元数据读取" },
  metadataNotChecked: {
    en: "Checked when the package is locked",
    zh: "锁定发行包时读取",
  },
  metadataChecking: { en: "Reading token #1…", zh: "正在读取 Token #1…" },
  metadataVerified: { en: "Token #1 JSON verified", zh: "Token #1 JSON 已核验" },
  metadataBaseUriInvalid: {
    en: "Use an HTTPS origin ending in /",
    zh: "请使用以 / 结尾的 HTTPS 来源",
  },
  metadataSampleUnavailable: {
    en: "Token #1 could not be read",
    zh: "无法读取 Token #1",
  },
  metadataSampleInvalid: {
    en: "Token #1 is not valid NFT JSON",
    zh: "Token #1 不是有效的 NFT JSON",
  },
  metadataSampleUnverified: {
    en: "Token #1 metadata must be readable JSON with a name and HTTPS, IPFS, or Arweave image before signing.",
    zh: "签名前，Token #1 元数据必须可读取，并包含名称以及 HTTPS、IPFS 或 Arweave 图片地址。",
  },
  metadataVerificationRequired: {
    en: "Verify a readable token #1 metadata sample before signing.",
    zh: "签名前请先核验可读取的 Token #1 元数据样本。",
  },
  factoryTemplateUnverified: {
    en: "The testnet Factory template could not be read. Check the connection and lock the package again.",
    zh: "无法读取测试网 Factory 模板。请检查连接后重新锁定发行包。",
  },
  artworkPreviewLabel: { en: "Artwork preview", zh: "作品预览" },
  chooseArtwork: { en: "Choose local art", zh: "选择本地作品" },
  resetArtwork: { en: "Remove artwork", zh: "移除作品" },
  // Production voice for the on-device privacy note: state where the artwork
  // lives and what never happens to it, without preview/staging phrasing.
  artworkPreviewLocalOnly: {
    en: "Stays on this device · never uploaded or written into the package",
    zh: "仅保存在本设备 · 不会上传，也不会写入发行包",
  },
  artworkFileInvalid: {
    en: "Choose a PNG, JPEG, WebP, or AVIF image up to 10 MB.",
    zh: "请选择不超过 10 MB 的 PNG、JPEG、WebP 或 AVIF 图片。",
  },
  signPlanDescription: {
    en: "Signs the exact testnet, Factory contract, template, package id, digest, and canonical collection payload with the owner wallet. The same commitment is included in the copied package. It does not mint or deploy a contract.",
    zh: "使用集合 Owner 钱包签署精确的测试网、Factory 合约、模板、发行包 ID、摘要与规范化藏品载荷；复制的发行包会包含同一份承诺。该操作不会铸造 NFT 或部署合约。",
  },
  canonicalPlanMismatch: {
    en: "The package no longer matches this release's testnet Factory, template, digest, or init payload. Regenerate it before signing.",
    zh: "发行包已不再匹配本版本的测试网 Factory、模板、摘要或初始化载荷。请重新生成后再签名。",
  },
  ownerWalletRequired: {
    en: "Connect the collection owner wallet before signing this creator commitment.",
    zh: "请先连接集合 Owner 钱包，再签署这份创作者承诺。",
  },
  planLockedDetail: {
    en: "Package and token #1 sample verified. Review the details, then sign with the collection owner wallet or copy the JSON for offline review.",
    zh: "发行包与 Token #1 样本已核验。复核细节后，可使用集合 Owner 钱包签名，或复制 JSON 进行离线复核。",
  },
  packageReady: { en: "Verified and ready to sign", zh: "已核验，可签名" },
  packageBlocked: { en: "Package needs attention", zh: "发行包需要处理" },
  planDraftReady: { en: "Ready for verification", zh: "可开始核验" },
  planDraftReadyDetail: {
    en: "Lock the package to read the Factory template and token #1 metadata before owner signing.",
    zh: "锁定发行包后会读取 Factory 模板和 Token #1 元数据，再开放 Owner 签名。",
  },
  planBlockedDetail: {
    en: "The package remains copyable for review, but signing stays off until every listed read and input succeeds.",
    zh: "发行包仍可复制复核，但只有列出的读取与输入全部通过后才能签名。",
  },
  planSigned: { en: "Creator commitment signed", zh: "创作者承诺已签署" },
  copyPackage: { en: "Copy package JSON", zh: "复制发行包 JSON" },
  deployChecklist: { en: "Release readiness", zh: "发行就绪清单" },
  deployChecklistHint: {
    en: "Inputs, live reads, signing, and the locked deployment boundary.",
    zh: "输入、实时读取、签名与已锁定的部署边界。",
  },
  executeDeployAction: { en: "Deployment locked", zh: "部署已锁定" },
  stepDeployTitleNep11: {
    en: "Contract deployment (locked)",
    zh: "合约部署（已锁定）",
  },
  // Scope boundary in product voice, matching the wording asset-factory settled
  // on in acec39136. This release ships the package pipeline; contract creation
  // is simply not in it. The previous copy announced the studio's core flow as
  // "unavailable" and then explained the Factory's missing ABI to a collector —
  // an engineering status note wearing a failure label. The requirement detail
  // stays in `stepDeployUniqueArtifactRequired` below, which only surfaces in
  // the release-readiness drawer.
  nftDeploymentCertificationPending: {
    en: "Contract creation is not part of this release. Design, verify, lock, and sign the collection package here — the signed package is the deliverable.",
    zh: "合约创建不在当前版本范围内。你可以在这里设计、校验、锁定并签名藏品发行包——签名后的发行包即为交付物。",
  },
  stepDeployUniqueArtifactRequired: {
    en: "Out of scope for this release: the creator-unique NEF/manifest is already bound, but contract creation still needs the upgraded live Factory ABI, transaction persistence, event confirmation, and deployment-record readback.",
    zh: "不在当前版本范围内：创作者独立 NEF/manifest 已与发行包绑定，但合约创建仍需升级链上 Factory ABI，并补齐交易持久化、事件确认与部署记录回读。",
  },
  artifactStatusMetadataOnly: {
    en: "Template read · no NEP-11 artifact",
    zh: "模板已读取 · 无 NEP-11 工件",
  },
  artifactStatusUnverified: {
    en: "Factory template not read",
    zh: "尚未读取 Factory 模板",
  },
  deployHonesty: {
    en: "This release sends no deployment or mint transaction and charges no app fee. It validates settings, reads the Factory template and token #1 metadata, exports a deterministic package, and signs only with the owner wallet. Local artwork is never uploaded. The deployed testnet Factory currently lacks the required creator-artifact ABI, so no contract or mint result is claimed.",
    zh: "本版本不会发送部署或铸造交易，也不收取应用费用。它会校验设置、读取 Factory 模板与 Token #1 元数据、导出确定性发行包，并仅允许 Owner 钱包签名。本地作品不会上传。测试网 Factory 当前缺少所需的创作者工件 ABI，因此不会宣称已创建合约或完成铸造。",
  },
  docWhatItIsBody: {
    en: "NFT Factory is a OneGate-loadable collection studio for preparing a deterministic NEP-11 package. Artwork, supply, royalty policy, transfer policy, owner, testnet, and metadata origin have one clear review surface. The production lane ends at owner signature/export; local art is preview-only and no deployment or mint success is simulated.",
    zh: "NFT 工厂是可由 OneGate 加载的 NEP-11 藏品工作室，用于准备确定性的发行包。作品、供应量、版税策略、转让策略、Owner、测试网与元数据来源集中在一个清晰的复核界面。当前生产流程止于 Owner 签名/导出；本地作品仅供预览，不会模拟部署或铸造成功。",
  },
  docSupportedTemplatesBody: {
    en: "The v1 package covers max supply, royalty, HTTPS metadata base URI, owner, and transferable/soulbound policy. Traits and mint price are not parameters of this template and are shown as v2 work instead of being falsely included in the package.",
    zh: "v1 发行包支持最大供应量、版税、HTTPS 元数据基础 URI、Owner，以及可转让/灵魂绑定策略。属性与铸造价格并非当前模板参数，因此明确列为 v2 工作，不会被虚假写入发行包。",
  },
  docSafetyModel: { en: "Verification model", zh: "核验模型" },
  docSafetyModelBody: {
    en: "The package uses a deterministic SHA-256 commitment and only the matching owner wallet can sign it. The signed message binds the exact testnet, Factory contract, template, creator-specific NEF, manifest, artifact digest, and canonical payload shown in the export. Token #1 is checked for current availability and basic NFT JSON shape; that read does not upload, pin, or make remote metadata immutable. Deployment stays locked until the exact live Factory ABI, governed artifacts, durable transaction recovery, event confirmation, and deployment-record readback are certified.",
    zh: "发行包使用确定性的 SHA-256 承诺，并只允许匹配的 Owner 钱包签名。签名消息会绑定导出中展示的精确测试网、Factory 合约、模板、创作者专属 NEF、manifest、工件摘要与规范化载荷。Token #1 只核验当前可用性与基础 NFT JSON 结构；该读取不会上传、固定或使远程元数据不可变。只有精确链上 Factory ABI、受治理工件、交易持久恢复、事件确认与部署记录回读完成认证后，才会开放部署。",
  },
  walletNetworkUnknown: {
    en: "The wallet network could not be detected. Keep Neo N3 testnet selected and try again.",
    zh: "无法识别钱包网络。请切换到 Neo N3 测试网后重试。",
  },
  walletNetworkMismatch: {
    en: "Switch the wallet to Neo N3 testnet before signing.",
    zh: "请先将钱包切换到 Neo N3 测试网再签名。",
  },
  walletChangedDuringSigning: {
    en: "The wallet account or network changed while signing. The signature was cleared; review and sign again.",
    zh: "签名过程中钱包账户或网络发生变化。旧签名已清除，请复核后重新签名。",
  },
  planChangedDuringSigning: {
    en: "The collection package changed while the wallet was open. No signature was kept; review the current package and sign again.",
    zh: "钱包打开期间发行包已发生变化。本次签名不会保留；请重新复核当前发行包后再签名。",
  },
} as const;

export const messages = mergeMessages(appMessages);
