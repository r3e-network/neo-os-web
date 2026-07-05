import { mergeMessages } from "@shared/locale/base-messages";

const appMessages = {
  // App translations
  title: { en: "Council Governance", zh: "议会治理" },
  liveGovernance: { en: "Live on-chain governance", zh: "链上实时治理" },
  heroImageAlt: {
    en: "Bright Neo council chamber with a quorum ring and on-chain voting panels",
    zh: "明亮的 Neo 议会厅，展示法定人数环和链上投票面板",
  },
  quorumChamber: { en: "Quorum chamber", zh: "法定人数议事厅" },
  quorumRing: {
    en: "Votes converge into one auditable council decision.",
    zh: "投票汇聚为一个可审计的议会决策。",
  },
  governanceSummary: {
    en: "Create council proposals, inspect live quorum, and cast on-chain for or against votes from one focused workspace.",
    zh: "在一个工作台里创建议会提案、查看实时法定人数，并发起链上赞成或反对投票。",
  },
  governanceStats: { en: "Governance statistics", zh: "治理统计" },
  proposalTabs: { en: "Proposal sections", zh: "提案分区" },
  reviewFloor: { en: "Review", zh: "审议" },
  draftFloor: { en: "Draft", zh: "起草" },
  refresh: { en: "Refresh", zh: "刷新" },
  active: { en: "Active", zh: "进行中" },
  history: { en: "History", zh: "历史" },
  create: { en: "Create", zh: "创建" },
  createProposal: { en: "Create Proposal", zh: "创建提案" },
  createProposalHelp: {
    en: "Council members can submit text proposals or parameter-change proposals directly to the governance contract.",
    zh: "议会成员可直接向治理合约提交文本提案或参数变更提案。",
  },
  dossierImageAlt: {
    en: "Council chamber desk prepared for proposal review",
    zh: "准备审议提案的议会厅桌面",
  },
  proposalDossier: { en: "Proposal dossier", zh: "提案案卷" },
  proposalDossierHelp: {
    en: "Shape the motion as an auditable council packet before it reaches the voting floor.",
    zh: "先把动议整理为可审计的议会案卷，再送入投票席。",
  },
  motionType: { en: "Motion type", zh: "动议类型" },
  reviewWindow: { en: "Review window", zh: "审议窗口" },
  reviewWindowHelp: {
    en: "Members can inspect and vote until the window closes.",
    zh: "议员可在窗口关闭前审阅并投票。",
  },
  draftReadiness: { en: "Draft readiness", zh: "草案状态" },
  readyToSubmit: { en: "Wallet review ready", zh: "钱包复核已就绪" },
  needsBrief: { en: "Motion packet pending", zh: "动议案卷待完善" },
  needsPolicyDetails: { en: "Needs policy details", zh: "需要策略详情" },
  needsCouncilEligibility: {
    en: "Needs council eligibility",
    zh: "需要议会资格",
  },
  draftReadinessHelp: {
    en: "Complete the motion brief and eligibility checks before submitting.",
    zh: "提交前请完成动议简报和资格检查。",
  },
  majorityPreview: {
    en: "Majority pass line is shown on each proposal.",
    zh: "每个提案都会显示多数通过线。",
  },
  governanceFlow: { en: "Governance flow", zh: "治理流程" },
  flowDraft: { en: "Draft motion", zh: "起草动议" },
  flowReview: { en: "Council review", zh: "议会审议" },
  flowVote: { en: "On-chain vote", zh: "链上投票" },
  floorStageLabel: { en: "Council floor", zh: "议会席位" },
  floorStageIdleTitle: {
    en: "Start with the motion brief",
    zh: "先准备动议简报",
  },
  floorStageIdleHint: {
    en: "The floor keeps only the essentials visible: council seat, brief, policy scope, and voting window.",
    zh: "议会席位只展示关键事项：席位资格、简报、策略范围和投票窗口。",
  },
  floorStageDraftTitle: {
    en: "Draft packet is taking shape",
    zh: "草案包正在成形",
  },
  floorStageDraftHint: {
    en: "Complete the missing checks before asking the wallet to publish the proposal.",
    zh: "在请求钱包发布提案前，补齐缺失检查。",
  },
  floorStageReadyTitle: {
    en: "Ready for council review",
    zh: "已准备进入议会审议",
  },
  floorStageReadyHint: {
    en: "The packet can be submitted on-chain and opened for council voting.",
    zh: "该案卷可提交上链，并开放给议会投票。",
  },
  floorStagePublishingTitle: {
    en: "Publishing to the council floor",
    zh: "正在发布到议会席位",
  },
  floorStagePublishingHint: {
    en: "Keep this screen open while the wallet request records the proposal.",
    zh: "钱包请求记录提案时，请保持此界面打开。",
  },
  floorSeat: { en: "Seat", zh: "席位" },
  floorSeatReady: { en: "Verified", zh: "已验证" },
  floorSeatReadOnly: { en: "Read-only", zh: "只读" },
  floorSeatConnect: { en: "Connect", zh: "连接" },
  floorBrief: { en: "Brief", zh: "简报" },
  floorBriefReady: { en: "Complete", zh: "完整" },
  floorBriefMissing: { en: "Missing", zh: "缺失" },
  floorPolicy: { en: "Scope", zh: "范围" },
  floorPolicyReady: { en: "Policy ready", zh: "策略已就绪" },
  floorPolicyMissing: { en: "Needs value", zh: "需要数值" },
  floorPolicyText: { en: "Text motion", zh: "文本动议" },
  floorWindow: { en: "Window", zh: "窗口" },
  floorPacket: { en: "Motion packet", zh: "动议案卷" },
  noActiveProposals: { en: "No active proposals", zh: "暂无进行中的提案" },
  noHistory: { en: "No history", zh: "暂无历史记录" },
  textType: { en: "Text", zh: "文本" },
  policyType: { en: "Policy Change", zh: "策略变更" },
  policyDetails: { en: "Policy Details", zh: "策略详情" },
  policyMethod: { en: "Policy Method", zh: "策略方法" },
  policyValue: { en: "Policy Value", zh: "策略值" },
  policyValuePlaceholder: { en: "Enter policy value", zh: "输入策略值" },
  policyMethodHint: {
    en: "Choose the network parameter and enter the exact value council members will review.",
    zh: "选择需要调整的网络参数，并填写议会成员将审议的准确数值。",
  },
  methodFeePerByte: { en: "Set Fee Per Byte", zh: "设置每字节费用" },
  methodExecFeeFactor: { en: "Set Exec Fee Factor", zh: "设置执行费系数" },
  methodStoragePrice: { en: "Set Storage Price", zh: "设置存储价格" },
  methodMaxBlockSize: { en: "Set Max Block Size", zh: "设置区块最大大小" },
  methodMaxTransactions: {
    en: "Set Max Transactions/Block",
    zh: "设置每块最大交易数",
  },
  methodMaxSystemFee: { en: "Set Max System Fee", zh: "设置最大系统费用" },
  yes: { en: "Yes", zh: "赞成" },
  no: { en: "No", zh: "反对" },
  for: { en: "For", zh: "赞成" },
  against: { en: "Against", zh: "反对" },
  notCandidate: {
    en: "Only top 21 council members can vote",
    zh: "仅前 21 名议会成员可投票",
  },
  notCandidateCreate: {
    en: "Only top 21 council members can create proposals",
    zh: "仅前 21 名议会成员可创建提案",
  },
  connectWallet: { en: "Connect wallet to vote", zh: "连接钱包以投票" },
  connectWalletCreate: {
    en: "Connect wallet to create a proposal",
    zh: "连接钱包以创建提案",
  },
  connectWalletReadOnly: {
    en: "Connect a council wallet to create proposals or vote. Proposal data remains readable.",
    zh: "连接议会钱包后可创建提案或投票；提案数据仍可只读查看。",
  },
  readOnlyReason: {
    en: "This wallet is not a current council member, so the app is in read-only mode.",
    zh: "当前钱包不是现任议会成员，因此小程序处于只读模式。",
  },
  eligibleToVote: {
    en: "Council member verified. Proposal writes are enabled.",
    zh: "已验证为议会成员，可发起提案和投票。",
  },
  alreadyVoted: {
    en: "You already voted on this proposal",
    zh: "您已对该提案投票",
  },
  alreadyVotedLabel: { en: "Voted", zh: "已投票" },
  externalProposalReadOnly: {
    en: "Mirrored from Neo Community; open details here, vote through the native governance flow when eligible.",
    zh: "该提案同步自 Neo Community；可在此查看详情，符合资格时通过原生治理流程投票。",
  },
  voteRecorded: { en: "Vote recorded", zh: "投票已记录" },
  proposalNotActive: {
    en: "This proposal is not active",
    zh: "该提案当前不可投票",
  },
  loadingProposals: { en: "Loading proposals...", zh: "加载提案中..." },
  loadingProposalsHint: {
    en: "Reading the latest entries from the governance contract.",
    zh: "正在从治理合约读取最新条目。",
  },
  failedToLoadProposals: { en: "Failed to load proposals", zh: "加载提案失败" },
  failedToLoadCandidates: {
    en: "Failed to load council candidates",
    zh: "加载议会候选人失败",
  },
  contractUnavailable: { en: "Contract not configured", zh: "合约未配置" },
  yourVotingPower: { en: "Your Voting Power", zh: "您的投票权重" },
  councilMember: { en: "Council Member", zh: "议会成员" },
  quorum: { en: "Quorum", zh: "法定人数" },
  proposalDetails: { en: "Proposal Details", zh: "提案详情" },
  proposalId: { en: "Proposal ID", zh: "提案 ID" },
  timeline: { en: "Timeline", zh: "时间线" },
  votingEnds: { en: "Voting Ends", zh: "投票结束" },
  execution: { en: "Execution", zh: "执行" },
  castYourVote: { en: "Cast Your Vote", zh: "投出您的一票" },
  proposalType: { en: "Type", zh: "类型" },
  proposalTitle: { en: "Title", zh: "标题" },
  description: { en: "Description", zh: "描述" },
  proposalBrief: { en: "Proposal brief", zh: "提案简报" },
  proposalDraft: { en: "Draft", zh: "草案" },
  proposalDraftEmpty: { en: "Untitled proposal", zh: "未命名提案" },
  textProposalScope: {
    en: "For discussion, signaling, and non-executing council decisions.",
    zh: "用于讨论、表态和不直接执行的议会决策。",
  },
  policyProposalScope: {
    en: "For executable Neo policy parameter changes after approval.",
    zh: "用于通过后可执行的 Neo 策略参数变更。",
  },
  duration: { en: "Duration", zh: "有效期" },
  duration3Days: { en: "3 Days", zh: "3 天" },
  duration7Days: { en: "7 Days", zh: "7 天" },
  duration14Days: { en: "14 Days", zh: "14 天" },
  titlePlaceholder: { en: "Name the motion", zh: "命名动议" },
  descPlaceholder: { en: "Summarize the decision and rationale", zh: "概述决议和理由" },
  proposalTitlePlaceholder: { en: "Name the motion", zh: "命名动议" },
  proposalDescPlaceholder: {
    en: "Summarize the decision and rationale",
    zh: "概述决议和理由",
  },
  proposalDescription: { en: "Description", zh: "描述" },
  fillAllFields: {
    en: "Please enter a title and description",
    zh: "请填写标题和描述",
  },
  policyFieldsRequired: {
    en: "Select a policy method and value",
    zh: "请选择策略方法并填写数值",
  },
  invalidPolicyValue: {
    en: "Enter a valid policy value",
    zh: "请输入有效的策略数值",
  },
  proposalSubmitted: { en: "Proposal submitted", zh: "提案已提交" },
  proposalCreated: { en: "Proposal created", zh: "提案已创建" },
  proposalFinalized: { en: "Proposal finalized", zh: "提案已定案" },
  proposalExecuted: {
    en: "Policy change executed on-chain",
    zh: "策略变更已在链上执行",
  },
  proposalRevoked: { en: "Proposal revoked", zh: "提案已撤回" },
  finalizeProposal: { en: "Finalize Proposal", zh: "定案提案" },
  executeProposal: { en: "Execute Policy", zh: "执行策略" },
  revokeProposal: { en: "Revoke Proposal", zh: "撤回提案" },
  submit: { en: "Submit", zh: "提交" },
  submitProposal: { en: "Submit Proposal", zh: "提交提案" },
  submittingProposal: { en: "Submitting proposal...", zh: "正在提交提案..." },
  activeProposals: { en: "Active Proposals", zh: "进行中提案" },
  historyProposals: { en: "History Proposals", zh: "历史提案" },
  noDescription: { en: "No description provided.", zh: "暂无描述。" },
  emptyProposalHelp: {
    en: "The list is read from the governance contract. Create a proposal when there is a real council action to review.",
    zh: "列表直接来自治理合约。需要议会审议时可创建新的真实提案。",
  },
  viewDetails: { en: "View Details", zh: "查看详情" },
  voteFor: { en: "Vote For", zh: "投赞成" },
  voteAgainst: { en: "Vote Against", zh: "投反对" },
  voteSplit: { en: "Vote split", zh: "投票分布" },
  creator: { en: "Creator", zh: "创建者" },
  close: { en: "Close", zh: "关闭" },
  passed: { en: "Passed", zh: "已通过" },
  rejected: { en: "Rejected", zh: "已拒绝" },
  revoked: { en: "Revoked", zh: "已撤销" },
  expired: { en: "Expired", zh: "已过期" },
  executed: { en: "Executed", zh: "已执行" },

  docSubtitle: {
    en: "Decentralized governance for Neo Council proposals",
    zh: "Neo 理事会提案的去中心化治理",
  },
  docDescription: {
    en: "Council Governance enables transparent voting on Neo ecosystem proposals. Council members can review, discuss, and vote on proposals with multi-signature execution.",
    zh: "理事会治理支持对 Neo 生态系统提案进行透明投票。理事会成员可以审查、讨论和投票提案，并通过多签执行。",
  },
  step1: {
    en: "Connect your Neo wallet (must be a council member)",
    zh: "连接您的 Neo 钱包（必须是理事会成员）",
  },
  step2: {
    en: "Browse active proposals and review their details",
    zh: "浏览活跃提案并查看详情",
  },
  step3: {
    en: "Cast your vote (For, Against, or Abstain)",
    zh: "投出您的票（赞成、反对或弃权）",
  },
  step4: {
    en: "Track proposal execution status after voting concludes",
    zh: "投票结束后跟踪提案执行状态",
  },
  feature1Name: { en: "Multi-Sig Execution", zh: "多签执行" },
  feature1Desc: {
    en: "Approved proposals require multiple council signatures to execute.",
    zh: "批准的提案需要多个理事会签名才能执行。",
  },
  feature2Name: { en: "Transparent Voting", zh: "透明投票" },
  feature2Desc: {
    en: "All votes are recorded on-chain for full accountability.",
    zh: "所有投票都记录在链上，完全可追溯。",
  },
  feature3Name: { en: "Proposal Lifecycle", zh: "提案流程" },
  feature3Desc: {
    en: "Track status from review through execution.",
    zh: "从审议到执行全程可追踪。",
  },
  quickActions: { en: "Quick Actions", zh: "快捷操作" },
  totalProposals: { en: "Total Proposals", zh: "提案总数" },
  votingPower: { en: "Voting Power", zh: "投票权重" },
  // The eligibility stat means "are you 1 of the 21 council members" — surface it
  // as a seat status, not a bare 1/0 weight a newcomer can't interpret.
  councilSeat: { en: "Council Seat", zh: "议会席位" },
  seatVerified: { en: "Verified", zh: "已验证" },
  seatReadOnly: { en: "Read-only", zh: "只读" },
  // Short status word for the Council Seat tile when no wallet is connected. The
  // full "connect a council wallet" guidance lives once in the access banner, so
  // the tile stays a clean single-word status like the other stat tiles.
  seatNotConnected: { en: "Not connected", zh: "未连接" },
  // Council size used as the quorum denominator when the contract returns none.
  councilOf21: { en: "Council of 21", zh: "21 人议会" },
  tokenNeo: { en: "NEO", zh: "NEO" },
  // Pass line for the vote bar: a proposal passes on a majority of the council
  // seats voting in favour. Surfaced as a caption + tick so a split vote does
  // not read as failing.
  passThreshold: {
    en: "Needs {needed} of {total} For to pass",
    zh: "需 {total} 席中 {needed} 票赞成方可通过",
  },
  passLine: { en: "Pass line", zh: "通过线" },
  // One-line caption under the Council Seat stat so eligibility is explained in
  // the stat block, not only in the access strip.
  seatCaptionConnect: {
    en: "Connect a council wallet to vote",
    zh: "连接议会钱包即可投票",
  },
  seatCaptionVerified: {
    en: "You can propose and vote",
    zh: "可发起提案并投票",
  },
  seatCaptionReadOnly: {
    en: "Viewing in read-only mode",
    zh: "以只读模式查看",
  },
  // Time-sensitivity cue for an active proposal whose voting window closes soon.
  endingSoon: { en: "Ending soon", zh: "即将结束" },
} as const;

export const messages = mergeMessages(appMessages);
