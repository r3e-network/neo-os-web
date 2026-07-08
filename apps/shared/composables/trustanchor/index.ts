/**
 * Shared TrustAnchor operator domain module.
 *
 * Canonical home of the TrustAnchor composable + static agent roster
 * consumed by BOTH the `trustanchor` miniapp and the `trustanchor-admin`
 * operator console (which previously reached across app packages with
 * `../../trustanchor/src/...` source imports — dissolved per the
 * framework-extraction plan's Wave-6 note).
 */

export { useTrustAnchor } from "./useTrustAnchor";
export type {
  AnchorAdminInfo,
  AnchorAgent,
  TrustAnchorStats,
  UseTrustAnchorOptions,
} from "./useTrustAnchor";
export { TRUSTANCHOR_AGENT_ACCOUNTS } from "./agentAccounts";
export type { AgentAccountInfo } from "./agentAccounts";
