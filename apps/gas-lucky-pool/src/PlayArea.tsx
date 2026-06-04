import { useEffect, useRef, useState } from "react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable, ObservableState } from "@shared/react/context";
import { formatGas, formatHash } from "@shared/utils/format";
import {
  getLaunchParam,
  type MiniAppLaunchContext,
} from "@shared/utils/launch-params";
import { normalizeClaimKey } from "./composables/useGasLuckyPool";
import "./PlayArea.scss";

interface PlayAreaProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Observable> | ObservableState;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
  launchContext: MiniAppLaunchContext;
}

function maskClaimKey(value: string): string {
  const key = normalizeClaimKey(value);
  if (!key) return "";
  if (key.length <= 12) return `${key.slice(0, 4)}...`;
  return `${key.slice(0, 7)}...${key.slice(-4)}`;
}

/**
 * Split a claim error into its human-readable message and the optional
 * bracketed `[ogvdiag ...]` diagnostics line. Diagnostics are appended by the
 * OneGate bridge as `"<message>\n[ogvdiag ...]"` so they can be surfaced
 * separately from the user-facing message.
 */
function splitClaimError(error: string): {
  message: string;
  diagnostics: string;
} {
  if (!error) return { message: "", diagnostics: "" };
  const match = error.match(/\n?(\[ogvdiag[^\]]*\])\s*$/);
  if (!match || match.index === undefined || !match[1]) {
    return { message: error.trim(), diagnostics: "" };
  }
  return {
    message: error.slice(0, match.index).trim(),
    diagnostics: match[1].trim(),
  };
}

const CLAIM_PROGRESS_STEPS = [
  { key: "wallet", label: "claimProgressWallet" },
  { key: "submitting", label: "claimProgressSubmitting" },
  { key: "confirming", label: "claimProgressConfirming" },
  { key: "paid", label: "claimProgressPaid" },
] as const;

function resolveClaimProgress(
  progress: string,
  status: string,
  claiming: boolean,
): string {
  if (progress) return progress;
  if (status === "paid" || status === "failed") return status;
  if (status === "submitted") return "confirming";
  return claiming ? "wallet" : "";
}

export default function PlayArea({
  t,
  state,
  dispatch,
  launchContext,
}: PlayAreaProps) {
  const { str, val } = useStateBindings(state as ObservableState);
  const currentClaimKey = str(
    "currentClaimKey",
    launchContext.params.claimKey ?? "",
  );
  const currentPoolId = str("currentPoolId");
  const lastTxid = str("lastTxid");
  const lastClaimAmount = val<bigint>("lastClaimAmount", 0n) ?? 0n;
  const lastClaimKey = str("lastClaimKey", currentClaimKey);
  const lastClaimLuckPercent = str("lastClaimLuckPercent");
  const claimStatus = str("claimStatus");
  const claimProgress = str("claimProgress");
  const isClaiming = Boolean(val<boolean>("isClaiming", false));
  const isCreating = Boolean(val<boolean>("isCreating", false));
  const isLoading = Boolean(val<boolean>("isLoading", false));
  const isFunding = Boolean(val<boolean>("isFunding", false));
  const isRefunding = Boolean(val<boolean>("isRefunding", false));
  const isCreditLoading = Boolean(val<boolean>("isCreditLoading", false));
  const isWithdrawingCredit = Boolean(
    val<boolean>("isWithdrawingCredit", false),
  );
  const gasCredit = val<bigint>("gasCredit", 0n) ?? 0n;
  const lastSuccessType = str("lastSuccessType");
  const lastError = str("lastError");
  // The claim key that arrived via the OneGate launch URL. This must come from
  // the launch context only (no app-state fallback): a claim key entered in the
  // creator workspace is *not* a OneGate claim launch and must keep the full
  // creator UI visible.
  const launchClaimKey = normalizeClaimKey(
    getLaunchParam(launchContext, ["claimKey", "key", "code", "k"], ""),
  );
  const isClaimOperation =
    !launchContext.operation ||
    launchContext.operation === "claimPool" ||
    launchContext.operation === "claimOneGateVault";
  const isOneGateClaimLaunch = isClaimOperation && Boolean(launchClaimKey);
  const launchPoolId = getLaunchParam(
    launchContext,
    ["poolId", "pool", "campaignId"],
    "",
  );
  const launchOneGateAppId = getLaunchParam(
    launchContext,
    ["oneGateAppId", "oneGateId", "onegateAppId"],
    "",
  );
  const claimSucceeded =
    lastSuccessType === "claim" &&
    claimStatus === "paid" &&
    Boolean(lastTxid) &&
    !lastError;
  const preloadedLaunchKeyRef = useRef("");
  const [claimKey, setClaimKey] = useState(currentClaimKey || launchClaimKey);
  const displayClaimKey = maskClaimKey(lastClaimKey || claimKey);
  const claimError = splitClaimError(lastError);
  const activeClaimProgress = resolveClaimProgress(
    claimProgress,
    claimStatus,
    isClaiming,
  );
  const activeClaimProgressIndex = CLAIM_PROGRESS_STEPS.findIndex(
    (step) => step.key === activeClaimProgress,
  );
  const showClaimProgress =
    !claimSucceeded &&
    !lastError &&
    Boolean(claimKey) &&
    Boolean(activeClaimProgress);
  const claimNetworkLabel =
    launchContext.network === "testnet"
      ? t("networkTestnet")
      : t("networkMainnet");
  const claimReceiptItems = [
    {
      label: t("claimKeyLabel"),
      value: displayClaimKey || t("claimKeyPending"),
      muted: !displayClaimKey,
    },
    {
      label: t("claimNetworkLabel"),
      value: claimNetworkLabel,
    },
    {
      label: t("contractGuarded"),
      value: t("perAddressOnce"),
    },
  ];

  // ── Creator workspace form state ──
  const [totalAmount, setTotalAmount] = useState("");
  const [minClaim, setMinClaim] = useState("1");
  const [maxClaim, setMaxClaim] = useState("5");
  const [maxClaims, setMaxClaims] = useState("");
  const [expiryHours, setExpiryHours] = useState("24");
  const [poolId, setPoolId] = useState(currentPoolId);
  const [topUpAmount, setTopUpAmount] = useState("");

  useEffect(() => {
    const nextKey = currentClaimKey || launchClaimKey;
    if (nextKey) setClaimKey(nextKey);
  }, [currentClaimKey, launchClaimKey]);

  useEffect(() => {
    if (!isOneGateClaimLaunch || !launchClaimKey) return;
    if (preloadedLaunchKeyRef.current === launchClaimKey) return;
    preloadedLaunchKeyRef.current = launchClaimKey;
    setClaimKey(launchClaimKey);
  }, [isOneGateClaimLaunch, launchClaimKey]);

  useEffect(() => {
    if (currentPoolId) setPoolId(currentPoolId);
  }, [currentPoolId]);

  const submitClaim = () => {
    if (!claimKey || isClaiming) return;
    void dispatch("claimPool", {
      claimKey,
      poolId: launchPoolId,
      oneGateAppId: launchOneGateAppId,
      appId: launchContext.appId ?? "miniapp-gas-lucky-pool",
    });
  };

  const submitCreatePool = () => {
    if (isCreating) return;
    void dispatch("createPool", {
      totalAmount,
      minClaim,
      maxClaim,
      maxClaims,
      expiryHours,
    });
  };

  const effectivePoolId = poolId || currentPoolId;

  const inspectPool = () => {
    if (isLoading) return;
    void dispatch("loadPool", { poolId: effectivePoolId });
  };

  const submitTopUp = () => {
    if (isFunding) return;
    void dispatch("topUpPool", {
      poolId: effectivePoolId,
      amount: topUpAmount,
    });
  };

  const submitRefund = () => {
    if (isRefunding) return;
    void dispatch("refundPool", { poolId: effectivePoolId });
  };

  const checkGasCredit = () => {
    if (isCreditLoading) return;
    void dispatch("loadGasCredit");
  };

  const withdrawGasCredit = () => {
    if (isWithdrawingCredit) return;
    void dispatch("withdrawGasCredit");
  };

  const creatorStatusLabel = claimStatus
    ? claimStatus === "paid"
      ? t("claimPaid")
      : claimStatus === "failed"
        ? t("claimFailed")
        : t("claimSubmitted")
    : "";

  return (
    <div
      className={`gas-pool-playarea${isOneGateClaimLaunch ? " gas-pool-playarea--claim-only" : ""}`}
    >
      {isOneGateClaimLaunch ? (
        <section
          className="gas-pool-claim-only"
          aria-label={t("claimPoolTitle")}
        >
          {claimSucceeded ? (
            <div
              className="gas-pool-claim-only__success"
              role="status"
              aria-live="polite"
            >
              <div className="gas-pool-congrats__badge">GAS</div>
              <div>
                <h2>{t("claimCongratsTitle")}</h2>
                <p>
                  {lastClaimAmount > 0n
                    ? t("claimCongratsBody", {
                        amount: formatGas(lastClaimAmount, 4),
                        claimKey: displayClaimKey,
                        poolId: "OneGate Vault",
                      })
                    : t("claimCongratsPending", {
                        claimKey: displayClaimKey,
                        poolId: "OneGate Vault",
                      })}
                </p>
                {lastClaimLuckPercent && (
                  <p className="gas-pool-congrats__luck">
                    {t("luckPercentLabel", { percent: lastClaimLuckPercent })}
                  </p>
                )}
                <dl
                  className="gas-pool-claim-only__summary"
                  aria-label={t("claimReceiptTitle")}
                >
                  {lastClaimAmount > 0n && (
                    <div>
                      <dt>{t("claimAmountLabel")}</dt>
                      <dd>{formatGas(lastClaimAmount, 8)} GAS</dd>
                    </div>
                  )}
                  {displayClaimKey && (
                    <div>
                      <dt>{t("claimKeyLabel")}</dt>
                      <dd>{displayClaimKey}</dd>
                    </div>
                  )}
                  <div>
                    <dt>{t("claimNetworkLabel")}</dt>
                    <dd>{claimNetworkLabel}</dd>
                  </div>
                  <div>
                    <dt>{t("contractGuarded")}</dt>
                    <dd>{t("perAddressOnce")}</dd>
                  </div>
                  <div className="gas-pool-claim-only__summary-row--txid">
                    <dt>{t("transactionIdLabel")}</dt>
                    <dd>
                      <code>{lastTxid}</code>
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          ) : (
            <>
              <div className="gas-pool-claim-only__top">
                <div className="gas-pool-congrats__badge">GAS</div>
                <div>
                  <span className="gas-pool-claim-only__eyebrow">
                    {claimKey ? t("scanClaimReady") : t("oneGateReady")}
                  </span>
                  <h2>{claimKey ? t("claimReward") : "OneGate Vault"}</h2>
                </div>
              </div>
              <p className="gas-pool-claim-only__copy">
                {claimKey ? t("scanClaimReview") : t("docOneGateFlow")}
              </p>
              <div className="gas-pool-claim-only__range">
                <span>{t("rewardRange")}</span>
                <strong>1-50 GAS</strong>
              </div>
              <dl
                className="gas-pool-claim-only__receipt"
                aria-label={t("claimReceiptTitle")}
              >
                {claimReceiptItems.map((item) => (
                  <div key={item.label}>
                    <dt>{item.label}</dt>
                    <dd className={item.muted ? "is-pending" : undefined}>
                      {item.value}
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="gas-pool-claim-only__note">
                {t("claimConsoleHint")}
              </p>
              {!claimKey && (
                <div className="gas-pool-claim-only__action-hint">
                  <span
                    className="gas-pool-claim-only__action-hint-icon"
                    aria-hidden="true"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      width="18"
                      height="18"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect x="3" y="3" width="7" height="7" rx="1.5" />
                      <rect x="14" y="3" width="7" height="7" rx="1.5" />
                      <rect x="3" y="14" width="7" height="7" rx="1.5" />
                      <path d="M14 14h3v3M21 14v7M14 21h3" />
                    </svg>
                  </span>
                  <span>{t("noPoolSelected")}</span>
                </div>
              )}
              {claimKey && !claimSucceeded && (
                <button
                  type="button"
                  className="gas-pool-claim-only__button"
                  onClick={submitClaim}
                  disabled={isClaiming}
                >
                  {t("claimReward")}
                </button>
              )}
              {claimError.message ? (
                <div
                  className="gas-pool-claim-only__error"
                  role="alert"
                  aria-live="assertive"
                >
                  <p className="gas-pool-claim-only__error-message">
                    {claimError.message}
                  </p>
                  {claimError.diagnostics && (
                    <code className="gas-pool-claim-only__error-diagnostics">
                      {claimError.diagnostics}
                    </code>
                  )}
                </div>
              ) : showClaimProgress ? (
                <div
                  className={`gas-pool-claim-progress gas-pool-claim-progress--${activeClaimProgress}`}
                  role="status"
                  aria-live="polite"
                >
                  <div className="gas-pool-claim-progress__header">
                    <span>{t("claimProgressTitle")}</span>
                    <strong>
                      {activeClaimProgress === "failed"
                        ? t("claimProgressFailed")
                        : activeClaimProgress === "paid"
                          ? t("claimProgressPaid")
                          : activeClaimProgress === "confirming"
                            ? t("claimProgressConfirming")
                            : activeClaimProgress === "submitting"
                              ? t("claimProgressSubmitting")
                              : t("claimProgressWallet")}
                    </strong>
                  </div>
                  <ol className="gas-pool-claim-progress__steps">
                    {CLAIM_PROGRESS_STEPS.map((step, index) => {
                      const isFailed = activeClaimProgress === "failed";
                      const isDone =
                        !isFailed &&
                        activeClaimProgressIndex >= 0 &&
                        index < activeClaimProgressIndex;
                      const isActive =
                        !isFailed &&
                        (index === activeClaimProgressIndex ||
                          (activeClaimProgressIndex < 0 && index === 0));
                      return (
                        <li
                          key={step.key}
                          className={`gas-pool-claim-progress__step${
                            isDone ? " gas-pool-claim-progress__step--done" : ""
                          }${
                            isActive
                              ? " gas-pool-claim-progress__step--active"
                              : ""
                          }${
                            isFailed && index === 2
                              ? " gas-pool-claim-progress__step--failed"
                              : ""
                          }`}
                        >
                          <span className="gas-pool-claim-progress__dot" />
                          <span>{t(step.label)}</span>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              ) : claimStatus ? (
                <div
                  className={`gas-pool-claim-status gas-pool-claim-status--${claimStatus}`}
                >
                  {claimStatus === "paid"
                    ? t("claimPaid")
                    : claimStatus === "failed"
                      ? t("claimFailed")
                      : t("claimSubmitted")}
                </div>
              ) : null}
            </>
          )}
        </section>
      ) : (
        <section
          className="gas-pool-workspace"
          aria-label={t("ownerWorkspaceTitle")}
        >
          <div className="gas-pool-grid">
            <div className="gas-pool-form">
              <h2>{t("createPoolTitle")}</h2>
              <p className="gas-pool-form__description">
                {t("createPoolDescription")}
              </p>
              <label className="gas-pool-form__field">
                <span>{t("totalAmount")}</span>
                <input
                  type="number"
                  inputMode="decimal"
                  min="1"
                  value={totalAmount}
                  onChange={(event) => setTotalAmount(event.target.value)}
                />
              </label>
              <div className="gas-pool-form__row">
                <label className="gas-pool-form__field">
                  <span>{t("minClaim")}</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min="1"
                    value={minClaim}
                    onChange={(event) => setMinClaim(event.target.value)}
                  />
                </label>
                <label className="gas-pool-form__field">
                  <span>{t("maxClaim")}</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min="1"
                    value={maxClaim}
                    onChange={(event) => setMaxClaim(event.target.value)}
                  />
                </label>
              </div>
              <div className="gas-pool-form__row">
                <label className="gas-pool-form__field">
                  <span>{t("maxClaims")}</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min="1"
                    value={maxClaims}
                    onChange={(event) => setMaxClaims(event.target.value)}
                  />
                </label>
                <label className="gas-pool-form__field">
                  <span>{t("expiryHours")}</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min="1"
                    value={expiryHours}
                    onChange={(event) => setExpiryHours(event.target.value)}
                  />
                </label>
              </div>
              <button
                type="button"
                className="gas-pool-claim-only__button"
                onClick={submitCreatePool}
                disabled={isCreating}
              >
                {isCreating ? t("creatingPool") : t("createPool")}
              </button>
            </div>

            <div className="gas-pool-form">
              <h2>{t("poolControlsTitle")}</h2>
              <label className="gas-pool-form__field">
                <span>{t("topUpAmount")}</span>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  value={topUpAmount}
                  onChange={(event) => setTopUpAmount(event.target.value)}
                />
              </label>
              <div className="gas-pool-actions">
                <button
                  type="button"
                  className="gas-pool-claim-only__button"
                  onClick={inspectPool}
                  disabled={isLoading}
                >
                  {isLoading ? t("loadingPool") : t("inspectPool")}
                </button>
                <button
                  type="button"
                  className="gas-pool-claim-only__button"
                  onClick={submitTopUp}
                  disabled={isFunding}
                >
                  {isFunding ? t("addingGas") : t("topUpPool")}
                </button>
                <button
                  type="button"
                  className="gas-pool-claim-only__button"
                  onClick={submitRefund}
                  disabled={isRefunding}
                >
                  {isRefunding ? t("recoveringGas") : t("refundPool")}
                </button>
              </div>

              <div className="gas-pool-credit">
                <span>{t("gasCredit")}</span>
                <strong>{formatGas(gasCredit, 4)} GAS</strong>
                <div className="gas-pool-credit__actions">
                  <button
                    type="button"
                    className="gas-pool-claim-only__button"
                    onClick={checkGasCredit}
                    disabled={isCreditLoading}
                  >
                    {isCreditLoading
                      ? t("checkingGasCredit")
                      : t("checkGasCredit")}
                  </button>
                  <button
                    type="button"
                    className="gas-pool-claim-only__button"
                    onClick={withdrawGasCredit}
                    disabled={isWithdrawingCredit}
                  >
                    {isWithdrawingCredit
                      ? t("withdrawingGasCredit")
                      : t("withdrawGasCredit")}
                  </button>
                </div>
              </div>

              {creatorStatusLabel && (
                <div
                  className={`gas-pool-claim-status gas-pool-claim-status--${claimStatus}`}
                  role="status"
                  aria-live="polite"
                >
                  {creatorStatusLabel}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {!isOneGateClaimLaunch && (
        <details className="gas-pool-secondary">
          <summary>{t("campaignOwnerTitle")}</summary>
          <div className="gas-pool-owner-note">
            <span>{t("campaignOwnerStep1")}</span>
            <span>{t("campaignOwnerStep2")}</span>
            <span>{t("campaignOwnerStep3")}</span>
          </div>
        </details>
      )}

      {!isOneGateClaimLaunch && lastError && (
        <div
          className="gas-pool-toast gas-pool-toast--error"
          role="alert"
          aria-live="assertive"
        >
          {claimError.message || lastError}
        </div>
      )}
    </div>
  );
}
