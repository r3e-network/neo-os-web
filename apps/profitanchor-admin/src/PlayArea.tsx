import { useState } from "react";
import { NeoButton, NeoCard, NeoInput } from "@shared/components-react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import type { ProfitAnchorStats } from "../../profitanchor/src/hooks/useProfitAnchor";
import "./PlayArea.scss";

interface PlayAreaProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Observable>;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
}

export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { val, str } = useStateBindings(state);
  const stats = val<ProfitAnchorStats | null>("stats", null);
  const agentAccounts =
    val<Array<Record<string, unknown>>>("agentAccounts", []) ?? [];
  const totalNeoDisplay = str("totalNeoDisplay", "0 NEO");
  const selectedAgent = str("selectedAgentDisplay", "None");
  const agentCount = str("agentCountDisplay", "0 / 21");
  const reserveDisplay = `${stats?.rewardReserve ?? 0} GAS`;

  const [fromAgentId, setFromAgentId] = useState("1");
  const [toAgentId, setToAgentId] = useState("2");
  const [moveAmount, setMoveAmount] = useState("1");
  const [candidateAgentId, setCandidateAgentId] = useState("1");
  const [candidatePublicKey, setCandidatePublicKey] = useState("");
  const [voteAgentId, setVoteAgentId] = useState(
    stats?.selectedAgentId ? String(stats.selectedAgentId) : "1",
  );

  const canMove =
    Boolean(fromAgentId.trim()) &&
    Boolean(toAgentId.trim()) &&
    Boolean(moveAmount.trim()) &&
    fromAgentId.trim() !== toAgentId.trim();
  const canUpdateCandidate =
    Boolean(candidateAgentId.trim()) && Boolean(candidatePublicKey.trim());
  const canSyncVote = Boolean(voteAgentId.trim());
  const visibleAgents = agentAccounts.slice(0, 21).slice(0, 6);
  const routeItems = [
    { label: t("selectedRoute"), value: selectedAgent },
    { label: t("agentCount"), value: agentCount },
    { label: t("trackedNeo"), value: totalNeoDisplay },
    { label: t("reserve"), value: reserveDisplay },
  ];

  return (
    <div className="anchor-admin-playarea anchor-admin-playarea--profit">
      <div className="anchor-admin-shell">
        <main className="anchor-admin-main">
          <section className="anchor-admin-hero">
            <div className="anchor-admin-hero-copy">
              <span className="anchor-admin-kicker">ProfitAnchor Admin</span>
              <h2>{t("adminHeroTitle")}</h2>
              <p>{t("adminHeroSubtitle")}</p>
            </div>
            <div className="anchor-admin-meter" aria-label={t("trackedNeo")}>
              <strong>{totalNeoDisplay}</strong>
              <span>{t("trackedNeo")}</span>
            </div>
          </section>

          <section className="anchor-admin-route-map" aria-label={t("routeMapTitle")}>
            <div className="anchor-admin-section-heading">
              <span>{t("routeMapTitle")}</span>
              <strong>{selectedAgent}</strong>
            </div>
            <div className="anchor-admin-route-grid">
              {routeItems.map((item) => (
                <div key={item.label} className="anchor-admin-route-tile">
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
              ))}
            </div>
          </section>

          <section className="anchor-admin-command-grid" aria-label={t("adminCommandCenter")}>
            <NeoCard title={t("moveNeo")} className="anchor-admin-workflow-card">
              <p>{t("moveNeoDesc")}</p>
              <div className="anchor-admin-form-grid">
                <NeoInput
                  type="number"
                  min={1}
                  max={21}
                  label={t("fromAgentId")}
                  value={fromAgentId}
                  onChange={setFromAgentId}
                />
                <NeoInput
                  type="number"
                  min={1}
                  max={21}
                  label={t("toAgentId")}
                  value={toAgentId}
                  onChange={setToAgentId}
                />
                <NeoInput
                  type="number"
                  min={1}
                  label={t("neoAmount")}
                  suffix="NEO"
                  value={moveAmount}
                  onChange={setMoveAmount}
                />
              </div>
              <NeoButton
                block
                variant="primary"
                disabled={!canMove}
                onClick={() =>
                  dispatch("transferAgentNeo", {
                    fromAgentId,
                    toAgentId,
                    amount: moveAmount,
                  })
                }
              >
                {t("submitMove")}
              </NeoButton>
            </NeoCard>

            <NeoCard title={t("setCandidate")} className="anchor-admin-workflow-card">
              <p>{t("setCandidateDesc")}</p>
              <NeoInput
                type="number"
                min={1}
                max={21}
                label={t("agentId")}
                value={candidateAgentId}
                onChange={setCandidateAgentId}
              />
              <NeoInput
                label={t("candidatePublicKey")}
                placeholder="02..."
                value={candidatePublicKey}
                onChange={setCandidatePublicKey}
              />
              <NeoButton
                block
                variant="primary"
                disabled={!canUpdateCandidate}
                onClick={() =>
                  dispatch("setAgentCandidate", {
                    agentId: candidateAgentId,
                    candidate: candidatePublicKey,
                  })
                }
              >
                {t("submitCandidate")}
              </NeoButton>
            </NeoCard>

            <NeoCard title={t("syncVote")} className="anchor-admin-workflow-card">
              <p>{t("syncVoteDesc")}</p>
              <div className="anchor-admin-vote-preview">
                <span>{t("currentVoteRoute")}</span>
                <strong>{selectedAgent}</strong>
              </div>
              <NeoInput
                type="number"
                min={1}
                max={21}
                label={t("agentId")}
                value={voteAgentId}
                onChange={setVoteAgentId}
              />
              <NeoButton
                block
                variant="erobo"
                disabled={!canSyncVote}
                onClick={() => dispatch("voteAgent", { agentId: voteAgentId })}
              >
                {t("submitVote")}
              </NeoButton>
            </NeoCard>
          </section>
        </main>

        <aside className="anchor-admin-side">
          <section className="anchor-admin-agent-strip" aria-label={t("agentDirectoryTitle")}>
            <div className="anchor-admin-section-heading">
              <span>{t("agentDirectoryTitle")}</span>
              <strong>{agentCount}</strong>
            </div>
            {visibleAgents.map((agent, idx) => (
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
          </section>

          <section className="anchor-admin-safety-card" aria-label={t("operatorRule")}>
            <div className="anchor-admin-section-heading">
              <span>{t("operatorRule")}</span>
              <strong>{t("manualOnly")}</strong>
            </div>
            <p>{t("operatorRuleDesc")}</p>
            <div className="anchor-admin-safety-list">
              <span>{t("safetyMove")}</span>
              <span>{t("safetyTarget")}</span>
              <span>{t("safetyVote")}</span>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
