import { useEffect, useRef, useState } from "react";
import { NeoButton, NeoCard, NeoInput } from "@shared/components-react";
import { StateView } from "@shared/components";
import { CategoryIcon } from "@shared/components-react/illustrations";
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
  // Track which action is in flight (string, not boolean) so each NeoButton can
  // show its own loading spinner during the multi-second wallet round-trip.
  const [busyAction, setBusyAction] = useState("");
  const submitting = Boolean(busyAction);
  const runDispatch = async (name: string, ...args: unknown[]) => {
    if (busyAction) return;
    setBusyAction(name);
    try {
      await dispatch(name, ...args);
    } finally {
      setBusyAction("");
    }
  };
  const stats = val<ProfitAnchorStats | null>("stats", null);
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
  const [voteAgentId, setVoteAgentId] = useState("1");
  // Stats are null on first render (loadAll is async), so the initial seed
  // above always resolves to "1". Once the live route arrives, pre-fill the
  // input to match selectedAgentId -- but only until the operator edits it,
  // so a manual choice is never clobbered by a later stats refresh.
  const voteEditedRef = useRef(false);
  const setVoteAgentIdManual = (value: string) => {
    voteEditedRef.current = true;
    setVoteAgentId(value);
  };
  const selectedAgentId = stats?.selectedAgentId;
  useEffect(() => {
    if (voteEditedRef.current) return;
    if (selectedAgentId && Number.isFinite(selectedAgentId)) {
      setVoteAgentId(String(selectedAgentId));
    }
  }, [selectedAgentId]);

  const visibleAgents = agentAccounts.slice(0, 21);
  // Live on-chain rows carry the `active` flag (set in loadAgents); the static
  // compile-time roster fallback does not. Use that to tell an armed directory
  // apart from the resting/unloaded fallback, so the resting state renders one
  // compact reference card instead of 21 near-identical "Candidate: none" rows.
  const agentsAreLive = visibleAgents.some((agent) => "active" in agent);
  const rosterCount = visibleAgents.length;
  // Stats arrive from getAnchorStats; null until the first load resolves. Drives
  // the "awaiting data" caption so the all-zero hero reads as loading, not broken.
  const statsLoaded = stats !== null;
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

  return (
    <div className="anchor-admin-playarea anchor-admin-playarea--profit">
      <div className="anchor-admin-shell">
        <main className="anchor-admin-main">
          <section className="anchor-admin-hero">
            <div className="anchor-admin-hero-top">
              <span className="anchor-admin-hero-badge">
                <CategoryIcon
                  name="finance"
                  size={40}
                  title={t("appName")}
                />
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
            {!statsLoaded && (
              <p className="anchor-admin-hero-await" role="status">
                {t("statsAwaitConnect")}
              </p>
            )}
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
              <span className="anchor-admin-step">{t("stepLabel", { step: 1 })}</span>
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
                disabled={!canMove || submitting}
                loading={busyAction === "transferAgentNeo"}
                onClick={() =>
                  runDispatch("transferAgentNeo", {
                    fromAgentId,
                    toAgentId,
                    amount: moveAmount,
                  })
                }
              >
                {t("submitMove")}
              </NeoButton>
              <p className="anchor-admin-card-rule">{t("cardRuleMove")}</p>
            </NeoCard>

            <NeoCard title={t("setCandidate")} className="anchor-admin-workflow-card">
              <span className="anchor-admin-step">{t("stepLabel", { step: 2 })}</span>
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
                disabled={!canUpdateCandidate || submitting}
                loading={busyAction === "setAgentCandidate"}
                onClick={() =>
                  runDispatch("setAgentCandidate", {
                    agentId: candidateAgentId,
                    candidate: candidatePublicKey,
                  })
                }
              >
                {t("submitCandidate")}
              </NeoButton>
              <p className="anchor-admin-card-rule">{t("cardRuleCandidate")}</p>
            </NeoCard>

            <NeoCard title={t("syncVote")} className="anchor-admin-workflow-card">
              <span className="anchor-admin-step">{t("stepLabel", { step: 3 })}</span>
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
                onChange={setVoteAgentIdManual}
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
                disabled={!canSyncVote || submitting}
                loading={busyAction === "voteAgent"}
                onClick={() => runDispatch("voteAgent", { agentId: voteAgentId })}
              >
                {t("submitVote")}
              </NeoButton>
              <p className="anchor-admin-card-rule">{t("cardRuleVote")}</p>
            </NeoCard>
          </section>
        </main>

        <aside className="anchor-admin-side">
          <section className="anchor-admin-agent-strip" aria-label={t("agentDirectoryTitle")}>
            <div className="anchor-admin-section-heading">
              <span>{t("agentDirectoryTitle")}</span>
              <strong className="anchor-admin-count-pill">{agentCount}</strong>
            </div>
            {visibleAgents.length === 0 ? (
              <div className="anchor-admin-agent-list anchor-admin-agent-list--state">
                {adminState === "loading" ? (
                  <StateView
                    className="anchor-admin-agent-state"
                    kind="loading"
                  />
                ) : (
                  <StateView
                    className="anchor-admin-agent-state"
                    kind="empty"
                    icon={null}
                    title={t("agentDirectoryEmpty")}
                  />
                )}
              </div>
            ) : !agentsAreLive ? (
              // Resting state: the static roster fallback (no live `active` flag).
              // A few skeleton rows + a one-line note read as "awaiting data"
              // instead of 21 near-identical "Candidate: none / —" rows.
              <div className="anchor-admin-agent-rest" role="status">
                <div className="anchor-admin-agent-skeletons" aria-hidden="true">
                  {[0, 1, 2].map((row) => (
                    <div key={row} className="anchor-admin-agent-skeleton" />
                  ))}
                </div>
                <p className="anchor-admin-agent-rest__note">
                  {t("directoryAwaitConnect")}
                </p>
                <span className="anchor-admin-agent-rest__count">
                  {t("directoryRosterNote", { count: rosterCount })}
                </span>
              </div>
            ) : (
              <div className="anchor-admin-agent-list">
                {visibleAgents.map((agent, idx) => {
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
                })}
              </div>
            )}
          </section>

          <section className="anchor-admin-safety-card" aria-label={t("operatorRule")}>
            <div className="anchor-admin-section-heading">
              <span>{t("operatorRule")}</span>
              <strong>{t("manualOnly")}</strong>
            </div>
            <p>{t("operatorRuleDesc")}</p>
            <p className="anchor-admin-yield-causality">{t("yieldCausality")}</p>
          </section>
        </aside>
      </div>
    </div>
  );
}
