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
  readyForAnchor: { en: "Ready for", zh: "当前 Anchor" },
  noAnchorTitle: { en: "Open an anchor link", zh: "打开 Anchor 链接" },
  noAnchorBody: {
    en: "Scan a OneGate link with anchorAppId, or enter the anchor appId in the action panel.",
    zh: "扫码打开带 anchorAppId 的 OneGate 链接，或在右侧操作栏输入 Anchor appId。",
  },
  agentModel: { en: "21-agent AA model", zh: "21 个 AA agent 模型" },
  routingDetails: { en: "Routing details", zh: "调仓细节" },
  agentModelBody: {
    en: "Every custom anchor owns its own 21 deterministic AA agent accounts. User actions stay simple; agent transfers and candidate changes are admin-only.",
    zh: "每个自定义 Anchor 都有自己的 21 个确定性 AA agent。用户只做质押、赎回、领取；agent 调仓和候选人变更只在管理员侧处理。",
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
