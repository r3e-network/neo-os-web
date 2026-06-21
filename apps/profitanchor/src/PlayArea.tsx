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

export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { val, num, str } = useStateBindings(state);

  const stats = val<ProfitAnchorStats | null>("stats", null);
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
  const effectiveRateDisplay = str("effectiveRateDisplay", "0");
  const workflowStatus = str("workflowStatus", t("workflowReady"));
  const lastError = str("lastError");
  const lastTxid = str("lastTxid");
  const submitting = val<boolean>("submitting", false) ?? false;
  const [amountInput, setAmountInput] = useState("1");
  const [localError, setLocalError] = useState("");
  const [busyAction, setBusyAction] = useState("");
  // Before stats load `stats` is null -> show 21 candidate slots as a placeholder.
  // Once stats are loaded, a genuine on-chain 0 must render as 0, not be masked.
  const agentTotal = stats ? agentCount : 21;
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
  // Reflect the shared in-flight lock so PlayArea buttons disable while a
  // submission started from the operation panel is still in flight.
  const isBusy = Boolean(busyAction) || submitting;
  // Wallet-effect preview: what the next transaction will actually do, surfaced
  // before the wallet prompt opens (stake path, AA route, claim plan).
  const stakeMemo = "stake:miniapp-profitanchor";
  const selectedAgent = stats?.selectedAgentId ? `#${stats.selectedAgentId}` : t("routeAwaiting");
  const claimReady = pendingRewards > 0;
  const preflightChecks: Array<{
    key: string;
    label: string;
    value: string;
    done: boolean;
    info?: string;
  }> = [
    {
      key: "amount",
      label: t("preflightAmount"),
      value: amountIsValid ? plannedAmountLabel : t("blocked"),
      done: amountIsValid,
    },
    {
      key: "route",
      label: t("preflightRoute"),
      value: selectedAgent,
      // The route row is informational only: staking does not require a
      // selected agent route, so mark it ready so "Awaiting route" does not
      // read as a precondition blocking the stake.
      done: true,
      info: !stats?.selectedAgentId ? t("preflightRouteInfo") : undefined,
    },
    {
      key: "claim",
      label: t("preflightClaim"),
      value: claimReady ? pendingRewardsDisplay : t("claimPlanEmpty"),
      done: claimReady,
    },
  ];
  // Hero surfaces the three core metrics; "—" placeholder before wallet/chain
  // data lands. Once stats are loaded a genuine on-chain 0 renders as "0 NEO"
  // (not "—"), so it is distinguishable from data-not-loaded.
  const placeholder = "—";
  const hasData = Boolean(stats);
  const canRecoverCredit = pendingWithdraw > 0;
  const metrics: Array<{ key: string; value: string; label: string }> = [
    {
      key: "stake",
      value: hasData ? myStakeDisplay : placeholder,
      label: t("myStake"),
    },
    {
      key: "pending",
      value: hasData ? pendingRewardsDisplay : placeholder,
      label: t("pendingRewards"),
    },
    {
      key: "reserve",
      value: hasData ? rewardReserveDisplay : placeholder,
      label: t("rewardReserve"),
    },
    {
      key: "rps",
      value: hasData ? rewardPerNeoDisplay : placeholder,
      label: t("rewardPerNeo"),
    },
  ];

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
    <div className="profitanchor-play-area">
      <section className="anchor-primary-card anchor-primary-card--profit">
        <div className="anchor-primary-copy">
          <div className="anchor-primary-brand">
            <span className="anchor-badge" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="5" r="3" />
                <path d="M12 8v8" />
                <path d="M5 12a7 7 0 0 0 14 0" />
                <path d="M5 12H3" />
                <path d="M21 12h-2" />
              </svg>
            </span>
            <span className="anchor-kicker">{t("appName")}</span>
          </div>
          <h2>{t("heroTitle")}</h2>
          <p>{t("heroDescription")}</p>
          <div className="anchor-hero-facts" aria-label={t("heroFactsLabel")}>
            <span className="anchor-hero-fact">
              <span className="anchor-hero-dot" aria-hidden="true" />
              {routeStatus}
            </span>
            <span className="anchor-hero-fact">
              {t("registeredAgentsCopy", { count: agentTotal })}
            </span>
            <span className="anchor-hero-fact">{t("heroFactVariable")}</span>
          </div>
        </div>
        <figure className="anchor-stage-card" aria-label={t("stageAria")}>
          <img
            src="./profitanchor-stage.jpg"
            alt=""
            loading="eager"
            decoding="async"
          />
          <figcaption>
            <span>{t("stageCaption")}</span>
            <strong>
              {hasData ? effectiveRateDisplay : placeholder}
              {hasData && <em>{t("effectiveRateUnit")}</em>}
            </strong>
            <small>{t("effectiveRate")}</small>
          </figcaption>
        </figure>
      </section>

      <section className="anchor-rate-band" aria-label={t("rateBandTitle")}>
        <div className="anchor-rate-band__copy">
          <span className="anchor-rate-band__eyebrow">{t("rateBandTitle")}</span>
          <p>{t("rateBandCopy")}</p>
        </div>
        <div className="anchor-rate-band__figure">
          <span className="anchor-rate-band__label">{t("effectiveRate")}</span>
          <strong>
            {hasData ? (
              <>
                {effectiveRateDisplay}
                <em>{t("effectiveRateUnit")}</em>
              </>
            ) : (
              <span className="anchor-rate-band__placeholder">{placeholder}</span>
            )}
          </strong>
          <small>
            {hasData && Number(effectiveRateDisplay) === 0
              ? t("effectiveRateEmpty")
              : t("effectiveRateCaption")}
          </small>
        </div>
      </section>

      {metrics.length > 0 && (
        <div className="anchor-stat-grid">
          {metrics.map((metric) => (
            <div className="stat-chip" key={metric.key}>
              <span
                className={`stat-value${metric.value === placeholder ? " stat-value--placeholder" : ""}`}
              >
                {metric.value}
              </span>
              <span className="stat-label">{metric.label}</span>
              {metric.key === "rps" && (
                <span className="stat-caption">{t("rewardPerNeoCaption")}</span>
              )}
            </div>
          ))}
        </div>
      )}
      {metrics.length > 0 && !hasData && (
        <p className="anchor-stats-hint">{t("statsAwaitConnect")}</p>
      )}

      <section className="anchor-earn-card" aria-label={t("earnTitle")}>
        <span className="anchor-earn-card__title">{t("earnTitle")}</span>
        <ul className="anchor-earn-card__list">
          <li>{t("earnLine1")}</li>
          <li>{t("earnLine2")}</li>
          <li>{t("earnLine3")}</li>
        </ul>
        <p className="anchor-earn-card__note">{t("selfLoanNote")}</p>
      </section>

      <section className="anchor-status-card" aria-label={t("stakingWorkspaceLabel")}>
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
          <span className="anchor-field-hint">{t("wholeNeoHint")}</span>

          <div className="anchor-amount-presets" aria-label={t("stakePresetLabel")}>
            {STAKE_AMOUNT_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                className={normalizedAmount === preset ? "is-active" : undefined}
                disabled={isBusy}
                onClick={() => setAmountInput(preset)}
              >
                {preset} NEO
              </button>
            ))}
          </div>

          <p
            className={`anchor-inline-status${amountIsValid ? " is-ready" : " is-blocked"}`}
            aria-live="polite"
          >
            {amountIsValid ? plannedAmountLabel : t("amountNeedsWholeNeo")}
            <em>{amountIsValid ? t("amountPlanReady") : t("amountPlanBlocked")}</em>
          </p>

          <section
            className="anchor-preflight-panel"
            aria-label={t("preflightTitle")}
          >
            <div className="anchor-preflight-head">
              <span>{t("preflightEyebrow")}</span>
              <strong>{t("preflightTitle")}</strong>
              {!hasData && (
                <em className="anchor-preflight-head__note">
                  {t("previewNotConnected")}
                </em>
              )}
            </div>
            <dl className="anchor-preflight-summary" aria-label={t("preflightChecklist")}>
              {preflightChecks.map((check) => (
                <div
                  key={check.key}
                  className={`anchor-preflight-row${check.done ? " is-ready" : ""}`}
                >
                  <dt>{check.label}</dt>
                  <dd>
                    {check.value}
                    {check.info && (
                      <em className="anchor-preflight-row__info">{check.info}</em>
                    )}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="anchor-preflight-note">
              <strong>{t("stakePathTitle")}</strong>
              <span>
                {t("stakePathCopy")} <code>{stakeMemo}</code>
              </span>
            </p>
            <p className="anchor-preflight-note">
              <strong>{claimReady ? t("claimPlanReady") : t("claimPlanEmpty")}</strong>
              <span>{claimReady ? t("claimPlanReadyCopy") : t("claimPlanEmptyCopy")}</span>
            </p>
          </section>

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
              disabled={isBusy || !claimReady}
              title={claimReady ? undefined : t("claimPlanEmpty")}
              onClick={() => void runSimpleAction("claimRewards")}
            >
              {busyAction === "claimRewards" ? t("workflowSubmitting") : t("submitClaim")}
            </button>
          </div>

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
