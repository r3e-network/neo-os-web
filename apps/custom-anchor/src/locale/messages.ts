import { mergeMessages } from "@shared/locale/base-messages";

const appMessages = {
  title: { en: "Custom Anchor", zh: "自定义 Anchor" },
  subtitle: {
    en: "Use a registered custom voting anchor: stake NEO, redeem NEO, and claim GAS rewards. Agent routing stays in the admin console.",
    zh: "使用已注册的自定义投票 Anchor：质押 NEO、赎回 NEO、领取 GAS。Agent 调仓留在管理员控制台。",
  },
  playTab: { en: "Anchor", zh: "Anchor" },
  activityTab: { en: "Activity", zh: "动态" },
  anchorStatus: { en: "Anchor status", zh: "Anchor 状态" },
  anchorAppId: { en: "Anchor appId", zh: "Anchor appId" },
  neoAmount: { en: "NEO amount", zh: "NEO 数量" },
  userStake: { en: "Your stake", zh: "我的质押" },
  // Honest zero-states for values the console cannot resolve yet. Each names
  // the next step instead of leaving a void — none of these is an error.
  valuePickAnchor: { en: "Pick an anchor", zh: "先选择锚点" },
  valueConnectWallet: { en: "Connect wallet", zh: "连接钱包" },
  valueAwaitingNetwork: { en: "Awaiting network", zh: "等待网络" },
  pendingRewards: { en: "Claimable GAS", zh: "可领取 GAS" },
  totalStaked: { en: "Total staked", zh: "总质押" },
  rewardReserve: { en: "Reward reserve", zh: "奖励池" },
  agentCount: { en: "Agents", zh: "Agent 数" },
  lastTxid: { en: "Last tx", zh: "最近交易" },
  anchorLinked: { en: "Anchor linked", zh: "Anchor 已连接" },
  anchorMissing: { en: "Waiting for anchor", zh: "等待 Anchor" },
  anchorAwaitingLaunch: {
    en: "Open a OneGate anchor link",
    zh: "打开 OneGate Anchor 链接",
  },
  anchorAwaitingInput: {
    en: "Enter or open an anchor link to begin",
    zh: "输入或打开 Anchor 链接以开始",
  },
  anchorIdHint: {
    en: "Format: custom-anchor:slug:nonce",
    zh: "格式：custom-anchor:slug:nonce",
  },
  anchorWorkspaceLabel: { en: "Transaction route", zh: "交易路径" },
  anchorWorkspaceTitle: {
    en: "Anchor routing workspace",
    zh: "Anchor 路由工作台",
  },
  anchorWorkspaceBody: {
    en: "User actions stay scoped to the anchor appId while the 21-agent AA route remains visible before signing.",
    zh: "用户操作按 Anchor appId 隔离，签名前可见 21-agent AA 路由状态。",
  },
  anchorFlowTitle: { en: "Anchor transaction flow", zh: "Anchor 交易流程" },
  anchorFlowOpen: { en: "Open anchor", zh: "打开 Anchor" },
  anchorFlowAction: { en: "Choose action", zh: "选择操作" },
  anchorFlowSign: { en: "Sign wallet tx", zh: "钱包签名" },
  anchorStageAlt: {
    en: "Glass governance anchor with twenty-one agent nodes.",
    zh: "玻璃治理 Anchor 与二十一个 agent 节点。",
  },
  anchorStageLabel: { en: "Shared voting route", zh: "共享投票路径" },
  anchorStageValueReady: {
    en: "21-agent anchor in focus",
    zh: "21-agent Anchor 就绪",
  },
  anchorStageValueIdle: {
    en: "Connect or register an anchor",
    zh: "连接或注册 Anchor",
  },
  actionPanelLabel: { en: "Wallet actions", zh: "钱包操作" },
  actionPanelTitle: { en: "Stake, redeem, or claim", zh: "质押、赎回或领取" },
  actionPanelBody: {
    en: "Enter the custom anchor id, choose a whole NEO amount, then submit the exact wallet transaction for this anchor.",
    zh: "输入自定义 Anchor ID，选择整数 NEO 数量，然后为该 Anchor 提交对应的钱包交易。",
  },
  anchorLaneAria: {
    en: "Live anchor operation lane",
    zh: "实时 Anchor 操作轨道",
  },
  anchorLaneLabel: { en: "Live route", zh: "实时路径" },
  anchorLaneTitle: {
    en: "NEO moves through the anchor, agents, and GAS reward loop",
    zh: "NEO 经由 Anchor、Agent 与 GAS 奖励回路流转",
  },
  anchorLaneBody: {
    en: "The stage reacts to the selected anchor, the amount, agent readiness, wallet submission, and recoverable rewards.",
    zh: "舞台会根据当前 Anchor、数量、agent 就绪度、钱包提交状态和可领取收益实时变化。",
  },
  anchorLaneAnchor: { en: "Anchor", zh: "Anchor" },
  anchorLaneAmount: { en: "Amount", zh: "数量" },
  anchorLaneAgents: { en: "Agents online", zh: "Agent 在线" },
  anchorLaneStatus: { en: "Status", zh: "状态" },
  anchorLaneAnchorPending: { en: "Choose anchor", zh: "选择 Anchor" },
  anchorLaneAmountPending: { en: "Set amount", zh: "设置数量" },
  anchorLaneAgentsPending: { en: "Not linked", zh: "未连接" },
  anchorLaneStateEmpty: { en: "Waiting", zh: "等待输入" },
  anchorLaneStateDraft: { en: "Drafting", zh: "草稿中" },
  anchorLaneStateReady: { en: "Ready to sign", zh: "可签名" },
  anchorLaneStateBusy: { en: "Submitting", zh: "提交中" },
  anchorLaneStateBlocked: { en: "Agent warning", zh: "Agent 警告" },
  anchorLaneStateError: { en: "Needs attention", zh: "需要处理" },
  anchorLaneStepStake: { en: "NEO stake", zh: "NEO 质押" },
  anchorLaneStepAgents: { en: "21-agent route", zh: "21-agent 路径" },
  anchorLaneStepRewards: { en: "GAS yield", zh: "GAS 收益" },
  launchSource: { en: "Launch source", zh: "启动来源" },
  userRoute: { en: "User route", zh: "用户路径" },
  userRouteBody: {
    en: "Stake, redeem, or claim from the same anchor.",
    zh: "在同一 Anchor 内质押、赎回或领取。",
  },
  adminRoute: { en: "Admin route", zh: "管理员路径" },
  adminRouteBody: {
    en: "Agent movement stays outside the user flow.",
    zh: "Agent 调仓不进入用户流程。",
  },
  safetyRail: { en: "Safety rail", zh: "安全边界" },
  safetyRailBody: {
    en: "Funds remain scoped by anchor appId.",
    zh: "资金按 Anchor appId 隔离。",
  },
  stakeTitle: { en: "Stake", zh: "质押" },
  stakeDescription: {
    en: "Lock NEO into this custom anchor. The contract routes voting through the anchor's 21 AA agents.",
    zh: "把 NEO 质押到该自定义 Anchor，合约通过该 Anchor 的 21 个 AA agent 执行投票。",
  },
  stakeAction: { en: "Stake NEO", zh: "质押 NEO" },
  claimTitle: { en: "Claim", zh: "领取" },
  claimDescription: {
    en: "Claim accumulated GAS rewards for the selected custom anchor.",
    zh: "领取当前自定义 Anchor 中你的 GAS 收益。",
  },
  claimAction: { en: "Claim GAS", zh: "领取 GAS" },
  withdrawTitle: { en: "Redeem", zh: "赎回" },
  withdrawDescription: {
    en: "Redeem NEO from the same custom anchor back to your wallet.",
    zh: "从同一个自定义 Anchor 赎回 NEO 到你的钱包。",
  },
  withdrawAction: { en: "Redeem NEO", zh: "赎回 NEO" },
  refreshStatus: { en: "Refresh status", zh: "刷新状态" },
  workflowReady: { en: "Ready", zh: "准备就绪" },
  statusLoaded: { en: "Anchor status loaded", zh: "Anchor 状态已加载" },
  refreshingStatus: {
    en: "Refreshing anchor status",
    zh: "正在刷新 Anchor 状态",
  },
  workflowFailed: { en: "Action failed", zh: "操作失败" },
  actionNeedsAttention: { en: "This action needs attention", zh: "此操作需要处理" },
  actionRetryDetail: {
    en: "Review the wallet, network, and pending-operation status, then try again.",
    zh: "请检查钱包、网络与待处理操作状态后重试。",
  },
  anchorReadUnavailableDetail: {
    en: "Live anchor data is temporarily unavailable. Verified values are not replaced with zero.",
    zh: "Anchor 实时数据暂不可用；已验证的数据不会被错误替换为 0。",
  },
  stakeSubmitting: {
    en: "Submitting stake transaction",
    zh: "正在提交质押交易",
  },
  withdrawSubmitting: {
    en: "Submitting redeem transaction",
    zh: "正在提交赎回交易",
  },
  claimSubmitting: { en: "Submitting reward claim", zh: "正在提交奖励领取" },
  stakeSubmitted: { en: "Stake transaction submitted", zh: "质押交易已提交" },
  withdrawSubmitted: {
    en: "Redeem transaction submitted",
    zh: "赎回交易已提交",
  },
  claimSubmitted: { en: "Reward claim submitted", zh: "奖励领取已提交" },
  submitting: { en: "Submitting...", zh: "提交中..." },
  invalidAnchorId: {
    en: "Anchor appId must look like custom-anchor:slug:nonce.",
    zh: "Anchor appId 需要类似 custom-anchor:slug:nonce。",
  },
  invalidAmount: {
    en: "NEO is indivisible. Enter a positive whole number.",
    zh: "NEO 不可分割，请输入正整数。",
  },
  notAvailable: { en: "Not available", zh: "暂无" },

  // Anchor existence + registration
  anchorNotRegistered: {
    en: "This anchor id is not registered yet. Register it below, or pick one from the list.",
    zh: "该 Anchor ID 尚未注册。可在下方注册，或从列表中选择一个。",
  },
  anchorAlreadyRegistered: {
    en: "That anchor id is already registered.",
    zh: "该 Anchor ID 已被注册。",
  },
  anchorNotRegisteredBadge: { en: "Not registered", zh: "未注册" },
  registerPanelLabel: { en: "Create anchor", zh: "创建 Anchor" },
  registerPanelTitle: {
    en: "Register a custom anchor",
    zh: "注册自定义 Anchor",
  },
  registerPanelBody: {
    en: "Pick a unique id (custom-anchor:slug:nonce) and a mode. Registration costs a 1 GAS prepaid fee; you become the anchor admin.",
    zh: "选择唯一 ID（custom-anchor:slug:nonce）和模式。注册需预付 1 GAS 费用；你将成为该 Anchor 管理员。",
  },
  registerAnchorAppId: { en: "New anchor appId", zh: "新 Anchor appId" },
  registerModeTrust: { en: "Trust (voting)", zh: "信任（投票）" },
  registerModeProfit: { en: "Profit (yield)", zh: "收益" },
  registerAction: { en: "Register anchor (1 GAS)", zh: "注册 Anchor（1 GAS）" },
  registerSubmitting: { en: "Registering anchor", zh: "正在注册 Anchor" },
  registerSubmitted: { en: "Anchor registered", zh: "Anchor 已注册" },
  registerAgentsNote: {
    en: "The recovery-safe flow confirms the fee, anchor app, AA accounts, and 21-agent binding one stage at a time. A refresh never repeats a confirmed transaction.",
    zh: "可恢复流程会逐阶段确认费用、Anchor app、AA 账户与 21-agent 绑定；刷新页面不会重复已确认交易。",
  },

  // Candidate council (21 compressed public keys) for agent provisioning
  registerCandidatesLabel: {
    en: "Council candidates (21 public keys)",
    zh: "Council 候选人（21 个公钥）",
  },
  registerCandidatesHint: {
    en: "One compressed public key (02/03 + 64 hex) per line — exactly 21. These are the council candidates your anchor's 21 agents vote for.",
    zh: "每行一个压缩公钥（02/03 + 64 位十六进制），共 21 个。这些是你的 Anchor 的 21 个 agent 所投票的 council 候选人。",
  },
  registerCandidatesPlaceholder: {
    en: "02abc...\n03def...\n(21 lines)",
    zh: "02abc...\n03def...\n（共 21 行）",
  },
  registerCandidatesUseDefault: {
    en: "Use default candidate set",
    zh: "使用默认候选集",
  },
  registerCandidatesCount: {
    en: "{count}/21 valid candidate keys",
    zh: "{count}/21 个有效候选公钥",
  },
  registerCandidatesInvalid: {
    en: "Enter exactly 21 compressed public keys (02/03 + 64 hex), one per line.",
    zh: "请输入正好 21 个压缩公钥（02/03 + 64 位十六进制），每行一个。",
  },
  registerProvisioningAccounts: {
    en: "Step 3/4 — registering AA agent accounts",
    zh: "第 3/4 步 — 注册 AA agent 账户",
  },
  registerProvisioningApp: {
    en: "Step 2/4 — registering the anchor app",
    zh: "第 2/4 步 — 注册 Anchor app",
  },
  registerProvisioningAgents: {
    en: "Step 4/4 — binding the 21 agents",
    zh: "第 4/4 步 — 绑定 21 个 agent",
  },
  registerProvisionedNote: {
    en: "Profit mode defaults to a ready-to-use candidate set; switch to your own keys for Trust (governance) voting.",
    zh: "收益模式默认使用现成的候选集；如需信任（治理）投票，请换成你自己的公钥。",
  },
  candidateKitTitle: {
    en: "Council candidate package",
    zh: "Council 候选人包",
  },
  candidateKitEmpty: { en: "No candidates loaded", zh: "尚未加载候选人" },
  candidateKitPartial: {
    en: "Candidate package incomplete",
    zh: "候选人包未完成",
  },
  candidateKitReady: { en: "Candidate package ready", zh: "候选人包已就绪" },
  candidatePreviewTitle: { en: "Candidate preview", zh: "候选人预览" },
  candidatePreviewEmpty: {
    en: "Use the default set for Profit mode, or paste your own 21 compressed public keys.",
    zh: "收益模式可使用默认候选集，也可以粘贴自己的 21 个压缩公钥。",
  },
  candidateRemaining: { en: "+{count} more keys", zh: "另有 {count} 个公钥" },
  registerModeTrustDesc: {
    en: "Staked NEO is routed to vote for council candidates via the anchor's 21 agents.",
    zh: "质押的 NEO 通过 Anchor 的 21 个 agent 投票给 council 候选人。",
  },
  registerModeProfitDesc: {
    en: "Staked NEO earns GAS yield from agent voting, without a governance mandate.",
    zh: "质押的 NEO 通过 agent 投票获得 GAS 收益，不承担治理职责。",
  },

  // No-agent (inert anchor) callout + stake gate
  noAgentsTitle: { en: "0/21 agents provisioned", zh: "0/21 个 agent 已配置" },
  noAgentsBody: {
    en: "This anchor has no AA agents yet, so staked NEO will not vote or earn GAS until the operator provisions agents in the admin console.",
    zh: "该 Anchor 尚无 AA agent，在运营方于管理员控制台配置 agent 之前，质押的 NEO 不会投票，也不会产生 GAS。",
  },
  noAgentsConfirm: {
    en: "Stake anyway — I understand this anchor earns nothing yet",
    zh: "仍然质押——我已了解该 Anchor 目前不产生收益",
  },
  noAgentsConfirmActive: {
    en: "Confirmed — staking enabled",
    zh: "已确认——可以质押",
  },

  // Reward-model explainer
  rewardModelTitle: { en: "How rewards work", zh: "奖励如何产生" },
  rewardModelBody: {
    en: "Staked NEO votes via the anchor's agents; the GAS those holdings generate is pooled in the reward reserve and shared pro-rata by stake. Rewards are variable and depend on the anchor being funded/harvested by its operator.",
    zh: "质押的 NEO 通过 Anchor 的 agent 投票；这些持仓产生的 GAS 汇入奖励储备，并按质押比例分配。奖励是浮动的，取决于运营方是否注入/收割该 Anchor 的收益。",
  },
  rewardPerNeoLabel: { en: "GAS / NEO (cumulative)", zh: "每 NEO GAS（累计）" },
  rewardPerNeoCaption: {
    en: "Cumulative GAS distributed per NEO since launch — not a current rate. 0 means the anchor has not distributed yet.",
    zh: "自上线以来每 NEO 累计分配的 GAS——并非当前收益率。为 0 表示该 Anchor 尚未分配过。",
  },

  // Anchor discovery
  discoverLabel: { en: "Browse anchors", zh: "浏览 Anchor" },
  discoverTitle: { en: "Registered anchors", zh: "已注册的 Anchor" },
  discoverEmpty: {
    en: "No registered anchors found yet.",
    zh: "暂未发现已注册的 Anchor。",
  },
  discoverRefresh: { en: "Refresh list", zh: "刷新列表" },
  discoverUse: { en: "Use", zh: "使用" },
  modeTrust: { en: "Trust", zh: "信任" },
  modeProfit: { en: "Profit", zh: "收益" },

  // Credit recovery
  creditTitle: { en: "Contract credits", zh: "合约额度" },
  creditBody: {
    en: "Over- or failed deposits are held as recoverable credit. Withdraw them back to your wallet anytime.",
    zh: "多付或失败的存款会作为可取回额度保留。可随时取回到你的钱包。",
  },
  creditNeo: { en: "NEO credit", zh: "NEO 额度" },
  creditGas: { en: "GAS credit", zh: "GAS 额度" },
  recoverNeo: { en: "Recover NEO", zh: "取回 NEO" },
  recoverGas: { en: "Recover GAS", zh: "取回 GAS" },
  recoverSubmitting: { en: "Recovering credit", zh: "正在取回额度" },
  recoverSubmitted: {
    en: "Credit recovered to your wallet",
    zh: "额度已取回到你的钱包",
  },
  noCreditToRecover: { en: "No recoverable credit.", zh: "没有可取回的额度。" },
  creditUnavailableTitle: { en: "Credit status unavailable", zh: "额度状态暂不可用" },
  creditUnavailableBody: {
    en: "The credit read did not return a valid amount. Nothing is shown as zero until the chain responds correctly.",
    zh: "额度读取未返回有效数值；链上数据恢复前不会将其显示为 0。",
  },
  creditDisconnectedBody: {
    en: "Connect a wallet to inspect wallet-scoped NEO and GAS credits.",
    zh: "连接钱包后可查看钱包对应的 NEO 与 GAS 额度。",
  },

  // Durable staged-operation recovery
  pendingOperationActive: { en: "Recovery in progress", zh: "正在恢复操作" },
  pendingOperationBody: {
    en: "The recorded stage is locked to this wallet, network, contract, and transaction. Check it before starting another write.",
    zh: "当前阶段已绑定到本钱包、网络、合约与交易；确认完成前不会开启新的写操作。",
  },
  pendingContinue: { en: "Continue confirmed setup", zh: "继续已确认的配置" },
  pendingCheck: { en: "Check pending transaction", zh: "检查待处理交易" },
  pendingRestored: { en: "Pending operation restored", zh: "已恢复待处理操作" },
  pendingReadyToContinue: { en: "This stage is ready to continue", zh: "当前阶段可以继续" },
  registerReadyToContinue: { en: "Previous stage confirmed; next stage is ready", zh: "上一阶段已确认；下一阶段可继续" },
  pendingWallet: { en: "Confirm this exact stage in your wallet", zh: "请在钱包中确认当前精确阶段" },
  pendingWalletCancelled: { en: "Wallet request cancelled before broadcast", zh: "钱包请求已在广播前取消" },
  pendingBroadcast: { en: "Transaction broadcast; waiting for exact confirmation", zh: "交易已广播；正在等待精确确认" },
  pendingChecking: { en: "Checking VM result, event, and readback", zh: "正在检查 VM 结果、事件与链上回读" },
  pendingStillWaiting: { en: "Confirmation is not available yet; do not resubmit", zh: "确认结果尚不可用；请勿重复提交" },
  pendingReadbackWaiting: { en: "Event confirmed; exact readback is still pending", zh: "事件已确认；精确链上回读仍在等待" },
  pendingMissingTxid: {
    en: "The wallet attempt has no recoverable transaction id. It remains pending and will not be replayed.",
    zh: "钱包尝试没有可恢复的交易 ID；操作会保持待处理且不会自动重播。",
  },
  pendingClearRejected: { en: "I rejected it — clear local record", zh: "我已拒绝——清除本地记录" },
  pendingClearedByUser: { en: "Unbroadcast wallet attempt cleared", zh: "未广播的钱包尝试已清除" },
  pendingFaultDetail: { en: "The VM returned FAULT. This stage has ended and can be reviewed before retrying.", zh: "VM 返回 FAULT；当前阶段已结束，可检查后重试。" },
  pendingEventMismatchDetail: { en: "The transaction halted, but its exact event does not match the recorded intent.", zh: "交易已 HALT，但精确事件与记录的意图不一致。" },
  pendingCorruptedDetail: { en: "The saved recovery record is malformed. No transaction will be replayed from it.", zh: "本地恢复记录格式异常；系统不会据此重播任何交易。" },
  stakeConfirmed: { en: "Stake confirmed on chain", zh: "质押已在链上确认" },
  withdrawConfirmed: { en: "Redeem confirmed on chain", zh: "赎回已在链上确认" },
  claimConfirmed: { en: "Reward claim confirmed on chain", zh: "奖励领取已在链上确认" },
  recoverConfirmed: { en: "Credit recovery confirmed on chain", zh: "额度取回已在链上确认" },
  pendingStage_register_fee: { en: "Registration fee", zh: "注册费用" },
  pendingStage_register_anchor: { en: "Anchor registration", zh: "Anchor 注册" },
  pendingStage_register_accounts: { en: "AA account provisioning", zh: "AA 账户配置" },
  pendingStage_register_agents: { en: "21-agent binding", zh: "21-agent 绑定" },
  pendingStage_stake: { en: "NEO stake", zh: "NEO 质押" },
  pendingStage_withdraw: { en: "NEO redeem", zh: "NEO 赎回" },
  pendingStage_claim: { en: "GAS claim", zh: "GAS 领取" },
  pendingStage_recover_credit: { en: "Credit recovery", zh: "额度取回" },
  pendingState_none: { en: "Clear", zh: "无待处理" },
  pendingState_prepared: { en: "Ready", zh: "可继续" },
  pendingState_attempted: { en: "Needs review", zh: "需要检查" },
  pendingState_pending: { en: "Confirming", zh: "确认中" },
  pendingState_readback: { en: "Reading chain", zh: "链上回读中" },
  pendingState_mismatch: { en: "Mismatch", zh: "不匹配" },
  pendingState_fault: { en: "Faulted", zh: "已失败" },
  pendingState_corrupted: { en: "Invalid record", zh: "记录异常" },
  pendingState_confirmed: { en: "Confirmed", zh: "已确认" },
  networkBindingLabel: { en: "Network and contract", zh: "网络与合约" },
  recoveryStorageLabel: { en: "Recovery storage", zh: "恢复存储" },
  networkState_bound: { en: "Pinned to launch network", zh: "已绑定启动网络" },
  networkState_verified: { en: "Wallet network verified", zh: "钱包网络已验证" },
  networkState_mismatch: { en: "Context mismatch", zh: "上下文不匹配" },
  networkState_unavailable: { en: "Unavailable", zh: "不可用" },
  storageState_ready: { en: "Round-trip verified", zh: "读写验证通过" },
  storageState_unavailable: { en: "Writes locked", zh: "写操作已锁定" },
  anchorDataUnavailable: { en: "Live data unavailable", zh: "实时数据暂不可用" },

  readyForAnchor: { en: "Anchor ready", zh: "Anchor 已就绪" },
  noAnchorTitle: { en: "Stake NEO to vote", zh: "质押 NEO 参与投票" },
  noAnchorBody: {
    en: "A custom anchor pools your NEO and votes for council candidates through 21 AA agents. Stake to direct your NEO voting power and earn a share of the GAS those votes generate.",
    zh: "自定义 Anchor 汇聚你的 NEO，并通过 21 个 AA agent 为 council 候选人投票。质押即可使用你的 NEO 投票权，并分享这些投票产生的 GAS。",
  },

  // Civic framing — what an anchor grants, surfaced up front in the hero.
  civicEyebrow: { en: "NEO governance", zh: "NEO 治理" },
  whatIsAnchorTitle: { en: "What is an anchor?", zh: "什么是 Anchor？" },
  whatIsAnchorBody: {
    en: "An anchor is a shared voting account. Your staked NEO keeps its voting power and is cast for the anchor's council candidates; you can redeem your NEO at any time.",
    zh: "Anchor 是一个共享投票账户。你质押的 NEO 保留其投票权，并投给该 Anchor 的 council 候选人；你可随时赎回自己的 NEO。",
  },

  // Onboarding next-step CTA (no anchor linked yet).
  onboardTitle: { en: "Get started", zh: "开始使用" },
  onboardBody: {
    en: "Paste an anchor id (custom-anchor:slug:nonce) in the field below, browse registered anchors, or register your own.",
    zh: "在下方字段粘贴 Anchor ID（custom-anchor:slug:nonce），浏览已注册的 Anchor，或注册你自己的。",
  },
  onboardBrowse: { en: "Browse anchors", zh: "浏览 Anchor" },
  onboardRegister: { en: "Register a new anchor", zh: "注册新 Anchor" },

  // Token + action clarifiers at the point of action.
  stakeTokenTag: { en: "spend NEO", zh: "支付 NEO" },
  withdrawTokenTag: { en: "return NEO", zh: "取回 NEO" },
  claimTokenTag: { en: "collect GAS", zh: "领取 GAS" },
  maintenanceLabel: { en: "Status", zh: "状态" },
  agentModel: { en: "21-agent AA model", zh: "21 个 AA agent 模型" },
  routingDetails: { en: "Routing details", zh: "调仓细节" },
  agentModelBody: {
    en: "Self-service registration provisions 21 deterministic AA accounts and binds the candidate route in a recoverable staged flow. User actions stay simple; later agent transfers and candidate changes remain admin-only.",
    zh: "自助注册会通过可恢复的分阶段流程配置 21 个确定性 AA 账户并绑定候选人路径。用户操作保持简单；后续 agent 调仓与候选人变更仍仅限管理员。",
  },
  docPurpose: { en: "What this app does", zh: "用途" },
  docPurposeBody: {
    en: "Custom Anchor is the user-facing staking surface for anchors created by teams or communities. It does not show low-level agent internals in the main flow.",
    zh: "Custom Anchor 是团队或社区创建 Anchor 后给用户使用的质押界面，主流程不展示底层 agent 细节。",
  },
  docSafety: { en: "Safety model", zh: "安全模型" },
  docSafetyBody: {
    en: "Funds are scoped by anchor appId. Redeem sends NEO back to the user; internal agent movement is restricted to the same anchor app and handled outside this user dApp.",
    zh: "资金按 Anchor appId 隔离。赎回只回到用户地址；内部 agent 调仓限制在同一个 Anchor app 内，并由用户 dApp 之外处理。",
  },
} as const;

export const messages = mergeMessages(appMessages);
