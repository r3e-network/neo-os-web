import { mergeMessages } from "@shared/locale/base-messages";

const appMessages = {
    // App translations
title: { en: "Breakup Contract", zh: "分手合约" },
  subtitle: {
    en: "Put skin in the game for the people you care about.",
    zh: "为你珍视的人，押上一点真心。",
  },
  contractTitle: { en: "A PROMISE, ON-CHAIN", zh: "链上的承诺" },
  heroIconTitle: { en: "Two people sharing a pact", zh: "共守约定的两个人" },
  clause1: {
    en: "Two people, one promise: you each lock a matching GAS stake. Honor it to the end and both stakes come back in full — break it, and yours goes to your partner.",
    zh: "两个人，一个承诺：各自锁定等额 GAS 质押。坚持到期满则双方质押全额退回 — 若违约，你的质押便归对方所有。",
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
    en: "Pacts you create or are named in will appear here. Connect your wallet to load them from the chain.",
    zh: "你创建或被指定参与的约定会显示在这里。连接钱包以从链上加载。",
  },
  contractDescription: {
    en: "Draft a stake-backed relationship agreement with a partner, duration, and terms before confirming the wallet intent.",
    zh: "填写伴侣、期限和条款，创建由质押支持的关系协议，并在钱包确认前复核。",
  },
  heroTagStakeBacked: { en: "Stake-backed", zh: "质押背书" },
  heroTagOnChain: { en: "On-chain", zh: "链上" },
  heroTagRefundable: { en: "Refundable", zh: "可退款" },
  howItWorksTitle: { en: "How it works", zh: "运作方式" },
  howItWorksStakeTitle: { en: "Both partners stake", zh: "双方质押" },
  howItWorksStakeCopy: {
    en: "You and your partner each lock matching GAS into the pact. The contract holds it until the agreement resolves.",
    zh: "你和伴侣各自将等额 GAS 锁入约定。合约会保管这笔资金，直到约定结束。",
  },
  howItWorksBreakTitle: { en: "If someone breaks it", zh: "如果有人毁约" },
  howItWorksBreakCopy: {
    en: "The partner who breaks the pact forfeits their stake — the other side receives both stakes back.",
    zh: "毁约的一方将失去其质押，另一方将取回两份质押。",
  },
  howItWorksSettleTitle: { en: "If it runs its term", zh: "如果约定到期" },
  howItWorksSettleCopy: {
    en: "When the duration passes with no break, either party can settle and both stakes are refunded in full.",
    zh: "若约定期满且无人毁约，任一方都可结算，两份质押将全额退还。",
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
  cancelled: { en: "Cancelled", zh: "已取消" },

  signContract: { en: "Sign Contract", zh: "签署合约" },
  breakContract: { en: "Break Contract", zh: "违约" },
  cancelContract: { en: "Cancel & reclaim", zh: "取消并取回" },
  settleContract: { en: "Settle", zh: "结算退还" },
  untitledContract: { en: "Untitled pact", zh: "未命名约定" },
  partnerTermsOffChain: {
    en: "Only the stake and duration are on-chain. The title and terms live on the creator's device — verify them together before you match the stake.",
    zh: "链上仅记录质押与期限。标题和条款仅保存在创建者的设备上 — 匹配质押前请与对方共同核对。",
  },

  contractCreated: { en: "Contract created successfully!", zh: "合约创建成功！" },
  contractSigned: { en: "Contract signed", zh: "合约已签署" },
  contractBroken: { en: "Pact broken — your stake is forfeited to your partner.", zh: "约定已违约 — 你的质押已归对方所有。" },
  contractSettled: { en: "Pact honored — both stakes refunded.", zh: "约定已履行 — 双方质押已退回。" },
  contractCancelled: { en: "Pact cancelled — your stake was reclaimed.", zh: "约定已取消 — 你的质押已取回。" },
  signNotPartner: {
    en: "Only the named partner can sign this pact.",
    zh: "只有被指定的伴侣才能签署此约定。",
  },
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
  contractSettling: {
    en: "Preparing settlement for pact #{id} — refunding both stakes.",
    zh: "正在为约定 #{id} 准备结算 — 退还双方质押。",
  },
  partnerSelf: {
    en: "You cannot name yourself as the partner.",
    zh: "不能将自己设为伴侣。",
  },
  pactIdRequired: {
    en: "Could not resolve the on-chain pact for this action.",
    zh: "无法解析该操作对应的链上约定。",
  },
  depositPrepaidNoContract: {
    en: "Your stake was deposited but the pact was not created. The stake is held on the contract as reusable prepaid credit — retry to create the pact.",
    zh: "你的质押已存入，但约定未能创建。质押作为可复用的预付额度保留在合约上 — 请重试以创建约定。",
  },
  depositPrepaidNoSign: {
    en: "Your matching stake was deposited but the pact was not signed. The stake is held on the contract as reusable prepaid credit — retry to sign.",
    zh: "你的等额质押已存入，但约定未能签署。质押作为可复用的预付额度保留在合约上 — 请重试签署。",
  },
  contractServiceUnavailableTitle: { en: "Couldn't load pacts", zh: "无法加载约定" },
  contractWalletUnavailable: {
    en: "Connect your wallet to stake and confirm the pact on-chain.",
    zh: "请连接钱包，以在链上质押并确认约定。",
  },
  lastSubmittedContract: {
    en: "Last submitted: {title}",
    zh: "上次提交：{title}",
  },
  createHintPartner: {
    en: "Add your partner's NEO address to begin.",
    zh: "先填写伴侣的 NEO 地址。",
  },
  createHintStake: {
    en: "Set a stake of at least 1 GAS for each of you.",
    zh: "为双方各设置至少 1 GAS 的质押。",
  },
  createHintDuration: {
    en: "Choose a term of at least 30 days.",
    zh: "选择至少 30 天的期限。",
  },
  createHintTitle: {
    en: "Give your pact a title so you'll both recognise it.",
    zh: "给约定起个名字，方便双方识别。",
  },
  createHintReady: {
    en: "Looks good — create your pact whenever you're ready.",
    zh: "一切就绪 — 准备好后即可创建约定。",
  },
  titleRequired: { en: "Contract title is required", zh: "请填写合约标题" },
  titleTooLong: { en: "Title must be 100 characters or less", zh: "标题最多100字符" },
  termsTooLong: { en: "Terms must be 2000 characters or less", zh: "条款最多2000字符" },
  titleCounter: { en: "{count}/{max} characters", zh: "{count}/{max} 字符" },
  termsCounter: { en: "{count}/{max} characters", zh: "{count}/{max} 字符" },
  contractUnavailable: { en: "Contract not configured", zh: "合约未配置" },
  loadFailed: { en: "Failed to load contracts", zh: "加载合约失败" },

  creditRecoveryTitle: { en: "Withdraw your GAS", zh: "提取你的 GAS" },
  creditRecoveryCopy: {
    en: "GAS owed to you is held as credit on the contract — a break payout (both stakes), a settlement refund (your stake back), or a stake you deposited without completing the pact. Withdraw it to your wallet anytime.",
    zh: "合约上以额度形式保留着应付给你的 GAS——可能是分手赔付（双方质押）、和解退款（退回你的质押），或你已存入但未完成约定的质押。可随时提取到你的钱包。",
  },
  recoverCredit: { en: "Withdraw GAS", zh: "提取 GAS" },
  creditRecovering: { en: "Withdrawing your GAS credit…", zh: "正在提取你的 GAS 额度…" },
  creditRecovered: { en: "GAS withdrawn to your wallet.", zh: "GAS 已提取到你的钱包。" },
  noCreditToRecover: { en: "No GAS credit to withdraw.", zh: "没有可提取的 GAS 额度。" },

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
