import { mergeMessages } from "@shared/locale/base-messages";

const appMessages = {
  appName: { en: "TrustAnchor", zh: "TrustAnchor" },
  title: { en: "TrustAnchor", zh: "TrustAnchor" },
  heroDescription: {
    en: "TrustAnchor uses verification-script agent accounts, not agent contracts. New users are routed to the agent account for candidate 21 by default, and the admin changes vote weight only by moving real NEO from agent A to agent B.",
    zh: "TrustAnchor 使用的是 verification-script 构造的 agent 账户，而不是 agent 合约。新用户默认先进入第 21 个 candidate 对应的 agent 账户，管理员调权的方式则是把真实 NEO 从 agent A 转到 agent B。",
  },
  stake: { en: "Stake NEO", zh: "质押 NEO" },
  unstake: { en: "Unstake NEO", zh: "解除质押" },
  claim: { en: "Claim GAS", zh: "领取 GAS" },
  myStake: { en: "My Stake", zh: "我的质押" },
  totalStaked: { en: "Total Staked", zh: "总质押量" },
  pendingRewards: { en: "Pending Rewards", zh: "待领取奖励" },
  pendingWithdrawLabel: { en: "Pending Withdraw", zh: "待领取解押" },
  claimPendingWithdraw: { en: "Claim Pending", zh: "领取待解押" },
  withdrawQueueDesc: {
    en: "If liquidity is currently routed into agents, unstake becomes a queued withdraw until enough NEO returns to the core pool.",
    zh: "如果当前流动性正在 agent 账户里投票，解押会先进入待领取状态，直到足够的 NEO 回流核心池为止。",
  },
  rewardPerStake: { en: "Reward Per Stake", zh: "每份质押奖励累计值" },
  contractLiquidityLabel: { en: "Core Liquidity", zh: "核心池流动性" },
  agentAccountsLabel: { en: "Agent Accounts", zh: "Agent 账户" },
  defaultIngressLabel: { en: "Default Candidate", zh: "默认 Candidate" },
  defaultIngressShort: { en: "Ingress", zh: "入口" },
  rebalanceShort: { en: "Rebalance", zh: "调仓" },
  noAgentContractsLabel: { en: "Agent Contracts", zh: "Agent 合约数" },
  zeroFee: { en: "0% Fees", zh: "0% 手续费" },
  zeroFeeDesc: { en: "100% of GAS rewards go to stakers", zh: "100% 的 GAS 奖励归质押者所有" },
  verificationAccountsTitle: { en: "Verification Accounts", zh: "Verification Script 账户" },
  verificationAccountsDesc: {
    en: "21 verification-script agent accounts, one candidate target per account, and no child agent-contract fleet.",
    zh: "共 21 个 verification-script agent 账户，每个账户绑定一个 candidate 目标，不再维护子 agent 合约集群。",
  },
  verificationScriptTitle: { en: "No Agent Contracts", zh: "不再使用 Agent 合约" },
  verificationScriptDesc: {
    en: "Each numbered agent path uses a verification-script agent account model, not a child contract account.",
    zh: "每条编号化 agent 路径都使用 verification-script agent 账户模型，而不是子合约账户。",
  },
  routingSummaryTitle: { en: "Routing Summary", zh: "路由摘要" },
  routingSummaryDesc: {
    en: "TrustAnchor tracks staking and rewards at the pool level. Operational voting uses 21 verification-script agent accounts, and fresh deposits always enter the agent account bound to candidate 21 first.",
    zh: "TrustAnchor 在池级别统计质押和奖励。实际投票通过 21 个 verification-script agent 账户完成，所有新流入都会先进入绑定 candidate 21 的 agent 账户。",
  },
  rebalanceTitle: { en: "Rebalance by Real Transfer", zh: "通过真实转账调权" },
  rebalanceDesc: {
    en: "The admin does not set a synthetic voting weight. Weight changes only happen by moving real NEO from agent A to agent B.",
    zh: "管理员不会设置虚拟投票权重。权重变化只能通过把真实 NEO 从 agent A 转到 agent B 来完成。",
  },
  rebalanceMetricDesc: {
    en: "Admin moves real NEO from agent A to agent B; no hidden weight variable exists.",
    zh: "管理员把真实 NEO 从 agent A 转到 agent B，不存在隐藏的权重配置变量。",
  },
  howItWorks: { en: "How It Works", zh: "工作原理" },
  step1: {
    en: "User stake enters the pool and is routed into the verification-script agent account for candidate 21 first.",
    zh: "用户质押先进入池子，再默认路由到 candidate 21 对应的 verification-script agent 账户。",
  },
  step2: {
    en: "Each candidate is represented by one verification-script agent account, not by a child smart contract.",
    zh: "每个 candidate 都由一个 verification-script agent 账户表示，而不是一个子智能合约。",
  },
  step3: {
    en: "Admin rebalances exposure by moving real NEO from agent A to agent B.",
    zh: "管理员通过把真实 NEO 从 agent A 转移到 agent B 来调节整体敞口。",
  },
  step4: {
    en: "Claimed GAS flows back into reward accounting and is distributed pro rata to stakers.",
    zh: "领取的 GAS 回流到奖励记账体系，再按比例分给质押者。",
  },
  adminControlTitle: { en: "Admin Controls", zh: "管理员控制边界" },
  adminControl1: {
    en: "Only real transfers between verification-script agent accounts change candidate exposure.",
    zh: "只有 verification-script agent 账户之间的真实转账才会改变 candidate 敞口。",
  },
  adminControl2: {
    en: "New deposits always start at the agent account bound to candidate 21 before any later rebalance.",
    zh: "新流入永远先从绑定 candidate 21 的 agent 账户进入，再进行后续调仓。",
  },
  adminControl3: {
    en: "No per-candidate child contract is deployed or managed in this model.",
    zh: "这个模型里不会再部署和管理每候选人一个子合约。",
  },
  routingTabTitle: { en: "Verification-Script Agent Accounts", zh: "Verification Script Agent 账户" },
  routingTabSubtitle: {
    en: "Twenty-one verification-script agent accounts are planned. The account bound to candidate 21 is the default ingress path for all fresh deposits.",
    zh: "规划为 21 个 verification-script agent 账户，其中绑定 candidate 21 的账户是所有新流入资金的默认入口。",
  },
  agentLabel: { en: "Agent", zh: "Agent" },
  agentRole: { en: "Role", zh: "角色" },
  agentTarget: { en: "Candidate Target", zh: "候选人目标" },
  agentFundingPath: { en: "Funding Path", zh: "资金路径" },
  agentAccount: { en: "Agent Account", zh: "Agent 账户" },
  agentVerificationScript: { en: "Verification Script", zh: "Verification Script" },
  deploymentPendingTitle: { en: "Contract deployment pending", zh: "合约待部署" },
  deploymentPendingDesc: {
    en: "TrustAnchor is being rebuilt around verification-script agent accounts. The product model is final, but the new on-chain contract rollout is still pending, so stake / unstake / claim remain disabled for now.",
    zh: "TrustAnchor 正在按 verification-script agent 账户模型重构。产品模型已经确定，但新的链上合约还未完成测试网上线，所以当前质押 / 解押 / 领取仍然保持禁用。",
  },
  tabOverview: { en: "Overview", zh: "概览" },
  tabRouting: { en: "Routing", zh: "路由" },
  tabArchitecture: { en: "Architecture", zh: "架构" },
  liveAccountingTitle: { en: "Live Accounting Surface", zh: "实时记账面" },
  docsSubtitle: { en: "Verification-script routing for zero-fee Neo staking", zh: "零费率 Neo 质押的 verification-script 路由模型" },
  feature1Name: { en: "Slot 21 Ingress", zh: "21 号槽位入口" },
  feature1Desc: {
    en: "All fresh deposits land in the agent account for candidate 21 before any admin rebalance happens.",
    zh: "所有新流入先进入 candidate 21 对应的 agent 账户，再由管理员进行后续调仓。",
  },
  feature2Name: { en: "Agent Accounts", zh: "Agent 账户" },
  feature2Desc: {
    en: "Routing uses verification-script agent accounts instead of per-candidate child contracts.",
    zh: "路由使用 verification-script agent 账户，而不是每个候选人一个子合约。",
  },
  feature3Name: { en: "Transfer-Based Rebalance", zh: "基于转账的调仓" },
  feature3Desc: {
    en: "Admin changes exposure only by moving real NEO from agent A to agent B.",
    zh: "管理员只能通过把真实 NEO 从 agent A 转到 agent B 来调整敞口。",
  },
  philosophy: { en: "Philosophy", zh: "理念" },
  philosophyText: {
    en: "TrustAnchor exists to make stake routing explicit. No hidden weight knobs, no per-candidate child contracts, and no fee skim. Every change in voting exposure should correspond to a real transfer between verification-script agent accounts.",
    zh: "TrustAnchor 的目标是把质押路由显式化。不使用隐藏权重开关，不使用每候选人一个子合约，也不抽手续费。每一次投票敞口变化都应该对应 verification-script agent 账户之间的一次真实转账。",
  },
} as const;

export const messages = mergeMessages(appMessages);
