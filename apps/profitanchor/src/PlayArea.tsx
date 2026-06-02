/**
 * PlayArea.tsx -- ProfitAnchor
 *
 * User-facing ProfitAnchor staking surface.
 */

import { useMemo, useState } from "react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import type { ProfitAnchorStats } from "./hooks/useProfitAnchor";
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

export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { val, num, str } = useStateBindings(state);

  const stats = val<ProfitAnchorStats | null>("stats", null);
  const agentAccounts =
    val<Array<Record<string, unknown>>>("agentAccounts", []) ?? [];
  const actionHistory =
    val<AnchorActionHistoryItem[]>("actionHistory", []) ?? [];
  const agentCount = num("agentCount");
  const pendingRewards = num("pendingRewards");
  const myStakeDisplay = str("myStakeDisplay", "0 NEO");
  const pendingRewardsDisplay = str("pendingRewardsDisplay", "0 GAS");
  const rewardReserveDisplay = str("rewardReserveDisplay", "0 GAS");
  const totalNeoDisplay = str("totalNeoDisplay", "0 NEO");
  const workflowStatus = str("workflowStatus", t("workflowReady"));
  const lastError = str("lastError");
  const lastTxid = str("lastTxid");
  const [amountInput, setAmountInput] = useState("1");
  const [localError, setLocalError] = useState("");
  const [busyAction, setBusyAction] = useState("");
  const selectedAgent = stats?.selectedAgentId
    ? `#${stats.selectedAgentId}`
    : "None";
  const agentTotal = agentCount || agentAccounts.length || 21;
  const routeStatus = stats?.selectedAgentId ? t("routeSelected") : t("routeAwaiting");
  const amountIsValid = useMemo(() => isWholeNeo(amountInput), [amountInput]);
  const normalizedAmount = useMemo(
    () => normalizeNeoAmount(amountInput),
    [amountInput],
  );
  const plannedAmountLabel = amountIsValid
    ? `${normalizedAmount} ${t("tokenNeo")}`
    : t("amountNeedsWholeNeo");
  const claimReady =
    pendingRewards > 0 ||
    !/^0(?:\.0+)?\s*GAS$/i.test(pendingRewardsDisplay.trim());
  const stakeMemo = "stake:miniapp-profitanchor";
  const isError = Boolean(localError || lastError);
  const statusText = localError || lastError || workflowStatus;
  const isBusy = Boolean(busyAction);
  const preflightChecks = [
    {
      key: "amount",
      label: t("preflightAmount"),
      done: amountIsValid,
      value: amountIsValid ? plannedAmountLabel : t("blocked"),
    },
    {
      key: "route",
      label: t("preflightRoute"),
      done: Boolean(stats?.selectedAgentId),
      value: selectedAgent,
    },
    {
      key: "claim",
      label: t("preflightClaim"),
      done: claimReady,
      value: pendingRewardsDisplay,
    },
  ];
  const readyToSubmit = amountIsValid;

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
    <div className="profitanchor-play-area">
      <section className="anchor-primary-card anchor-primary-card--profit">
        <div className="anchor-primary-head">
          <span className="anchor-badge" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="5" r="3" />
              <path d="M12 8v8" />
              <path d="M5 12a7 7 0 0 0 14 0" />
              <path d="M5 12H3" />
              <path d="M21 12h-2" />
            </svg>
          </span>
          <div>
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
      </div>

      <section className="anchor-workspace" aria-label="ProfitAnchor staking workspace">
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

            <section
              className={`anchor-preflight-panel${readyToSubmit ? " is-ready" : " is-blocked"}`}
              aria-label={t("preflightTitle")}
            >
              <div className="anchor-preflight-head">
                <div className="anchor-preflight-head__text">
                  <span>{t("preflightEyebrow")}</span>
                  <strong>{t("preflightTitle")}</strong>
                </div>
                <span
                  className={`anchor-ready-pill${readyToSubmit ? " is-ready" : ""}`}
                >
                  {readyToSubmit ? plannedAmountLabel : t("amountNeedsWholeNeo")}
                </span>
              </div>

              <div className="anchor-preflight-summary" aria-label={t("preflightChecklist")}>
                {preflightChecks.map((check) => (
                  <div
                    key={check.key}
                    className={`anchor-preflight-row${check.done ? " is-ready" : ""}`}
                  >
                    <span className="anchor-preflight-row__label">{check.label}</span>
                    <em className="anchor-preflight-row__value">{check.value}</em>
                  </div>
                ))}
              </div>

              <p className="anchor-preflight-note">
                {readyToSubmit ? t("amountPlanReady") : t("amountPlanBlocked")}
              </p>
              <p className="anchor-preflight-note">
                {t("stakePathCopy")} <code>{stakeMemo}</code>
              </p>
            </section>

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
                className="anchor-action-button anchor-action-button--secondary"
                disabled={isBusy || !amountIsValid}
                onClick={() => void runAmountAction("withdrawNeo")}
              >
                {busyAction === "withdrawNeo" ? t("workflowSubmitting") : t("submitWithdraw")}
              </button>
              <button
                type="button"
                className="anchor-action-button anchor-action-button--success"
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

          <div className={`anchor-status-strip${isError ? " anchor-status-strip--error" : ""}`} aria-live="polite">
            <span>{statusText}</span>
            {lastTxid && <code>{t("lastTxid")}: {formatTx(lastTxid)}</code>}
          </div>

          <div className="anchor-action-history" aria-label={t("actionHistory")}>
            <div className="anchor-action-history__head">
              <span>{t("actionHistory")}</span>
              <strong>{selectedAgent}</strong>
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

        <aside className="anchor-route-card" aria-label="ProfitAnchor route state">
          <span>{t("routeState")}</span>
          <strong>{selectedAgent}</strong>
          <dl>
            <div>
              <dt>{t("routeStatus")}</dt>
              <dd>{routeStatus}</dd>
            </div>
            <div>
              <dt>{t("routeAgents")}</dt>
              <dd>{agentTotal}/21</dd>
            </div>
            <div>
              <dt>{t("routeRewardPool")}</dt>
              <dd>{rewardReserveDisplay}</dd>
            </div>
          </dl>
        </aside>
      </section>

      <details className="neo-card anchor-routing-model">
        <summary className="section-title">{t("routingProtectionTitle")}</summary>
        <div className="anchor-flow-list">
          <span>{t("currentRoute")}: {selectedAgent}.</span>
          <span>{t("registeredAgentsCopy", { count: agentTotal })}</span>
          <span>{t("operatorRouteCopy")}</span>
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
