import { mergeMessages } from "@shared/locale/base-messages";

const appMessages = {
  title: { en: "Timestamp Proof", zh: "时间戳证明" },
  proofs: { en: "Proofs", zh: "证明" },
  verify: { en: "Verify", zh: "验证" },

  createProof: { en: "Create Proof", zh: "创建证明" },
  enterContent: { en: "Enter content to timestamp", zh: "输入要时间戳的内容" },
  createDisabledHint: {
    en: "Add some text above to enable timestamping.",
    zh: "在上方输入内容即可生成时间戳。",
  },
  contentPlaceholder: { en: "Paste your text, document hash, or idea...", zh: "粘贴您的文本、文档哈希或想法..." },
  createSuccess: { en: "Proof saved to this device.", zh: "证明已保存到当前设备。" },
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
  connectWalletToAnchor: { en: "Connect a wallet to anchor on-chain", zh: "连接钱包以上链锚定" },
  anchorCostNote: {
    en: "Anchoring writes the digest into a public Neo transaction (small network fee). Local proofs stay private and free.",
    zh: "锚定会将摘要写入一笔公开的 Neo 交易（仅需少量网络费）。本地证明则保持私密且免费。",
  },
  howToVerifyTitle: { en: "How to verify on-chain", zh: "如何在链上核验" },
  howToVerifyBody: {
    en: "Open the anchor transaction on the explorer: anyone can read \"timestamp-proof:<digest>\" in the transaction data, and the block time is the proof time. No app or device is needed to confirm it.",
    zh: "在区块浏览器中打开锚定交易：任何人都能在交易数据中读取 “timestamp-proof:<摘要>”，区块时间即为证明时间。无需依赖本应用或设备即可核验。",
  },

  verifyProof: { en: "Verify Proof", zh: "验证证明" },
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
  noProofsHint: { en: "Saved proof entries will appear here.", zh: "已保存的证明记录会显示在这里。" },

  copyDigest: { en: "Copy digest", zh: "复制摘要" },
  copyReference: { en: "Copy proof reference", zh: "复制证明引用" },
  deleteProof: { en: "Delete proof", zh: "删除证明" },
  clearAllProofs: { en: "Clear all", zh: "清除全部" },

  digestCopied: { en: "Digest copied", zh: "已复制摘要" },
  referenceCopied: { en: "Reference copied", zh: "已复制引用" },
  proofDeleted: { en: "Proof deleted", zh: "证明已删除" },
  proofsCleared: { en: "Proofs cleared", zh: "证明已清除" },
  error: { en: "Something went wrong", zh: "出现错误" },

  docSubtitle: { en: "SHA-256 proof journal with optional on-chain anchor", zh: "SHA-256 证明记录，可选上链锚定" },
  docDescription: {
    en: "Create SHA-256 proof entries locally, then optionally anchor a proof on Neo N3 (a 0-GAS self-transfer that embeds the digest) so a third party can verify the digest and time on-chain.",
    zh: "在本地创建 SHA-256 证明记录，并可选择将证明锚定到 Neo N3（一笔携带摘要的 0 GAS 自转账），以便第三方在链上核验摘要与时间。",
  },
  step1: { en: "Enter your content or document hash", zh: "输入您的内容或文档哈希" },
  step2: { en: "Hash it locally in the browser", zh: "在浏览器本地计算哈希" },
  step3: { en: "Optionally anchor the proof on-chain for third-party verification", zh: "可选地将证明上链锚定，供第三方核验" },
  step4: { en: "Re-open and verify the proof by ID anytime", zh: "随时按编号重新验证该证明" },

  feature1Name: { en: "Local Certificates", zh: "本地证明条目" },
  feature1Desc: {
    en: "Each proof is saved in local browser storage with a deterministic SHA-256 hash",
    zh: "每条证明都会以确定性的 SHA-256 哈希保存在浏览器本地存储中",
  },
  feature2Name: { en: "Instant Verification", zh: "即时验证" },
  feature2Desc: { en: "Look up any saved proof by ID without waiting for a contract call", zh: "无需等待合约调用，直接按编号查询已保存证明" },
  feature3Name: { en: "Universal Hashing", zh: "通用哈希" },
  feature3Desc: { en: "Works with text, notes, hashes, drafts, and any other short-form content", zh: "适用于文本、备注、哈希、草稿及其他短内容" },

  proofStats: { en: "Proof Stats", zh: "证明统计" },
  totalProofs: { en: "Total Proofs", zh: "总证明数" },
  anchoredProofs: { en: "Anchored", zh: "已锚定" },
  latestId: { en: "Latest ID", zh: "最新编号" },
} as const;

export const messages = mergeMessages(appMessages);
