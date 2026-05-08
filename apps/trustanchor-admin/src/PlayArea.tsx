import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import type { TrustAnchorStats } from "../../trustanchor/src/hooks/useTrustAnchor";
import "./PlayArea.scss";

interface PlayAreaProps {
  state: Record<string, Observable>;
}

export default function PlayArea({ state }: PlayAreaProps) {
  const { val, str } = useStateBindings(state);
  const stats = val<TrustAnchorStats | null>("stats", null);
  const agentAccounts =
    val<Array<Record<string, unknown>>>("agentAccounts", []) ?? [];
  const totalNeoDisplay = str("totalNeoDisplay", "0 NEO");
  const selectedAgent = str("selectedAgentDisplay", "None");
  const agentCount = str("agentCountDisplay", "0 / 21");

  return (
    <div className="anchor-admin-playarea anchor-admin-playarea--trust">
      <section className="anchor-admin-hero">
        <div>
          <span className="anchor-admin-kicker">TrustAnchor Admin</span>
          <h2>Move. Target. Vote.</h2>
          <p>
            Manual NEO routing only. Funds move between TrustAnchor AA agents,
            then the selected agent vote is synced explicitly.
          </p>
        </div>
        <div className="anchor-admin-meter">
          <strong>{totalNeoDisplay}</strong>
          <span>tracked</span>
        </div>
      </section>

      <div className="anchor-admin-stat-row">
        <span>
          <strong>{selectedAgent}</strong>
          selected route
        </span>
        <span>
          <strong>{agentCount}</strong>
          agents
        </span>
        <span>
          <strong>{stats?.rewardReserve ?? 0} GAS</strong>
          reserve
        </span>
      </div>

      <details className="anchor-admin-details">
        <summary>Agent details</summary>
        <div className="anchor-admin-agent-list">
          {agentAccounts.slice(0, 21).map((agent, idx) => (
            <div key={idx} className="anchor-admin-agent-row">
              <span>#{String(agent.agentId ?? idx + 1)}</span>
              <code>
                {String(
                  agent.accountAddress ??
                    agent.address ??
                    agent.name ??
                    `agent-${idx + 1}`,
                )}
              </code>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}
