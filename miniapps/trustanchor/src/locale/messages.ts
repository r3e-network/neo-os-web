export const messages = {
  title: { en: "TrustAnchor", zh: "TrustAnchor" },
  subtitle: { en: "Reputation-Based Voting Delegation", zh: "基于声誉的投票委托" },
  description: { en: "Vote for candidates with proven reputation and active contribution. Zero fees, 100% of GAS rewards to stakers.", zh: "投票给有良好声誉和积极贡献的候选人。零手续费，100% 的 GAS 奖励归质押者所有。" },

  mission: { en: "Our Mission", zh: "我们的使命" },
  missionText: { en: "Amplify voices of active contributors. Vote for reputation, not profit.", zh: "放大活跃贡献者的声音。为声誉投票，而非利润。" },

  stake: { en: "Stake NEO", zh: "质押 NEO" },
  unstake: { en: "Unstake NEO", zh: "解除质押" },
  delegate: { en: "Delegate", zh: "委托" },
  claim: { en: "Claim GAS", zh: "领取 GAS" },

  myStake: { en: "My Stake", zh: "我的质押" },
  totalStaked: { en: "Total Staked", zh: "总质押量" },
  pendingRewards: { en: "Pending Rewards", zh: "待领取奖励" },
  totalRewards: { en: "Total Rewards", zh: "总奖励" },

  agents: { en: "Candidates", zh: "候选人" },
  delegates: { en: "My Delegates", zh: "我的委托" },
  performance: { en: "Reputation", zh: "声誉" },
  votes: { en: "Votes", zh: "投票数" },
  contribution: { en: "Contribution", zh: "贡献度" },

  noStake: { en: "No NEO staked", zh: "暂无质押" },
  stakeDesc: { en: "Stake NEO to participate in governance", zh: "质押 NEO 参与治理" },

  agentRanking: { en: "Candidate Ranking", zh: "候选人排名" },
  topAgents: { en: "Top Reputation Candidates", zh: "声誉最佳的候选人" },
  amount: { en: "Amount", zh: "数量" },

  zeroFee: { en: "0% Fees", zh: "0% 手续费" },
  zeroFeeDesc: { en: "100% of GAS rewards go to stakers", zh: "100% 的 GAS 奖励归质押者所有" },

  voteForReputation: { en: "Vote for Reputation", zh: "为声誉投票" },
  voteForReputationDesc: { en: "Support candidates with proven track records", zh: "支持有良好记录的候选人" },
  notForProfit: { en: "Not for Profit", zh: "非营利" },
  notForProfitDesc: { en: "Zero fee model. GAS rewards are a byproduct, not the goal.", zh: "零手续费模式。GAS 奖励是副产品，而非目标。" },

  howItWorks: { en: "How It Works", zh: "工作原理" },
  step1: { en: "Stake your NEO in TrustAnchor", zh: "在 TrustAnchor 中质押您的 NEO" },
  step2: { en: "Vote for candidates with active contribution and good reputation", zh: "投票给有积极贡献和良好声誉的候选人" },
  step3: { en: "Help secure Neo N3 network by voting for quality candidates", zh: "通过投票给优质候选人帮助保障 Neo N3 网络" },
  step4: { en: "Earn GAS rewards as a byproduct of participation", zh: "作为参与的副产品赚取 GAS 奖励" },

  warningTitle: { en: "Wrong Network", zh: "网络错误" },
  warningMessage: { en: "TrustAnchor requires Neo N3 network.", zh: "TrustAnchor 需要 Neo N3 网络。" },
  switchButton: { en: "Switch to Neo", zh: "切换到 Neo" },
  wrongChain: { en: "Wrong Network", zh: "网络错误" },
  wrongChainMessage: { en: "This app requires Neo N3 network.", zh: "此应用需 Neo N3 网络。" },
  switchToNeo: { en: "Switch to Neo N3", zh: "切换到 Neo N3" },

  error: { en: "Operation failed", zh: "操作失败" },
  success: { en: "Success", zh: "成功" },

  tabOverview: { en: "Overview", zh: "概览" },
  tabAgents: { en: "Candidates", zh: "候选人" },
  tabHistory: { en: "About", zh: "关于" },

  statsTitle: { en: "Statistics", zh: "统计" },
  aprLabel: { en: "Est. Yield", zh: "预估收益" },
  delegatorsLabel: { en: "Total Stakers", zh: "总质押人数" },
  votePowerLabel: { en: "Total Vote Power", zh: "总投票权" },

  connectWallet: { en: "Connect Wallet", zh: "连接钱包" },
  disconnected: { en: "Disconnected", zh: "已断开" },

  loading: { en: "Loading...", zh: "加载中..." },
  refresh: { en: "Refresh", zh: "刷新" },

  philosophy: { en: "Philosophy", zh: "理念" },
  philosophyText: { en: "TrustAnchor exists to promote quality governance. GAS rewards are a natural incentive, but our true purpose is ensuring Neo N3 is governed by active, reputable contributors.", zh: "TrustAnchor 的存在是为了促进优质治理。GAS 奖励是自然激励，但我们真正的目的是确保 Neo N3 由活跃、有声誉的贡献者治理。" },
} as const;

export type Messages = typeof messages;
