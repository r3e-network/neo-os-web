import { mergeMessages } from "@shared/locale/base-messages";

const appMessages = {
    // App translations
title: { en: "Breakup Contract", zh: "分手合约" },
  subtitle: { en: "Relationship stakes on-chain", zh: "链上关系赌注" },
  contractTitle: { en: "RELATIONSHIP CONTRACT", zh: "关系合约" },
  clause1: {
    en: "This contract binds two parties in a commitment backed by cryptocurrency stakes.",
    zh: "本合约将双方绑定在由加密货币质押支持的承诺中。",
  },

  partnerLabel: { en: "Partner Address", zh: "伴侣地址" },
  titleLabel: { en: "Contract Title", zh: "合约标题" },
  stakeLabel: { en: "Stake Amount", zh: "质押金额" },
  durationLabel: { en: "Contract Duration", zh: "合约期限" },
  termsLabel: { en: "Contract Terms", zh: "合约条款" },
  signatureLabel: { en: "Your Signature", zh: "您的签名" },

  partnerPlaceholder: { en: "Enter partner's NEO address", zh: "输入伴侣的 NEO 地址" },
  titlePlaceholder: { en: "Short title (max 100 chars)", zh: "简短标题（最多100字符）" },
  stakePlaceholder: { en: "Amount in GAS", zh: "GAS 金额" },
  durationPlaceholder: { en: "Days", zh: "天数" },
  termsPlaceholder: { en: "Optional terms (max 2000 chars)", zh: "可选条款（最多2000字符）" },
  connectWallet: { en: "Connect wallet to sign", zh: "连接钱包以签名" },
  partnerRequired: { en: "Partner address is required", zh: "需要填写伴侣地址" },
  partnerInvalid: { en: "Invalid partner address", zh: "伴侣地址无效" },

  createBtn: { en: "Sign & Create Contract", zh: "签署并创建合约" },
  tabCreate: { en: "Create", zh: "创建" },
  tabContracts: { en: "Contracts", zh: "合约" },
  daysSuffix: { en: "Days", zh: "天" },

  activeContracts: { en: "Active Contracts", zh: "活跃合约" },
  partner: { en: "Partner", zh: "伴侣" },
  stake: { en: "Stake", zh: "质押" },
  duration: { en: "Duration", zh: "期限" },
  daysLeft: { en: "days left", zh: "天剩余" },
  progress: { en: "Progress", zh: "进度" },

  pending: { en: "Pending", zh: "待签署" },
  active: { en: "Active", zh: "活跃" },
  broken: { en: "Broken", zh: "已破裂" },
  ended: { en: "Ended", zh: "已结束" },

  signContract: { en: "Sign Contract", zh: "签署合约" },
  breakContract: { en: "Break Contract", zh: "违约" },

  contractCreated: { en: "Contract created successfully!", zh: "合约创建成功！" },
  contractSigned: { en: "Contract signed", zh: "合约已签署" },
  contractBroken: { en: "Contract broken! Stake forfeited.", zh: "合约已破裂！质押被没收。" },
  titleRequired: { en: "Contract title is required", zh: "请填写合约标题" },
  titleTooLong: { en: "Title must be 100 characters or less", zh: "标题最多100字符" },
  termsTooLong: { en: "Terms must be 2000 characters or less", zh: "条款最多2000字符" },
  contractUnavailable: { en: "Contract not configured", zh: "合约未配置" },
  loadFailed: { en: "Failed to load contracts", zh: "加载合约失败" },

  docSubtitle: { en: "Stake-backed relationship agreements", zh: "带质押的关系合约" },
  docDescription: {
    en: "Breakup Contract lets two parties lock GAS into a timed agreement with clear terms. Both parties sign on-chain, the stake is held by the contract, and early termination triggers forfeits according to the rules.",
    zh: "分手合约支持双方将 GAS 锁定在有期限的协议中并明确条款。双方在链上签署后由合约托管质押，提前终止将按规则触发违约处理。",
  },
  step1: { en: "Connect your wallet and create a contract draft.", zh: "连接钱包并创建合约草案。" },
  step2: { en: "Set partner address, stake amount, and terms.", zh: "填写伴侣地址、质押金额与条款。" },
  step3: { en: "Both parties sign to lock the stake on-chain.", zh: "双方签署后质押上链锁定。" },
  step4: { en: "Track status, completion, or early termination.", zh: "跟踪合约状态、完成或提前终止。" },
  feature1Name: { en: "Crypto Stakes", zh: "加密质押" },
  feature1Desc: { en: "Real GAS locked in contract.", zh: "真实的 GAS 锁定在合约中。" },
  feature2Name: { en: "On-Chain Proof", zh: "链上证明" },
  feature2Desc: { en: "Immutable relationship records.", zh: "不可变的关系记录。" },
  feature3Name: { en: "Dual Signature", zh: "双签确认" },
  feature3Desc: { en: "Both parties must sign before activation.", zh: "双方签署后合约才会生效。" },
} as const;

export const messages = mergeMessages(appMessages);
