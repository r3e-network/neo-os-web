import { mergeMessages } from "@shared/locale/base-messages";

const appMessages = {
  tabOverview: { en: "Overview", zh: "概览" },
  adminScope: { en: "Admin scope", zh: "管理范围" },
  trackedNeo: { en: "Tracked NEO", zh: "跟踪 NEO" },
  agentCount: { en: "Agents", zh: "Agent 数" },
  selectedRoute: { en: "Selected route", zh: "当前路由" },
  moveNeo: { en: "Move NEO", zh: "移动 NEO" },
  moveNeoDesc: {
    en: "Move whole NEO from one ProfitAnchor AA agent to another.",
    zh: "在 ProfitAnchor 的 AA agent 之间移动整数 NEO。",
  },
  submitMove: { en: "Submit move", zh: "提交调仓" },
  setCandidate: { en: "Update candidate", zh: "更新候选人" },
  setCandidateDesc: {
    en: "Change one agent's council candidate public key.",
    zh: "更新某个 agent 的 council candidate 公钥。",
  },
  submitCandidate: { en: "Update candidate", zh: "更新候选人" },
  syncVote: { en: "Sync vote", zh: "同步投票" },
  syncVoteDesc: {
    en: "Submit the chosen AA agent vote after manual routing.",
    zh: "在人工调仓后同步所选 AA agent 的投票。",
  },
  submitVote: { en: "Sync vote", zh: "同步投票" },
  fromAgentId: { en: "From agent", zh: "来源 agent" },
  toAgentId: { en: "To agent", zh: "目标 agent" },
  agentId: { en: "Agent", zh: "Agent" },
  neoAmount: { en: "NEO amount", zh: "NEO 数量" },
  candidatePublicKey: { en: "Candidate public key", zh: "候选人公钥" },
  operatorRule: { en: "Operator rule", zh: "运营边界" },
  operatorRuleDesc: {
    en: "ProfitAnchor Admin does only three things: move NEO between the app's own 21 AA agents, update an agent's vote target, and sync that vote.",
    zh: "ProfitAnchor Admin 只做三件事：在本 app 的 21 个 AA agent 间移动 NEO、更新 agent 投票目标、同步投票。",
  },
  anchorTransferSubmitted: {
    en: "Agent transfer submitted",
    zh: "Agent 调仓交易已提交",
  },
  candidateUpdateSubmitted: {
    en: "Candidate update submitted",
    zh: "候选人更新已提交",
  },
  voteSyncSubmitted: { en: "Vote sync submitted", zh: "投票同步已提交" },
} as const;

export const messages = mergeMessages(appMessages);
