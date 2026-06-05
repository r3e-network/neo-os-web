import { mergeMessages } from "@shared/locale/base-messages";

const appMessages = {
  // App translations
  title: { en: "Gov Merc", zh: "治理雇佣兵" },
  subtitle: { en: "Bid for governance influence", zh: "竞价治理影响力" },
  govHeroTitle: { en: "Governance Influence Market", zh: "治理影响力市场" },
  govHeroSubtitle: {
    en: "Pool NEO voting weight, compete with GAS bids, and route each epoch through a transparent market workflow.",
    zh: "汇聚 NEO 投票权、用 GAS 竞价，并通过透明市场流程分配每个周期的治理影响力。",
  },
  marketSignalTitle: { en: "Neo N3 governance desk", zh: "Neo N3 治理台" },
  marketReady: { en: "Ready", zh: "就绪" },
  walletStatusIdle: { en: "Wallet not connected", zh: "钱包未连接" },
  rent: { en: "Pool", zh: "池子" },
  market: { en: "Bids", zh: "竞价" },
  poolStats: { en: "Pool Stats", zh: "池子统计" },
  totalPool: { en: "Total Pool", zh: "总池子" },
  currentEpoch: { en: "Current Epoch", zh: "当前周期" },
  yourDeposits: { en: "Your Deposits", zh: "你的存入" },
  depositNeo: { en: "Deposit NEO", zh: "存入 NEO" },
  withdrawNeo: { en: "Withdraw NEO", zh: "提取 NEO" },
  depositAmount: { en: "Deposit amount", zh: "存入金额" },
  withdrawAmount: { en: "Withdraw amount", zh: "提取金额" },
  placeBid: { en: "Place Bid", zh: "提交竞价" },
  bidAmount: { en: "Bid amount", zh: "竞价金额" },
  actionDepositHint: {
    en: "Add NEO voting power to the shared pool for future epochs.",
    zh: "向共享池增加 NEO 投票权，用于后续周期。",
  },
  actionWithdrawHint: {
    en: "Release unused pool deposits when you no longer want exposure.",
    zh: "不再参与时，可释放未使用的池内存款。",
  },
  actionBidHint: {
    en: "Commit GAS to compete for the right to steer the epoch.",
    zh: "投入 GAS 竞价，争取本周期的治理指向权。",
  },
  bidLeaderboard: { en: "Bid Leaderboard", zh: "竞价榜" },
  noBids: { en: "No bids yet", zh: "暂无竞价" },
  emptyBidTitle: { en: "No active bids yet", zh: "暂无活跃竞价" },
  emptyBidCopy: {
    en: "The first valid GAS bid becomes the market signal for this epoch.",
    zh: "第一笔有效 GAS 竞价会成为本周期的市场信号。",
  },
  flowTitle: { en: "Epoch flow", zh: "周期流程" },
  flowDeposit: { en: "Pool voting weight", zh: "汇聚投票权" },
  flowDepositCopy: {
    en: "Depositors contribute NEO influence while their position remains tracked.",
    zh: "存入者贡献 NEO 影响力，同时保留可追踪仓位。",
  },
  flowBid: { en: "Run GAS auction", zh: "运行 GAS 竞价" },
  flowBidCopy: {
    en: "Bidders compete for the active epoch with transparent amounts.",
    zh: "竞价者用透明金额争夺当前周期。",
  },
  flowInfluence: { en: "Route governance", zh: "路由治理权" },
  flowInfluenceCopy: {
    en: "Winning bid directs the pooled influence for that epoch.",
    zh: "获胜竞价决定该周期池子的治理指向。",
  },
  riskNoteTitle: { en: "Operator readiness", zh: "操作就绪度" },
  riskNoteCopy: {
    en: "Staking, bids, and settlement run directly against the on-chain MiniAppGovMerc contract. Review the epoch and amount before submitting.",
    zh: "质押、竞价与结算均直接调用链上 MiniAppGovMerc 合约。提交前请确认周期和金额。",
  },
  settlementWindow: { en: "Settlement window", zh: "结算窗口" },
  epochSettlement: { en: "Per epoch", zh: "按周期" },
  executionPath: { en: "Execution path", zh: "执行路径" },
  executionPathCopy: { en: "On-chain contract", zh: "链上合约" },
  tabStats: { en: "Stats", zh: "统计" },
  depositSuccess: { en: "Deposit submitted", zh: "存入已提交" },
  withdrawSuccess: { en: "Withdrawal submitted", zh: "提取已提交" },
  bidSuccess: { en: "Bid submitted", zh: "竞价已提交" },
  enterAmount: { en: "Enter an amount", zh: "请输入金额" },
  bidRefunded: {
    en: "Bid failed — your GAS was refunded",
    zh: "竞价失败 —— 你的 GAS 已退回",
  },
  bidRecoverable: {
    en: "Bid failed and the automatic refund did not complete. Your GAS is safe in your payment balance and can be withdrawn.",
    zh: "竞价失败且自动退款未完成。你的 GAS 安全保存在支付余额中，可随时提取。",
  },
  withdrawExceeds: {
    en: "Amount exceeds your deposits",
    zh: "金额超过你的存入余额",
  },
  settleTitle: { en: "Route governance", zh: "路由治理权" },
  settleCopy: {
    en: "Settle the live epoch: the top GAS bid wins and directs the pooled NEO influence, then the epoch advances.",
    zh: "结算当前周期：最高 GAS 竞价获胜并指向汇聚的 NEO 影响力，随后周期推进。",
  },
  settleLastLabel: { en: "Last settled", zh: "上次结算" },
  settleNone: { en: "No epoch settled yet", zh: "尚未结算任何周期" },
  settleSummary: {
    en: "Epoch {epoch}: {winner} won with {amount}",
    zh: "周期 {epoch}：{winner} 以 {amount} 获胜",
  },
  settleNoBids: {
    en: "No bids to settle for this epoch",
    zh: "本周期没有可结算的竞价",
  },
  settleNoBidsHint: {
    en: "Place at least one GAS bid before routing governance for this epoch.",
    zh: "在路由本周期治理权之前，请至少提交一笔 GAS 竞价。",
  },
  settleSuccess: {
    en: "Epoch settled — governance routed",
    zh: "周期已结算 —— 治理权已路由",
  },
  loadFailed: { en: "Failed to load data", zh: "加载数据失败" },
  error: { en: "Error", zh: "错误" },

  // ── Chain wiring: validation + missing-contract + bid lifecycle ──────────
  enterNeoAmount: { en: "Enter a whole NEO amount", zh: "请输入整数 NEO 金额" },
  missingContract: { en: "Contract not configured", zh: "合约未配置" },
  minBid: {
    en: "First bid must be at least {amount} {tokenGas}",
    zh: "首次竞价至少为 {amount} {tokenGas}",
  },
  bidDepositHeld: {
    en: "Your GAS was deposited as reusable bid credit. Raise the bid again or withdraw the credit.",
    zh: "你的 GAS 已存为可复用的竞价额度。可再次提价或提取该额度。",
  },

  // ── Staker rewards (NEW: claim accrued GAS auction revenue) ──────────────
  rewardsTitle: { en: "Staker rewards", zh: "质押者收益" },
  rewardsCopy: {
    en: "NEO stakers earn the GAS auction revenue pro-rata. Claim your accrued share at any time.",
    zh: "NEO 质押者按比例分得 GAS 竞拍收益，可随时领取你累积的份额。",
  },
  pendingRewards: { en: "Claimable rewards", zh: "可领取收益" },
  claimRewards: { en: "Claim rewards", zh: "领取收益" },
  claimSuccess: { en: "Rewards claimed", zh: "收益已领取" },
  noRewards: { en: "No rewards to claim yet", zh: "暂无可领取的收益" },
  rewardsEmptyHint: {
    en: "Stake NEO and win an epoch's auction to start earning GAS rewards.",
    zh: "质押 NEO 并赢得某个周期的竞拍后即可开始累积 GAS 收益。",
  },

  // ── Losing-bid reclaim + unused credit (NEW) ─────────────────────────────
  reclaimTitle: { en: "Reclaim bids", zh: "取回竞价" },
  reclaimCopy: {
    en: "Lost an epoch? Pull back your losing bid from any settled epoch, and withdraw any unused bid credit.",
    zh: "未赢得某周期？可从已结算周期取回未中标的竞价，并提取未使用的竞价额度。",
  },
  reclaimBidLabel: { en: "Reclaim epoch {epoch}", zh: "取回周期 {epoch}" },
  reclaimBidAmount: { en: "{amount} {tokenGas} from epoch {epoch}", zh: "周期 {epoch} 的 {amount} {tokenGas}" },
  reclaimSuccess: { en: "Bid reclaimed", zh: "竞价已取回" },
  reclaimEmpty: { en: "No losing bids to reclaim", zh: "没有可取回的未中标竞价" },
  withdrawCredit: { en: "Withdraw unused credit", zh: "提取未用额度" },
  creditWithdrawSuccess: { en: "Bid credit withdrawn", zh: "竞价额度已提取" },
  noCredit: { en: "No unused bid credit", zh: "没有未使用的竞价额度" },
  unusedCredit: { en: "Unused bid credit", zh: "未使用的竞价额度" },

  docSubtitle: {
    en: "Governance mercenary pool with competitive bidding",
    zh: "基于竞价的治理雇佣池",
  },
  docDescription: {
    en: "Gov Merc aggregates NEO into a shared pool and runs GAS-based bids each epoch. The winning bidder directs the pooled governance influence for that epoch while deposits remain tracked on-chain.",
    zh: "Gov Merc 将 NEO 汇聚到共享池，并按周期进行 GAS 竞价。获胜者在该周期内获得池子的治理影响力，存入资金全程链上记录。",
  },
  step1: {
    en: "Connect your Neo wallet and review the current epoch.",
    zh: "连接 Neo 钱包并查看当前周期。",
  },
  step2: {
    en: "Deposit NEO to add voting power to the pool.",
    zh: "存入 NEO，为资金池提供治理投票力量。",
  },
  step3: {
    en: "Place a GAS bid to compete for epoch influence.",
    zh: "提交 GAS 竞价，争夺本周期影响力。",
  },
  step4: {
    en: "Track bids, results, and withdraw deposits when needed.",
    zh: "链上跟踪竞价结果，必要时可提取存入。",
  },
  feature1Name: { en: "Epoch Bidding", zh: "周期竞价" },
  feature1Desc: {
    en: "Competitive GAS bids determine each epoch's winner.",
    zh: "使用 GAS 竞价决定周期赢家。",
  },
  feature2Name: { en: "Shared Pool", zh: "共享池" },
  feature2Desc: {
    en: "Deposited NEO aggregates voting power on-chain.",
    zh: "存入 NEO 汇聚链上投票力量。",
  },
  feature3Name: { en: "On-chain Ledger", zh: "链上账本" },
  feature3Desc: {
    en: "Bids, deposits, and epoch status are transparent.",
    zh: "竞价、存入与周期状态全程透明。",
  },
  activeBids: { en: "Active Bids", zh: "活跃竞价" },
  tokenNeo: { en: "NEO", zh: "NEO" },
} as const;

export const messages = mergeMessages(appMessages);
