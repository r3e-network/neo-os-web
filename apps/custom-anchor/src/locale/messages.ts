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
  pendingRewards: { en: "Claimable GAS", zh: "可领取 GAS" },
  totalStaked: { en: "Total staked", zh: "总质押" },
  rewardReserve: { en: "Reward reserve", zh: "奖励池" },
  agentCount: { en: "Agents", zh: "Agent 数" },
  lastTxid: { en: "Last tx", zh: "最近交易" },
  anchorLinked: { en: "Anchor linked", zh: "Anchor 已连接" },
  anchorMissing: { en: "Waiting for anchor", zh: "等待 Anchor" },
  anchorAwaitingLaunch: { en: "Open a OneGate anchor link", zh: "打开 OneGate Anchor 链接" },
  anchorAwaitingInput: {
    en: "Enter or open an anchor link to begin",
    zh: "输入或打开 Anchor 链接以开始",
  },
  anchorIdHint: {
    en: "Format: custom-anchor:slug:nonce",
    zh: "格式：custom-anchor:slug:nonce",
  },
  anchorWorkspaceLabel: { en: "Transaction route", zh: "交易路径" },
  anchorWorkspaceTitle: { en: "Anchor routing workspace", zh: "Anchor 路由工作台" },
  anchorWorkspaceBody: {
    en: "User actions stay scoped to the anchor appId while the 21-agent AA route remains visible before signing.",
    zh: "用户操作按 Anchor appId 隔离，签名前可见 21-agent AA 路由状态。",
  },
  anchorFlowTitle: { en: "Anchor transaction flow", zh: "Anchor 交易流程" },
  anchorFlowOpen: { en: "Open anchor", zh: "打开 Anchor" },
  anchorFlowAction: { en: "Choose action", zh: "选择操作" },
  anchorFlowSign: { en: "Sign wallet tx", zh: "钱包签名" },
  actionPanelLabel: { en: "Wallet actions", zh: "钱包操作" },
  actionPanelTitle: { en: "Stake, redeem, or claim", zh: "质押、赎回或领取" },
  actionPanelBody: {
    en: "Enter the custom anchor id, choose a whole NEO amount, then submit the exact wallet transaction for this anchor.",
    zh: "输入自定义 Anchor ID，选择整数 NEO 数量，然后为该 Anchor 提交对应的钱包交易。",
  },
  launchSource: { en: "Launch source", zh: "启动来源" },
  userRoute: { en: "User route", zh: "用户路径" },
  userRouteBody: { en: "Stake, redeem, or claim from the same anchor.", zh: "在同一 Anchor 内质押、赎回或领取。" },
  adminRoute: { en: "Admin route", zh: "管理员路径" },
  adminRouteBody: { en: "Agent movement stays outside the user flow.", zh: "Agent 调仓不进入用户流程。" },
  safetyRail: { en: "Safety rail", zh: "安全边界" },
  safetyRailBody: { en: "Funds remain scoped by anchor appId.", zh: "资金按 Anchor appId 隔离。" },
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
  refreshingStatus: { en: "Refreshing anchor status", zh: "正在刷新 Anchor 状态" },
  workflowFailed: { en: "Action failed", zh: "操作失败" },
  stakeSubmitting: { en: "Submitting stake transaction", zh: "正在提交质押交易" },
  withdrawSubmitting: { en: "Submitting redeem transaction", zh: "正在提交赎回交易" },
  claimSubmitting: { en: "Submitting reward claim", zh: "正在提交奖励领取" },
  stakeSubmitted: { en: "Stake transaction submitted", zh: "质押交易已提交" },
  withdrawSubmitted: { en: "Redeem transaction submitted", zh: "赎回交易已提交" },
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
  anchorAlreadyRegistered: { en: "That anchor id is already registered.", zh: "该 Anchor ID 已被注册。" },
  anchorNotRegisteredBadge: { en: "Not registered", zh: "未注册" },
  registerPanelLabel: { en: "Create anchor", zh: "创建 Anchor" },
  registerPanelTitle: { en: "Register a custom anchor", zh: "注册自定义 Anchor" },
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
    en: "Registering provisions all 21 AA agents in the same flow (3 wallet transactions: AA accounts → anchor app → agent council), so your anchor starts earning immediately. Externally-created anchors that skipped this stay at 0/21 until their operator provisions agents.",
    zh: "注册会在同一流程中配置全部 21 个 AA agent（3 笔钱包交易：AA 账户 → Anchor app → agent council），因此你的 Anchor 立即开始产生收益。未经此流程在外部创建的 Anchor 会停留在 0/21，直到运营方配置 agent。",
  },

  // Candidate council (21 compressed public keys) for agent provisioning
  registerCandidatesLabel: { en: "Council candidates (21 public keys)", zh: "Council 候选人（21 个公钥）" },
  registerCandidatesHint: {
    en: "One compressed public key (02/03 + 64 hex) per line — exactly 21. These are the council candidates your anchor's 21 agents vote for.",
    zh: "每行一个压缩公钥（02/03 + 64 位十六进制），共 21 个。这些是你的 Anchor 的 21 个 agent 所投票的 council 候选人。",
  },
  registerCandidatesPlaceholder: {
    en: "02abc...\n03def...\n(21 lines)",
    zh: "02abc...\n03def...\n（共 21 行）",
  },
  registerCandidatesUseDefault: { en: "Use default candidate set", zh: "使用默认候选集" },
  registerCandidatesCount: { en: "{count}/21 valid candidate keys", zh: "{count}/21 个有效候选公钥" },
  registerCandidatesInvalid: {
    en: "Enter exactly 21 compressed public keys (02/03 + 64 hex), one per line.",
    zh: "请输入正好 21 个压缩公钥（02/03 + 64 位十六进制），每行一个。",
  },
  registerProvisioningAccounts: { en: "Step 1/3 — registering AA agent accounts", zh: "第 1/3 步 — 注册 AA agent 账户" },
  registerProvisioningApp: { en: "Step 2/3 — registering the anchor app", zh: "第 2/3 步 — 注册 Anchor app" },
  registerProvisioningAgents: { en: "Step 3/3 — provisioning the 21 agents", zh: "第 3/3 步 — 配置 21 个 agent" },
  registerProvisionedNote: {
    en: "Profit mode defaults to a ready-to-use candidate set; switch to your own keys for Trust (governance) voting.",
    zh: "收益模式默认使用现成的候选集；如需信任（治理）投票，请换成你自己的公钥。",
  },
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
  noAgentsConfirmActive: { en: "Confirmed — staking enabled", zh: "已确认——可以质押" },

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
  discoverEmpty: { en: "No registered anchors found yet.", zh: "暂未发现已注册的 Anchor。" },
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
  recoverSubmitted: { en: "Credit recovered to your wallet", zh: "额度已取回到你的钱包" },
  noCreditToRecover: { en: "No recoverable credit.", zh: "没有可取回的额度。" },

  readyForAnchor: { en: "Anchor ready", zh: "Anchor 已就绪" },
  noAnchorTitle: { en: "Open an anchor link", zh: "打开 Anchor 链接" },
  noAnchorBody: {
    en: "Scan a OneGate link with anchorAppId, or enter the anchor appId in the action panel.",
    zh: "扫码打开带 anchorAppId 的 OneGate 链接，或在右侧操作栏输入 Anchor appId。",
  },
  agentModel: { en: "21-agent AA model", zh: "21 个 AA agent 模型" },
  routingDetails: { en: "Routing details", zh: "调仓细节" },
  agentModelBody: {
    en: "Every custom anchor can hold up to 21 deterministic AA agent accounts, but a newly registered anchor starts with 0 — its operator provisions agents in the admin console. User actions stay simple; agent transfers and candidate changes are admin-only.",
    zh: "每个自定义 Anchor 最多可拥有 21 个确定性 AA agent，但新注册的 Anchor 初始为 0——由运营方在管理员控制台配置。用户只做质押、赎回、领取；agent 调仓和候选人变更只在管理员侧处理。",
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
