import { mergeMessages } from "@shared/locale/base-messages";

const appMessages = {
  title: { en: "Quadratic Funding", zh: "二次方资助" },
  actionFailed: {
    en: "Action failed — please try again",
    zh: "操作失败，请重试",
  },
  qfHeroTitle: {
    en: "Fund public goods with matching power",
    zh: "用匹配资金放大公共物品资助",
  },
  qfHeroSubtitle: {
    en: "Discover public-good projects, contribute NEO or GAS, and review how the shared pool may amplify broad support.",
    zh: "发现公共物品项目、捐助 NEO 或 GAS，并了解共享资金池如何可能放大广泛支持。",
  },
  qfFundingDeskAlt: {
    en: "Quadratic funding allocation desk",
    zh: "二次方资助分配工作台",
  },
  qfMatchSignal: { en: "Matching signal", zh: "匹配信号" },
  qfPrimaryAction: { en: "Contribute", zh: "立即捐助" },
  qfRefreshAction: { en: "Refresh rounds", zh: "刷新轮次" },
  qfWalletSummary: { en: "Funding summary", zh: "资助概览" },
  qfTabsLabel: { en: "Funding workflow", zh: "资助流程" },
  qfRoundHealth: { en: "Round health", zh: "轮次状态" },
  qfSelectedRound: { en: "Selected round", zh: "已选轮次" },
  qfLiveRound: { en: "Live rounds", zh: "进行中轮次" },
  qfTrustTitle: { en: "Funding safeguards", zh: "资助保障" },
  qfTrustItemOne: { en: "Round setup", zh: "轮次创建" },
  qfTrustItemTwo: { en: "Donor signal", zh: "捐助信号" },
  qfTrustItemThree: { en: "On-chain close", zh: "链上结算" },
  qfNoRoundTitle: { en: "No funding round selected", zh: "尚未选择资助轮次" },
  qfNoRoundBody: {
    en: "Refresh the contract to load active community rounds, or open Rounds if you need to start one.",
    zh: "刷新合约读取进行中的社区轮次；如需发起新轮次，请进入轮次页。",
  },
  qfRoundsEmptyPreview: {
    en: "Once a round exists, each card shows its title, matching pool, schedule and matched totals.",
    zh: "轮次创建后，每张卡片会展示名称、匹配资金池、时间安排与匹配总额。",
  },
  qfMechanicExplainer: {
    en: "The preview estimates the CLR subsidy signal from wallet count and total contributed. It is not an exact per-donor or identity-verified calculation.",
    zh: "预览使用钱包数与捐助总额估算 CLR 补贴信号，并非按每位捐助者精确计算，也未验证真人身份。",
  },
  qfCreateDeskIntro: {
    en: "Shape the round like a funding desk: pick the capital asset, lock the pool, set the window, and preview the donor-facing card before signing.",
    zh: "像配置资助交易桌一样创建轮次：选择资金资产、锁定匹配池、设置窗口，并在签名前预览捐助者看到的卡片。",
  },
  qfRoundBlueprint: { en: "Round blueprint", zh: "轮次蓝图" },
  qfRoundLivePreview: {
    en: "Funding round live preview",
    zh: "资助轮次实时预览",
  },
  qfRoundPreviewWindowEmpty: { en: "Window not set", zh: "尚未设置窗口" },
  qfGasPoolLabel: { en: "Grant pool", zh: "资助池" },
  qfMatchingAvailable: { en: "Available match", zh: "可用匹配额" },
  qfNeoPoolLabel: { en: "Governance stake", zh: "治理权益" },
  qfNoProjectsTitle: {
    en: "No projects in this round",
    zh: "当前轮次暂无项目",
  },
  qfNoProjectsBody: {
    en: "Register a project with a concise mission and link before donors contribute.",
    zh: "先登记项目使命与链接，再让捐助者进行资助。",
  },
  qfSelectRoundBeforeProject: {
    en: "Select or create a round before registering a project.",
    zh: "注册项目前请先选择或创建轮次。",
  },
  qfContributionHint: {
    en: "Contribution calls are signed against the selected round and project ID.",
    zh: "捐助交易会按已选轮次和项目 ID 发起签名。",
  },
  qfDonorDeskTitle: {
    en: "Back a project and grow its match",
    zh: "支持项目并放大匹配额",
  },
  qfDonorDeskSubtitle: {
    en: "Pick a project, choose the round's NEO or GAS amount, and review the donor signal before signing.",
    zh: "选择项目、按轮次资产设定 NEO 或 GAS 金额，并在签名前复核捐助信号。",
  },
  qfPickProject: { en: "Pick a project", zh: "选择项目" },
  qfNoProjectDescription: {
    en: "Mission details have not been added yet.",
    zh: "项目方尚未补充使命说明。",
  },
  qfVisitProject: {
    en: "Visit {name}",
    zh: "访问 {name}",
  },
  qfDonationTicket: { en: "Donation ticket", zh: "捐助票据" },
  qfAmountPresets: { en: "Donation amount presets", zh: "捐助金额快捷选项" },
  qfDecreaseAmount: { en: "Decrease donation amount", zh: "减少捐助金额" },
  qfIncreaseAmount: { en: "Increase donation amount", zh: "增加捐助金额" },
  qfDonationPreview: { en: "Donation preview", zh: "捐助预览" },
  qfCustomAmount: { en: "Custom amount", zh: "自定义金额" },
  qfNoMemo: { en: "No memo", zh: "无备注" },
  qfDonationDetails: {
    en: "Manual project ID and memo",
    zh: "手动项目 ID 与备注",
  },
  qfDonationDetailsHint: {
    en: "Most donors can use the project cards and amount chips above. Open this only for an unlisted project ID or an optional memo.",
    zh: "大多数捐助者直接使用上方项目卡和金额快捷选项即可。仅在需要输入未列出的项目 ID 或可选备注时展开这里。",
  },
  qfFundingGateEyebrow: { en: "Funding launchpad", zh: "资助启动台" },
  qfFundingNeedsRoundTitle: {
    en: "Load or create a round before donation",
    zh: "先读取或创建资助轮次",
  },
  qfFundingNeedsRoundBody: {
    en: "A contribution needs an active round so the wallet can sign against the correct matching pool. Start there, then this desk turns into the donation flow.",
    zh: "捐助需要先绑定进行中的轮次，钱包才能按正确的匹配资金池签名。先从轮次开始，随后这里会切换成捐助流程。",
  },
  qfFundingNeedsProjectsTitle: {
    en: "Bring projects onto the board",
    zh: "先把项目放上资助看板",
  },
  qfFundingNeedsProjectsBody: {
    en: "This round is ready, but donors need real project cards to choose from. Register the first project or refresh the project ledger.",
    zh: "轮次已准备好，但捐助者需要先看到可选择的项目卡。请注册第一个项目，或刷新项目账本。",
  },
  qfFundingGateStepRounds: { en: "Round", zh: "轮次" },
  qfFundingGateStepProjects: { en: "Projects", zh: "项目" },
  qfFundingGateStepDonate: { en: "Donate", zh: "捐助" },
  qfSetupStatus: { en: "Desk status", zh: "启动台状态" },
  qfSetupLaneLabel: { en: "Funding setup path", zh: "资助启动路径" },
  qfProjectsReadyCount: {
    en: "{count} projects ready",
    zh: "{count} 个项目已就绪",
  },
  qfDonationDeskReady: { en: "Desk ready", zh: "捐助台已就绪" },
  qfDonationDeskWaiting: { en: "Waiting for setup", zh: "等待准备完成" },
  qfExploreAndManage: { en: "Explore & manage", zh: "探索与管理" },
  qfRefreshFundingData: { en: "Refresh funding data", zh: "刷新资助数据" },
  qfRefreshingFundingData: { en: "Refreshing funding data…", zh: "正在刷新资助数据……" },
  qfOpenRoundsAction: { en: "Open rounds", zh: "打开轮次" },
  qfRefreshProjectsAction: { en: "Refresh projects", zh: "刷新项目" },
  qfAmplifyTitle: {
    en: "Why your donation is amplified",
    zh: "为什么你的捐助会被放大",
  },
  qfAmplifyCopy: {
    en: "The preview allocates the pool by the aggregate equal-split estimate (wallet count − 1) × total. The final amounts are reviewed and submitted by the platform admin after the round ends.",
    zh: "预览按汇总等额估算值（钱包数 − 1）× 总额分配匹配池。轮次结束后，最终金额由平台管理员复核并上链。",
  },
  qfProjectMatchEstimate: {
    en: "Estimated match for project #{id}: {match} (approx.)",
    zh: "项目 #{id} 的预估匹配额：{match}（约值）",
  },
  qfProjectMatchHint: {
    en: "Approximate, based on current on-chain donor breadth — the final match is set by the operator at round close.",
    zh: "基于当前链上捐助者广度的近似值——最终匹配额由运营方在轮次结束时确定。",
  },
  tabRounds: { en: "Rounds", zh: "轮次" },
  tabProjects: { en: "Projects", zh: "项目" },
  tabContribute: { en: "Contribute", zh: "捐助" },

  contractMissing: {
    en: "Contract address not configured",
    zh: "合约地址未配置",
  },
  // The framework's default-contract reads/invokes surface a missing
  // deployment as the shared "contractUnavailable" key; the legacy stack
  // mapped that case onto this app's "contractMissing" copy (the old
  // useContractAddress wrapper). Override the shared key with the same copy
  // so the banner/toast strings stay byte-identical across the rewrite.
  contractUnavailable: {
    en: "Contract address not configured",
    zh: "合约地址未配置",
  },
  fundingSafetyChecking: {
    en: "Checking contract recovery and pause state…",
    zh: "正在检查合约资金恢复能力与暂停状态……",
  },
  fundingSafetyReady: {
    en: "Recovery-capable contract verified. Funding actions require the exact event and chain readback.",
    zh: "已验证合约具备资金恢复能力；资助操作还必须通过精确事件与链上读回确认。",
  },
  fundingSafetyLegacy: {
    en: "Browse-only: this deployment cannot withdraw unconsumed prepaid NEO/GAS. Funding writes are blocked until the recovery-capable contract is deployed.",
    zh: "当前为只读模式：此部署无法取回未消耗的预付 NEO/GAS。恢复版合约部署前，资金写入已禁用。",
  },
  fundingSafetyUnverified: {
    en: "Browse-only: recovery methods respond, but this exact network deployment has not completed production lifecycle validation.",
    zh: "当前为只读模式：恢复方法可以响应，但此网络上的具体部署尚未完成生产生命周期验证。",
  },
  fundingSafetyPaused: {
    en: "Funding writes are paused on-chain. Browsing remains available.",
    zh: "链上资金写入已暂停，仍可浏览轮次与项目。",
  },
  // Honest zero-states for the selected-round readouts. No round selected is
  // the desk's opening state, not a missing value.
  qfNoRoundSelected: { en: "No round selected", zh: "尚未选择轮次" },
  qfMatchingAwaitsRound: { en: "Select a round", zh: "请选择轮次" },
  // The pre-connect state: no contract resolved, so no snapshot to verify.
  // Neutral product voice — nothing has failed, and browsing genuinely is the
  // whole experience until a wallet arrives.
  fundingSafetyAwaitingContext: {
    en: "Browse rounds and projects freely. Connect a wallet to contribute.",
    zh: "可自由浏览轮次与项目；连接钱包后即可捐助。",
  },
  fundingAwaitingContextShort: {
    en: "Browsing · connect a wallet to contribute",
    zh: "浏览模式 · 连接钱包后可捐助",
  },
  fundingSafetyUnavailable: {
    en: "The contract snapshot could not be verified. Funding writes remain blocked; refresh to check again.",
    zh: "暂时无法验证合约快照，资金写入保持禁用；请刷新后重试检查。",
  },
  fundingWriteScopeChanged: {
    en: "The wallet network or contract verification changed before signing. No new write was submitted.",
    zh: "签名前钱包网络或合约验证状态发生变化，未提交新的写入。",
  },
  fundingBrowseOnlyAction: {
    en: "Browse-only until contract upgrade",
    zh: "合约升级前仅可浏览",
  },
  fundingReadyShort: { en: "Funding transactions are ready", zh: "资助交易已就绪" },
  fundingCheckingShort: { en: "Checking funding access…", zh: "正在检查资助能力……" },
  fundingBrowseShort: {
    en: "Explore mode · contributions are temporarily unavailable",
    zh: "探索模式 · 捐助暂不可用",
  },
  fundingPausedShort: { en: "Explore mode · funding is paused", zh: "探索模式 · 资助已暂停" },
  fundingUnavailableShort: {
    en: "Explore mode · live funding status is unavailable",
    zh: "探索模式 · 暂无法读取实时资助状态",
  },
  qfBrowseModeTitle: { en: "Explore projects without signing", zh: "无需签名即可探索项目" },
  qfBrowseModeBody: {
    en: "Rounds, projects, contribution totals, and matching results remain live. Transaction tools return only after the upgraded funding contract completes production validation.",
    zh: "轮次、项目、捐助总额与匹配结果仍会实时更新。升级后的资助合约完成生产验证后，交易工具才会恢复。",
  },
  pendingRecovered: {
    en: "The previously broadcast transaction now has an exact event and matching chain state.",
    zh: "先前广播的交易现已找到精确事件，且链上状态一致。",
  },
  pendingStillWaiting: {
    en: "Transaction {txid} is still awaiting its exact event and chain readback. Do not submit another write.",
    zh: "交易 {txid} 仍在等待精确事件与链上读回，请勿再次提交写入。",
  },
  pendingDepositRecovery: {
    en: "Deposit {txid} was broadcast, but the funding action was not. Do not retry; the prepaid credit must be reviewed and reclaimed before this lock is cleared.",
    zh: "预付交易 {txid} 已广播，但资金操作尚未广播。请勿重试；必须先检查并取回预付余额，再清除此锁。",
  },
  pendingIntentUncertain: {
    en: "A wallet request was interrupted before its transaction ID was recorded. Check wallet activity before clearing this local retry lock.",
    zh: "钱包请求在记录交易 ID 前被中断。清除本地防重试锁前，请先检查钱包活动记录。",
  },
  pendingWrongScope: {
    en: "This pending transaction belongs to another network or contract. Switch back to review it, or clear the local lock only after checking the transaction.",
    zh: "这笔待确认交易属于其他网络或合约。请切回原环境检查，或在核实交易后再清除本地锁。",
  },
  pendingRecoveryUnavailable: {
    en: "The pending transaction could not be checked right now. No new write is allowed until recovery succeeds or you review and clear the local lock.",
    zh: "暂时无法检查待确认交易。在恢复成功，或你核实并清除本地锁之前，不允许发起新的写入。",
  },
  pendingBlocksWrites: {
    en: "A broadcast transaction is still unresolved. Refresh to recover it before submitting another write.",
    zh: "已有一笔广播交易尚未确认。请先刷新恢复，再提交新的写入。",
  },
  pendingReviewTitle: {
    en: "Review pending transaction",
    zh: "检查待确认交易",
  },
  pendingRefreshAction: {
    en: "Check chain state",
    zh: "检查链上状态",
  },
  pendingClearAction: {
    en: "Forget local lock",
    zh: "清除本地锁",
  },
  pendingClearHint: {
    en: "Refresh first. Forgetting only removes this browser's retry lock; it does not cancel or reverse the on-chain transaction.",
    zh: "请先刷新。清除操作只会移除此浏览器的防重复提交锁，不会取消或撤销链上交易。",
  },
  pendingRecoveryRequiredAction: {
    en: "Recover prepaid credit first",
    zh: "请先取回预付余额",
  },
  pendingDepositMustRecover: {
    en: "This lock protects a prepaid deposit. Reclaim the on-chain credit before removing it.",
    zh: "此锁保护一笔已预付的链上余额；请先取回余额，再移除本地锁。",
  },
  pendingCleared: {
    en: "The local retry lock was cleared. The on-chain transaction was not cancelled.",
    zh: "本地防重复提交锁已清除；链上交易并未取消。",
  },
  writeAwaitingConfirmation: {
    en: "Transaction {txid} was broadcast, but its exact contract event is not verified yet. Do not submit again; refresh to recover the latest chain state.",
    zh: "交易 {txid} 已广播，但尚未验证到精确合约事件。请勿重复提交；刷新以恢复最新链上状态。",
  },
  chainSnapshotUnavailable: {
    en: "The required chain snapshot is unavailable. No funds were sent.",
    zh: "所需链上快照暂不可用，未发送任何资金。",
  },
  collectionTooLarge: {
    en: "This on-chain collection exceeds the supported client limit. Writes remain blocked instead of using a partial snapshot.",
    zh: "此链上集合超过客户端支持上限。为避免使用不完整快照，写入保持禁用。",
  },
  incompleteProjectSnapshot: {
    en: "Every project in the round must load and appear in the reviewed allocation before finalization.",
    zh: "结算前必须完整读取本轮每个项目，并全部纳入已复核的分配列表。",
  },
  chainReadbackMismatch: {
    en: "The transaction event was found, but the resulting chain state does not match the reviewed action. Do not repeat it; refresh and inspect the round.",
    zh: "已找到交易事件，但链上结果与已确认操作不一致。请勿重复提交；刷新并检查轮次。",
  },
  matchingPoolMinimumGas: {
    en: "A GAS matching pool must contain at least 0.1 GAS.",
    zh: "GAS 匹配资金池至少需要 0.1 GAS。",
  },
  matchExceedsPool: {
    en: "Suggested allocations exceed the matching pool.",
    zh: "建议分配总额超过匹配资金池。",
  },
  roundStateChanged: {
    en: "The round state changed. Refresh before taking this action.",
    zh: "轮次状态已变化，请刷新后再操作。",
  },
  projectStateChanged: {
    en: "The project state changed. Refresh before claiming.",
    zh: "项目状态已变化，请刷新后再领取。",
  },
  roundNotActive: {
    en: "This round is not currently accepting contributions.",
    zh: "当前轮次暂不接受捐助。",
  },
  selfContributionBlocked: {
    en: "Project owners and round creators cannot contribute to projects in their own round.",
    zh: "项目负责人和轮次创建者不能向自己轮次中的项目捐助。",
  },
  qfSybilDisclosure: {
    en: "Match previews use the aggregate estimate (wallet count − 1) × contributed total. Wallets are not verified people or Sybil-resistant identities; the platform admin reviews the final allocation.",
    zh: "匹配预览采用汇总估算：（钱包数 − 1）× 捐助总额。钱包并不等于已验证的真人身份，也不具备女巫攻击防护；最终分配由平台管理员复核。",
  },

  refresh: { en: "Refresh", zh: "刷新" },
  walletNotConnected: { en: "Wallet not connected", zh: "钱包未连接" },

  roundTitle: { en: "Round title", zh: "轮次名称" },
  roundTitlePlaceholder: { en: "Public Goods Round", zh: "公共资助轮次" },
  roundDescription: { en: "Round description", zh: "轮次说明" },
  roundDescriptionPlaceholder: {
    en: "Focus on open-source infra and education.",
    zh: "关注开源基础设施与教育。",
  },
  assetType: { en: "Round asset", zh: "轮次资产" },
  assetNeo: { en: "NEO", zh: "NEO" },
  assetGas: { en: "GAS", zh: "GAS" },
  matchingPool: { en: "Matching pool", zh: "匹配资金池" },
  matchingPoolPlaceholder: { en: "50", zh: "50" },
  matchingPoolHint: {
    en: "Matching pool is locked at creation; you can top up later.",
    zh: "匹配池创建时锁定，可后续追加。",
  },
  roundStart: { en: "Start time", zh: "开始时间" },
  roundStartPlaceholder: { en: "2025-06-01 09:00", zh: "2025-06-01 09:00" },
  roundStartPlaceholderFriendly: {
    en: "Select start time",
    zh: "选择开始时间",
  },
  roundEnd: { en: "End time", zh: "结束时间" },
  roundEndPlaceholder: { en: "2025-06-30 18:00", zh: "2025-06-30 18:00" },
  roundEndPlaceholderFriendly: { en: "Select end time", zh: "选择结束时间" },
  roundDateFormat: { en: "YYYY-MM-DD HH:mm", zh: "YYYY-MM-DD HH:mm" },
  roundDateFormatHint: {
    en: "Local time, e.g. 2026-09-01 09:00",
    zh: "本地时间，例如 2026-09-01 09:00",
  },

  createRound: { en: "Create Round", zh: "创建轮次" },
  creatingRound: { en: "Creating...", zh: "创建中..." },
  roundCreated: { en: "Round created", zh: "轮次已创建" },
  invalidRound: { en: "Invalid round configuration", zh: "轮次配置无效" },
  invalidMatchingPool: {
    en: "Invalid matching pool amount",
    zh: "匹配池金额无效",
  },
  invalidEndTime: {
    en: "End time must be in the future",
    zh: "结束时间必须晚于当前时间",
  },
  assetSelect: { en: "Matching asset", zh: "匹配资产" },

  roundsTitle: { en: "Funding Rounds", zh: "资助轮次" },
  emptyRounds: { en: "No rounds yet", zh: "暂无轮次" },
  selectRound: { en: "Select", zh: "选择" },
  selectedRound: { en: "Selected", zh: "已选择" },
  roundStatusUpcoming: { en: "Upcoming", zh: "即将开始" },
  roundStatusActive: { en: "Active", zh: "进行中" },
  roundStatusEnded: { en: "Ended", zh: "已结束" },
  roundStatusFinalized: { en: "Finalized", zh: "已结算" },
  roundStatusCancelled: { en: "Cancelled", zh: "已取消" },
  totalContributed: { en: "Total contributed", zh: "已捐助" },
  matchingRemaining: { en: "Matching remaining", zh: "剩余匹配" },
  projectCount: { en: "Projects", zh: "项目数" },
  roundSchedule: { en: "Schedule", zh: "时间" },
  roundAsset: { en: "Asset", zh: "资产" },
  roundCreator: { en: "Creator", zh: "创建者" },

  adminTools: { en: "Round Ops", zh: "轮次管理" },
  qfOpsControlRoom: { en: "Control room", zh: "控制室" },
  qfOpsControlRoomHint: {
    en: "Manage reserves, review suggested allocation, then finalize only when the round is ready.",
    zh: "管理匹配储备、复核建议分配，并仅在轮次就绪后结算。",
  },
  qfOpsStatus: { en: "Round ops status", zh: "轮次操作状态" },
  qfOpsAdminReady: { en: "Admin wallet", zh: "管理员钱包" },
  qfOpsAdminNeeded: { en: "Admin required", zh: "需要管理员" },
  qfOpsCreatorReady: { en: "Creator controls", zh: "创建者操作" },
  qfOpsReadOnly: { en: "Read-only", zh: "只读" },
  qfOpsReserve: { en: "Reserve", zh: "储备" },
  qfOpsReservePresets: { en: "Matching reserve presets", zh: "匹配储备预设" },
  qfOpsAllocation: { en: "Allocation", zh: "分配" },
  qfOpsClaimUnusedHint: {
    en: "Recover matching funds that were never allocated after finalization.",
    zh: "结算后取回未分配的匹配资金。",
  },
  addMatching: { en: "Add matching", zh: "追加匹配" },
  addMatchingPlaceholder: { en: "10", zh: "10" },
  addingMatching: { en: "Adding...", zh: "追加中..." },
  matchingAdded: { en: "Matching pool updated", zh: "匹配池已更新" },
  finalizeRound: { en: "Finalize", zh: "结算轮次" },
  finalizeProjectsJson: { en: "Project IDs (JSON)", zh: "项目 ID（JSON）" },
  finalizeProjectsPlaceholder: { en: "[1,2,3]", zh: "[1,2,3]" },
  finalizeMatchesJson: { en: "Matched amounts (JSON)", zh: "匹配金额（JSON）" },
  finalizeMatchesPlaceholder: { en: "[100,50,25]", zh: "[100,50,25]" },
  finalizeHint: {
    en: "Amounts are in GAS units, not raw integers.",
    zh: "金额以 GAS 为单位输入。",
  },
  finalizeKnownProjects: { en: "Projects in this round", zh: "本轮项目" },
  finalizePrefill: { en: "Use these", zh: "填入项目" },
  finalizing: { en: "Finalizing...", zh: "结算中..." },
  roundFinalized: { en: "Round finalized", zh: "轮次已结算" },
  finalizeAdminOnly: {
    en: "Finalize is restricted to the platform admin and only after the round ends.",
    zh: "结算仅限平台管理员，且需在轮次结束后进行。",
  },
  finalizeSuggested: {
    en: "Finalize with suggested matches",
    zh: "按建议匹配结算",
  },
  matchApproxCaveat: {
    en: "Estimated matches use (wallet count − 1) × total under an equal-split assumption, not exact per-donor CLR. A wallet count does not prove unique people, so the platform operator reviews every allocation before finalization.",
    zh: "预估匹配额在等额假设下使用（钱包数 − 1）× 总额，并非精确的逐捐助者 CLR。钱包数量不代表经过验证的独立真人，因此平台运营方会在结算前逐项复核。",
  },
  matchFinalizedCaveat: {
    en: "These are the finalized on-chain allocations for this round, not a new estimate.",
    zh: "以下为本轮已在链上结算的实际匹配额，并非新的预估值。",
  },
  qfMatchPreviewTitle: { en: "Matching preview", zh: "匹配预览" },
  qfMatchPreviewHint: {
    en: "Review the current donor-breadth estimate before the round closes.",
    zh: "在轮次结算前查看当前的捐助广度估算。",
  },
  qfFinalAllocationsTitle: { en: "Final allocations", zh: "最终分配" },
  qfFinalAllocationsHint: {
    en: "Project allocations confirmed by the finalized round.",
    zh: "由已结算轮次确认的项目匹配分配。",
  },
  finalizeNoProjects: {
    en: "Register projects and gather contributions before finalizing.",
    zh: "结算前请先登记项目并积累捐助。",
  },
  finalizeConnectAdmin: {
    en: "Connect the platform admin wallet to finalize this round.",
    zh: "请连接平台管理员钱包以结算本轮。",
  },
  finalizeShowAdvanced: {
    en: "Advanced: enter match amounts manually",
    zh: "高级：手动输入匹配金额",
  },
  finalizeHideAdvanced: { en: "Hide advanced inputs", zh: "隐藏高级输入" },
  matchTableProject: { en: "Project", zh: "项目" },
  matchTableContributed: { en: "Contributed", zh: "已捐助" },
  matchTableDonors: { en: "Donors", zh: "捐助人数" },
  matchTableSuggested: { en: "Suggested match", zh: "建议匹配" },
  claimUnused: { en: "Claim unused", zh: "领取剩余匹配" },
  claimingUnused: { en: "Claiming...", zh: "领取中..." },
  unusedClaimed: { en: "Unused matching claimed", zh: "剩余匹配已领取" },
  cancelRound: { en: "Cancel round", zh: "取消轮次" },
  cancelRoundHint: {
    en: "Only before the round starts and while it has no contributions; your matching deposit is refunded.",
    zh: "仅在轮次开始前且无任何捐助时可用，将退回你的匹配押金。",
  },
  cancelling: { en: "Cancelling...", zh: "取消中..." },
  roundCancelled: {
    en: "Round cancelled and matching refunded",
    zh: "轮次已取消，匹配押金已退回",
  },

  registerProject: { en: "Register Project", zh: "注册项目" },
  qfRegisterProjectHint: {
    en: "Project intake for this round.",
    zh: "本轮项目入口。",
  },
  projectsList: { en: "Project ledger", zh: "项目账本" },
  registeringProject: { en: "Registering...", zh: "注册中..." },
  projectName: { en: "Project name", zh: "项目名称" },
  projectNamePlaceholder: { en: "Open Source Explorer", zh: "开源浏览器" },
  projectDescription: { en: "Project description", zh: "项目说明" },
  projectDescriptionPlaceholder: {
    en: "Building tools for Neo developers.",
    zh: "构建 Neo 开发者工具。",
  },
  projectLink: { en: "Project link", zh: "项目链接" },
  projectLinkPlaceholder: {
    en: "https://example.org",
    zh: "https://example.org",
  },
  projectRegistered: { en: "Project registered", zh: "项目已注册" },
  emptyProjects: { en: "No projects yet", zh: "暂无项目" },
  projectStatusActive: { en: "Active", zh: "进行中" },
  projectStatusInactive: { en: "Inactive", zh: "已停用" },
  projectStatusClaimed: { en: "Claimed", zh: "已领取" },
  donors: { en: "Donors", zh: "捐助人数" },
  matchedAmount: { en: "Matched", zh: "匹配金额" },
  contributeNow: { en: "Contribute", zh: "捐助" },
  claimProject: { en: "Claim", zh: "领取" },
  claimingProject: { en: "Claiming...", zh: "领取中..." },
  projectClaimed: { en: "Project claimed", zh: "项目已领取" },
  projectOwner: { en: "Owner", zh: "负责人" },

  contribute: { en: "Contribute", zh: "捐助" },
  contributing: { en: "Contributing...", zh: "捐助中..." },
  contributionRoundId: { en: "Round ID", zh: "轮次 ID" },
  contributionProjectId: { en: "Project ID", zh: "项目 ID" },
  contributionAmount: { en: "Amount", zh: "金额" },
  contributionAmountPlaceholder: { en: "2", zh: "2" },
  contributionMemo: { en: "Memo (optional)", zh: "备注（可选）" },
  contributionMemoPlaceholder: {
    en: "For open-source tooling",
    zh: "支持开源工具",
  },
  contributionSent: { en: "Contribution sent", zh: "捐助已提交" },
  invalidContribution: { en: "Invalid contribution", zh: "捐助信息无效" },
  neoNoFractional: {
    en: "NEO is indivisible — enter a whole number.",
    zh: "NEO 不可分割，请输入整数。",
  },
  invalidProject: { en: "Invalid project details", zh: "项目信息无效" },
  invalidProjectLink: {
    en: "Use a valid HTTP or HTTPS project link, or leave it blank.",
    zh: "请输入有效的 HTTP 或 HTTPS 项目链接，或留空。",
  },
  selectProjectHint: {
    en: "Choose a project from the list above.",
    zh: "从上方列表选择项目。",
  },
  selectRoundFirst: {
    en: "Select a round before contributing.",
    zh: "捐助前请先选择轮次。",
  },
  noSelectedRound: {
    en: "Select a round to view projects.",
    zh: "请选择轮次查看项目。",
  },

  dateUnknown: { en: "Schedule TBD", zh: "时间待定" },

  docSubtitle: {
    en: "Quadratic matching for public grants",
    zh: "公共资助的二次方匹配",
  },
  docDescription: {
    en: "Quadratic Funding rounds let communities match small donor contributions with a shared pool. Matching is computed off-chain and finalized on-chain.",
    zh: "二次方资助轮次通过共享匹配池放大小额捐助。匹配金额链下计算、链上结算。",
  },
  step1: {
    en: "Create a round with matching pool and schedule.",
    zh: "创建轮次并设置匹配池与时间。",
  },
  step2: {
    en: "Projects register with descriptions and links.",
    zh: "项目方提交说明与链接完成注册。",
  },
  step3: {
    en: "Donors contribute during the active window.",
    zh: "捐助者在轮次期间完成捐助。",
  },
  step4: {
    en: "Compute matching off-chain and finalize on-chain.",
    zh: "链下计算匹配金额并上链结算。",
  },
  feature1Name: { en: "Matching Pools", zh: "匹配资金池" },
  feature1Desc: {
    en: "Lock GAS to match community donations.",
    zh: "锁定 GAS 为社区捐助匹配。",
  },
  feature2Name: { en: "Project Registry", zh: "项目登记" },
  feature2Desc: {
    en: "Each project has a dedicated record and funding stats.",
    zh: "每个项目有独立档案与资金统计。",
  },
  feature3Name: { en: "Donor Signals", zh: "捐助信号" },
  feature3Desc: {
    en: "Wallet-address counts provide a public breadth signal; they do not prove unique people.",
    zh: "钱包地址数提供公开的支持广度信号，但不能证明真人唯一性。",
  },
  sidebarSelectedRound: { en: "Selected Round", zh: "已选轮次" },
  sidebarMatchingPool: { en: "Matching Pool", zh: "匹配资金池" },
  ariaProjects: { en: "Projects", zh: "项目" },
  ariaRounds: { en: "Rounds", zh: "轮次" },
  quickContribute: { en: "Quick Contribute", zh: "快捷捐助" },
} as const;

export const messages = mergeMessages(appMessages);
