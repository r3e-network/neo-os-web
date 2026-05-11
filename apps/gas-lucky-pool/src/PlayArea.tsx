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
  const lastTxid = str("lastTxid");
  const lastClaimAmount = val<bigint>("lastClaimAmount", 0n) ?? 0n;
  const lastClaimKey = str("lastClaimKey", currentClaimKey);
  const lastClaimLuckPercent = str("lastClaimLuckPercent");
  const claimStatus = str("claimStatus");
  const claimProgress = str("claimProgress");
  const isClaiming = Boolean(val<boolean>("isClaiming", false));
  const lastSuccessType = str("lastSuccessType");
  const lastError = str("lastError");
  const launchClaimKey = normalizeClaimKey(
    getLaunchParam(
      launchContext,
      ["claimKey", "key", "code", "k"],
      currentClaimKey,
    ),
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
  const activeClaimProgress = resolveClaimProgress(
    claimProgress,
    claimStatus,
    isClaiming,
  );
  const activeClaimProgressIndex = CLAIM_PROGRESS_STEPS.findIndex(
    (step) => step.key === activeClaimProgress,
  );
  const showClaimProgress =
    !claimSucceeded && Boolean(claimKey) && Boolean(activeClaimProgress);

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

  const submitClaim = () => {
    if (!claimKey || isClaiming) return;
    void dispatch("claimPool", {
      claimKey,
      poolId: launchPoolId,
      oneGateAppId: launchOneGateAppId,
      appId: launchContext.appId ?? "miniapp-gas-lucky-pool",
    });
  };

  return (
    <div
      className={`gas-pool-playarea${isOneGateClaimLaunch ? " gas-pool-playarea--claim-only" : ""}`}
    >
      <section className="gas-pool-claim-only" aria-label={t("claimPoolTitle")}>
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
              <code>{formatHash(lastTxid, 10, 8)}</code>
            </div>
          </div>
        ) : (
          <>
            <div className="gas-pool-claim-only__top">
              <div className="gas-pool-congrats__badge">GAS</div>
              <div>
                <div className="gas-pool-claim-only__badge">
                  {claimKey ? t("scanClaimReady") : t("oneGateReady")}
                </div>
                <h2>
                  {claimKey ? t("claimReward") : "OneGate Vault"}
                </h2>
              </div>
            </div>
            <p className="gas-pool-claim-only__copy">
              {claimKey ? t("scanClaimReview") : t("docOneGateFlow")}
            </p>
            <div className="gas-pool-claim-only__range">
              <span>{t("rewardRange")}</span>
              <strong>1-50 GAS</strong>
            </div>
            {!claimKey && (
              <div className="gas-pool-claim-only__action-hint">
                {t("noPoolSelected")}
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
            {showClaimProgress ? (
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

      {(lastTxid || lastError) && (
        <div
          className={`gas-pool-toast${lastError ? " gas-pool-toast--error" : ""}`}
        >
          {lastError ||
            (lastClaimAmount > 0n
              ? `${t("claimedAmount", { amount: formatGas(lastClaimAmount, 4) })}${lastClaimLuckPercent ? ` · ${t("luckPercentLabel", { percent: lastClaimLuckPercent })}` : ""} · tx ${formatHash(lastTxid, 10, 8)}`
              : `tx ${formatHash(lastTxid, 10, 8)}`)}
        </div>
      )}
    </div>
  );
}
