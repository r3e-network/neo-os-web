/**
 * Shared ProfitAnchor operator domain module.
 *
 * Canonical home of the ProfitAnchor composable + static agent roster
 * consumed by BOTH the `profitanchor` miniapp and the `profitanchor-admin`
 * operator console (which previously reached across app packages with
 * `../../profitanchor/src/...` source imports — dissolved per the
 * framework-extraction plan's Wave-6 note).
 */

export { useProfitAnchor } from "./useProfitAnchor";
export type {
  AnchorAdminInfo,
  AnchorAgent,
  ProfitAnchorStats,
  UseProfitAnchorOptions,
} from "./useProfitAnchor";
export { PROFITANCHOR_AGENT_ACCOUNTS } from "./agentAccounts";
export type { AgentAccountInfo } from "./agentAccounts";
