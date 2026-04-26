import { mergeMessages } from "@shared/locale/base-messages";

const appMessages = {
  appName: { en: "ProfitAnchor", zh: "ProfitAnchor" },
  title: { en: "ProfitAnchor", zh: "ProfitAnchor" },
  heroDescription: {
    en: "ProfitAnchor tracks candidate profitability and votes pooled NEO toward the highest expected GAS return. Admins can update vote routing only; user stake and accrued rewards stay outside admin custody.",
    zh: "ProfitAnchor 跟踪候选人的收益表现，并把池化 NEO 投向预期 GAS 收益最高的候选人。管理员只能更新投票路由，不能转走用户质押或已记账奖励。",
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
  defaultIngressLabel: { en: "Best Candidate", zh: "最佳候选人" },
  defaultIngressShort: { en: "Best", zh: "最佳" },
  ingressCount: { en: "Profit Routes", zh: "收益路由" },
  rebalanceShort: { en: "Optimize", zh: "优化" },
  noAgentContractsLabel: { en: "Agent Contracts", zh: "Agent 合约数" },
  zeroFee: { en: "0% Fees", zh: "0% 手续费" },
  zeroFeeDesc: { en: "100% of GAS rewards go to stakers", zh: "100% 的 GAS 奖励归质押者所有" },
  verificationAccountsTitle: { en: "Verification Accounts", zh: "Verification Script 账户" },
  verificationAccountsDesc: {
    en: "AA-generated agent accounts represent candidate routes. ProfitAnchor selects the best route by expected GAS per NEO.",
    zh: "AA 生成的 agent 账户代表不同候选人路由。ProfitAnchor 按每 NEO 预期 GAS 收益选择最佳路由。",
  },
  verificationScriptTitle: { en: "No Agent Contracts", zh: "不再使用 Agent 合约" },
  verificationScriptDesc: {
    en: "Each numbered agent path uses a verification-script agent account model, not a child contract account.",
    zh: "每条编号化 agent 路径都使用 verification-script agent 账户模型，而不是子合约账户。",
  },
  routingSummaryTitle: { en: "Routing Summary", zh: "路由摘要" },
  routingSummaryDesc: {
    en: "ProfitAnchor exposes the current best-profit candidate and the AA agent accounts available for vote execution. SelfLoan can use this same signal for collateral voting.",
    zh: "ProfitAnchor 展示当前最高收益候选人以及可执行投票的 AA agent 账户。SelfLoan 可复用该信号为抵押 NEO 投票。",
  },
  rebalanceTitle: { en: "Highest-Profit Vote", zh: "最高收益投票" },
  rebalanceDesc: {
    en: "ProfitAnchor only syncs votes to the highest recorded profit score. Admins can update scores and trigger votes, not transfer user NEO or claimed GAS.",
    zh: "ProfitAnchor 只会同步到记录中收益分最高的候选人。管理员可以更新收益分并触发投票，不能转移用户 NEO 或已领取 GAS。",
  },
  rebalanceMetricDesc: {
    en: "Admin updates profit scores and triggers vote-only sync; no user withdrawal path exists.",
    zh: "管理员更新收益分并触发仅投票同步；不存在用户资金提现路径。",
  },
  howItWorks: { en: "How It Works", zh: "工作原理" },
  step1: {
    en: "User stake enters the pool and remains user-withdrawable through the contract accounting surface.",
    zh: "用户质押进入池子，并通过合约记账面保持用户可赎回。",
  },
  step2: {
    en: "Each candidate is represented by one verification-script agent account, not by a child smart contract.",
    zh: "每个 candidate 都由一个 verification-script agent 账户表示，而不是一个子智能合约。",
  },
  step3: {
    en: "Admin records current candidate profit scores; ProfitAnchor exposes the best candidate for vote sync.",
    zh: "管理员记录当前候选人收益分；ProfitAnchor 对外暴露最佳候选人用于投票同步。",
  },
  step4: {
    en: "Claimed GAS flows back into reward accounting and is distributed pro rata to stakers.",
    zh: "领取的 GAS 回流到奖励记账体系，再按比例分给质押者。",
  },
  adminControlTitle: { en: "Admin Controls", zh: "管理员控制边界" },
  adminControl1: {
    en: "Admin can register AA agent accounts, update candidate profit scores, and trigger vote-only sync.",
    zh: "管理员可以注册 AA agent 账户、更新候选人收益分，并触发仅限投票的同步。",
  },
  adminControl2: {
    en: "No admin method sends user-staked NEO or reward GAS to arbitrary recipients.",
    zh: "不存在可由管理员把用户质押 NEO 或奖励 GAS 转给任意收款人的方法。",
  },
  adminControl3: {
    en: "No per-candidate child contract is deployed or managed in this model.",
    zh: "这个模型里不会再部署和管理每候选人一个子合约。",
  },
  routingTabTitle: { en: "Verification-Script Agent Accounts", zh: "Verification Script Agent 账户" },
  routingTabSubtitle: {
    en: "AA agent accounts provide vote identities; ProfitAnchor chooses the highest expected GAS return for staked NEO.",
    zh: "AA agent 账户提供投票身份；ProfitAnchor 为质押 NEO 选择预期 GAS 收益最高的候选人。",
  },
  agentLabel: { en: "Agent", zh: "Agent" },
  agentRole: { en: "Role", zh: "角色" },
  agentTarget: { en: "Candidate Target", zh: "候选人目标" },
  agentFundingPath: { en: "Funding Path", zh: "资金路径" },
  agentAccount: { en: "Agent Account", zh: "Agent 账户" },
  agentVerificationScript: { en: "Verification Script", zh: "Verification Script" },
  deploymentPendingTitle: { en: "Contract deployment pending", zh: "合约待部署" },
  deploymentPendingDesc: {
    en: "ProfitAnchor uses the shared PlatformAnchor contract. Until a network deployment is configured, stake / unstake / claim stay disabled in production flows.",
    zh: "ProfitAnchor 使用共享 PlatformAnchor 合约。在网络部署完成配置前，生产流程中的质押 / 解押 / 领取保持禁用。",
  },
  tabOverview: { en: "Overview", zh: "概览" },
  tabRouting: { en: "Routing", zh: "路由" },
  tabArchitecture: { en: "Architecture", zh: "架构" },
  liveAccountingTitle: { en: "Live Accounting Surface", zh: "实时记账面" },
  docsSubtitle: { en: "Profit-optimized Neo voting with AA agent accounts", zh: "基于 AA agent 账户的收益优化 Neo 投票" },
  docDescription: { en: "Highest-profit NEO voting with user-owned stake and rewards", zh: "最高收益 NEO 投票，用户拥有质押和奖励" },
  feature1Name: { en: "Best-Profit Routing", zh: "最佳收益路由" },
  feature1Desc: {
    en: "Voting follows the highest recorded expected GAS return per NEO.",
    zh: "投票跟随记录中每 NEO 预期 GAS 收益最高的候选人。",
  },
  feature2Name: { en: "Agent Accounts", zh: "Agent 账户" },
  feature2Desc: {
    en: "Routing uses verification-script agent accounts instead of per-candidate child contracts.",
    zh: "路由使用 verification-script agent 账户，而不是每个候选人一个子合约。",
  },
  feature3Name: { en: "SelfLoan Signal", zh: "SelfLoan 信号" },
  feature3Desc: {
    en: "SelfLoan can use ProfitAnchor's best candidate to vote collateralized NEO without transferring collateral custody.",
    zh: "SelfLoan 可使用 ProfitAnchor 的最佳候选人为抵押 NEO 投票，同时不转移抵押资产托管权。",
  },
  philosophy: { en: "Philosophy", zh: "理念" },
  philosophyText: {
    en: "ProfitAnchor is intentionally narrow: it optimizes NEO voting for GAS yield while preserving user withdrawal and reward boundaries. Admin control exists for candidate scoring and vote execution only.",
    zh: "ProfitAnchor 故意保持边界很窄：它只为 GAS 收益优化 NEO 投票，同时保留用户赎回和奖励边界。管理员权限只用于候选人打分和投票执行。",
  },
  invalidAmount: { en: "NEO is indivisible — enter a whole number", zh: "NEO 不可分割 — 请输入整数" },
  tokenNeo: { en: "NEO", zh: "NEO" },
} as const;

export const messages = mergeMessages(appMessages);
