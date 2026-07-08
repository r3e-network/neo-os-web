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
    en: "Discover public-good projects, contribute GAS, and let the matching pool amplify broad community support.",
    zh: "发现公共物品项目、捐助 GAS，并让匹配资金池放大更广泛的社区支持。",
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
    en: "Matching favors projects with more unique donors: 100 people giving 1 GAS each out-matches 1 person giving 100.",
    zh: "匹配更青睐捐助者更广的项目：100 人各捐 1 GAS 获得的匹配，高于 1 人单独捐出 100。",
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
    en: "Pick a project, choose a GAS amount, and see why broad donor support matters before signing.",
    zh: "选择项目、设定 GAS 金额，并在签名前理解为什么更广泛的捐助者支持更重要。",
  },
  qfPickProject: { en: "Pick a project", zh: "选择项目" },
  qfDonationTicket: { en: "Donation ticket", zh: "捐助票据" },
  qfAmountPresets: { en: "Donation amount presets", zh: "捐助金额快捷选项" },
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
  qfOpenRoundsAction: { en: "Open rounds", zh: "打开轮次" },
  qfRefreshProjectsAction: { en: "Refresh projects", zh: "刷新项目" },
  qfAmplifyTitle: {
    en: "Why your donation is amplified",
    zh: "为什么你的捐助会被放大",
  },
  qfAmplifyCopy: {
    en: "This round's matching pool tops up each project based on the breadth of its donors. Each unique donor increases a project's match — many small donations are amplified more than one large one.",
    zh: "本轮的匹配资金池会根据每个项目的捐助者广度进行追加。每位独立捐助者都会提升项目的匹配额——众多小额捐助比单笔大额捐助被放大得更多。",
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

  refresh: { en: "Refresh", zh: "刷新" },
  walletNotConnected: { en: "Wallet not connected", zh: "钱包未连接" },

  roundTitle: { en: "Round title", zh: "轮次名称" },
  roundTitlePlaceholder: { en: "Public Goods Round", zh: "公共资助轮次" },
  roundDescription: { en: "Round description", zh: "轮次说明" },
  roundDescriptionPlaceholder: {
    en: "Focus on open-source infra and education.",
    zh: "关注开源基础设施与教育。",
  },
  assetType: { en: "Asset (GAS only)", zh: "资产（仅 GAS）" },
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
    en: "Suggested matches are an approximation of quadratic matching computed from on-chain aggregates (donor count × total), not exact per-donor CLR. Review and override the amounts before finalizing real funds.",
    zh: "建议匹配额是基于链上汇总数据（捐助人数 × 总额）对二次方匹配的近似估算，并非按每位捐助者精确计算的 CLR。结算真实资金前请复核并按需修改金额。",
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
    en: "Unique donor totals enable quadratic matching.",
    zh: "记录唯一捐助者金额以支持二次方匹配。",
  },
  sidebarSelectedRound: { en: "Selected Round", zh: "已选轮次" },
  sidebarMatchingPool: { en: "Matching Pool", zh: "匹配资金池" },
  ariaProjects: { en: "Projects", zh: "项目" },
  ariaRounds: { en: "Rounds", zh: "轮次" },
  quickContribute: { en: "Quick Contribute", zh: "快捷捐助" },
} as const;

export const messages = mergeMessages(appMessages);
