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
  const myStakeDisplay = str("myStakeDisplay", "0 NEO");
  const pendingRewardsDisplay = str("pendingRewardsDisplay", "0 GAS");
  const pendingWithdrawDisplay = str("pendingWithdrawDisplay", "0 NEO");
  const rewardReserveDisplay = str("rewardReserveDisplay", "0 GAS");
  const rewardPerNeoDisplay = str("rewardPerNeoDisplay", "0");
  const totalNeoDisplay = str("totalNeoDisplay", "0 NEO");
  const workflowStatus = str("workflowStatus", t("workflowReady"));
  const lastError = str("lastError");
  const lastTxid = str("lastTxid");
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
  const statusText = localError || lastError || workflowStatus;
  const isBusy = Boolean(busyAction);

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

  const runSimpleAction = async (action: "claimRewards" | "refreshAnchor") => {
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
        <div className="anchor-primary-card__lead">
          <span className="anchor-badge" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2 4 6v6c0 5 3.5 8 8 10 4.5-2 8-5 8-10V6l-8-4Z" />
              <path d="m9 12 2 2 4-4" />
            </svg>
          </span>
          <div className="anchor-primary-card__copy">
            <span className="anchor-kicker">{t("appName")}</span>
            <h2>{t("heroTitle")}</h2>
            <p>{t("heroDescription")}</p>
          </div>
        </div>
        <div className="anchor-score">
          <span>{myStakeDisplay}</span>
          <small>{t("myStake")}</small>
        </div>
      </section>

      <div className="anchor-stat-grid">
        <div className="stat-chip">
          <span className="stat-value">{pendingRewardsDisplay}</span>
          <span className="stat-label">{t("pendingRewards")}</span>
        </div>
        <div className="stat-chip">
          <span className="stat-value">
            {totalNeoDisplay || `${stats?.totalStaked ?? 0} NEO`}
          </span>
          <span className="stat-label">{t("totalNeoTracked")}</span>
        </div>
        <div className="stat-chip">
          <span className="stat-value">{rewardReserveDisplay}</span>
          <span className="stat-label">{t("rewardReserve")}</span>
        </div>
        <div className="stat-chip">
          <span className="stat-value">{pendingWithdrawDisplay}</span>
          <span className="stat-label">{t("pendingWithdraw")}</span>
        </div>
      </div>

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
                disabled={isBusy}
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
          </div>

          <div className={`anchor-status-strip${localError || lastError ? " anchor-status-strip--error" : ""}`} aria-live="polite">
            <span>{statusText}</span>
            {lastTxid && <code>{t("lastTxid")}: {formatTx(lastTxid)}</code>}
          </div>

          <div className="anchor-action-history" aria-label={t("actionHistory")}>
            <div className="anchor-action-history__head">
              <span>{t("actionHistory")}</span>
              <strong>{stats?.selectedAgentId ? selectedAgent : "—"}</strong>
            </div>
            {actionHistory.length === 0 ? (
              <p>{t("actionHistoryEmpty")}</p>
            ) : (
              actionHistory.slice(0, 4).map((item) => (
                <div className="anchor-history-row" key={`${item.action}-${item.at ?? item.txid ?? item.amount ?? "local"}`}>
                  <span>{item.action}</span>
                  <strong>{item.amount ? `${item.amount} NEO` : item.status}</strong>
                  {item.txid && <code>{formatTx(item.txid)}</code>}
                </div>
              ))
            )}
          </div>
        </div>

        <aside className="anchor-route-card" aria-label={t("routeStateLabel")}>
          <span>{t("routeStateLabel")}</span>
          <strong
            className={
              stats?.selectedAgentId ? undefined : "anchor-route-card__placeholder"
            }
          >
            {stats?.selectedAgentId ? selectedAgent : "—"}
          </strong>
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
              <dd>{rewardReserveDisplay}</dd>
            </div>
            <div>
              <dt>{t("rewardPerNeo")}</dt>
              <dd>{rewardPerNeoDisplay}</dd>
            </div>
          </dl>
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
