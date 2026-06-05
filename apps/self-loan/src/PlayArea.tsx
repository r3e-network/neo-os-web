/**
 * PlayArea.tsx -- Self Loan
 *
 * Self-custodial lending interface with platform stats, loan status card
 * with LTV and health factor gauge, borrow form with LTV slider,
 * repay section, and add-collateral section.
 */

import { useState } from "react";
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

  const neoBalance = num("neoBalance");
  const selectedLtvPercent = num("selectedLtvPercent");
  const healthFactor = num("healthFactor");
  const currentLTV = num("currentLTV");
  const totalLoans = num("totalLoans");

  const neoBalanceDisplay = str("neoBalanceDisplay");
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
  const handleBorrow = async () => {
    if (!localCollateralAmt) return;
    await dispatch("borrow", {
      collateralAmount: localCollateralAmt,
    });
    setLocalCollateralAmt("");
  };

  const handleSelectTier = (tier: number) => {
    dispatch("setLtvTier", tier);
  };

  const handleRepay = async () => {
    if (!localRepayAmt) return;
    await dispatch("repay", localRepayAmt);
    setLocalRepayAmt("");
  };

  const handleAddCollateral = async () => {
    if (!localAddCollateral) return;
    await dispatch("addCollateral", localAddCollateral);
    setLocalAddCollateral("");
  };

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
      ? t("safe") || "Safe"
      : hf >= 1.2
        ? t("caution") || "Caution"
        : t("danger") || "Danger";

  /* ---------- Derived LTV ---------- */
  const ltvPct = selectedLtvPercent > 0 ? selectedLtvPercent : currentLTV;
  const ltvColor =
    ltvPct <= 50 ? "#16c784" : ltvPct <= 75 ? "#f59e0b" : "#ef4444";

  /* ---------- Expected borrow (collateral × LTV, net of origination fee) ---------- */
  const collateralNum = parseFloat(localCollateralAmt || collateralAmount);
  // Use ?? so a genuine 0% fee renders as 0, not masked by a default.
  const rawFeeBps = (platformStats as PlatformStatsData | null)?.platformFeeBps;
  const feeBps = Number.isFinite(rawFeeBps) ? (rawFeeBps as number) : 0;
  const grossBorrow =
    Number.isFinite(collateralNum) && collateralNum > 0
      ? (collateralNum * selectedLtvPercent) / 100
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
    healthFactorDisplay || (hf > 0 ? hf.toFixed(2) : "--");
  const displayCurrentLTV =
    currentLTVDisplay || (currentLTV > 0 ? `${currentLTV.toFixed(1)}%` : "--");
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

  return (
    <div className="selfloan-play-area">
      {/* ==================== Hero ==================== */}
      <div className="selfloan-hero">
        <div className="selfloan-hero-lead">
          <span className="selfloan-hero-badge" aria-hidden="true">
            {"$"}
          </span>
          <div className="selfloan-hero-copy">
            <span className="selfloan-hero-eyebrow">
              {t("eyebrow") || "SELF LOAN"}
            </span>
            <h2 className="selfloan-hero-title">{t("title") || "SelfLoan"}</h2>
            <p className="selfloan-hero-subtitle">
              {t("docSubtitle") || "Tiered LTV self-loans with auto-repayment"}
            </p>
          </div>
        </div>
        <div className="selfloan-hero-stats">
          <div className="selfloan-hero-stat">
            <span className="selfloan-hero-stat-value">
              {displayTotalLoans}
            </span>
            <span className="selfloan-hero-stat-label">
              {t("totalLoans") || "Total Loans"}
            </span>
          </div>
          <div className="selfloan-hero-stat">
            <span className="selfloan-hero-stat-value">
              {displayTotalBorrowed}
            </span>
            <span className="selfloan-hero-stat-label">
              {t("totalBorrowed") || "Total Borrowed"}
            </span>
          </div>
          <div className="selfloan-hero-stat">
            <span className="selfloan-hero-stat-value">
              {displayTotalRepaid}
            </span>
            <span className="selfloan-hero-stat-label">
              {t("totalRepaid") || "Total Repaid"}
            </span>
          </div>
        </div>
      </div>

      <NeoCard
        variant="erobo"
        title={t("profitAnchorTitle") || "ProfitAnchor Vote Route"}
      >
        <div className="selfloan-profit-anchor">
          <div>
            <span className="selfloan-profit-anchor-label">
              {t("profitAnchorStatus") || "Collateral vote signal"}
            </span>
            <span className="selfloan-profit-anchor-value">
              {t("profitAnchorValue") || "Operator-selected council candidate"}
            </span>
          </div>
          <div className="selfloan-profit-anchor-badge">
            {t("profitAnchorBadge") || "Vote-only dependency"}
          </div>
        </div>
      </NeoCard>

      {/* ==================== Loan Status Card ==================== */}
      {hasLoan && (
        <NeoCard
          variant="erobo"
          title={t("loanStatus") || "Your Loan"}
        >
          <div className="selfloan-status">
            <div className="selfloan-status-row">
              <div className="selfloan-status-item">
                <span className="selfloan-status-label">
                  {t("collateral") || "Collateral"}
                </span>
                <span className="selfloan-status-value">
                  {displayCollateral} NEO
                </span>
              </div>
              <div className="selfloan-status-item">
                <span className="selfloan-status-label">
                  {t("borrowed") || "Borrowed"}
                </span>
                <span className="selfloan-status-value">
                  {displayBorrowed} GAS
                </span>
              </div>
              <div className="selfloan-status-item">
                <span className="selfloan-status-label">
                  {t("currentLTV") || "Current LTV"}
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
                  {healthMetricLabel || t("healthFactor") || "Health Factor"}
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
              <div className="selfloan-health-markers">
                <span>{t("liquidation") || "Liquidation"}</span>
                <span className="selfloan-health-status-label" style={{ color: healthColor }}>
                  {healthLabel}
                </span>
                <span>{t("safe") || "Safe"}</span>
              </div>
            </div>
          </div>
        </NeoCard>
      )}

      {/* ==================== Borrow Form ==================== */}
      <NeoCard
        variant="erobo"
        title={t("borrow") || "Borrow"}
      >
        <div className="selfloan-form">
          <div className="selfloan-balance-hint">
            {t("yourBalance") || "Your Balance"}:{" "}
            <strong>{displayNeoBalance} NEO</strong>
          </div>
          <NeoInput
            label={t("collateralAmount") || "Collateral (NEO)"}
            placeholder="0.00"
            type="number"
            value={localCollateralAmt || collateralAmount}
            suffix="NEO"
            onChange={handleSetCollateralAmount}
          />
          {/* LTV Tier Selector */}
          <div className="selfloan-ltv-tiers" role="group" aria-label={t("ltvTier") || "LTV Tier"}>
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

          {/* Expected borrow (collateral × LTV, net of origination fee) */}
          <div className="selfloan-balance-hint">
            {(feeBps > 0
              ? t("estimatedBorrowNet")
              : t("estimatedBorrow")) ||
              "Estimated Borrow"}
            :{" "}
            <strong>
              {expectedBorrow > 0 ? expectedBorrow.toFixed(2) : "0.00"} GAS
            </strong>
          </div>
          {feeBps > 0 && grossBorrow > 0 && (
            <div className="selfloan-balance-hint">
              {t("originationFee", { percent: feePercent }) ||
                "Origination fee"}
              : <strong>{feeAmount.toFixed(2)} GAS</strong>
            </div>
          )}

          {/* LTV Selector / Indicator */}
          <div className="selfloan-ltv-indicator">
            <span className="selfloan-ltv-label">
              {t("selectedLTV") || "LTV Ratio"}
            </span>
            <span
              className="selfloan-ltv-value"
              style={{ color: ltvColor }}
            >
              {ltvPct > 0 ? `${ltvPct}%` : "--"}
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
              <span>{t("conservative") || "Conservative"}</span>
              <span>{t("aggressive") || "Aggressive"}</span>
            </div>
          </div>

          <div className="selfloan-cta">
            {isConnected ? (
              <NeoButton
                variant="primary"
                block
                loading={isBorrowing}
                disabled={!localCollateralAmt || isBorrowing}
                onClick={handleBorrow}
              >
                {t("borrow") || "Borrow"}
              </NeoButton>
            ) : (
              <div className="selfloan-connect-prompt" role="note">
                <span className="selfloan-connect-prompt-icon" aria-hidden="true">
                  {"🔒"}
                </span>
                <span className="selfloan-connect-prompt-text">
                  {t("connectWalletToUse") || "Connect wallet to use Self Loan"}
                </span>
              </div>
            )}
          </div>
        </div>
      </NeoCard>

      {/* ==================== Repay Section ==================== */}
      {hasLoan && (
        <NeoCard
          variant="erobo"
          title={t("repay") || "Repay Loan"}
        >
          <div className="selfloan-form">
            <NeoInput
              label={t("repayAmount") || "Repay Amount"}
              placeholder="0.00"
              type="number"
              value={localRepayAmt}
              suffix="GAS"
              onChange={setLocalRepayAmt}
            />
            <NeoButton
              variant="success"
              block
              loading={isRepaying}
              disabled={!localRepayAmt || isRepaying}
              onClick={handleRepay}
            >
              {t("repay") || "Repay"}
            </NeoButton>
          </div>
        </NeoCard>
      )}

      {/* ==================== Add Collateral Section ==================== */}
      {hasLoan && (
        <NeoCard
          variant="erobo"
          title={t("addCollateral") || "Add Collateral"}
        >
          <div className="selfloan-form">
            <div className="selfloan-balance-hint">
              {t("availableBalance") || "Available"}:{" "}
              <strong>{displayNeoBalance} NEO</strong>
            </div>
            <NeoInput
              label={t("addCollateralAmount") || "Additional Collateral"}
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
              {t("addCollateral") || "Add Collateral"}
            </NeoButton>
          </div>
        </NeoCard>
      )}

      {/* ==================== Reclaim Affordances ==================== */}
      {/* The deposit-then-act model can leave a credit on the contract if the
          second step never completed (e.g. a deposited NEO collateral that was
          never borrowed against, or a GAS repay-deposit that was never applied).
          These cards give the user an explicit recovery path so no funds strand. */}
      {hasCollateralCredit && (
        <NeoCard variant="erobo" title={t("reclaimCollateralTitle") || "Reclaim Collateral"}>
          <div className="selfloan-form">
            <div className="selfloan-balance-hint">
              {t("reclaimCollateralCopy") ||
                "You have NEO credited as collateral that was never borrowed against."}
            </div>
            <div className="selfloan-balance-hint">
              {t("reclaimable") || "Reclaimable"}:{" "}
              <strong>{collateralCreditDisplay}</strong>
            </div>
            <NeoButton
              variant="secondary"
              block
              loading={isProcessing}
              disabled={isProcessing}
              onClick={handleReclaimCollateral}
            >
              {t("reclaimCollateral") || "Reclaim Collateral"}
            </NeoButton>
          </div>
        </NeoCard>
      )}

      {hasRepayCredit && (
        <NeoCard variant="erobo" title={t("reclaimRepayTitle") || "Reclaim Repay Credit"}>
          <div className="selfloan-form">
            <div className="selfloan-balance-hint">
              {t("reclaimRepayCopy") ||
                "You have GAS deposited as repay credit that was never applied to a loan."}
            </div>
            <div className="selfloan-balance-hint">
              {t("reclaimable") || "Reclaimable"}:{" "}
              <strong>{repayCreditDisplay}</strong>
            </div>
            <NeoButton
              variant="secondary"
              block
              loading={isProcessing}
              disabled={isProcessing}
              onClick={handleReclaimRepayCredit}
            >
              {t("reclaimRepayCredit") || "Reclaim Repay Credit"}
            </NeoButton>
          </div>
        </NeoCard>
      )}

      {/* Loading overlay */}
      {isLoading && (
        <div className="selfloan-loading-overlay">
          <div className="selfloan-loading-spinner" />
          <span>{t("loading") || "Loading..."}</span>
        </div>
      )}
    </div>
  );
}
