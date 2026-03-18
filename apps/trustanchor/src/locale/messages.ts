import { mergeMessages } from "@shared/locale/base-messages";

const appMessages = {
  appName: { en: "TrustAnchor", zh: "TrustAnchor" },
  title: { en: "TrustAnchor", zh: "TrustAnchor" },
  heroDescription: {
    en: "Verification-script staking accounts replace per-candidate agent contracts. Fresh deposits land in slot 21 first, then the admin rebalances by moving real NEO from slot A to slot B.",
    zh: "TrustAnchor 改为使用 verification-script 质押账户，而不是每个候选人一个 agent 合约。新流入默认先进入 21 号槽位，管理员再通过把真实 NEO 从 A 槽位转到 B 槽位来调整权重。",
  },
  stake: { en: "Stake NEO", zh: "质押 NEO" },
  unstake: { en: "Unstake NEO", zh: "解除质押" },
  claim: { en: "Claim GAS", zh: "领取 GAS" },
  myStake: { en: "My Stake", zh: "我的质押" },
  totalStaked: { en: "Total Staked", zh: "总质押量" },
  pendingRewards: { en: "Pending Rewards", zh: "待领取奖励" },
  rewardPerStake: { en: "Reward Per Stake", zh: "每份质押奖励累计值" },
  routingSlotsLabel: { en: "Routing Slots", zh: "路由槽位" },
  defaultIngressLabel: { en: "Default Ingress", zh: "默认入口槽位" },
  defaultIngressShort: { en: "Ingress", zh: "入口" },
  rebalanceShort: { en: "Rebalance", zh: "调仓" },
  noAgentContractsLabel: { en: "Agent Contracts", zh: "Agent 合约数" },
  zeroFee: { en: "0% Fees", zh: "0% 手续费" },
  zeroFeeDesc: { en: "100% of GAS rewards go to stakers", zh: "100% 的 GAS 奖励归质押者所有" },
  verificationAccountsTitle: { en: "Verification Accounts", zh: "Verification Script 账户" },
  verificationAccountsDesc: {
    en: "21 routing slots, one candidate target per slot, no per-slot smart contract deployment.",
    zh: "共 21 个路由槽位，每个槽位绑定一个候选人目标，不再为每个槽位部署独立合约。",
  },
  verificationScriptTitle: { en: "No Agent Contracts", zh: "不再使用 Agent 合约" },
  verificationScriptDesc: {
    en: "Each routing slot is a verification-script account model, not a child contract account.",
    zh: "每个路由槽位都是 verification-script 账户模型，而不是子合约账户。",
  },
  routingSummaryTitle: { en: "Routing Summary", zh: "路由摘要" },
  routingSummaryDesc: {
    en: "TrustAnchor tracks staking and rewards at the pool level. Operational routing happens through 21 verification-script accounts, with slot 21 acting as the default ingress for fresh deposits.",
    zh: "TrustAnchor 在池级别统计质押和奖励。实际投票路由通过 21 个 verification-script 账户完成，其中 21 号槽位是新资金的默认入口。",
  },
  rebalanceTitle: { en: "Rebalance by Real Transfer", zh: "通过真实转账调权" },
  rebalanceDesc: {
    en: "The admin does not set a synthetic voting weight. Weight changes only happen by moving real NEO from one routing slot to another.",
    zh: "管理员不会设置虚拟投票权重。权重变化只能通过把真实 NEO 从一个槽位转移到另一个槽位来完成。",
  },
  rebalanceMetricDesc: {
    en: "Admin moves real NEO from slot A to slot B; no hidden weight variable exists.",
    zh: "管理员把真实 NEO 从 A 槽位转到 B 槽位，不存在隐藏的权重配置变量。",
  },
  howItWorks: { en: "How It Works", zh: "工作原理" },
  step1: {
    en: "User stake enters the pool and is routed into verification-slot 21 first.",
    zh: "用户质押先进入池子，再默认路由到 21 号 verification 槽位。",
  },
  step2: {
    en: "Each slot corresponds to exactly one candidate target and one verification-script account.",
    zh: "每个槽位只对应一个候选人目标和一个 verification-script 账户。",
  },
  step3: {
    en: "Admin rebalances exposure by moving real NEO from slot A to slot B.",
    zh: "管理员通过把真实 NEO 从 A 槽位转移到 B 槽位来调节整体敞口。",
  },
  step4: {
    en: "Claimed GAS flows back into reward accounting and is distributed pro rata to stakers.",
    zh: "领取的 GAS 回流到奖励记账体系，再按比例分给质押者。",
  },
  adminControlTitle: { en: "Admin Controls", zh: "管理员控制边界" },
  adminControl1: {
    en: "Only real transfers between routing slots change candidate exposure.",
    zh: "只有路由槽位之间的真实转账才会改变候选人敞口。",
  },
  adminControl2: {
    en: "New deposits always start at slot 21 before any later rebalance.",
    zh: "新流入永远先从 21 号槽位进入，再进行后续调仓。",
  },
  adminControl3: {
    en: "No per-candidate child contract is deployed or managed in this model.",
    zh: "这个模型里不会再部署和管理每候选人一个子合约。",
  },
  routingTabTitle: { en: "Verification-Script Routing Slots", zh: "Verification Script 路由槽位" },
  routingTabSubtitle: {
    en: "Twenty-one routing accounts are planned. Slot 21 is the default ingress slot for all fresh deposits.",
    zh: "规划为 21 个路由账户，其中 21 号槽位是所有新流入资金的默认入口。",
  },
  slotLabel: { en: "Slot", zh: "槽位" },
  slotRole: { en: "Role", zh: "角色" },
  slotTarget: { en: "Candidate Target", zh: "候选人目标" },
  slotFundingPath: { en: "Funding Path", zh: "资金路径" },
  slotAccount: { en: "Account Address", zh: "账户地址" },
  slotVerificationScript: { en: "Verification Script", zh: "Verification Script" },
  deploymentPendingTitle: { en: "Contract deployment pending", zh: "合约待部署" },
  deploymentPendingDesc: {
    en: "TrustAnchor is being rebuilt around verification-script routing accounts. The product model is final, but the new on-chain contract rollout is still pending, so stake / unstake / claim remain disabled for now.",
    zh: "TrustAnchor 正在按 verification-script 路由账户模型重构。产品模型已经确定，但新的链上合约还未完成测试网上线，所以当前质押 / 解押 / 领取仍然保持禁用。",
  },
  tabOverview: { en: "Overview", zh: "概览" },
  tabRouting: { en: "Routing", zh: "路由" },
  tabArchitecture: { en: "Architecture", zh: "架构" },
  liveAccountingTitle: { en: "Live Accounting Surface", zh: "实时记账面" },
  docsSubtitle: { en: "Verification-script routing for zero-fee Neo staking", zh: "零费率 Neo 质押的 verification-script 路由模型" },
  feature1Name: { en: "Slot 21 Ingress", zh: "21 号槽位入口" },
  feature1Desc: {
    en: "All fresh deposits land in slot 21 before any admin rebalance happens.",
    zh: "所有新流入先进入 21 号槽位，再由管理员进行后续调仓。",
  },
  feature2Name: { en: "Verification Accounts", zh: "Verification Script 账户" },
  feature2Desc: {
    en: "Routing uses verification-script accounts instead of per-candidate child contracts.",
    zh: "路由使用 verification-script 账户，而不是每个候选人一个子合约。",
  },
  feature3Name: { en: "Transfer-Based Rebalance", zh: "基于转账的调仓" },
  feature3Desc: {
    en: "Admin changes exposure only by moving real NEO from slot A to slot B.",
    zh: "管理员只能通过把真实 NEO 从 A 槽位转到 B 槽位来调整敞口。",
  },
  philosophy: { en: "Philosophy", zh: "理念" },
  philosophyText: {
    en: "TrustAnchor exists to make stake routing explicit. No hidden weight knobs, no per-candidate child contracts, and no fee skim. Every change in voting exposure should correspond to a real transfer between verification-script routing accounts.",
    zh: "TrustAnchor 的目标是把质押路由显式化。不使用隐藏权重开关，不使用每候选人一个子合约，也不抽手续费。每一次投票敞口变化都应该对应 verification-script 路由账户之间的一次真实转账。",
  },
} as const;

export const messages = mergeMessages(appMessages);
