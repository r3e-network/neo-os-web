import { mergeMessages } from "@shared/locale/base-messages";

const appMessages = {
  title: { en: "Timestamp Proof", zh: "时间戳证明" },
  proofs: { en: "Proofs", zh: "证明" },
  verify: { en: "Verify", zh: "验证" },

  createProof: { en: "Create Proof", zh: "创建证明" },
  proofWorkspace: { en: "Timestamp proof workspace", zh: "时间戳证明工作台" },
  proofWorkflow: { en: "Proof workflow", zh: "证明流程" },
  proofPrivacy: {
    en: "Your source content stays local; only the digest is saved or anchored.",
    zh: "原文内容保留在本地；保存或锚定的是摘要。",
  },
  proofStageKicker: { en: "Proof desk", zh: "证明工作台" },
  proofStageTitle: {
    en: "Timestamp proof press",
    zh: "时间戳证明压印台",
  },
  createPanelKicker: { en: "Create", zh: "创建" },
  createPanelTitle: {
    en: "Prepare a timestamp certificate",
    zh: "准备时间戳证书",
  },
  createPanelBody: {
    en: "Place source material on the proof sheet, then seal a local certificate when it looks right.",
    zh: "把原始材料放到证明纸上，确认无误后封存为本地证书。",
  },
  enterContent: { en: "Enter content to timestamp", zh: "输入要时间戳的内容" },
  createDisabledHint: {
    en: "Add source material when you are ready.",
    zh: "准备好后添加原始材料。",
  },
  contentPlaceholder: {
    en: "Paste your text, document hash, or idea...",
    zh: "粘贴您的文本、文档哈希或想法...",
  },
  documentPreviewLabel: { en: "Certificate preview", zh: "证书预览" },
  proofSheetLabel: { en: "Proof sheet", zh: "证明纸" },
  documentPreviewEmptyTitle: { en: "Ready for content", zh: "等待内容" },
  documentPreviewEmpty: {
    en: "Your proof preview will appear here as soon as you add content.",
    zh: "输入内容后，这里会实时显示证明预览。",
  },
  proofPressLabel: { en: "Animated proof press", zh: "动态证明压印台" },
  proofPressKicker: { en: "Document fingerprint", zh: "文档指纹" },
  proofPressEmptyTitle: {
    en: "Proof press standing by.",
    zh: "证明压印台待命中。",
  },
  proofPressEmptyBody: {
    en: "Nothing leaves this device. The sheet becomes a local certificate only when you seal it.",
    zh: "内容不会离开本设备。只有封存后，纸张才会成为本地证书。",
  },
  proofPressReadyTitle: {
    en: "Fingerprint queued. Review the sheet, then seal the proof.",
    zh: "指纹已排队。核对文档卡片后即可封存证明。",
  },
  proofPressReadyBody: {
    en: "One tap hashes the content on this device and saves a timestamp certificate.",
    zh: "点击后将在本设备计算哈希，并保存一张时间戳证书。",
  },
  proofPressStampingTitle: {
    en: "Stamping the local certificate.",
    zh: "正在压印本地证书。",
  },
  proofPressStampingBody: {
    en: "The source stays private while the digest is sealed into your local journal.",
    zh: "原文保持私密，仅将摘要封存进本地证明记录。",
  },
  proofPressRailLabel: { en: "Proof press status", zh: "证明压印状态" },
  proofDeskAlt: { en: "Timestamp proof desk with a sealed certificate", zh: "带有封存证书的时间戳证明工作台" },
  proofPressAnchorLocal: { en: "Local rail", zh: "本地轨道" },
  proofPressAnchorAnchoring: { en: "Anchoring", zh: "锚定中" },
  proofPressAnchorAnchored: { en: "On-chain", zh: "已上链" },
  documentTypeHash: { en: "SHA-256 digest", zh: "SHA-256 摘要" },
  documentTypeText: { en: "Source content", zh: "原始内容" },
  digestPassThrough: {
    en: "Use this digest directly",
    zh: "直接使用该摘要",
  },
  localHashPending: {
    en: "Will hash locally on save",
    zh: "保存时本地计算哈希",
  },
  contentChars: { en: "Characters", zh: "字符数" },
  pendingDigest: { en: "After save", zh: "保存后生成" },
  proofRouteLabel: { en: "Proof route", zh: "证明路径" },
  proofRouteHash: { en: "Local hash", zh: "本地哈希" },
  proofRouteSave: { en: "Device proof", zh: "设备证明" },
  proofRouteAnchor: { en: "Public anchor", zh: "公开锚定" },
  proofRouteReady: { en: "Ready", zh: "就绪" },
  proofRouteWaiting: { en: "Waiting", zh: "等待内容" },
  proofTemplatesLabel: { en: "Proof templates", zh: "证明模板" },
  proofTemplateRelease: { en: "Release note", zh: "发布记录" },
  proofTemplateReleaseBody: {
    en: "Version or artifact note",
    zh: "版本或产物说明",
  },
  proofTemplateAudit: { en: "Audit seal", zh: "审计封存" },
  proofTemplateAuditBody: {
    en: "Review result or report",
    zh: "评审结果或报告",
  },
  proofTemplateDigest: { en: "Known digest", zh: "已有摘要" },
  proofTemplateDigestBody: {
    en: "Paste a SHA-256 hash",
    zh: "粘贴 SHA-256 哈希",
  },
  createSuccess: {
    en: "Proof saved to this device.",
    zh: "证明已保存到当前设备。",
  },
  proofId: { en: "Proof ID", zh: "证明ID" },
  timestamp: { en: "Timestamp", zh: "时间戳" },

  // On-chain anchoring — publish the digest + time so a third party can verify.
  anchorStatus: { en: "Status", zh: "状态" },
  anchorOnChain: { en: "Anchor on-chain", zh: "上链锚定" },
  anchorShort: { en: "Anchor", zh: "锚定" },
  anchoredOnChain: { en: "Anchored on-chain", zh: "已上链锚定" },
  localOnly: { en: "Local only", zh: "仅本地" },
  anchorTxid: { en: "Anchor transaction", zh: "锚定交易" },
  viewOnExplorer: { en: "View on explorer", zh: "在区块浏览器查看" },
  proofAnchored: { en: "Proof anchored on-chain", zh: "证明已上链锚定" },
  anchorFailed: { en: "Anchoring failed", zh: "锚定失败" },
  alreadyAnchored: { en: "Proof is already anchored", zh: "证明已锚定" },
  connectWalletToAnchor: {
    en: "Connect a wallet to anchor on-chain",
    zh: "连接钱包以上链锚定",
  },
  anchorCostNote: {
    en: "Anchoring writes the digest into a public Neo transaction (small network fee). Local proofs stay private and free.",
    zh: "锚定会将摘要写入一笔公开的 Neo 交易（仅需少量网络费）。本地证明则保持私密且免费。",
  },
  howToVerifyTitle: { en: "How to verify on-chain", zh: "如何在链上核验" },
  howToVerifyBody: {
    en: 'Open the anchor transaction on the explorer: anyone can read "timestamp-proof:<digest>" in the transaction data, and the block time is the proof time. No app or device is needed to confirm it.',
    zh: "在区块浏览器中打开锚定交易：任何人都能在交易数据中读取 “timestamp-proof:<摘要>”，区块时间即为证明时间。无需依赖本应用或设备即可核验。",
  },

  verifyProof: { en: "Verify Proof", zh: "验证证明" },
  verifyPanelKicker: { en: "Verify", zh: "核验" },
  verifyPanelTitle: { en: "Inspect an existing proof", zh: "核验已有证明" },
  verifyPanelBody: {
    en: "Search by proof ID, SHA-256 digest, or original content to confirm the saved timestamp and anchor status.",
    zh: "通过证明编号、SHA-256 摘要或原文查询，确认保存时间与锚定状态。",
  },
  proofLookup: { en: "Proof lookup", zh: "证明查询" },
  verifyPlaceholder: {
    en: "Proof ID, SHA-256 digest, or original content",
    zh: "证明编号、SHA-256 摘要或原始内容",
  },
  verifying: { en: "Verifying...", zh: "验证中..." },
  verifyEmpty: { en: "No proof selected", zh: "未选择证明" },
  validProof: { en: "Proof Found", zh: "已找到证明" },
  invalidProof: { en: "Invalid Proof", zh: "无效证明" },
  contentPreview: { en: "Content preview", zh: "内容预览" },
  proofDigest: { en: "SHA-256 digest", zh: "SHA-256 摘要" },
  verifyFailed: { en: "Verification failed", zh: "验证失败" },

  recentProofs: { en: "Recent Proofs", zh: "最近证明" },
  noProofs: { en: "No proofs yet", zh: "暂无证明" },
  noProofsHint: {
    en: "Saved proof entries will appear here.",
    zh: "已保存的证明记录会显示在这里。",
  },

  copyDigest: { en: "Copy digest", zh: "复制摘要" },
  copyReference: { en: "Copy proof reference", zh: "复制证明引用" },
  deleteProof: { en: "Delete proof", zh: "删除证明" },
  clearAllProofs: { en: "Clear all", zh: "清除全部" },

  digestCopied: { en: "Digest copied", zh: "已复制摘要" },
  referenceCopied: { en: "Reference copied", zh: "已复制引用" },
  proofDeleted: { en: "Proof deleted", zh: "证明已删除" },
  proofsCleared: { en: "Proofs cleared", zh: "证明已清除" },
  error: { en: "Something went wrong", zh: "出现错误" },

  docSubtitle: {
    en: "SHA-256 proof journal with optional on-chain anchor",
    zh: "SHA-256 证明记录，可选上链锚定",
  },
  docDescription: {
    en: "Create SHA-256 proof entries locally, then optionally anchor a proof on Neo N3 (a 0-GAS self-transfer that embeds the digest) so a third party can verify the digest and time on-chain.",
    zh: "在本地创建 SHA-256 证明记录，并可选择将证明锚定到 Neo N3（一笔携带摘要的 0 GAS 自转账），以便第三方在链上核验摘要与时间。",
  },
  step1: {
    en: "Enter your content or document hash",
    zh: "输入您的内容或文档哈希",
  },
  step2: { en: "Hash it locally in the browser", zh: "在浏览器本地计算哈希" },
  step3: {
    en: "Optionally anchor the proof on-chain for third-party verification",
    zh: "可选地将证明上链锚定，供第三方核验",
  },
  step4: {
    en: "Re-open and verify the proof by ID anytime",
    zh: "随时按编号重新验证该证明",
  },

  feature1Name: { en: "Local Certificates", zh: "本地证明条目" },
  feature1Desc: {
    en: "Each proof is saved in local browser storage with a deterministic SHA-256 hash",
    zh: "每条证明都会以确定性的 SHA-256 哈希保存在浏览器本地存储中",
  },
  feature2Name: { en: "Instant Verification", zh: "即时验证" },
  feature2Desc: {
    en: "Look up any saved proof by ID without waiting for a contract call",
    zh: "无需等待合约调用，直接按编号查询已保存证明",
  },
  feature3Name: { en: "Universal Hashing", zh: "通用哈希" },
  feature3Desc: {
    en: "Works with text, notes, hashes, drafts, and any other short-form content",
    zh: "适用于文本、备注、哈希、草稿及其他短内容",
  },

  proofStats: { en: "Proof Stats", zh: "证明统计" },
  totalProofs: { en: "Total Proofs", zh: "总证明数" },
  anchoredProofs: { en: "Anchored", zh: "已锚定" },
  latestId: { en: "Latest ID", zh: "最新编号" },
} as const;

export const messages = mergeMessages(appMessages);
