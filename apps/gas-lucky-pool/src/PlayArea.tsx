import { useEffect, useMemo, useRef, useState } from "react";
import { NeoButton, NeoCard, NeoInput } from "@shared/components-react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable, ObservableState } from "@shared/react/context";
import { formatGas, formatHash } from "@shared/utils/format";
import { getLaunchParam, type MiniAppLaunchContext } from "@shared/utils/launch-params";
import { buildOneGateDirectMiniAppUrl } from "@shared/utils/onegate-launch";
import { normalizeClaimKey, normalizePoolId, type GasLuckyClaim, type GasLuckyPool } from "./composables/useGasLuckyPool";
import "./PlayArea.scss";

const APP_ID = "miniapp-gas-lucky-pool";
const ONEGATE_QR_LOGO_SRC = "/miniapps/gas-lucky-pool/onegate-logo.png";

interface PlayAreaProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Observable> | ObservableState;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
  launchContext: MiniAppLaunchContext;
}

function statusLabel(t: PlayAreaProps["t"], status?: string) {
  if (status === "active") return t("active");
  if (status === "expired") return t("expired");
  if (status === "empty") return t("empty");
  return t("unknown");
}

function poolProgress(pool: GasLuckyPool | null) {
  if (!pool || pool.maxClaims <= 0) return 0;
  return Math.min(100, Math.max(0, (pool.claimedCount / pool.maxClaims) * 100));
}

function defaultShareUrl(claimKey: string, network?: MiniAppLaunchContext["network"]) {
  const key = normalizeClaimKey(claimKey);
  if (!key) return "";
  return buildOneGateDirectMiniAppUrl("gas-lucky-pool", APP_ID, {
    operation: "claimPool",
    network: network ?? undefined,
    claimKey: key,
  });
}

export default function PlayArea({ t, state, dispatch, launchContext }: PlayAreaProps) {
  const { str, bool, num, val } = useStateBindings(state as ObservableState);
  const currentPool = val<GasLuckyPool>("currentPool");
  const recentPools = val<GasLuckyPool[]>("recentPools", []) ?? [];
  const recentClaims = val<GasLuckyClaim[]>("recentClaims", []) ?? [];
  const isCreating = bool("isCreating");
  const isClaiming = bool("isClaiming");
  const isRefunding = bool("isRefunding");
  const isFunding = bool("isFunding");
  const isLoading = bool("isLoading");
  const isCreditLoading = bool("isCreditLoading");
  const isWithdrawingCredit = bool("isWithdrawingCredit");
  const currentPoolId = str("currentPoolId", launchContext.params.poolId ?? "");
  const currentClaimKey = str("currentClaimKey", launchContext.params.claimKey ?? "");
  const shareUrlFromState = str("currentShareUrl");
  const lastTxid = str("lastTxid");
  const lastClaimAmount = val<bigint>("lastClaimAmount", 0n) ?? 0n;
  const lastClaimPoolId = str("lastClaimPoolId", currentPoolId);
  const lastClaimKey = str("lastClaimKey", currentClaimKey);
  const lastClaimLuckPercent = str("lastClaimLuckPercent");
  const claimStatus = str("claimStatus");
  const lastRefundAmount = val<bigint>("lastRefundAmount", 0n) ?? 0n;
  const lastRefundPoolId = str("lastRefundPoolId", currentPoolId);
  const lastFundAmount = val<bigint>("lastFundAmount", 0n) ?? 0n;
  const lastFundPoolId = str("lastFundPoolId", currentPoolId);
  const lastSuccessType = str("lastSuccessType");
  const lastError = str("lastError");
  const gasCredit = val<bigint>("gasCredit", 0n) ?? 0n;
  const launchClaimKey = normalizeClaimKey(getLaunchParam(launchContext, ["claimKey", "key", "code", "k"], currentClaimKey));
  const isOneGateClaimLaunch =
    launchContext.source === "onegate" &&
    launchContext.operation === "claimPool" &&
    Boolean(launchClaimKey);
  const claimSucceeded = lastSuccessType === "claim" && Boolean(lastTxid) && !lastError;
  const refundSucceeded = lastSuccessType === "refund" && Boolean(lastTxid) && !lastError;
  const fundSucceeded = lastSuccessType === "fund" && Boolean(lastTxid) && !lastError;
  const preloadedLaunchKeyRef = useRef("");

  const [totalAmount, setTotalAmount] = useState("100");
  const [minClaim, setMinClaim] = useState("1");
  const [maxClaim, setMaxClaim] = useState("50");
  const [maxClaims, setMaxClaims] = useState("20");
  const [expiryHours, setExpiryHours] = useState("72");
  const [topUpAmount, setTopUpAmount] = useState("5");
  const [poolId, setPoolId] = useState(currentPoolId);
  const [claimKey, setClaimKey] = useState(currentClaimKey || launchClaimKey);
  const [copied, setCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState("");

  useEffect(() => {
    setPoolId(currentPoolId);
  }, [currentPoolId]);

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

  const shareUrl = useMemo(
    () => defaultShareUrl(claimKey, launchContext.network) || shareUrlFromState,
    [claimKey, launchContext.network, shareUrlFromState],
  );

  useEffect(() => {
    let mounted = true;
    if (!shareUrl) {
      setQrDataUrl("");
      return;
    }
    import("qrcode")
      .then((qrcode) =>
        qrcode.toDataURL(shareUrl, {
          errorCorrectionLevel: "H",
          margin: 2,
          width: 220,
          color: {
            dark: "#06251B",
            light: "#F7FFF9",
          },
        }),
      )
      .then((url) => {
        if (mounted) setQrDataUrl(url);
      })
      .catch(() => {
        if (mounted) setQrDataUrl("");
      });
    return () => {
      mounted = false;
    };
  }, [shareUrl]);

  const previewMinimum = Number(minClaim || 0) * Number(maxClaims || 0);
  const previewMaximum = Number(maxClaim || 0) * Number(maxClaims || 0);
  const configuredTotal = Number(totalAmount || 0);
  const configurationValid =
    configuredTotal > 0 &&
    Number(minClaim) >= 1 &&
    Number(maxClaim) <= 50 &&
    Number(maxClaim) >= Number(minClaim) &&
    Number(maxClaims) >= 1 &&
    configuredTotal >= previewMinimum &&
    configuredTotal <= previewMaximum;

  const handleCreate = async () => {
    await dispatch("createPool", {
      totalAmount,
      minClaim,
      maxClaim,
      maxClaims,
      expiryHours,
    });
  };

  const handleCheckClaim = async () => {
    await dispatch("checkClaimStatus", { claimKey });
  };

  const handleClaim = async () => {
    await dispatch("claimPool", { claimKey });
  };

  const handleRefund = async () => {
    await dispatch("refundPool", { poolId });
  };

  const handleTopUp = async () => {
    await dispatch("topUpPool", { poolId, amount: topUpAmount });
  };

  const handleLoadGasCredit = async () => {
    await dispatch("loadGasCredit");
  };

  const handleWithdrawGasCredit = async () => {
    await dispatch("withdrawGasCredit");
  };

  const handleCopy = async () => {
    if (!shareUrl) return;
    await navigator.clipboard?.writeText(shareUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="gas-pool-playarea">
      <section className="gas-pool-hero">
        <div className="gas-pool-hero__copy">
          <h2>{t("title")}</h2>
          <p>{t("subtitle")}</p>
        </div>
        <div className="gas-pool-hero__stats" aria-label={t("poolOverview")}>
          <div>
            <span>{num("activePoolCount")}</span>
            <small>{t("activePools")}</small>
          </div>
          <div>
            <span>{num("claimCount")}</span>
            <small>{t("claims")}</small>
          </div>
          <div>
            <span>{currentPool ? `${formatGas(currentPool.minClaimAmount, 2)}-${formatGas(currentPool.maxClaimAmount, 2)}` : "1-50"}</span>
            <small>GAS range</small>
          </div>
        </div>
      </section>

      <div className="gas-pool-grid">
        <NeoCard variant="erobo" title={t("createPoolTitle")}>
          <div className="gas-pool-form">
            <div className="gas-pool-form__row">
              <NeoInput label={t("totalAmount")} value={totalAmount} type="number" suffix="GAS" min={0.1} onChange={setTotalAmount} />
              <NeoInput label={t("maxClaims")} value={maxClaims} type="number" suffix="claims" min={1} max={100} onChange={setMaxClaims} />
            </div>
            <div className="gas-pool-form__row">
              <NeoInput label={t("minClaim")} value={minClaim} type="number" suffix="GAS" min={1} max={50} onChange={setMinClaim} />
              <NeoInput label={t("maxClaim")} value={maxClaim} type="number" suffix="GAS" min={1} max={50} onChange={setMaxClaim} />
            </div>
            <NeoInput label={t("expiryHours")} value={expiryHours} type="number" suffix="hours" min={1} max={720} onChange={setExpiryHours} />
            <div className={`gas-pool-bounds${configurationValid ? " gas-pool-bounds--ok" : ""}`}>
              <span>{t("contractGuarded")}</span>
              <strong>{previewMinimum.toFixed(2)} - {previewMaximum.toFixed(2)} GAS capacity</strong>
            </div>
            <NeoButton
              variant="primary"
              size="lg"
              block
              loading={isCreating}
              disabled={!configurationValid || isCreating}
              onClick={handleCreate}
            >
              {t("createPool")}
            </NeoButton>
            <div className="gas-pool-credit">
              <div>
                <span>{t("gasCredit")}</span>
                <strong>{formatGas(gasCredit, 4)} GAS</strong>
                <p>{t("gasCreditDescription")}</p>
              </div>
              <div className="gas-pool-credit__actions">
                <NeoButton
                  variant="secondary"
                  loading={isCreditLoading}
                  disabled={isCreditLoading || isWithdrawingCredit}
                  onClick={handleLoadGasCredit}
                >
                  {t("checkGasCredit")}
                </NeoButton>
                <NeoButton
                  variant="ghost"
                  loading={isWithdrawingCredit}
                  disabled={gasCredit <= 0n || isCreditLoading || isWithdrawingCredit}
                  onClick={handleWithdrawGasCredit}
                >
                  {t("withdrawGasCredit")}
                </NeoButton>
              </div>
            </div>
          </div>
        </NeoCard>

        <NeoCard variant="erobo" title={t("claimPoolTitle")}>
          <div className="gas-pool-claim">
            {isOneGateClaimLaunch && (
              <div className="gas-pool-scan-ready" role="status" aria-live="polite">
                <span>{t("scanClaimReady")}</span>
                <strong>{t("scanClaimPool", { claimKey: launchClaimKey })}</strong>
                <small>{t("scanClaimReview")}</small>
              </div>
            )}
            <NeoInput label={t("claimKey")} value={claimKey} placeholder="ogv_campaign_user_key" onChange={setClaimKey} />
            <div className="gas-pool-actions">
              <NeoButton variant="secondary" loading={isLoading} disabled={!claimKey || isLoading} onClick={handleCheckClaim}>
                {t("inspectClaim")}
              </NeoButton>
              <NeoButton variant="success" loading={isClaiming} disabled={!claimKey || isClaiming} onClick={handleClaim}>
                {isOneGateClaimLaunch ? t("claimScannedKey", { claimKey }) : t("claimOnce")}
              </NeoButton>
            </div>
            {claimStatus && (
              <div className={`gas-pool-claim-status gas-pool-claim-status--${claimStatus}`}>
                {claimStatus === "paid" ? t("claimPaid") : claimStatus === "failed" ? t("claimFailed") : t("claimSubmitted")}
              </div>
            )}
            {currentPool ? (
              <div className="gas-pool-card">
                <div className="gas-pool-card__top">
                  <span>#{currentPool.id}</span>
                  <strong className={`gas-pool-status gas-pool-status--${currentPool.status}`}>
                    {statusLabel(t, currentPool.status)}
                  </strong>
                </div>
                <div className="gas-pool-progress">
                  <span style={{ width: `${poolProgress(currentPool)}%` }} />
                </div>
                <dl className="gas-pool-card__metrics">
                  <div>
                    <dt>{t("remainingGas")}</dt>
                    <dd>{formatGas(currentPool.remainingAmount, 4)} GAS</dd>
                  </div>
                  <div>
                    <dt>{t("claims")}</dt>
                    <dd>{currentPool.claimedCount}/{currentPool.maxClaims}</dd>
                  </div>
                  <div>
                    <dt>{t("bestLuck")}</dt>
                    <dd>{currentPool.bestLuckAmount > 0n ? `${formatGas(currentPool.bestLuckAmount, 4)} GAS` : "-"}</dd>
                  </div>
                </dl>
                <div className="gas-pool-topup" aria-label={t("topUpPool")}>
                  <NeoInput
                    label={t("topUpAmount")}
                    value={topUpAmount}
                    type="number"
                    suffix="GAS"
                    min={0.00000001}
                    onChange={setTopUpAmount}
                  />
                  <NeoButton
                    variant="secondary"
                    loading={isFunding}
                    disabled={!poolId || !topUpAmount || isFunding || currentPool.status !== "active"}
                    onClick={handleTopUp}
                  >
                    {t("topUpPool")}
                  </NeoButton>
                </div>
                <NeoButton
                  variant="ghost"
                  loading={isRefunding}
                  disabled={isRefunding || currentPool.status === "active"}
                  onClick={handleRefund}
                >
                  {t("refundPool")}
                </NeoButton>
              </div>
            ) : (
              <div className="gas-pool-empty">{t("noPoolSelected")}</div>
            )}
            <div className="gas-pool-qr gas-pool-qr--inline" aria-label={t("shareQr")}>
              <div className="gas-pool-qr__heading">{t("shareQr")}</div>
              <div className="gas-pool-qr__content">
                <div className="gas-pool-qr__code">
                  {qrDataUrl ? (
                    <img className="gas-pool-qr__image" src={qrDataUrl} alt={t("shareQr")} />
                  ) : (
                    <div className="gas-pool-qr__placeholder">{t("oneGateReady")}</div>
                  )}
                  <img
                    className="gas-pool-qr__logo"
                    src={ONEGATE_QR_LOGO_SRC}
                    alt="OneGate"
                    loading="lazy"
                    decoding="async"
                    data-testid="onegate-qr-logo"
                  />
                </div>
                <div className="gas-pool-qr__meta">
                <p>{shareUrl || t("noPoolSelected")}</p>
                  <NeoButton variant="secondary" disabled={!shareUrl} onClick={handleCopy}>
                    {copied ? t("copied") : t("shareLink")}
                  </NeoButton>
                </div>
              </div>
            </div>
          </div>
        </NeoCard>
      </div>

      {claimSucceeded && (
        <section className="gas-pool-congrats" role="status" aria-live="polite">
          <div className="gas-pool-congrats__badge">GAS</div>
          <div>
            <h3>{t("claimCongratsTitle")}</h3>
            <p>
              {lastClaimAmount > 0n
                ? t("claimCongratsBody", {
                    amount: formatGas(lastClaimAmount, 4),
                    claimKey: lastClaimKey || claimKey,
                    poolId: lastClaimPoolId || poolId,
                  })
                : t("claimCongratsPending", { claimKey: lastClaimKey || claimKey, poolId: lastClaimPoolId || poolId })}
            </p>
            {lastClaimLuckPercent && (
              <p className="gas-pool-congrats__luck">
                {t("luckPercentLabel", { percent: lastClaimLuckPercent })}
              </p>
            )}
          </div>
          <code>{formatHash(lastTxid, 10, 8)}</code>
        </section>
      )}

      {refundSucceeded && (
        <section className="gas-pool-congrats gas-pool-congrats--refund" role="status" aria-live="polite">
          <div className="gas-pool-congrats__badge">GAS</div>
          <div>
            <h3>{t("refundCongratsTitle")}</h3>
            <p>
              {lastRefundAmount > 0n
                ? t("refundCongratsBody", {
                    amount: formatGas(lastRefundAmount, 4),
                    poolId: lastRefundPoolId || poolId,
                  })
                : t("refundSubmitted")}
            </p>
          </div>
          <code>{formatHash(lastTxid, 10, 8)}</code>
        </section>
      )}

      {fundSucceeded && (
        <section className="gas-pool-congrats gas-pool-congrats--fund" role="status" aria-live="polite">
          <div className="gas-pool-congrats__badge">GAS</div>
          <div>
            <h3>{t("fundCongratsTitle")}</h3>
            <p>
              {lastFundAmount > 0n
                ? t("fundCongratsBody", {
                    amount: formatGas(lastFundAmount, 4),
                    poolId: lastFundPoolId || poolId,
                  })
                : t("topUpSubmitted")}
            </p>
          </div>
          <code>{formatHash(lastTxid, 10, 8)}</code>
        </section>
      )}

      <section className="gas-pool-lists">
        <NeoCard variant="erobo" title={t("totalPools")}>
          {recentPools.length ? (
            <div className="gas-pool-list">
              {recentPools.map((pool) => (
                <button key={pool.id} type="button" onClick={() => setPoolId(pool.id)}>
                  <span>#{pool.id}</span>
                  <strong>{formatGas(pool.totalAmount, 2)} GAS</strong>
                  <small>{formatGas(pool.minClaimAmount, 2)}-{formatGas(pool.maxClaimAmount, 2)} GAS</small>
                </button>
              ))}
            </div>
          ) : (
            <div className="gas-pool-empty">{t("noPoolSelected")}</div>
          )}
        </NeoCard>
        <NeoCard variant="erobo" title={t("activityTab")}>
          {recentClaims.length ? (
            <div className="gas-pool-claims">
              {recentClaims.map((claim) => (
                <div key={claim.id}>
                  <span>{formatHash(claim.claimer, 8, 6)}</span>
                  <strong>{formatGas(claim.amount, 4)} GAS</strong>
                  <small>Pool #{claim.poolId}</small>
                </div>
              ))}
            </div>
          ) : (
            <div className="gas-pool-empty">{t("claims")}: 0</div>
          )}
        </NeoCard>
      </section>

      {(lastTxid || lastError) && (
        <div className={`gas-pool-toast${lastError ? " gas-pool-toast--error" : ""}`}>
          {lastError ||
            (lastSuccessType === "claim" && lastClaimAmount > 0n
              ? `${t("claimedAmount", { amount: formatGas(lastClaimAmount, 4) })}${lastClaimLuckPercent ? ` · ${t("luckPercentLabel", { percent: lastClaimLuckPercent })}` : ""} · tx ${formatHash(lastTxid, 10, 8)}`
              : lastSuccessType === "refund" && lastRefundAmount > 0n
                ? `${t("refundCongratsBody", {
                    amount: formatGas(lastRefundAmount, 4),
                    poolId: lastRefundPoolId || poolId,
                  })} · tx ${formatHash(lastTxid, 10, 8)}`
              : lastSuccessType === "fund" && lastFundAmount > 0n
                ? `${t("fundCongratsBody", {
                    amount: formatGas(lastFundAmount, 4),
                    poolId: lastFundPoolId || poolId,
                  })} · tx ${formatHash(lastTxid, 10, 8)}`
              : `tx ${formatHash(lastTxid, 10, 8)}`)}
        </div>
      )}
    </div>
  );
}
