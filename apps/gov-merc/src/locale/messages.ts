import { mergeMessages } from "@shared/locale/base-messages";

const appMessages = {
  // App translations
  title: { en: "Gov Merc", zh: "治理雇佣兵" },
  subtitle: { en: "Stake NEO for yield, bid GAS for the title", zh: "质押 NEO 赚收益，竞价 GAS 抢称号" },
  govHeroTitle: { en: "Governance Influence Auction", zh: "治理影响力竞拍" },
  govHeroSubtitle: {
    en: "Stake NEO to earn each epoch's winning GAS bid pro-rata; bid GAS to win the epoch's influence title.",
    zh: "质押 NEO，按比例分得每个周期的获胜 GAS 竞价；竞价 GAS，赢得本周期的影响力称号。",
  },
  marketSignalTitle: { en: "Neo N3 governance desk", zh: "Neo N3 治理台" },
  marketReady: { en: "Ready", zh: "就绪" },
  valueUnavailable: { en: "Unavailable", zh: "暂不可用" },
  dataUnavailableShort: { en: "Data unavailable", zh: "数据不可用" },
  // Honest zero-states. A visitor who has just opened the desk has no wallet and
  // no chain reads yet — the expected first paint, not a failure. Each of these
  // names the next step; none of them reads as an error.
  valueAwaitingNetwork: { en: "Awaiting network", zh: "等待网络" },
  valueConnectWallet: { en: "Connect wallet", zh: "连接钱包" },
  epochAwaitNetworkShort: { en: "Epoch pending", zh: "轮次待加载" },
  epochOpensOnNetwork: {
    en: "The epoch window opens once the desk reaches the network.",
    zh: "接入网络后即显示本轮竞价窗口。",
  },
  marketPlateNoBidYet: {
    en: "No bid has opened this epoch yet — the first bid starts the window.",
    zh: "本轮尚无出价——首次出价将开启竞价窗口。",
  },
  walletStatusIdle: { en: "Wallet not connected", zh: "钱包未连接" },
  marketArtAlt: {
    en: "Bright civic auction chamber with NEO and GAS lanes meeting at the settlement desk",
    zh: "明亮的治理竞拍大厅，NEO 与 GAS 通道汇聚到中央结算台",
  },
  yourNextMove: { en: "Your next move", zh: "你的下一步" },
  chooseRole: { en: "Choose how to participate", zh: "选择参与方式" },
  bidRole: { en: "Bid GAS", zh: "竞价 GAS" },
  stakeRole: { en: "Stake NEO", zh: "质押 NEO" },
  amountPlaceholderGas: { en: "Amount in GAS", zh: "输入 GAS 金额" },
  amountPlaceholderNeo: { en: "Whole NEO only", zh: "仅支持整数 NEO" },
  suggestedAmounts: { en: "Suggested amounts", zh: "推荐金额" },
  actionBidCompact: {
    en: "First bid is at least {min} GAS. Existing credit is used before any new payment.",
    zh: "首次竞价至少 {min} GAS；会先使用已有额度，再决定是否需要新付款。",
  },
  actionStakeCompact: {
    en: "NEO is indivisible. Enter a positive whole amount.",
    zh: "NEO 不可分割，请输入正整数金额。",
  },
  // ── Civic framing: what winning the title actually grants (hero lede) ──────
  govHeroGrant: {
    en: "Winning records you as this epoch's influence holder on-chain — a public signal of support, not an executed vote. Your staked NEO stays yours and earns the GAS bid; it is never delegated or voted by the contract.",
    zh: "获胜将把你记录为本周期的影响力持有者（链上公示）——这是一种公开的支持信号，而非已执行的投票。你质押的 NEO 始终归你所有并赚取 GAS 竞价收益，合约绝不会代为委托或投票。",
  },
  // ── Wallet-connect onboarding (shown when no wallet is linked) ─────────────
  connectTitle: { en: "Connect your Neo wallet to take part", zh: "连接 Neo 钱包以参与" },
  connectCopy: {
    en: "Link a wallet to stake NEO for a reward share or bid GAS for the epoch's influence title. The first action you take will prompt your wallet to connect.",
    zh: "连接钱包即可质押 NEO 分享收益，或竞价 GAS 争夺本周期的影响力称号。你的首个操作将提示钱包进行连接。",
  },
  connectAction: { en: "Connect wallet", zh: "连接钱包" },
  connectCompactCopy: {
    en: "Connect once, then the desk verifies the wallet network and contract before every write.",
    zh: "连接后，每次写入前都会重新核验钱包网络与目标合约。",
  },
  // ── Token legend (disambiguate NEO stake vs GAS bid at point of action) ────
  tokenLegendTitle: { en: "Two tokens, two roles", zh: "两种代币，两种用途" },
  tokenLegendNeo: { en: "NEO — stake for a reward share", zh: "NEO —— 质押以分享收益" },
  tokenLegendGas: { en: "GAS — bid for the influence title", zh: "GAS —— 竞价以争夺影响力称号" },
  tokenTagStake: { en: "Staked in NEO", zh: "以 NEO 质押" },
  tokenTagBid: { en: "Paid in GAS", zh: "以 GAS 支付" },
  marketPlateLabel: { en: "Live influence round", zh: "实时影响力周期" },
  marketPlateEpoch: { en: "Epoch #{epoch}", zh: "周期 #{epoch}" },
  marketPlateTopBid: { en: "Top bid: {amount} {tokenGas}", zh: "最高竞价：{amount} {tokenGas}" },
  marketRouting: { en: "Routing transaction", zh: "交易路由中" },
  connectingWallet: { en: "Connecting wallet...", zh: "钱包连接中..." },
  stakingNeo: { en: "Staking NEO...", zh: "NEO 质押中..." },
  unstakingNeo: { en: "Unstaking NEO...", zh: "NEO 取消质押中..." },
  placingBid: { en: "Routing GAS bid...", zh: "GAS 竞价路由中..." },
  settlingEpoch: { en: "Settling epoch...", zh: "周期结算中..." },
  earnLaneTitle: { en: "Earn with NEO", zh: "用 NEO 赚收益" },
  earnLaneCopy: {
    en: "Stake once, then receive your share whenever an epoch settles.",
    zh: "质押一次，之后每次周期结算即可按份额获得收益。",
  },
  bidLaneTitle: { en: "Compete with GAS", zh: "用 GAS 竞价" },
  bidLaneCopy: {
    en: "Bid for the influence title. The winner funds the staker rewards.",
    zh: "竞价争夺影响力称号；获胜者的出价会分给质押者。",
  },
  stakedBalanceLabel: { en: "Your staked balance", zh: "你的质押余额" },
  withdrawDrawerTitle: { en: "Unstake or adjust NEO", zh: "取消或调整 NEO 质押" },
  minBidLabel: { en: "Minimum first bid", zh: "首次最低竞价" },
  rent: { en: "Pool", zh: "池子" },
  market: { en: "Bids", zh: "竞价" },
  poolStats: { en: "Pool Stats", zh: "池子统计" },
  actionsTitle: { en: "Your actions", zh: "你的操作" },
  totalPool: { en: "Total Pool", zh: "总池子" },
  currentEpoch: { en: "Current Epoch", zh: "当前周期" },
  yourDeposits: { en: "Your Deposits", zh: "你的存入" },
  depositNeo: { en: "Stake NEO", zh: "质押 NEO" },
  withdrawNeo: { en: "Unstake NEO", zh: "取消质押 NEO" },
  depositAmount: { en: "Stake amount", zh: "质押金额" },
  withdrawAmount: { en: "Unstake amount", zh: "取消质押金额" },
  placeBid: { en: "Place Bid", zh: "提交竞价" },
  bidAmount: { en: "Bid amount", zh: "竞价金额" },
  actionDepositHint: {
    en: "Stake NEO to weight your share of the auction yield. NEO stakers split every epoch's winning GAS bid pro-rata.",
    zh: "质押 NEO 以决定你分得竞拍收益的份额。NEO 质押者按比例分享每个周期的获胜 GAS 竞价。",
  },
  actionWithdrawHint: {
    en: "Release staked NEO when you no longer want a reward share.",
    zh: "不再需要收益份额时，可取出已质押的 NEO。",
  },
  actionBidHint: {
    en: "Commit GAS to compete for this epoch's influence title. Minimum first bid: {min} {tokenGas}.",
    zh: "投入 GAS 竞争本周期的影响力称号。首次竞价至少 {min} {tokenGas}。",
  },
  bidLeaderboard: { en: "Bid Leaderboard", zh: "竞价榜" },
  noBids: { en: "No bids yet", zh: "暂无竞价" },
  emptyBidTitle: { en: "No active bids yet", zh: "暂无活跃竞价" },
  emptyBidCopy: {
    en: "The first valid GAS bid becomes the market signal for this epoch.",
    zh: "第一笔有效 GAS 竞价会成为本周期的市场信号。",
  },
  flowTitle: { en: "Epoch flow", zh: "周期流程" },
  flowDeposit: { en: "Stake NEO for yield", zh: "质押 NEO 赚收益" },
  flowDepositCopy: {
    en: "Stakers lock NEO to weight their pro-rata share of the auction revenue.",
    zh: "质押者锁定 NEO，按比例决定其分得竞拍收益的份额。",
  },
  flowBid: { en: "Run GAS auction", zh: "运行 GAS 竞价" },
  flowBidCopy: {
    en: "Mercenaries bid GAS to compete for the active epoch's influence title.",
    zh: "雇佣兵竞价 GAS，争夺当前周期的影响力称号。",
  },
  flowInfluence: { en: "Settle & pay stakers", zh: "结算并分配给质押者" },
  flowInfluenceCopy: {
    en: "Settlement records the top bidder as the epoch winner and pays their GAS bid to stakers pro-rata.",
    zh: "结算将最高出价者记录为该周期获胜者，并将其 GAS 竞价按比例分配给质押者。",
  },
  influenceUseTitle: { en: "How influence is used", zh: "影响力如何使用" },
  influenceUseCopy: {
    en: "Settlement records the winning bidder as the epoch's influence holder on-chain and pays their bid to stakers. The staked NEO is not delegated or voted by the contract — any vote execution happens off-contract.",
    zh: "结算在链上记录获胜者为该周期的影响力持有者，并将其竞价支付给质押者。质押的 NEO 不会被合约委托或投票——任何投票执行均在合约外进行。",
  },
  riskNoteTitle: { en: "Operator readiness", zh: "操作就绪度" },
  riskNoteToggle: { en: "Contract & settlement details", zh: "合约与结算详情" },
  riskNoteCopy: {
    en: "Staking, bids, and settlement run directly against the on-chain MiniAppGovMerc contract. Review the epoch and amount before submitting.",
    zh: "质押、竞价与结算均直接调用链上 MiniAppGovMerc 合约。提交前请确认周期和金额。",
  },
  settlementWindow: { en: "Settlement window", zh: "结算窗口" },
  epochSettlement: { en: "Per epoch", zh: "按周期" },
  executionPath: { en: "Execution path", zh: "执行路径" },
  executionPathCopy: { en: "On-chain contract", zh: "链上合约" },
  tabStats: { en: "Stats", zh: "统计" },
  depositSuccess: { en: "Stake confirmed on-chain", zh: "质押已在链上确认" },
  withdrawSuccess: { en: "Unstake confirmed on-chain", zh: "取消质押已在链上确认" },
  bidSuccess: { en: "Bid confirmed on-chain", zh: "竞价已在链上确认" },
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
  settleTitle: { en: "Settle epoch", zh: "结算周期" },
  settleAction: { en: "Settle epoch", zh: "结算周期" },
  settleCopy: {
    en: "Settle the live epoch: the top GAS bidder is recorded as the epoch winner, their bid is paid to NEO stakers pro-rata, then the epoch advances.",
    zh: "结算当前周期：最高 GAS 出价者被记录为该周期获胜者，其竞价按比例分配给 NEO 质押者，随后周期推进。",
  },
  currentTopBid: { en: "Current top bid", zh: "当前最高竞价" },
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
  settleReadyTitle: { en: "The auction is ready to settle", zh: "竞拍已可结算" },
  settleSuccess: {
    en: "Epoch settled — winning bid paid to stakers",
    zh: "周期已结算 —— 获胜竞价已分配给质押者",
  },

  // ── v2 bidding window (first bid opens a fixed window; settle after it) ──
  bidWindowTitle: { en: "Bidding window", zh: "竞价窗口" },
  bidWindowUnopened: {
    en: "First bid opens a {minutes}-minute window",
    zh: "首笔竞价将开启 {minutes} 分钟竞价窗口",
  },
  bidWindowCountdown: { en: "Closes in {time}", zh: "{time} 后截止" },
  bidWindowClosed: {
    en: "Bidding closed — ready to settle",
    zh: "竞价已截止 —— 可以结算",
  },
  biddingClosed: {
    en: "Bidding for this epoch has closed",
    zh: "本周期竞价已截止",
  },
  biddingClosedHint: {
    en: "Bidding for this epoch has closed — settle to start the next one.",
    zh: "本周期竞价已截止 —— 结算后将开启下一周期。",
  },
  biddingClosedCreditHeld: {
    en: "Bidding closed before your bid landed. Your GAS is held as reusable bid credit — withdraw it or bid in the next epoch.",
    zh: "竞价在你的出价生效前已截止。你的 GAS 已保存为可复用的竞价额度 —— 可提取或在下一周期使用。",
  },
  epochNotEnded: {
    en: "The bidding window is still open — settle after the deadline",
    zh: "竞价窗口尚未结束 —— 截止后才能结算",
  },
  settleAfterDeadlineHint: {
    en: "Settlement unlocks when the bidding window ends.",
    zh: "竞价窗口结束后才能结算。",
  },
  loadFailed: { en: "Failed to load data", zh: "加载数据失败" },
  error: { en: "Error", zh: "错误" },

  // ── Exact write binding + durable recovery ─────────────────────────────
  recoveryStorageUnavailable: {
    en: "Reliable recovery storage is unavailable; wallet writes stay disabled.",
    zh: "可靠的交易恢复存储不可用；钱包写入已禁用。",
  },
  transactionAlreadyPending: {
    en: "Check the saved transaction before opening another wallet request.",
    zh: "请先检查已保存的交易，再发起新的钱包请求。",
  },
  walletAddressInvalid: { en: "The connected Neo wallet address is invalid.", zh: "已连接的 Neo 钱包地址无效。" },
  walletNetworkUnknown: { en: "The wallet network could not be verified.", zh: "无法核验钱包网络。" },
  walletNetworkMismatch: { en: "Switch the wallet to this app's Neo N3 network.", zh: "请将钱包切换到本应用的 Neo N3 网络。" },
  contractBindingMismatch: { en: "The configured Gov Merc contract does not match this network.", zh: "当前 Gov Merc 合约与所选网络不匹配。" },
  transactionNotBroadcast: { en: "The wallet did not return a valid transaction ID.", zh: "钱包未返回有效交易 ID。" },
  transactionIdentityChanged: { en: "The transaction ID changed; the saved ID remains locked for checking.", zh: "交易 ID 发生变化；已保存的 ID 将继续锁定等待检查。" },
  transactionBindingChanged: { en: "Wallet or network changed after broadcast; check the saved transaction.", zh: "广播后钱包或网络发生变化；请检查已保存交易。" },
  transactionFaulted: { en: "The saved transaction faulted on-chain and was cleared.", zh: "已保存交易在链上执行失败，记录已清除。" },
  transactionPendingConfirmation: { en: "Transaction saved; confirmation or readback is still pending.", zh: "交易已保存；仍在等待确认或精确回读。" },
  transactionPending: { en: "Transaction awaiting confirmation", zh: "交易等待确认" },
  transactionPendingCopy: { en: "Saved as {txid}. Checking never resubmits or signs it.", zh: "已保存为 {txid}；检查不会重复提交或签名。" },
  checkingTransaction: { en: "Checking transaction...", zh: "正在检查交易…" },
  checkTransaction: { en: "Check saved transaction", zh: "检查已保存交易" },
  recoveryDoesNotResubmit: { en: "Read-only check. No wallet prompt and no duplicate payment.", zh: "只读检查，不会唤起钱包，也不会重复付款。" },
  creditHeldReady: { en: "Bid funding is confirmed as reusable credit. Submit the bid when ready; no duplicate payment is needed.", zh: "竞价付款已确认为可复用额度。准备好后提交竞价，无需重复付款。" },
  reviewBidHint: { en: "Review the GAS amount; the app rechecks epoch, wallet, network, contract and available credit.", zh: "确认 GAS 金额；应用会重新核验周期、钱包、网络、合约与可用额度。" },
  reviewStakeHint: { en: "Review the whole NEO amount; fractional NEO is rejected before signing.", zh: "确认整数 NEO 金额；小数 NEO 会在签名前被拒绝。" },
  details: { en: "Market details", zh: "市场详情" },
  marketDrawer: { en: "Market", zh: "市场" },
  walletDrawer: { en: "Wallet", zh: "钱包" },
  recoveryDrawer: { en: "Recovery", zh: "恢复" },
  pendingShort: { en: "Pending", zh: "待确认" },
  clearShort: { en: "Clear", zh: "无待处理" },
  threeSteps: { en: "3 steps", zh: "3 步" },
  bidsUnavailable: { en: "The bid feed is unavailable. Refresh before relying on the leaderboard.", zh: "竞价数据源暂不可用；请刷新后再参考排行榜。" },
  reclaimUnavailable: { en: "Reclaim data is unavailable or this bid is no longer reclaimable.", zh: "取回数据暂不可用，或该竞价已无法取回。" },
  reclaimNotSettled: { en: "Only bids from settled epochs can be reclaimed.", zh: "只能取回已结算周期的竞价。" },
  winnerCannotReclaim: { en: "The winning bid funded staker rewards and cannot be reclaimed.", zh: "获胜竞价已用于质押者收益，无法取回。" },
  recoveryReady: { en: "Recovery journal ready", zh: "交易恢复记录已就绪" },
  recoveryReadyCopy: { en: "Broadcast IDs survive refresh and are checked without resubmission.", zh: "广播交易 ID 会跨刷新保留，并以只读方式检查。" },
  recoveryUnavailableTitle: { en: "Recovery journal unavailable", zh: "交易恢复记录不可用" },
  pendingOperationLabel: { en: "Operation", zh: "操作" },
  pendingStageLabel: { en: "Stage", zh: "阶段" },
  noPendingTransaction: { en: "No saved transaction needs attention.", zh: "当前没有需要处理的已保存交易。" },
  operation_deposit: { en: "Stake NEO", zh: "质押 NEO" },
  operation_withdraw: { en: "Unstake NEO", zh: "取消质押 NEO" },
  operation_bid: { en: "Place GAS bid", zh: "提交 GAS 竞价" },
  operation_settle: { en: "Settle epoch", zh: "结算周期" },
  operation_claim: { en: "Claim rewards", zh: "领取收益" },
  operation_reclaim: { en: "Reclaim bid", zh: "取回竞价" },
  "operation_withdraw-credit": { en: "Withdraw bid credit", zh: "提取竞价额度" },
  stage_payment: { en: "Funding payment", zh: "付款阶段" },
  stage_action: { en: "Contract action", zh: "合约操作阶段" },

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
    en: "Stake NEO for auction yield; bid GAS for the epoch title",
    zh: "质押 NEO 赚竞拍收益；竞价 GAS 抢周期称号",
  },
  docDescription: {
    en: "Gov Merc is a two-sided auction. NEO stakers split each epoch's winning GAS bid pro-rata. Mercenaries bid GAS to win the epoch's influence title — recorded on-chain, with vote execution handled off-contract. The staked NEO is held as reward weight and is not voted by the contract.",
    zh: "Gov Merc 是一个双边竞拍。NEO 质押者按比例分得每个周期的获胜 GAS 竞价。雇佣兵竞价 GAS 以赢得本周期的影响力称号——该称号链上记录，投票执行在合约外进行。质押的 NEO 仅作为收益权重，合约不会用其投票。",
  },
  step1: {
    en: "Connect your Neo wallet and review the current epoch.",
    zh: "连接 Neo 钱包并查看当前周期。",
  },
  step2: {
    en: "Stake NEO to earn a pro-rata share of the auction yield.",
    zh: "质押 NEO，按比例分得竞拍收益。",
  },
  step3: {
    en: "Bid GAS to compete for the epoch's influence title.",
    zh: "竞价 GAS，争夺本周期的影响力称号。",
  },
  step4: {
    en: "Settle the epoch to pay the winning bid to stakers; claim rewards or unstake anytime.",
    zh: "结算周期将获胜竞价分配给质押者；可随时领取收益或取消质押。",
  },
  feature1Name: { en: "Epoch Bidding", zh: "周期竞价" },
  feature1Desc: {
    en: "Competitive GAS bids determine each epoch's winner.",
    zh: "使用 GAS 竞价决定周期赢家。",
  },
  feature2Name: { en: "Staker Yield", zh: "质押收益" },
  feature2Desc: {
    en: "Staked NEO earns the winning GAS bid pro-rata each epoch (weight only — not voted by the contract).",
    zh: "质押的 NEO 按比例分得每个周期的获胜 GAS 竞价（仅作权重，合约不会用其投票）。",
  },
  feature3Name: { en: "On-chain Ledger", zh: "链上账本" },
  feature3Desc: {
    en: "Bids, stakes, and epoch status are transparent.",
    zh: "竞价、质押与周期状态全程透明。",
  },
  activeBids: { en: "Active Bids", zh: "活跃竞价" },
  lastDistributed: { en: "Last GAS to stakers", zh: "上期分给质押者的 GAS" },
  tokenNeo: { en: "NEO", zh: "NEO" },
} as const;

export const messages = mergeMessages(appMessages);
