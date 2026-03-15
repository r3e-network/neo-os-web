import { mergeMessages } from "@shared/locale/base-messages";

const appMessages = {
  title: { en: "Timestamp Proof", zh: "时间戳证明" },
  proofs: { en: "Proofs", zh: "证明" },
  verify: { en: "Verify", zh: "验证" },

  createProof: { en: "Create Proof", zh: "创建证明" },
  enterContent: { en: "Enter content to timestamp", zh: "输入要时间戳的内容" },
  contentPlaceholder: { en: "Paste your text, document hash, or idea...", zh: "粘贴您的文本、文档哈希或想法..." },
  createSuccess: { en: "Proof created!", zh: "证明已创建！" },
  proofId: { en: "Proof ID", zh: "证明ID" },
  timestamp: { en: "Timestamp", zh: "时间戳" },
  txHash: { en: "Transaction", zh: "交易" },

  verifyProof: { en: "Verify Proof", zh: "验证证明" },
  enterProofId: { en: "Enter Proof ID", zh: "输入证明ID" },
  validProof: { en: "Valid Proof", zh: "有效证明" },
  invalidProof: { en: "Invalid Proof", zh: "无效证明" },
  verifiedContent: { en: "Verified Content", zh: "已验证内容" },
  verifyFailed: { en: "Verification failed", zh: "验证失败" },

  recentProofs: { en: "Recent Proofs", zh: "最近证明" },
  noProofs: { en: "No proofs yet", zh: "暂无证明" },
  myProofs: { en: "My Proofs", zh: "我的证明" },

  docSubtitle: { en: "Immutable blockchain timestamps", zh: "区块链不可变时间戳" },
  docDescription: {
    en: "Create tamper-proof timestamps for any content on the blockchain.",
    zh: "在区块链���为任何内容创建防篡改时间戳。",
  },
  step1: { en: "Enter your content or document hash", zh: "输入您的内容或文档哈希" },
  step2: { en: "Submit to create an on-chain timestamp", zh: "提交以创建链上时间戳" },
  step3: { en: "Receive a verifiable proof certificate", zh: "接收可验证的证明证书" },
  step4: { en: "Anyone can verify the proof anytime", zh: "任何人都可以随时验证证明" },

  feature1Name: { en: "Immutable Proof", zh: "不可变证明" },
  feature1Desc: { en: "Timestamps are permanently recorded on-chain", zh: "时间戳永久记录在链上" },
  feature2Name: { en: "Instant Verification", zh: "即时验证" },
  feature2Desc: { en: "Anyone can verify proofs at any time", zh: "任何人都可以随时验证证明" },
  feature3Name: { en: "Universal Hashing", zh: "通用哈希" },
  feature3Desc: { en: "Works with any text, document, or data hash", zh: "适用于任何文本、文档或数据哈希" },

  proofStats: { en: "Proof Stats", zh: "证明统计" },
  totalProofs: { en: "Total Proofs", zh: "总证明数" },
  yourProofs: { en: "Your Proofs", zh: "你的证明" },
  ariaProofs: { en: "Proofs", zh: "证明" },
  latestId: { en: "Latest ID", zh: "最新编号" },
} as const;

export const messages = mergeMessages(appMessages);
