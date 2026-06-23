import { useCallback, useEffect, useState } from "react";
import { NeoButton, NeoCard, NeoInput } from "@shared/components-react";
import { StateView } from "@shared/components";
import { CategoryIcon } from "@shared/components-react/illustrations";
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
  const { val, str, bool } = useStateBindings(state);
  const stats = val<TrustAnchorStats | null>("stats", null);
  const agentAccounts =
    val<Array<Record<string, unknown>>>("agentAccounts", []) ?? [];
  // True once the on-chain directory has loaded. Until then the rows are the
  // static roster (kept for Move/Vote balance lookups), so we suppress the
  // full list and show a compact placeholder instead of 21 lookalike rows.
  const agentsLive = bool("agentsLive");
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
  // Only the confirmed-denied state makes the controls read-only. (Gating on
  // the transient "loading" state too dimmed the read-only grid via opacity,
  // which dropped the static labels below WCAG AA on first render; an
  // unauthorized click during loading harmlessly reverts on-chain anyway.)
  const controlsDisabled = isDenied;

  const [fromAgentId, setFromAgentId] = useState("1");
  const [toAgentId, setToAgentId] = useState("2");
  const [moveAmount, setMoveAmount] = useState("1");
  const [candidateAgentId, setCandidateAgentId] = useState("1");
  const [candidatePublicKey, setCandidatePublicKey] = useState("");
  // Seed the vote field with a sensible default ("1") so the third command card
  // paints with an example value like its two pre-filled siblings, then snap to
  // the live on-chain route once stats arrive. The voteAgentEdited guard below
  // stops tracking the moment the operator edits the field so we never clobber
  // their intent.
  const [voteAgentId, setVoteAgentId] = useState("1");
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

  const visibleAgents = agentAccounts.slice(0, 21);
  // Resolve an agent's on-chain NEO balance (read in main.tsx) by agent id.
  const agentBalanceById = (id: string): number | null => {
    const numeric = Number(id);
    if (!Number.isInteger(numeric)) return null;
    const match = visibleAgents.find(
      (agent, idx) => Number(agent.agentId ?? idx + 1) === numeric,
    );
    if (!match) return null;
    const raw = (match as Record<string, unknown>).neoBalance;
    return typeof raw === "number" ? raw : null;
  };
  // Pre-validate the move against the SOURCE agent's NEO balance so the operator
  // is not submitting a transfer the contract would revert (insufficient NEO).
  const sourceBalance = agentBalanceById(fromAgentId);
  const moveAmountNum = Number(moveAmount);
  const moveExceedsBalance =
    sourceBalance !== null &&
    Number.isFinite(moveAmountNum) &&
    moveAmountNum > 0 &&
    moveAmountNum > sourceBalance;
  // Account address for the agent whose vote is being synced (for the AA-witness note).
  const voteAgentAccount = (() => {
    const numeric = Number(voteAgentId);
    if (!Number.isInteger(numeric)) return "";
    const match = visibleAgents.find(
      (agent, idx) => Number(agent.agentId ?? idx + 1) === numeric,
    );
    if (!match) return "";
    return String(match.account ?? match.accountAddress ?? match.address ?? "");
  })();
  const shortVoteAccount = voteAgentAccount
    ? voteAgentAccount.length <= 16
      ? voteAgentAccount
      : `${voteAgentAccount.slice(0, 8)}…${voteAgentAccount.slice(-6)}`
    : "";

  const canMove =
    !controlsDisabled &&
    Boolean(fromAgentId.trim()) &&
    Boolean(toAgentId.trim()) &&
    Boolean(moveAmount.trim()) &&
    fromAgentId.trim() !== toAgentId.trim() &&
    !moveExceedsBalance;
  const canUpdateCandidate =
    !controlsDisabled &&
    Boolean(candidateAgentId.trim()) &&
    Boolean(candidatePublicKey.trim());
  const canSyncVote = !controlsDisabled && Boolean(voteAgentId.trim());
  const routeItems = [
    { label: t("selectedRoute"), value: selectedAgent },
    { label: t("agentCount"), value: agentCount },
    { label: t("trackedNeo"), value: totalNeoDisplay },
    { label: t("reserve"), value: reserveDisplay },
  ];
  const heroRouteSteps = [
    { label: t("moveNeo"), ready: canMove },
    { label: t("setCandidate"), ready: canUpdateCandidate },
    { label: t("syncVote"), ready: canSyncVote },
  ];

  return (
    <div className="anchor-admin-playarea anchor-admin-playarea--trust">
      <div className="anchor-admin-shell">
        <main className="anchor-admin-main">
          <section className="anchor-admin-hero anchor-admin-hero--staged">
            <div className="anchor-admin-hero-panel">
              <div className="anchor-admin-hero-top">
                <span className="anchor-admin-hero-badge">
                  <CategoryIcon name="governance" size={40} title={t("appName")} />
                </span>
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
              {!agentsLive && (
                <p className="anchor-admin-hero-caption">{t("statsAwaitConnect")}</p>
              )}
            </div>

            <figure className="anchor-admin-route-stage" aria-label={t("routeMapTitle")}>
              <picture aria-hidden="true">
                <source srcSet="./banner.avif" type="image/avif" />
                <source srcSet="./banner.webp" type="image/webp" />
                <img src="./banner.jpg" alt="" loading="eager" decoding="async" />
              </picture>
              <figcaption>
                <span>{t("routeMapTitle")}</span>
                <strong>{selectedAgent}</strong>
                <small>{totalNeoDisplay} · {reserveDisplay}</small>
              </figcaption>
              <ol className="anchor-admin-route-steps">
                {heroRouteSteps.map((step, index) => (
                  <li key={step.label} className={step.ready ? "is-ready" : undefined}>
                    <span>{index + 1}</span>
                    <strong>{step.label}</strong>
                  </li>
                ))}
              </ol>
              <div className="anchor-admin-route-beam" aria-hidden="true" />
            </figure>
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
              {sourceBalance !== null && (
                <p className="anchor-admin-move-hint">
                  {t("moveBalanceHint")}{" "}
                  <strong>
                    #{fromAgentId.trim()}: {sourceBalance} {t("agentBalanceLabel")}
                  </strong>
                </p>
              )}
              {moveExceedsBalance && (
                <p className="anchor-admin-move-error" role="alert">
                  {t("moveExceedsBalance")}
                </p>
              )}
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
              {voteAgentId.trim() && (
                <p className="anchor-admin-witness-note" role="note">
                  <strong>{t("voteWitnessTitle")}</strong>
                  <span>
                    {t("voteWitnessNote", {
                      agent: voteAgentId.trim(),
                      account: shortVoteAccount || t("agentBalanceUnknown"),
                    })}
                  </span>
                </p>
              )}
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
              <strong className="anchor-admin-count-pill">{agentCount}</strong>
            </div>
            <div className="anchor-admin-agent-scroll">
              <div
                className={`anchor-admin-agent-list${agentsLive ? "" : " is-resting"}`}
              >
                {visibleAgents.length === 0 ? (
                  adminState === "loading" ? (
                    <StateView
                      className="anchor-admin-agent-state"
                      kind="loading"
                      title={t("agentDirectoryLoading")}
                    />
                  ) : (
                    <StateView
                      className="anchor-admin-agent-state"
                      kind="empty"
                      icon={null}
                      title={t("agentDirectoryEmpty")}
                      hint={t("agentDirectoryEmptyHint")}
                    />
                  )
                ) : (
                  visibleAgents.map((agent, idx) => {
                    const address = String(
                      agent.account ??
                        agent.accountAddress ??
                        agent.address ??
                        agent.name ??
                        `agent-${idx + 1}`,
                    );
                    const rawBalance = (agent as Record<string, unknown>).neoBalance;
                    const balance =
                      typeof rawBalance === "number" ? rawBalance : null;
                    const hasActiveFlag = "active" in agent;
                    const isActive = Boolean(
                      (agent as Record<string, unknown>).active,
                    );
                    const candidate = String(
                      (agent as Record<string, unknown>).candidate ?? "",
                    );
                    const shortCandidate = candidate
                      ? candidate.length <= 16
                        ? candidate
                        : `${candidate.slice(0, 8)}…${candidate.slice(-6)}`
                      : "";
                    return (
                      <div key={idx} className="anchor-admin-agent-row">
                        <div className="anchor-admin-agent-row__top">
                          <span>#{String(agent.agentId ?? idx + 1)}</span>
                          <strong className="anchor-admin-agent-row__balance">
                            {balance !== null
                              ? `${balance} ${t("agentBalanceLabel")}`
                              : t("agentBalanceUnknown")}
                          </strong>
                          {hasActiveFlag && (
                            <span
                              className={`anchor-admin-agent-row__flag${isActive ? " is-active" : ""}`}
                            >
                              {isActive ? t("agentActive") : t("agentInactive")}
                            </span>
                          )}
                        </div>
                        <code title={address}>{address}</code>
                        <span className="anchor-admin-agent-row__candidate">
                          {t("agentCandidateLabel")}:{" "}
                          {shortCandidate || t("agentCandidateNone")}
                        </span>
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
            <p className="anchor-admin-yield-causality">{t("yieldCausality")}</p>
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
