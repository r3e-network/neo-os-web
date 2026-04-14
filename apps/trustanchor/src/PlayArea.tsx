/**
 * PlayArea.tsx -- TrustAnchor
 *
 * Full interactive staking console: hero gauge, stats overview,
 * routing/rebalance summaries, and stake/unstake/claim operations.
 */

import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import type { TrustAnchorStats } from "./hooks/useTrustAnchor";
import AnchorGaugeHero from "./components/AnchorGaugeHero";
import StakeOperationPanel from "./components/StakeOperationPanel";
import "./PlayArea.scss";

interface PlayAreaProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Observable>;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
}

export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { val, num, str } = useStateBindings(state);

  const stats = val<TrustAnchorStats | null>("stats", null);
  const pendingRewards = val<number>("pendingRewards", 0);
  const pendingWithdraw = val<number>("pendingWithdraw", 0);
  const agentAccounts = val<Array<Record<string, unknown>>>("agentAccounts", []) ?? [];
  const myStakeDisplay = str("myStakeDisplay", "0 NEO");
  const pendingRewardsDisplay = str("pendingRewardsDisplay", "0 GAS");
  const agentCount = num("agentCount");
  const ingressCount = num("ingressCount");

  return (
    <div className="trustanchor-play-area">
      <AnchorGaugeHero
        t={t}
        totalStaked={stats?.totalStaked ?? 0}
        agentCount={agentAccounts.length}
      />

      {/* Stats Overview */}
      <div className="stats-bar">
        <div className="stat-chip">
          <span className="stat-value">{myStakeDisplay}</span>
          <span className="stat-label">{t("myStake") || "My Stake"}</span>
        </div>
        <div className="stat-chip">
          <span className="stat-value">{pendingRewardsDisplay}</span>
          <span className="stat-label">{t("pendingRewards") || "Rewards"}</span>
        </div>
        <div className="stat-chip">
          <span className="stat-value">{agentCount}</span>
          <span className="stat-label">{t("agentCount") || "Agents"}</span>
        </div>
        <div className="stat-chip">
          <span className="stat-value">{ingressCount}</span>
          <span className="stat-label">{t("ingressCount") || "Ingress"}</span>
        </div>
      </div>

      {/* Routing Summary */}
      <div className="neo-card mb-4 px-1">
        <div className="section-header mb-4">
          <span className="section-title">{t("routingSummaryTitle") || "Routing Summary"}</span>
        </div>
        <span className="section-desc">{t("routingSummaryDesc") || "Overview of network routing."}</span>
      </div>

      {/* Rebalance Section */}
      <div className="neo-card px-1">
        <div className="section-header mb-4">
          <span className="section-title">{t("rebalanceTitle") || "Rebalance"}</span>
        </div>
        <span className="section-desc">{t("rebalanceDesc") || "Rebalance stake distribution."}</span>
      </div>

      {/* Agent Accounts Table */}
      {agentAccounts.length > 0 && (
        <div className="neo-card px-1">
          <div className="section-header mb-4">
            <span className="section-title">{t("agentAccounts") || "Agent Accounts"}</span>
            <span className="agent-badge">{agentAccounts.length}</span>
          </div>
          <div className="agent-list">
            {agentAccounts.slice(0, 5).map((agent, idx) => (
              <div key={idx} className="agent-row">
                <span className="agent-address">{String(agent.address ?? agent.name ?? `Agent ${idx + 1}`).slice(0, 20)}...</span>
                <span className="agent-status">{String(agent.status ?? (t("active") || "Active"))}</span>
              </div>
            ))}
            {agentAccounts.length > 5 && (
              <span className="more-agents">{t("moreAgents", { count: agentAccounts.length - 5 }) || `+${agentAccounts.length - 5} more`}</span>
            )}
          </div>
        </div>
      )}

      <StakeOperationPanel
        t={t}
        pendingRewards={pendingRewards ?? 0}
        pendingWithdraw={pendingWithdraw ?? 0}
        dispatch={dispatch}
      />
    </div>
  );
}
