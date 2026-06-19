/**
 * PlayArea.tsx -- Self Loan
 *
 * Self-custodial lending interface with platform stats, loan status card
 * with LTV and health factor gauge, borrow form with LTV slider,
 * repay section, and add-collateral section.
 */

import { useEffect, useState } from "react";
import { NeoButton, NeoCard, NeoInput } from "@shared/components-react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import "./PlayArea.scss";

interface PlayAreaProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Observable>;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
}

interface LoanData {
  borrowed?: number;
  collateral?: number;
  ltv?: number;
  active?: boolean;
  healthFactor?: number;
  status?: string;
}

interface PlatformStatsData {
  totalBorrowed?: number;
  totalCollateral?: number;
  totalLoans?: number;
  avgLtv?: number;
  platformFeeBps?: number;
}

interface StatsData {
  totalLoans?: number;
  totalBorrowed?: number;
  totalRepaid?: number;
  activeLoans?: number;
}

interface LtvOptionData {
  tier: number;
  percent: number;
  label: string;
  desc?: string;
}

export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { str, bool, num, val } = useStateBindings(state);

  /* ---------- Bound state ---------- */
  const isLoading = bool("isLoading");
  const isBorrowing = bool("isBorrowing");
  const isRepaying = bool("isRepaying");
  const isAddingCollateral = bool("isAddingCollateral");
  const isProcessing = bool("isProcessing");
  const isConnected = bool("isConnected");

  const hasCollateralCredit = bool("hasCollateralCredit");
  const hasRepayCredit = bool("hasRepayCredit");
  const collateralCreditDisplay = str("collateralCreditDisplay");
  const repayCreditDisplay = str("repayCreditDisplay");

  // Relayed-but-unconfirmed notice: a borrow/repay tx was broadcast but its
  // confirming event was never observed (verified=false). Surfaced as a distinct
  // "pending confirmation" banner instead of a success toast.
  const hasPendingConfirmation = bool("hasPendingConfirmation");
  const pendingConfirmation = str("pendingConfirmation");

  const neoBalance = num("neoBalance");
  const selectedLtvPercent = num("selectedLtvPercent");
  const healthFactor = num("healthFactor");
  const currentLTV = num("currentLTV");
  const totalLoans = num("totalLoans");
  // WHOLE GAS per NEO (0 = unconfigured). Needed so the borrow estimate mirrors
  // takeLoan(), which sizes the loan on collateralValue = collateralNeo × neoPrice.
  const neoPrice = num("neoPrice");

  const neoBalanceDisplay = str("neoBalanceDisplay");
  const neoPriceDisplay = str("neoPriceDisplay");
  const poolDisplay = str("poolDisplay");
  const hasActiveLoan = bool("hasActiveLoan");
  const borrowOkNonce = num("borrowOkNonce");
  const repayOkNonce = num("repayOkNonce");
  const addCollateralOkNonce = num("addCollateralOkNonce");
  const hasLoanDisplay = str("hasLoanDisplay");
  const healthFactorDisplay = str("healthFactorDisplay");
  const healthMetricLabel = str("healthMetricLabel");
  const currentLTVDisplay = str("currentLTVDisplay");
  const collateralDisplay = str("collateralDisplay");
  const borrowedDisplay = str("borrowedDisplay");
  const totalBorrowedDisplay = str("totalBorrowedDisplay");
  const totalRepaidDisplay = str("totalRepaidDisplay");
  const collateralAmount = str("collateralAmount");

  const loan = val<LoanData>("loan");
  const platformStats = val<PlatformStatsData>("platformStats");
  const stats = val<StatsData>("stats");
  const selectedTier = num("selectedLtv", 1);
  const ltvOptions = val<LtvOptionData[]>("ltvOptions") ?? [];

  /* ---------- Local form state ---------- */
  const [localCollateralAmt, setLocalCollateralAmt] = useState("");
  const [localRepayAmt, setLocalRepayAmt] = useState("");
  const [localAddCollateral, setLocalAddCollateral] = useState("");

  /* ---------- Handlers ---------- */
  // Inputs are cleared by the success-nonce effects below (not after dispatch),
  // so a swallowed failure (notify.guard resolves to undefined) preserves what
  // the user typed instead of forcing a full re-entry.
  const handleBorrow = async () => {
    if (!localCollateralAmt || hasActiveLoan) return;
    await dispatch("borrow", {
      collateralAmount: localCollateralAmt,
    });
  };

  const handleSelectTier = (tier: number) => {
    dispatch("setLtvTier", tier);
  };

  const handleRepay = async () => {
    if (!localRepayAmt) return;
    await dispatch("repay", localRepayAmt);
  };

  const handleAddCollateral = async () => {
    if (!localAddCollateral) return;
    await dispatch("addCollateral", localAddCollateral);
  };

  /* Clear each form's local input only when its action actually succeeded — the
     composable bumps a per-action nonce on success (and never on a swallowed
     failure), so the effect runs on real completions only. */
  useEffect(() => {
    if (borrowOkNonce > 0) setLocalCollateralAmt("");
  }, [borrowOkNonce]);
  useEffect(() => {
    if (repayOkNonce > 0) setLocalRepayAmt("");
  }, [repayOkNonce]);
  useEffect(() => {
    if (addCollateralOkNonce > 0) setLocalAddCollateral("");
  }, [addCollateralOkNonce]);

  const handleSetCollateralAmount = (v: string) => {
    setLocalCollateralAmt(v);
    dispatch("setCollateralAmount", v);
  };

  const handleReclaimCollateral = async () => {
    await dispatch("reclaimCollateral");
  };

  const handleReclaimRepayCredit = async () => {
    await dispatch("reclaimRepayCredit");
  };

  /* ---------- Derived health gauge ---------- */
  const hf = healthFactor > 0 ? healthFactor : 0;
  const healthColor =
    hf >= 2 ? "#16c784" : hf >= 1.2 ? "#f59e0b" : "#ef4444";
  const healthPercent = Math.min(hf / 3, 1) * 100;
  const healthLabel =
    hf >= 2
      ? t("safe")
      : hf >= 1.2
        ? t("caution")
        : t("danger");

  /* ---------- Derived LTV ---------- */
  const ltvPct = selectedLtvPercent > 0 ? selectedLtvPercent : currentLTV;
  // AA-compliant (>=4.5:1 on the light value chip) shades of the same
  // green/amber/red risk semantics. The brighter brand tones (#16c784 / #f59e0b)
  // failed WCAG contrast as foreground text.
  const ltvColor =
    ltvPct <= 50 ? "#0a6e4a" : ltvPct <= 75 ? "#a15c07" : "#b91c1c";

  /* ---------- Expected borrow (collateral × LTV, net of origination fee) ---------- */
  const collateralNum = parseFloat(localCollateralAmt || collateralAmount);
  // Use ?? so a genuine 0% fee renders as 0, not masked by a default.
  const rawFeeBps = (platformStats as PlatformStatsData | null)?.platformFeeBps;
  const feeBps = Number.isFinite(rawFeeBps) ? (rawFeeBps as number) : 0;
  // takeLoan() sizes the loan on collateralValue = collateralNeo × neoPrice (whole
  // GAS per NEO); when no price is configured each NEO counts as 1 unit of value.
  // Omitting the price factor understated the estimate by ~neoPrice× (e.g. 3× at a
  // 3 GAS/NEO price), so the user saw far less than takeLoan() actually disburses.
  const collateralValueFactor = neoPrice > 0 ? neoPrice : 1;
  const grossBorrow =
    Number.isFinite(collateralNum) && collateralNum > 0
      ? (collateralNum * collateralValueFactor * selectedLtvPercent) / 100
      : 0;
  // Mirror takeLoan(): netBorrow = gross − gross*feeBps/10000. The user actually
  // receives the net amount, so display that (not the gross) to avoid overstating.
  const feeAmount = (grossBorrow * feeBps) / 10000;
  const expectedBorrow = Math.max(grossBorrow - feeAmount, 0);
  const feePercent = feeBps / 100;

  /* ---------- Display helpers ---------- */
  const displayNeoBalance =
    neoBalanceDisplay || (neoBalance > 0 ? neoBalance.toFixed(2) : "0");
  const displayHealthFactor =
    healthFactorDisplay || (hf > 0 ? hf.toFixed(2) : "—");
  const displayCurrentLTV =
    currentLTVDisplay || (currentLTV > 0 ? `${currentLTV.toFixed(1)}%` : "—");
  const displayCollateral =
    collateralDisplay ||
    ((loan as LoanData)?.collateral?.toLocaleString() ?? "0");
  const displayBorrowed =
    borrowedDisplay ||
    ((loan as LoanData)?.borrowed?.toLocaleString() ?? "0");
  const displayTotalBorrowed =
    totalBorrowedDisplay ||
    (platformStats?.totalBorrowed?.toLocaleString() ??
      (stats as StatsData)?.totalBorrowed?.toLocaleString() ??
      "0");
  const displayTotalRepaid =
    totalRepaidDisplay ||
    ((stats as StatsData)?.totalRepaid?.toLocaleString() ?? "0");
  const displayTotalLoans =
    totalLoans > 0
      ? totalLoans
      : (platformStats?.totalLoans ??
          (stats as StatsData)?.totalLoans ??
          0);

  const hasLoan =
    hasLoanDisplay.toLowerCase() === "yes" ||
    Boolean((loan as LoanData | null)?.active) ||
    Boolean((loan as LoanData | null)?.borrowed);

  /* Outstanding GAS debt (whole GAS) drives the repay "Max" chip. The repay
     validation accepts up to 8 decimals, so trim the fill value to 8 dp and
     drop trailing zeros to match what the user would type. */
  const outstandingDebt = Math.max(0, Number((loan as LoanData | null)?.borrowed ?? 0));
  const outstandingDebtInput =
    outstandingDebt > 0
      ? outstandingDebt.toFixed(8).replace(/\.?0+$/, "")
      : "";

  return (
    <div className="selfloan-play-area">
      {/* ==================== Hero ==================== */}
      <div className="selfloan-hero">
        <div className="selfloan-hero-lead">
          <span className="selfloan-hero-badge" aria-hidden="true">
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="7" width="18" height="13" rx="2" />
              <path d="M3 11h18" />
              <path d="M7 7V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2" />
              <circle cx="12" cy="15" r="1.5" />
            </svg>
          </span>
          <div className="selfloan-hero-copy">
            <span className="selfloan-hero-eyebrow">
              {t("eyebrow")}
            </span>
            <h2 className="selfloan-hero-title">{t("title")}</h2>
            <p className="selfloan-hero-subtitle">
              {t("docSubtitle")}
            </p>
          </div>
        </div>
        <div className="selfloan-hero-stats">
          <div className="selfloan-hero-stat">
            <span className="selfloan-hero-stat-value">
              {displayTotalLoans}
            </span>
            <span className="selfloan-hero-stat-label">
              {t("totalLoans")}
            </span>
          </div>
          <div className="selfloan-hero-stat">
            <span className="selfloan-hero-stat-value">
              {displayTotalBorrowed}
            </span>
            <span className="selfloan-hero-stat-label">
              {t("totalBorrowed")}
            </span>
          </div>
          <div className="selfloan-hero-stat">
            <span className="selfloan-hero-stat-value">
              {displayTotalRepaid}
            </span>
            <span className="selfloan-hero-stat-label">
              {t("totalRepaid")}
            </span>
          </div>
        </div>
      </div>

      {/* ==================== Loan Status Card ==================== */}
      {hasLoan && (
        <NeoCard
          variant="erobo"
          title={t("loanStatus")}
        >
          <div className="selfloan-status">
            <div className="selfloan-status-row">
              <div className="selfloan-status-item">
                <span className="selfloan-status-label">
                  {t("collateral")}
                </span>
                <span className="selfloan-status-value">
                  {displayCollateral} NEO
                </span>
              </div>
              <div className="selfloan-status-item">
                <span className="selfloan-status-label">
                  {t("borrowed")}
                </span>
                <span className="selfloan-status-value">
                  {displayBorrowed} GAS
                </span>
              </div>
              <div className="selfloan-status-item">
                <span className="selfloan-status-label">
                  {t("currentLTV")}
                </span>
                <span className="selfloan-status-value">
                  {displayCurrentLTV}
                </span>
              </div>
            </div>

            {/* Health Factor Gauge */}
            <div className="selfloan-health">
              <div className="selfloan-health-header">
                <span className="selfloan-health-label">
                  {healthMetricLabel || t("healthFactor")}
                </span>
                <span
                  className="selfloan-health-value"
                  style={{ color: healthColor }}
                >
                  {displayHealthFactor}
                </span>
              </div>
              <div className="selfloan-health-track">
                <div
                  className="selfloan-health-bar"
                  style={{
                    width: `${healthPercent}%`,
                    background: healthColor,
                  }}
                />
              </div>
              {/* Endpoint labels describe the ratio extremes, not a liquidation
                  event — this product never force-liquidates, so the low end is
                  "Under-collateralized", not "Liquidation". */}
              <div className="selfloan-health-markers">
                <span>{t("underCollateralized")}</span>
                <span className="selfloan-health-status-label" style={{ color: healthColor }}>
                  {healthLabel}
                </span>
                <span>{t("safe")}</span>
              </div>
            </div>
          </div>
        </NeoCard>
      )}

      {/* ==================== Borrow Form ==================== */}
      <NeoCard
        variant="erobo"
        title={t("borrow")}
      >
        <div className="selfloan-form">
          <div className="selfloan-balance-hint">
            {t("yourBalance")}:{" "}
            <strong>{displayNeoBalance} NEO</strong>
          </div>
          <NeoInput
            label={t("collateralAmount")}
            placeholder="0.00"
            type="number"
            value={localCollateralAmt || collateralAmount}
            suffix="NEO"
            onChange={handleSetCollateralAmount}
          />
          {/* LTV Tier Selector */}
          <div className="selfloan-ltv-tiers" role="group" aria-label={t("ltvTier")}>
            {ltvOptions.map((option) => (
              <button
                key={option.tier}
                type="button"
                className={
                  "selfloan-ltv-tier" +
                  (option.tier === selectedTier ? " is-active" : "")
                }
                aria-pressed={option.tier === selectedTier}
                onClick={() => handleSelectTier(option.tier)}
              >
                <span className="selfloan-ltv-tier-label">{option.label}</span>
                <span className="selfloan-ltv-tier-percent">{option.percent}%</span>
              </button>
            ))}
          </div>

          {/* Rate the debt is sized by + pool liquidity available to disburse.
              Both come straight from the contract (neoPrice / pool); hidden when
              no price is configured so the borrow math stays honest. */}
          {neoPriceDisplay && (
            <div className="selfloan-balance-hint">
              {t("rateLabel")}:{" "}
              <strong>{t("rateValue", { price: neoPriceDisplay })}</strong>
            </div>
          )}
          <div className="selfloan-balance-hint">
            {t("poolAvailable")}: <strong>{poolDisplay}</strong>
          </div>

          {/* Expected borrow (collateral × LTV, net of origination fee) */}
          <div className="selfloan-balance-hint">
            {feeBps > 0 ? t("estimatedBorrowNet") : t("estimatedBorrow")}
            :{" "}
            <strong>
              {expectedBorrow > 0 ? expectedBorrow.toFixed(2) : "0.00"} GAS
            </strong>
          </div>
          {feeBps > 0 && grossBorrow > 0 && (
            <div className="selfloan-balance-hint">
              {t("originationFee", { percent: feePercent })}
              : <strong>{feeAmount.toFixed(2)} GAS</strong>
            </div>
          )}

          {/* Honest disclosure: the borrow size is derived from an operator-set
              neoPrice (not a market oracle), and the 0.5% fee is the pool's
              revenue — both are read straight from the contract above. */}
          <p className="selfloan-rate-fee-note" role="note">
            {t("rateFeeNote")}
          </p>

          {/* LTV Selector / Indicator */}
          <div className="selfloan-ltv-indicator">
            <span className="selfloan-ltv-label">
              {t("selectedLTV")}
            </span>
            <span
              className="selfloan-ltv-value"
              style={{ color: ltvColor }}
            >
              {ltvPct > 0 ? `${ltvPct}%` : "—"}
            </span>
            <div className="selfloan-ltv-track">
              <div
                className="selfloan-ltv-bar"
                style={{
                  width: `${Math.min(ltvPct, 100)}%`,
                  background: `linear-gradient(90deg, #16c784, ${ltvColor})`,
                }}
              />
            </div>
            <div className="selfloan-ltv-hints">
              <span>{t("conservative")}</span>
              <span>{t("aggressive")}</span>
            </div>
          </div>

          <div className="selfloan-cta">
            {!isConnected ? (
              <div className="selfloan-connect-prompt" role="note">
                <span className="selfloan-connect-prompt-icon" aria-hidden="true">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="4" y="11" width="16" height="9" rx="2" />
                    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                  </svg>
                </span>
                <span className="selfloan-connect-prompt-text">
                  {t("connectWalletToUse")}
                </span>
              </div>
            ) : hasActiveLoan ? (
              /* One loan per address — block the Borrow path up front (the
                 contract would otherwise revert in step 2, AFTER the NEO
                 deposit lands) and point at Add Collateral / Repay. */
              <div className="selfloan-connect-prompt" role="note">
                <span className="selfloan-connect-prompt-icon" aria-hidden="true">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 11v5" />
                    <path d="M12 8h.01" />
                  </svg>
                </span>
                <span className="selfloan-connect-prompt-text">
                  {t("loanAlreadyActiveHint")}
                </span>
              </div>
            ) : (
              <NeoButton
                variant="primary"
                block
                loading={isBorrowing}
                disabled={!localCollateralAmt || isBorrowing}
                onClick={handleBorrow}
              >
                {t("borrow")}
              </NeoButton>
            )}
          </div>

          {/* Custody disclosure — the locked collateral simply sits in the
              SelfLoan contract and is returned in full on repayment. The
              contract has NO voting/ProfitAnchor path, so this states the real
              disposition of the funds rather than implying they earn/vote. */}
          <div className="selfloan-vote-route" role="note">
            <span className="selfloan-vote-route-eyebrow">
              {t("custodyTitle")}
            </span>
            <p className="selfloan-vote-route-copy">
              <strong>{t("custodyValue")}</strong> · {t("custodyBadge")}
            </p>
          </div>
        </div>
      </NeoCard>

      {/* ==================== Repay Section ==================== */}
      {hasLoan && (
        <NeoCard
          variant="erobo"
          title={t("repay")}
        >
          <div className="selfloan-form">
            <div className="selfloan-repay-field">
              <NeoInput
                label={t("repayAmount")}
                placeholder="0.00"
                type="number"
                value={localRepayAmt}
                suffix="GAS"
                onChange={setLocalRepayAmt}
              />
              {/* Max chip fills the exact outstanding debt so the user need not
                  copy the Borrowed figure to repay in full. */}
              {outstandingDebt > 0 && (
                <button
                  type="button"
                  className="selfloan-max-chip"
                  onClick={() => setLocalRepayAmt(outstandingDebtInput)}
                >
                  {t("maxRepay")}
                </button>
              )}
            </div>
            <NeoButton
              variant="success"
              block
              loading={isRepaying}
              disabled={!localRepayAmt || isRepaying}
              onClick={handleRepay}
            >
              {t("repay")}
            </NeoButton>
          </div>
        </NeoCard>
      )}

      {/* ==================== Add Collateral Section ==================== */}
      {hasLoan && (
        <NeoCard
          variant="erobo"
          title={t("addCollateral")}
        >
          <div className="selfloan-form">
            <div className="selfloan-balance-hint">
              {t("availableBalance")}:{" "}
              <strong>{displayNeoBalance} NEO</strong>
            </div>
            <NeoInput
              label={t("addCollateralAmount")}
              placeholder="0.00"
              type="number"
              value={localAddCollateral}
              suffix="NEO"
              onChange={setLocalAddCollateral}
            />
            <NeoButton
              variant="secondary"
              block
              loading={isAddingCollateral}
              disabled={!localAddCollateral || isAddingCollateral}
              onClick={handleAddCollateral}
            >
              {t("addCollateral")}
            </NeoButton>
          </div>
        </NeoCard>
      )}

      {/* ==================== Pending confirmation ==================== */}
      {/* The action's transaction was broadcast but its confirming event was
          never observed (chain.invoke verified=false). Say so honestly rather
          than claiming success, so the user neither double-submits nor assumes
          the position already moved — a refresh hydrates it once the tx lands. */}
      {hasPendingConfirmation && (
        <NeoCard variant="erobo" title={t("pendingConfirmationLabel")}>
          <div className="selfloan-form">
            <div className="selfloan-balance-hint">{pendingConfirmation}</div>
          </div>
        </NeoCard>
      )}

      {/* ==================== Reclaim Affordances ==================== */}
      {/* The deposit-then-act model can leave a credit on the contract if the
          second step never completed (e.g. a deposited NEO collateral that was
          never borrowed against, or a GAS repay-deposit that was never applied).
          These cards give the user an explicit recovery path so no funds strand. */}
      {hasCollateralCredit && (
        <NeoCard variant="erobo" title={t("reclaimCollateralTitle")}>
          <div className="selfloan-form">
            <div className="selfloan-balance-hint">
              {t("reclaimCollateralCopy")}
            </div>
            <div className="selfloan-balance-hint">
              {t("reclaimable")}:{" "}
              <strong>{collateralCreditDisplay}</strong>
            </div>
            <NeoButton
              variant="secondary"
              block
              loading={isProcessing}
              disabled={isProcessing}
              onClick={handleReclaimCollateral}
            >
              {t("reclaimCollateral")}
            </NeoButton>
          </div>
        </NeoCard>
      )}

      {hasRepayCredit && (
        <NeoCard variant="erobo" title={t("reclaimRepayTitle")}>
          <div className="selfloan-form">
            <div className="selfloan-balance-hint">
              {t("reclaimRepayCopy")}
            </div>
            <div className="selfloan-balance-hint">
              {t("reclaimable")}:{" "}
              <strong>{repayCreditDisplay}</strong>
            </div>
            <NeoButton
              variant="secondary"
              block
              loading={isProcessing}
              disabled={isProcessing}
              onClick={handleReclaimRepayCredit}
            >
              {t("reclaimRepayCredit")}
            </NeoButton>
          </div>
        </NeoCard>
      )}

      {/* Loading overlay */}
      {isLoading && (
        <div className="selfloan-loading-overlay">
          <div className="selfloan-loading-spinner" />
          <span>{t("loading")}</span>
        </div>
      )}
    </div>
  );
}
