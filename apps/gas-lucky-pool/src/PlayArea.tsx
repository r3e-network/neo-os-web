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

export default function PlayArea({ t, state, launchContext }: PlayAreaProps) {
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
  const lastSuccessType = str("lastSuccessType");
  const lastError = str("lastError");
  const launchClaimKey = normalizeClaimKey(
    getLaunchParam(
      launchContext,
      ["claimKey", "key", "code", "k"],
      currentClaimKey,
    ),
  );
  const isOneGateClaimLaunch =
    launchContext.source === "onegate" &&
    launchContext.operation === "claimPool" &&
    Boolean(launchClaimKey);
  const claimSucceeded =
    lastSuccessType === "claim" && Boolean(lastTxid) && !lastError;
  const preloadedLaunchKeyRef = useRef("");
  const [claimKey, setClaimKey] = useState(currentClaimKey || launchClaimKey);

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
                      claimKey: lastClaimKey || claimKey,
                      poolId: "OneGate Vault",
                    })
                  : t("claimCongratsPending", {
                      claimKey: lastClaimKey || claimKey,
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
            <div className="gas-pool-claim-only__badge">
              {claimKey ? t("scanClaimReady") : t("oneGateReady")}
            </div>
            <h2>
              {claimKey ? t("scanClaimPool", { claimKey }) : "OneGate Vault"}
            </h2>
            <p>{claimKey ? t("scanClaimReview") : t("docOneGateFlow")}</p>
            <div className="gas-pool-claim-only__range">
              <span>{t("rewardRange")}</span>
              <strong>1-50 GAS</strong>
            </div>
            <div className="gas-pool-claim-only__action-hint">
              {claimKey ? t("claimConsoleHint") : t("noPoolSelected")}
            </div>
            {claimStatus && (
              <div
                className={`gas-pool-claim-status gas-pool-claim-status--${claimStatus}`}
              >
                {claimStatus === "paid"
                  ? t("claimPaid")
                  : claimStatus === "failed"
                    ? t("claimFailed")
                    : t("claimSubmitted")}
              </div>
            )}
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
