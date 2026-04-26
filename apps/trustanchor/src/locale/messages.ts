import { mergeMessages } from "@shared/locale/base-messages";

const appMessages = {
  appName: { en: "TrustAnchor", zh: "TrustAnchor" },
  title: { en: "TrustAnchor", zh: "TrustAnchor" },
  heroDescription: {
    en: "TrustAnchor uses AA-generated agent accounts as vote identities. Admins can register agents and sync vote routes, but cannot transfer user-staked NEO or user-earned GAS.",
    zh: "TrustAnchor 使用 AA 生成的 agent 账户作为投票身份。管理员可以注册 agent 并同步投票路由，但不能转移用户质押的 NEO 或用户获得的 GAS。",
  },
  stake: { en: "Stake NEO", zh: "质押 NEO" },
  unstake: { en: "Unstake NEO", zh: "解除质押" },
  claim: { en: "Claim GAS", zh: "领取 GAS" },
  myStake: { en: "My Stake", zh: "我的质押" },
  totalStaked: { en: "Total Staked", zh: "总质押量" },
  pendingRewards: { en: "Pending Rewards", zh: "待领取奖励" },
  pendingWithdrawLabel: { en: "Unstaked Credit", zh: "未质押余额" },
  claimPendingWithdraw: { en: "Withdraw Credit", zh: "取回余额" },
  withdrawQueueDesc: {
    en: "NEO credits that are not staked can be withdrawn only by the same user.",
    zh: "未质押的 NEO 余额只能由同一用户本人取回。",
  },
  rewardPerStake: { en: "Reward Per Stake", zh: "每份质押奖励累计值" },
  contractLiquidityLabel: { en: "Core Liquidity", zh: "核心池流动性" },
  agentAccountsLabel: { en: "Agent Accounts", zh: "Agent 账户" },
  defaultIngressLabel: { en: "Vote Routes", zh: "投票路由" },
  defaultIngressShort: { en: "Routes", zh: "路由" },
  ingressCount: { en: "Vote Routes", zh: "投票路由" },
  rebalanceShort: { en: "Rebalance", zh: "调仓" },
  noAgentContractsLabel: { en: "Agent Contracts", zh: "Agent 合约数" },
  zeroFee: { en: "0% Fees", zh: "0% 手续费" },
  zeroFeeDesc: { en: "100% of GAS rewards go to stakers", zh: "100% 的 GAS 奖励归质押者所有" },
  verificationAccountsTitle: { en: "Verification Accounts", zh: "Verification Script 账户" },
  verificationAccountsDesc: {
    en: "AA-generated agent accounts, one candidate target per account, and no child agent-contract fleet.",
    zh: "AA 生成的 agent 账户，每个账户绑定一个 candidate 目标，不再维护子 agent 合约集群。",
  },
  verificationScriptTitle: { en: "No Agent Contracts", zh: "不再使用 Agent 合约" },
  verificationScriptDesc: {
    en: "Each numbered agent path uses a verification-script agent account model, not a child contract account.",
    zh: "每条编号化 agent 路径都使用 verification-script agent 账户模型，而不是子合约账户。",
  },
  routingSummaryTitle: { en: "Routing Summary", zh: "路由摘要" },
  routingSummaryDesc: {
    en: "TrustAnchor tracks staking and rewards at the pool level. Operational voting uses registered AA agent accounts while user withdrawals and GAS claims stay user-witnessed.",
    zh: "TrustAnchor 在池级别统计质押和奖励。实际投票通过已注册 AA agent 账户完成，用户赎回和 GAS 领取仍需要用户签名。",
  },
  rebalanceTitle: { en: "Vote-Only Admin Surface", zh: "仅投票管理员权限" },
  rebalanceDesc: {
    en: "The admin does not hold a withdrawal key. Admin updates are limited to AA agent registration, candidate changes, and vote sync.",
    zh: "管理员没有提现密钥。管理员更新仅限于 AA agent 注册、候选人变更和投票同步。",
  },
  rebalanceMetricDesc: {
    en: "Admin registers AA agent routes and syncs votes; no admin path transfers user stake or reward GAS.",
    zh: "管理员注册 AA agent 路由并同步投票；不存在可转移用户质押或奖励 GAS 的管理员路径。",
  },
  howItWorks: { en: "How It Works", zh: "工作原理" },
  step1: {
    en: "User stake enters PlatformAnchor accounting and remains withdrawable only by that user.",
    zh: "用户质押进入 PlatformAnchor 记账，并且只能由该用户本人赎回。",
  },
  step2: {
    en: "Each candidate is represented by one verification-script agent account, not by a child smart contract.",
    zh: "每个 candidate 都由一个 verification-script agent 账户表示，而不是一个子智能合约。",
  },
  step3: {
    en: "Admin updates candidate routing and vote sync only; user withdrawals and GAS claims require user witness.",
    zh: "管理员只能更新候选人路由并同步投票；用户赎回和 GAS 领取都需要用户签名。",
  },
  step4: {
    en: "Claimed GAS flows back into reward accounting and is distributed pro rata to stakers.",
    zh: "领取的 GAS 回流到奖励记账体系，再按比例分给质押者。",
  },
  adminControlTitle: { en: "Admin Controls", zh: "管理员控制边界" },
  adminControl1: {
    en: "Only AA agent registration, candidate updates, and vote sync change governance exposure.",
    zh: "只有 AA agent 注册、候选人更新和投票同步会改变治理敞口。",
  },
  adminControl2: {
    en: "Reward GAS claims require the user's witness and transfer only to that same user.",
    zh: "奖励 GAS 领取需要用户签名，并且只能转给该用户本人。",
  },
  adminControl3: {
    en: "No per-candidate child contract is deployed or managed in this model.",
    zh: "这个模型里不会再部署和管理每候选人一个子合约。",
  },
  routingTabTitle: { en: "Verification-Script Agent Accounts", zh: "Verification Script Agent 账户" },
  routingTabSubtitle: {
    en: "AA agent accounts provide vote identities. Candidate exposure changes through explicit vote sync, not through admin custody of user funds.",
    zh: "AA agent 账户提供投票身份。候选人敞口通过明确的投票同步变化，而不是通过管理员托管用户资金变化。",
  },
  agentLabel: { en: "Agent", zh: "Agent" },
  agentRole: { en: "Role", zh: "角色" },
  agentTarget: { en: "Candidate Target", zh: "候选人目标" },
  agentFundingPath: { en: "Funding Path", zh: "资金路径" },
  agentAccount: { en: "Agent Account", zh: "Agent 账户" },
  agentVerificationScript: { en: "Verification Script", zh: "Verification Script" },
  deploymentPendingTitle: { en: "Shared contract deployment pending", zh: "共享合约待部署" },
  deploymentPendingDesc: {
    en: "TrustAnchor now targets the shared PlatformAnchor contract. Until a network deployment hash is configured, stake / unstake / claim stay disabled in production flows.",
    zh: "TrustAnchor 现在面向共享 PlatformAnchor 合约。在网络部署哈希配置完成前，生产流程中的质押 / 解押 / 领取保持禁用。",
  },
  tabOverview: { en: "Overview", zh: "概览" },
  tabRouting: { en: "Routing", zh: "路由" },
  tabArchitecture: { en: "Architecture", zh: "架构" },
  liveAccountingTitle: { en: "Live Accounting Surface", zh: "实时记账面" },
  docsSubtitle: { en: "Verification-script routing for zero-fee Neo staking", zh: "零费率 Neo 质押的 verification-script 路由模型" },
  docDescription: { en: "AA agent voting with user-owned stake and rewards", zh: "AA agent 投票，用户拥有质押和奖励" },
  feature1Name: { en: "User-Credited Stake", zh: "用户记账质押" },
  feature1Desc: {
    en: "Fresh deposits are credited to the user first; voting routes are admin-managed separately.",
    zh: "新流入先记入用户余额；投票路由由管理员单独管理。",
  },
  feature2Name: { en: "Agent Accounts", zh: "Agent 账户" },
  feature2Desc: {
    en: "Routing uses verification-script agent accounts instead of per-candidate child contracts.",
    zh: "路由使用 verification-script agent 账户，而不是每个候选人一个子合约。",
  },
  feature3Name: { en: "Transfer-Based Rebalance", zh: "基于转账的调仓" },
  feature3Desc: {
    en: "Admin manages vote routing only; user stake and reward GAS remain outside admin custody.",
    zh: "管理员只能管理投票路由；用户质押和奖励 GAS 不进入管理员托管。",
  },
  philosophy: { en: "Philosophy", zh: "理念" },
  philosophyText: {
    en: "TrustAnchor exists to make stake routing explicit. No hidden weight knobs, no per-candidate child contracts, and no fee skim. Every change in voting exposure is an explicit agent or candidate vote update, never an admin withdrawal path.",
    zh: "TrustAnchor 的目标是把质押路由显式化。不使用隐藏权重开关，不使用每候选人一个子合约，也不抽手续费。每一次投票敞口变化都是明确的 agent 或候选人投票更新，而不是管理员提现路径。",
  },
  invalidAmount: { en: "NEO is indivisible — enter a whole number", zh: "NEO 不可分割 — 请输入整数" },
  tokenNeo: { en: "NEO", zh: "NEO" },
} as const;

export const messages = mergeMessages(appMessages);
