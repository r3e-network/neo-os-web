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
  partnerAddress: { en: "Partner Address", zh: "伴侣地址" },
  titleLabel: { en: "Contract Title", zh: "合约标题" },
  stakeLabel: { en: "Stake Amount", zh: "质押金额" },
  stakeAmount: { en: "Stake", zh: "质押" },
  durationLabel: { en: "Contract Duration", zh: "合约期限" },
  durationDays: { en: "Duration", zh: "期限" },
  termsLabel: { en: "Contract Terms", zh: "合约条款" },
  contractTerms: { en: "Terms", zh: "条款" },
  signatureLabel: { en: "Your Signature", zh: "您的签名" },
  signatureEmoji: { en: "Signature mark", zh: "签名标记" },
  heartIcon: { en: "Active relationship heart", zh: "活跃关系爱心" },
  brokenHeartIcon: { en: "Broken relationship", zh: "破裂关系" },

  partnerPlaceholder: { en: "Enter partner's NEO address", zh: "输入伴侣的 NEO 地址" },
  titlePlaceholder: { en: "Short title (max 100 chars)", zh: "简短标题（最多100字符）" },
  contractTitlePlaceholder: { en: "Our covenant", zh: "我们的约定" },
  stakePlaceholder: { en: "Amount in GAS", zh: "GAS 金额" },
  durationPlaceholder: { en: "Days", zh: "天数" },
  termsPlaceholder: { en: "Optional terms (max 2000 chars)", zh: "可选条款（最多2000字符）" },
  contractTermsPlaceholder: { en: "Optional notes, expectations, and exit rules", zh: "可选备注、约定和退出规则" },
  connectWallet: { en: "Connect wallet to sign", zh: "连接钱包以签名" },
  partnerRequired: { en: "Partner address is required", zh: "需要填写伴侣地址" },
  partnerInvalid: { en: "Invalid partner address", zh: "伴侣地址无效" },
  stakeRequired: { en: "Stake amount is required", zh: "需要填写质押金额" },
  stakeOrDurationInvalid: { en: "Stake must be at least 1 GAS and duration at least 30 days", zh: "质押至少 1 GAS，期限至少 30 天" },

  createBtn: { en: "Sign & Create Contract", zh: "签署并创建合约" },
  createContract: { en: "Create Contract", zh: "创建合约" },
  newContract: { en: "New Contract", zh: "新建合约" },
  contracts: { en: "Contracts", zh: "合约" },
  noContracts: { en: "No contracts yet", zh: "暂无合约" },
  noContractsHint: {
    en: "Created or signed relationship agreements will appear here once the contract index is available.",
    zh: "合约索引可用后，已创建或已签署的关系协议会显示在这里。",
  },
  contractDescription: {
    en: "Draft a stake-backed relationship agreement with a partner, duration, and terms before confirming the wallet intent.",
    zh: "填写伴侣、期限和条款，创建由质押支持的关系协议，并在钱包确认前复核。",
  },
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
  total: { en: "Total", zh: "总计" },
  active: { en: "Active", zh: "活跃" },
  broken: { en: "Broken", zh: "已破裂" },
  ended: { en: "Ended", zh: "已结束" },

  signContract: { en: "Sign Contract", zh: "签署合约" },
  breakContract: { en: "Break Contract", zh: "违约" },

  contractCreated: { en: "Contract created successfully!", zh: "合约创建成功！" },
  contractSigned: { en: "Contract signed", zh: "合约已签署" },
  contractBroken: { en: "Contract broken! Stake forfeited.", zh: "合约已破裂！质押被没收。" },
  contractPreparing: {
    en: "Preparing wallet confirmation for \"{title}\" with {amount} stake.",
    zh: "正在为「{title}」准备 {amount} 质押的钱包确认。",
  },
  contractSubmitted: {
    en: "Contract \"{title}\" submitted. Refreshing contract state.",
    zh: "合约「{title}」已提交，正在刷新状态。",
  },
  contractSigning: {
    en: "Preparing signature confirmation for contract #{id}.",
    zh: "正在为合约 #{id} 准备签署确认。",
  },
  contractBreaking: {
    en: "Preparing breakup confirmation for contract #{id}.",
    zh: "正在为合约 #{id} 准备违约确认。",
  },
  contractServiceUnavailableTitle: { en: "Contract index unavailable", zh: "合约索引暂不可用" },
  contractIndexUnavailable: {
    en: "Live contract records are not available in this environment yet. You can still prepare a new agreement and review the wallet intent before signing.",
    zh: "当前环境暂未接通实时合约记录。你仍可准备新协议，并在签名前查看钱包意图。",
  },
  contractActionUnavailable: {
    en: "Contract submission services are not configured in this environment yet.",
    zh: "当前环境暂未配置合约提交服务。",
  },
  contractWalletUnavailable: {
    en: "Open this MiniApp from the platform workspace to confirm the contract wallet intent.",
    zh: "请从平台工作区打开此小程序，以确认合约钱包意图。",
  },
  lastSubmittedContract: {
    en: "Last submitted: {title}",
    zh: "上次提交：{title}",
  },
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
