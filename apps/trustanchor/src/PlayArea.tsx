/**
 * PlayArea.tsx -- TrustAnchor
 *
 * User-facing TrustAnchor staking surface.
 */

import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import type { TrustAnchorStats } from "./hooks/useTrustAnchor";
import "./PlayArea.scss";

interface PlayAreaProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Observable>;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
}

export default function PlayArea({ state }: PlayAreaProps) {
  const { val, num, str } = useStateBindings(state);

  const stats = val<TrustAnchorStats | null>("stats", null);
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
  const agentTotal = agentCount || agentAccounts.length || 21;
  const routeStatus = stats?.selectedAgentId ? "Route selected" : "Awaiting route";

  return (
    <div className="trustanchor-play-area">
      <section className="anchor-primary-card anchor-primary-card--trust">
        <div className="anchor-primary-card__lead">
          <span className="anchor-badge" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2 4 6v6c0 5 3.5 8 8 10 4.5-2 8-5 8-10V6l-8-4Z" />
              <path d="m9 12 2 2 4-4" />
            </svg>
          </span>
          <div className="anchor-primary-card__copy">
            <span className="anchor-kicker">TrustAnchor</span>
            <h2>Stake. Redeem. Claim.</h2>
            <p>
              NEO-backed rewards with manual AA agent voting handled in the
              admin console.
            </p>
          </div>
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

      <section className="anchor-workspace" aria-label="TrustAnchor staking workspace">
        <div className="anchor-status-card">
          <div className="anchor-section-head">
            <span>Transaction route</span>
            <h3>Stake routing workspace</h3>
            <p>
              Stake, redeem, and claim stay in the wallet flow while AA agent
              routing remains visible for every reward cycle.
            </p>
          </div>

          <div className="anchor-flow" aria-label="TrustAnchor transaction flow">
            <div>
              <span className="anchor-flow__number">01</span>
              <strong>Choose amount</strong>
            </div>
            <div>
              <span className="anchor-flow__number">02</span>
              <strong>Sign wallet tx</strong>
            </div>
            <div>
              <span className="anchor-flow__number">03</span>
              <strong>Track rewards</strong>
            </div>
          </div>

          <div className="anchor-guidance-grid">
            <div>
              <span>User flow</span>
              <strong>Stake, redeem, or claim without leaving TrustAnchor.</strong>
            </div>
            <div>
              <span>Agent route</span>
              <strong>
                {selectedAgent === "None"
                  ? "No active route selected yet."
                  : `Current route ${selectedAgent}.`}
              </strong>
            </div>
            <div>
              <span>Safety rail</span>
              <strong>Admin-only agent movement stays outside the user tx.</strong>
            </div>
          </div>
        </div>

        <aside className="anchor-route-card" aria-label="TrustAnchor route state">
          <span>Route state</span>
          <strong>{selectedAgent}</strong>
          <dl>
            <div>
              <dt>Status</dt>
              <dd>{routeStatus}</dd>
            </div>
            <div>
              <dt>Agents</dt>
              <dd>{agentTotal}/21</dd>
            </div>
            <div>
              <dt>Reward pool</dt>
              <dd>{rewardReserveDisplay}</dd>
            </div>
          </dl>
        </aside>
      </section>

      <details className="neo-card anchor-routing-model" open>
        <summary className="section-title">How routing is protected</summary>
        <div className="anchor-flow-list">
          <span>Current route: {selectedAgent}.</span>
          <span>
            {agentTotal}/21 AA agents registered for
            TrustAnchor.
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
