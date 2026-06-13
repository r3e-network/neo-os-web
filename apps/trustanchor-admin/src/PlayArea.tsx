import { useCallback, useEffect, useState } from "react";
import { NeoButton, NeoCard, NeoInput } from "@shared/components-react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import type { TrustAnchorStats } from "../../trustanchor/src/hooks/useTrustAnchor";
import "./PlayArea.scss";

interface PlayAreaProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Observable>;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
}

export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { val, str } = useStateBindings(state);
  const stats = val<TrustAnchorStats | null>("stats", null);
  const agentAccounts =
    val<Array<Record<string, unknown>>>("agentAccounts", []) ?? [];
  const totalNeoDisplay = str("totalNeoDisplay", "0 NEO");
  const selectedAgent = str("selectedAgentDisplay", t("noneFallback"));
  const agentCount = str("agentCountDisplay", "0 / 21");
  const reserveDisplay = str("reserveDisplay", "0 GAS");
  // Admin-role gating: until admin() + getAppAdmin resolve we keep the console
  // neutral; a non-operator gets a read-only state instead of a fully armed
  // console that only fails with a raw contract "unauthorized" assert.
  const adminState = str("adminState", "loading");
  const expectedAdmin = str("expectedAdminDisplay", "");
  const isDenied = adminState === "denied";
  const controlsDisabled = isDenied;

  const [fromAgentId, setFromAgentId] = useState("1");
  const [toAgentId, setToAgentId] = useState("2");
  const [moveAmount, setMoveAmount] = useState("1");
  const [candidateAgentId, setCandidateAgentId] = useState("1");
  const [candidatePublicKey, setCandidatePublicKey] = useState("");
  // Seed the vote field with the live on-chain route once stats arrive, but
  // stop tracking the moment the operator edits the field so we never clobber
  // their intent. The useState initializer alone runs when stats is still null,
  // so without this effect the field would freeze on the placeholder value.
  const [voteAgentId, setVoteAgentId] = useState("");
  const [voteAgentEdited, setVoteAgentEdited] = useState(false);
  const selectedAgentId = stats?.selectedAgentId;

  useEffect(() => {
    if (voteAgentEdited) return;
    if (selectedAgentId && selectedAgentId > 0) {
      setVoteAgentId(String(selectedAgentId));
    }
  }, [selectedAgentId, voteAgentEdited]);

  const onVoteAgentIdChange = useCallback((next: string) => {
    setVoteAgentEdited(true);
    setVoteAgentId(next);
  }, []);

  // In-flight guards: one per fund-moving action. Each is set true before the
  // first await and reset in finally so a double-click (or a click while the
  // first call is still settling) cannot fire the same transfer/vote twice.
  const [movingNeo, setMovingNeo] = useState(false);
  const [updatingCandidate, setUpdatingCandidate] = useState(false);
  const [syncingVote, setSyncingVote] = useState(false);

  const submitMove = useCallback(async () => {
    if (movingNeo) return;
    setMovingNeo(true);
    try {
      await dispatch("transferAgentNeo", {
        fromAgentId,
        toAgentId,
        amount: moveAmount,
      });
    } finally {
      setMovingNeo(false);
    }
  }, [movingNeo, dispatch, fromAgentId, toAgentId, moveAmount]);

  const submitCandidate = useCallback(async () => {
    if (updatingCandidate) return;
    setUpdatingCandidate(true);
    try {
      await dispatch("setAgentCandidate", {
        agentId: candidateAgentId,
        candidate: candidatePublicKey,
      });
    } finally {
      setUpdatingCandidate(false);
    }
  }, [updatingCandidate, dispatch, candidateAgentId, candidatePublicKey]);

  const submitVote = useCallback(async () => {
    if (syncingVote) return;
    setSyncingVote(true);
    try {
      await dispatch("voteAgent", { agentId: voteAgentId });
    } finally {
      setSyncingVote(false);
    }
  }, [syncingVote, dispatch, voteAgentId]);

  const canMove =
    !controlsDisabled &&
    Boolean(fromAgentId.trim()) &&
    Boolean(toAgentId.trim()) &&
    Boolean(moveAmount.trim()) &&
    fromAgentId.trim() !== toAgentId.trim();
  const canUpdateCandidate =
    !controlsDisabled &&
    Boolean(candidateAgentId.trim()) &&
    Boolean(candidatePublicKey.trim());
  const canSyncVote = !controlsDisabled && Boolean(voteAgentId.trim());
  const visibleAgents = agentAccounts.slice(0, 21);
  const routeItems = [
    { label: t("selectedRoute"), value: selectedAgent },
    { label: t("agentCount"), value: agentCount },
    { label: t("trackedNeo"), value: totalNeoDisplay },
    { label: t("reserve"), value: reserveDisplay },
  ];

  return (
    <div className="anchor-admin-playarea anchor-admin-playarea--trust">
      <div className="anchor-admin-shell">
        <main className="anchor-admin-main">
          <section className="anchor-admin-hero">
            <div className="anchor-admin-hero-top">
              <div className="anchor-admin-hero-badge" aria-hidden="true">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 3l7 3v5c0 4.2-2.9 7.5-7 9-4.1-1.5-7-4.8-7-9V6l7-3z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                </svg>
              </div>
              <div className="anchor-admin-hero-copy">
                <span className="anchor-admin-kicker">{t("appName")}</span>
                <h2>{t("adminHeroTitle")}</h2>
                <p>{t("adminHeroSubtitle")}</p>
              </div>
            </div>
            <div className="anchor-admin-hero-stats">
              {routeItems.map((item) => (
                <div key={item.label} className="anchor-admin-hero-stat">
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
              ))}
            </div>
          </section>

          {isDenied && (
            <div className="anchor-admin-role-banner" role="status">
              <span className="anchor-admin-role-banner__eyebrow">
                {t("operatorRequiredEyebrow")}
              </span>
              <strong>{t("operatorRequiredTitle")}</strong>
              <p>
                {expectedAdmin
                  ? t("operatorRequiredBody", { address: expectedAdmin })
                  : t("operatorRequiredBodyNoAddress")}
              </p>
            </div>
          )}

          <section
            className={`anchor-admin-command-grid${controlsDisabled ? " is-readonly" : ""}`}
            aria-label={t("adminCommandCenter")}
          >
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
                disabled={!canMove || movingNeo}
                loading={movingNeo}
                onClick={submitMove}
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
                disabled={!canUpdateCandidate || updatingCandidate}
                loading={updatingCandidate}
                onClick={submitCandidate}
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
                onChange={onVoteAgentIdChange}
              />
              <NeoButton
                block
                variant="primary"
                disabled={!canSyncVote || syncingVote}
                loading={syncingVote}
                onClick={submitVote}
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
            <div className="anchor-admin-agent-scroll">
              <div className="anchor-admin-agent-list">
                {visibleAgents.length === 0 ? (
                  <div className="anchor-admin-agent-empty">{t("agentDirectoryEmpty")}</div>
                ) : (
                  visibleAgents.map((agent, idx) => {
                    const address = String(
                      agent.account ??
                        agent.accountAddress ??
                        agent.address ??
                        agent.name ??
                        `agent-${idx + 1}`,
                    );
                    return (
                      <div key={idx} className="anchor-admin-agent-row">
                        <span>#{String(agent.agentId ?? idx + 1)}</span>
                        <code title={address}>{address}</code>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
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
