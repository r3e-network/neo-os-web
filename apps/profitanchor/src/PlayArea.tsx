/**
 * PlayArea.tsx -- ProfitAnchor
 *
 * Manual AA agent routing console for ProfitAnchor.
 */

import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import type { ProfitAnchorStats } from "./hooks/useProfitAnchor";
import "./PlayArea.scss";

interface PlayAreaProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Observable>;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
}

export default function PlayArea({ state }: PlayAreaProps) {
  const { val, num, str } = useStateBindings(state);

  const stats = val<ProfitAnchorStats | null>("stats", null);
  const agentAccounts =
    val<Array<Record<string, unknown>>>("agentAccounts", []) ?? [];
  const agentCount = num("agentCount");
  const myStakeDisplay = str("myStakeDisplay", "0 NEO");
  const pendingRewardsDisplay = str("pendingRewardsDisplay", "0 GAS");
  const rewardReserveDisplay = str("rewardReserveDisplay", "0 GAS");
  const totalNeoDisplay = str("totalNeoDisplay", "0 NEO");
  const selectedAgent = stats?.selectedAgentId
    ? `#${stats.selectedAgentId}`
    : "None";

  return (
    <div className="profitanchor-play-area">
      <section className="anchor-primary-card anchor-primary-card--profit">
        <div>
          <span className="anchor-kicker">ProfitAnchor</span>
          <h2>Stake. Redeem. Claim.</h2>
          <p>
            NEO-backed rewards with manual AA agent routing handled in the
            admin console.
          </p>
        </div>
        <div className="anchor-score">
          <span>{myStakeDisplay}</span>
          <small>your stake</small>
        </div>
      </section>

      <div className="anchor-stat-grid">
        <div className="stat-chip">
          <span className="stat-value">{pendingRewardsDisplay}</span>
          <span className="stat-label">Claimable</span>
        </div>
        <div className="stat-chip">
          <span className="stat-value">
            {totalNeoDisplay || `${stats?.totalStaked ?? 0} NEO`}
          </span>
          <span className="stat-label">Total staked</span>
        </div>
        <div className="stat-chip">
          <span className="stat-value">{rewardReserveDisplay}</span>
          <span className="stat-label">Reward reserve</span>
        </div>
      </div>

      <details className="neo-card">
        <summary className="section-title">Routing details</summary>
        <div className="anchor-flow-list">
          <span>Current route: {selectedAgent}.</span>
          <span>
            {agentCount || agentAccounts.length}/21 AA agents registered for
            ProfitAnchor.
          </span>
          <span>
            Operators move NEO between candidate agents and update vote targets
            when the council set changes.
          </span>
        </div>
        <div className="agent-list">
          {agentAccounts.slice(0, 21).map((agent, idx) => (
            <div key={idx} className="agent-row">
              <span className="agent-address">
                {String(
                  agent.accountAddress ??
                    agent.address ??
                    agent.name ??
                    `agent-${idx + 1}`,
                )}
              </span>
              <span className="agent-status">
                candidate {String(agent.agentId ?? idx + 1)}
              </span>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}
