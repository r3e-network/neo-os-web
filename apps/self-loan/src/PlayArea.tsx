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
}

interface StatsData {
  totalLoans?: number;
  totalBorrowed?: number;
  totalRepaid?: number;
  activeLoans?: number;
}

export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { str, bool, num, val } = useStateBindings(state);

  /* ---------- Bound state ---------- */
  const isLoading = bool("isLoading");
  const isBorrowing = bool("isBorrowing");
  const isRepaying = bool("isRepaying");
  const isConnected = bool("isConnected");

  const neoBalance = num("neoBalance");
  const neoPrice = num("neoPrice");
  const selectedLtvPercent = num("selectedLtvPercent");
  const healthFactor = num("healthFactor");
  const currentLTV = num("currentLTV");
  const totalLoans = num("totalLoans");

  const neoBalanceDisplay = str("neoBalanceDisplay");
  const hasLoanDisplay = str("hasLoanDisplay");
  const healthFactorDisplay = str("healthFactorDisplay");
  const currentLTVDisplay = str("currentLTVDisplay");
  const collateralDisplay = str("collateralDisplay");
  const borrowedDisplay = str("borrowedDisplay");
  const totalBorrowedDisplay = str("totalBorrowedDisplay");
  const totalRepaidDisplay = str("totalRepaidDisplay");
  const borrowAmount = str("borrowAmount");
  const collateralAmount = str("collateralAmount");

  const loan = val<LoanData>("loan");
  const platformStats = val<PlatformStatsData>("platformStats");
  const stats = val<StatsData>("stats");
  const selectedLtv = val("selectedLtv");

  /* ---------- Local form state ---------- */
  const [localBorrowAmt, setLocalBorrowAmt] = useState("");
  const [localCollateralAmt, setLocalCollateralAmt] = useState("");
  const [localRepayAmt, setLocalRepayAmt] = useState("");
  const [localAddCollateral, setLocalAddCollateral] = useState("");

  /* ---------- Handlers ---------- */
  const handleBorrow = async () => {
    if (!localBorrowAmt || !localCollateralAmt) return;
    await dispatch("borrow", {
      borrowAmount: localBorrowAmt,
      collateralAmount: localCollateralAmt,
    });
    setLocalBorrowAmt("");
    setLocalCollateralAmt("");
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

  const handleSetBorrowAmount = (v: string) => {
    setLocalBorrowAmt(v);
    dispatch("setBorrowAmount", v);
  };

  const handleSetCollateralAmount = (v: string) => {
    setLocalCollateralAmt(v);
    dispatch("setCollateralAmount", v);
  };

  /* ---------- Derived health gauge ---------- */
  const hf = healthFactor > 0 ? healthFactor : 0;
  const healthColor =
    hf >= 2 ? "#00e599" : hf >= 1.2 ? "#f59e0b" : "#ef4444";
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
    ltvPct <= 50 ? "#00e599" : ltvPct <= 75 ? "#f59e0b" : "#ef4444";

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
      {/* ==================== Platform Stats ==================== */}
      <div className="selfloan-hero-stats">
        <div className="selfloan-hero-stat">
          <span className="selfloan-hero-stat-value">
            ${neoPrice > 0 ? neoPrice.toFixed(2) : "--"}
          </span>
          <span className="selfloan-hero-stat-label">
            {t("neoPrice") || "NEO Price"}
          </span>
        </div>
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

      <NeoCard
        variant="erobo"
        title={t("profitAnchorTitle") || "ProfitAnchor Yield Route"}
      >
        <div className="selfloan-profit-anchor">
          <div>
            <span className="selfloan-profit-anchor-label">
              {t("profitAnchorStatus") || "Collateral vote signal"}
            </span>
            <span className="selfloan-profit-anchor-value">
              {t("profitAnchorValue") || "Highest expected GAS per NEO"}
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
                  {t("healthFactor") || "Health Factor"}
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
          <NeoInput
            label={t("borrowAmount") || "Borrow Amount (GAS)"}
            placeholder="0.00"
            type="number"
            value={localBorrowAmt || borrowAmount}
            suffix="GAS"
            onChange={handleSetBorrowAmount}
          />

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
                  background: `linear-gradient(90deg, #00e599, ${ltvColor})`,
                }}
              />
            </div>
            <div className="selfloan-ltv-hints">
              <span>{t("conservative") || "Conservative"}</span>
              <span>{t("aggressive") || "Aggressive"}</span>
            </div>
          </div>

          <NeoButton
            variant="primary"
            block
            loading={isBorrowing}
            disabled={
              !localCollateralAmt || !localBorrowAmt || isBorrowing || !isConnected
            }
            onClick={handleBorrow}
          >
            {isConnected
              ? t("borrow") || "Borrow"
              : t("connectWallet") || "Connect Wallet"}
          </NeoButton>
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
              disabled={!localAddCollateral}
              onClick={handleAddCollateral}
            >
              {t("addCollateral") || "Add Collateral"}
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
