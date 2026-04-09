import { mergeMessages } from "@shared/locale/base-messages";

const appMessages = {
  title: { en: "Timestamp Proof", zh: "时间戳证明" },
  proofs: { en: "Proofs", zh: "证明" },
  verify: { en: "Verify", zh: "验证" },

  createProof: { en: "Create Proof", zh: "创建证明" },
  enterContent: { en: "Enter content to timestamp", zh: "输入要时间戳的内容" },
  contentPlaceholder: { en: "Paste your text, document hash, or idea...", zh: "粘贴您的文本、文档哈希或想法..." },
  createSuccess: { en: "Proof saved to this device.", zh: "证明已保存到当前设备。" },
  proofId: { en: "Proof ID", zh: "证明ID" },
  timestamp: { en: "Timestamp", zh: "时间戳" },
  txHash: { en: "Reference", zh: "引用" },

  verifyProof: { en: "Verify Proof", zh: "验证证明" },
  enterProofId: { en: "Enter Proof ID", zh: "输入证明ID" },
  validProof: { en: "Proof Found", zh: "已找到证明" },
  invalidProof: { en: "Invalid Proof", zh: "无效证明" },
  verifiedContent: { en: "Verified Content", zh: "已验证内容" },
  verifyFailed: { en: "Verification failed", zh: "验证失败" },

  recentProofs: { en: "Recent Proofs", zh: "最近证明" },
  noProofs: { en: "No proofs yet", zh: "暂无证明" },
  myProofs: { en: "My Proofs", zh: "我的证明" },

  docSubtitle: { en: "Device-local SHA-256 proof journal", zh: "设备本地 SHA-256 证明记录" },
  docDescription: {
    en: "Create and verify local SHA-256 proof entries without depending on a deployed contract.",
    zh: "无需依赖已部署合约，直接创建和验证本地 SHA-256 证明记录。",
  },
  step1: { en: "Enter your content or document hash", zh: "输入您的内容或文档哈希" },
  step2: { en: "Hash it locally in the browser", zh: "在浏览器本地计算哈希" },
  step3: { en: "Store a reusable proof entry on this device", zh: "在当前设备保存可重复验证的证明记录" },
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
  yourProofs: { en: "Your Proofs", zh: "你的证明" },
  ariaProofs: { en: "Proofs", zh: "证明" },
  latestId: { en: "Latest ID", zh: "最新编号" },
  ellipsis: { en: "...", zh: "..." },
  idPrefix: { en: "#", zh: "#" },
  labelSeparator: { en: ": ", zh: "：" },
} as const;

export const messages = mergeMessages(appMessages);
