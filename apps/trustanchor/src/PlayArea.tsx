/**
 * PlayArea.tsx -- TrustAnchor
 *
 * User-facing TrustAnchor staking surface.
 */

import { useMemo, useState } from "react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import type { TrustAnchorStats } from "./hooks/useTrustAnchor";
import "./PlayArea.scss";

interface PlayAreaProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Observable>;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
}

type AnchorActionHistoryItem = {
  action: string;
  amount?: string;
  status: string;
  txid?: string;
  at?: string;
};

const STAKE_AMOUNT_PRESETS = ["1", "10", "25", "100"];

function normalizeNeoAmount(value: string): string {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return value.trim();
  return String(Math.trunc(numeric));
}

function isWholeNeo(value: string): boolean {
  return /^[1-9]\d*$/.test(value.trim());
}

function formatTx(txid: string): string {
  if (!txid) return "";
  if (txid.length <= 20) return txid;
  return `${txid.slice(0, 10)}...${txid.slice(-8)}`;
}

function formatAddress(value: string): string {
  if (!value) return "";
  if (value.length <= 20) return value;
  return `${value.slice(0, 10)}...${value.slice(-6)}`;
}

export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { val, num, str } = useStateBindings(state);

  const stats = val<TrustAnchorStats | null>("stats", null);
  const agentAccounts =
    val<Array<Record<string, unknown>>>("agentAccounts", []) ?? [];
  const actionHistory =
    val<AnchorActionHistoryItem[]>("actionHistory", []) ?? [];
  const agentCount = num("agentCount");
  const pendingRewards = num("pendingRewards");
  const pendingWithdraw = num("pendingWithdraw");
  const myStakeDisplay = str("myStakeDisplay", "0 NEO");
  const pendingRewardsDisplay = str("pendingRewardsDisplay", "0 GAS");
  const pendingWithdrawDisplay = str("pendingWithdrawDisplay", "0 NEO");
  const rewardReserveDisplay = str("rewardReserveDisplay", "0 GAS");
  const rewardPerNeoDisplay = str("rewardPerNeoDisplay", "0");
  const totalNeoDisplay = str("totalNeoDisplay", "0 NEO");
  const workflowStatus = str("workflowStatus", t("workflowReady"));
  const lastError = str("lastError");
  const lastTxid = str("lastTxid");
  const submitting = val<boolean>("submitting", false) ?? false;
  const [amountInput, setAmountInput] = useState("1");
  const [localError, setLocalError] = useState("");
  const [busyAction, setBusyAction] = useState("");
  const selectedAgent = stats?.selectedAgentId
    ? `#${stats.selectedAgentId}`
    : t("noneFallback");
  const hasAgentStats = agentCount > 0 || agentAccounts.length > 0;
  const agentTotal = agentCount || agentAccounts.length || 0;
  const agentTotalDisplay = hasAgentStats ? String(agentTotal) : "—";
  const routeStatus = stats?.selectedAgentId
    ? t("routeSelected")
    : t("awaitingRoute");
  const amountIsValid = useMemo(() => isWholeNeo(amountInput), [amountInput]);
  const normalizedAmount = useMemo(
    () => normalizeNeoAmount(amountInput),
    [amountInput],
  );
  // Gate hero/stat displays on whether chain stats have loaded, mirroring
  // sibling profitanchor: show the em-dash placeholder until data lands so a
  // genuine on-chain 0 is distinguishable from data-not-loaded.
  const placeholder = "—";
  const hasData = Boolean(stats);
  const statusText = localError || lastError || workflowStatus;
  // Reflect the shared in-flight lock so PlayArea buttons disable while a
  // submission started from the manifest operation panel is still in flight.
  const isBusy = Boolean(busyAction) || submitting;
  const claimReady = pendingRewards > 0;
  const canRecoverCredit = pendingWithdraw > 0;

  const runAmountAction = async (action: "stakeNeo" | "withdrawNeo") => {
    if (!amountIsValid) {
      setLocalError(t("invalidAmount"));
      return;
    }
    setLocalError("");
    setBusyAction(action);
    try {
      await dispatch(action, { amount: normalizedAmount });
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : t("workflowFailed"));
    } finally {
      setBusyAction("");
    }
  };

  const runSimpleAction = async (
    action: "claimRewards" | "refreshAnchor" | "recoverNeoCredit",
  ) => {
    setLocalError("");
    setBusyAction(action);
    try {
      await dispatch(action);
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : t("workflowFailed"));
    } finally {
      setBusyAction("");
    }
  };

  return (
    <div className="trustanchor-play-area">
      <section className="anchor-primary-card anchor-primary-card--trust">
        <div className="anchor-primary-card__copy">
          <div className="anchor-primary-card__brand">
            <span className="anchor-badge" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2 4 6v6c0 5 3.5 8 8 10 4.5-2 8-5 8-10V6l-8-4Z" />
                <path d="m9 12 2 2 4-4" />
              </svg>
            </span>
            <span className="anchor-kicker">{t("appName")}</span>
          </div>
          <h2>{t("heroTitle")}</h2>
          <p>{t("heroDescription")}</p>
          <div className="anchor-hero-facts" aria-label={t("heroFactsLabel")}>
            <span>{t("heroFactAgents")}</span>
            <span>{t("heroFactReserve")}</span>
            <span>{t("heroFactVariable")}</span>
          </div>
          {!hasData && (
            <p className="anchor-connect-prompt">{t("connectPrompt")}</p>
          )}
        </div>
        <figure className="anchor-stage-card" aria-label={t("stageAria")}>
          <img
            src="./trustanchor-stage.jpg"
            alt=""
            loading="eager"
            decoding="async"
          />
          <figcaption>
            <span>{t("stageCaption")}</span>
            <strong className={hasData ? undefined : "anchor-score__placeholder"}>
              {hasData ? myStakeDisplay : placeholder}
            </strong>
            <small>{t("myStake")}</small>
          </figcaption>
        </figure>
      </section>

      <div className="anchor-stat-grid">
        <div className="stat-chip">
          <span className={`stat-value${hasData ? "" : " stat-value--placeholder"}`}>
            {hasData ? pendingRewardsDisplay : placeholder}
          </span>
          <span className="stat-label">{t("pendingRewards")}</span>
        </div>
        <div className="stat-chip">
          <span className={`stat-value${hasData ? "" : " stat-value--placeholder"}`}>
            {hasData
              ? totalNeoDisplay || `${stats?.totalStaked ?? 0} NEO`
              : placeholder}
          </span>
          <span className="stat-label">{t("totalNeoTracked")}</span>
        </div>
        <div className="stat-chip">
          <span className={`stat-value${hasData ? "" : " stat-value--placeholder"}`}>
            {hasData ? rewardReserveDisplay : placeholder}
          </span>
          <span className="stat-label">{t("rewardReserve")}</span>
        </div>
        <div className="stat-chip">
          <span className={`stat-value${hasData ? "" : " stat-value--placeholder"}`}>
            {hasData ? pendingWithdrawDisplay : placeholder}
          </span>
          <span className="stat-label">{t("pendingWithdraw")}</span>
        </div>
      </div>

      <section className="anchor-earn-card" aria-label={t("earnTitle")}>
        <span className="anchor-earn-card__title">{t("earnTitle")}</span>
        <ul className="anchor-earn-card__list">
          <li>{t("earnLine1")}</li>
          <li>{t("earnLine2")}</li>
          <li>{t("earnLine3")}</li>
        </ul>
      </section>

      <section className="anchor-workspace" aria-label={t("stakingWorkspaceLabel")}>
        <div className="anchor-status-card">
          <div className="anchor-section-head">
            <span>{t("actionPanelLabel")}</span>
            <h3>{t("actionPanelTitle")}</h3>
            <p>{t("actionPanelBody")}</p>
          </div>

          <div className="anchor-action-panel">
            <label className="anchor-amount-field">
              <span>{t("neoAmount")}</span>
              <input
                type="number"
                inputMode="numeric"
                min="1"
                step="1"
                value={amountInput}
                aria-invalid={!amountIsValid}
                disabled={isBusy}
                onChange={(event) => setAmountInput(event.currentTarget.value)}
              />
            </label>

            <div className="anchor-amount-presets" aria-label={t("stakePresetLabel")}>
              {STAKE_AMOUNT_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  className={amountInput === preset ? "is-active" : undefined}
                  disabled={isBusy}
                  onClick={() => setAmountInput(preset)}
                >
                  {preset} NEO
                </button>
              ))}
            </div>

            <div className="anchor-action-buttons" aria-label={t("actionPanelTitle")}>
              <button
                type="button"
                className="anchor-action-button anchor-action-button--primary"
                disabled={isBusy || !amountIsValid}
                onClick={() => void runAmountAction("stakeNeo")}
              >
                {busyAction === "stakeNeo" ? t("workflowSubmitting") : t("submitStake")}
              </button>
              <button
                type="button"
                className="anchor-action-button"
                disabled={isBusy || !amountIsValid}
                onClick={() => void runAmountAction("withdrawNeo")}
              >
                {busyAction === "withdrawNeo" ? t("workflowSubmitting") : t("submitWithdraw")}
              </button>
              <button
                type="button"
                className="anchor-action-button"
                disabled={isBusy || !claimReady}
                title={claimReady ? undefined : t("noRewardsHint")}
                onClick={() => void runSimpleAction("claimRewards")}
              >
                {busyAction === "claimRewards" ? t("workflowSubmitting") : t("submitClaim")}
              </button>
              <button
                type="button"
                className="anchor-action-button anchor-action-button--ghost"
                disabled={isBusy}
                onClick={() => void runSimpleAction("refreshAnchor")}
              >
                {busyAction === "refreshAnchor" ? t("workflowSubmitting") : t("refreshStatus")}
              </button>
            </div>
            {!claimReady && (
              <p className="anchor-claim-note">{t("claimDisabledCaption")}</p>
            )}
            <p className="anchor-redeem-note">{t("redeemTimingNote")}</p>
            {canRecoverCredit && (
              <div className="anchor-recover-card">
                <div className="anchor-recover-card__copy">
                  <span className="anchor-recover-card__label">{t("pendingWithdraw")}</span>
                  <strong>{pendingWithdrawDisplay}</strong>
                  <small>{t("creditRecoverHint")}</small>
                </div>
                <button
                  type="button"
                  className="anchor-action-button anchor-action-button--primary"
                  disabled={isBusy}
                  onClick={() => void runSimpleAction("recoverNeoCredit")}
                >
                  {busyAction === "recoverNeoCredit"
                    ? t("workflowSubmitting")
                    : t("recoverCredit")}
                </button>
              </div>
            )}
          </div>

          <div className={`anchor-status-strip${localError || lastError ? " anchor-status-strip--error" : ""}`} aria-live="polite">
            <span>{statusText}</span>
            {lastTxid && <code>{t("lastTxid")}: {formatTx(lastTxid)}</code>}
          </div>

          {actionHistory.length > 0 && (
            <div className="anchor-action-history" aria-label={t("actionHistory")}>
              <div className="anchor-action-history__head">
                <span>{t("actionHistory")}</span>
                <strong>{stats?.selectedAgentId ? selectedAgent : "—"}</strong>
              </div>
              {actionHistory.slice(0, 4).map((item) => (
                <div className="anchor-history-row" key={`${item.action}-${item.at ?? item.txid ?? item.amount ?? "local"}`}>
                  <span>{item.action}</span>
                  <strong>{item.amount ? `${item.amount} NEO` : item.status}</strong>
                  {item.txid && <code>{formatTx(item.txid)}</code>}
                </div>
              ))}
            </div>
          )}
        </div>

        <aside className="anchor-route-card" aria-label={t("routeStateLabel")}>
          <span>{t("routeStateLabel")}</span>
          <small className="anchor-route-card__eyebrow">{t("voteTargetLabel")}</small>
          <strong
            className={
              stats?.selectedAgentId ? undefined : "anchor-route-card__placeholder"
            }
          >
            {stats?.selectedAgentId ? selectedAgent : "—"}
          </strong>
          <p className="anchor-route-card__lead-copy">{t("routeStateCaption")}</p>
          <dl>
            <div>
              <dt>{t("statusLabel")}</dt>
              <dd>{routeStatus}</dd>
            </div>
            <div>
              <dt>{t("agentsLabel")}</dt>
              <dd>{agentTotalDisplay}/21</dd>
            </div>
            <div>
              <dt>{t("rewardPoolLabel")}</dt>
              <dd>{hasData ? rewardReserveDisplay : placeholder}</dd>
            </div>
            <div>
              <dt>{t("rewardPerNeo")}</dt>
              <dd>{hasData ? rewardPerNeoDisplay : placeholder}</dd>
            </div>
          </dl>
          <p className="anchor-route-card__caption">{t("rewardPerNeoMerged")}</p>
        </aside>
      </section>

      <details className="neo-card anchor-routing-model">
        <summary className="anchor-routing-model__summary">
          <span className="section-title">{t("routeModelHeading")}</span>
          <span className="anchor-routing-model__hint">
            {t("agentsHint", { count: agentTotalDisplay })}
          </span>
        </summary>
        <div className="anchor-flow-list">
          <span>{t("currentRouteLine", { agent: selectedAgent })}</span>
          <span>{t("agentsRegisteredLine", { count: agentTotalDisplay })}</span>
          <span>{t("operatorsNote")}</span>
        </div>
        <div className="agent-list">
          {agentAccounts.slice(0, 21).map((agent, idx) => {
            const address = String(
              agent.accountAddress ??
                agent.address ??
                agent.name ??
                `agent-${idx + 1}`,
            );
            return (
              <div key={idx} className="agent-row">
                <span className="agent-address" title={address}>
                  {formatAddress(address)}
                </span>
                <span className="agent-status">
                  {t("agentCandidateLabel", {
                    id: String(agent.agentId ?? idx + 1),
                  })}
                </span>
              </div>
            );
          })}
        </div>
      </details>
    </div>
  );
}
