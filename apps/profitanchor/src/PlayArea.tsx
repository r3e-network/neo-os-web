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
  const actionHistory =
    val<AnchorActionHistoryItem[]>("actionHistory", []) ?? [];
  const agentCount = num("agentCount");
  const pendingRewards = num("pendingRewards");
  const myStake = num("myStake");
  const myStakeDisplay = str("myStakeDisplay", "0 NEO");
  const pendingRewardsDisplay = str("pendingRewardsDisplay", "0 GAS");
  const rewardReserveDisplay = str("rewardReserveDisplay", "0 GAS");
  const workflowStatus = str("workflowStatus", t("workflowReady"));
  const lastError = str("lastError");
  const lastTxid = str("lastTxid");
  const [amountInput, setAmountInput] = useState("1");
  const [localError, setLocalError] = useState("");
  const [busyAction, setBusyAction] = useState("");
  const agentTotal = agentCount || 21;
  const routeStatus = stats?.selectedAgentId ? t("routeSelected") : t("routeAwaiting");
  const amountIsValid = useMemo(() => isWholeNeo(amountInput), [amountInput]);
  const normalizedAmount = useMemo(
    () => normalizeNeoAmount(amountInput),
    [amountInput],
  );
  const plannedAmountLabel = amountIsValid
    ? `${normalizedAmount} ${t("tokenNeo")}`
    : t("amountNeedsWholeNeo");
  const isError = Boolean(localError || lastError);
  const statusText = localError || lastError || workflowStatus;
  const isBusy = Boolean(busyAction);
  // Wallet-linked data drives whether per-user tiles are surfaced.
  const hasWalletData = myStake > 0 || pendingRewards > 0;
  const hasReserve = Boolean(stats);
  const metrics = [
    hasWalletData && {
      key: "stake",
      value: myStakeDisplay,
      label: t("myStake"),
    },
    hasWalletData && {
      key: "pending",
      value: pendingRewardsDisplay,
      label: t("pendingRewards"),
    },
    hasReserve && {
      key: "reserve",
      value: rewardReserveDisplay,
      label: t("rewardReserve"),
    },
  ].filter(Boolean) as Array<{ key: string; value: string; label: string }>;

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
            <div className="anchor-hero-facts">
              <span className="anchor-hero-fact">
                <span className="anchor-hero-dot" aria-hidden="true" />
                {routeStatus}
              </span>
              <span className="anchor-hero-fact">
                {t("registeredAgentsCopy", { count: agentTotal })}
              </span>
            </div>
          </div>
        </div>
      </section>

      {metrics.length > 0 && (
        <div className="anchor-stat-grid">
          {metrics.map((metric) => (
            <div className="stat-chip" key={metric.key}>
              <span className="stat-value">{metric.value}</span>
              <span className="stat-label">{metric.label}</span>
            </div>
          ))}
        </div>
      )}

      <section className="anchor-status-card" aria-label="ProfitAnchor staking workspace">
        <div className="anchor-section-head">
          <div className="anchor-section-head__text">
            <span>{t("actionPanelLabel")}</span>
            <h3>{t("actionPanelTitle")}</h3>
          </div>
          <button
            type="button"
            className="anchor-refresh-button"
            aria-label={t("refreshStatus")}
            title={t("refreshStatus")}
            disabled={isBusy}
            onClick={() => void runSimpleAction("refreshAnchor")}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 12a9 9 0 1 1-2.64-6.36" />
              <path d="M21 3v6h-6" />
            </svg>
          </button>
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

          <p
            className={`anchor-inline-status${amountIsValid ? " is-ready" : " is-blocked"}`}
            aria-live="polite"
          >
            {amountIsValid ? plannedAmountLabel : t("amountNeedsWholeNeo")}
            <em>{amountIsValid ? t("amountPlanReady") : t("amountPlanBlocked")}</em>
          </p>

          <button
            type="button"
            className="anchor-action-button anchor-action-button--primary"
            disabled={isBusy || !amountIsValid}
            onClick={() => void runAmountAction("stakeNeo")}
          >
            {busyAction === "stakeNeo" ? t("workflowSubmitting") : t("submitStake")}
          </button>

          <div className="anchor-action-secondary" aria-label={t("actionPanelTitle")}>
            <button
              type="button"
              className="anchor-action-link"
              disabled={isBusy || !amountIsValid}
              onClick={() => void runAmountAction("withdrawNeo")}
            >
              {busyAction === "withdrawNeo" ? t("workflowSubmitting") : t("submitWithdraw")}
            </button>
            <button
              type="button"
              className="anchor-action-link"
              disabled={isBusy}
              onClick={() => void runSimpleAction("claimRewards")}
            >
              {busyAction === "claimRewards" ? t("workflowSubmitting") : t("submitClaim")}
            </button>
          </div>
        </div>

        <div className={`anchor-status-strip${isError ? " anchor-status-strip--error" : ""}`} aria-live="polite">
          <span className="anchor-status-strip__line">
            <span className="anchor-status-dot" aria-hidden="true" />
            {statusText}
          </span>
          {lastTxid && <code>{t("lastTxid")}: {formatTx(lastTxid)}</code>}
        </div>

        {actionHistory.length > 0 && (
          <div className="anchor-action-history" aria-label={t("actionHistory")}>
            <div className="anchor-action-history__head">
              <span>{t("actionHistory")}</span>
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
      </section>
    </div>
  );
}
