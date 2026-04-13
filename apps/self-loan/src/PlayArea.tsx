/**
 * PlayArea.tsx -- Self Loan
 *
 * Self-custodial lending interface with platform stats, loan status card
 * with LTV and health factor, borrow form, and repay section.
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
  healthFactor?: number;
  status?: string;
}

interface PlatformStatsData {
  totalBorrowed?: number;
  totalCollateral?: number;
  totalLoans?: number;
  avgLtv?: number;
}

export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { str, bool, num, val } = useStateBindings(state);

  const isLoading = bool("isLoading");
  const isBorrowing = bool("isBorrowing");
  const isRepaying = bool("isRepaying");
  const isConnected = bool("isConnected");
  const neoBalance = num("neoBalance");
  const neoPrice = num("neoPrice");
  const selectedLtvPercent = num("selectedLtv");
  const healthFactor = num("healthFactor");
  const currentLTV = num("currentLTV");
  const borrowAmount = str("borrowAmount");
  const collateralAmount = str("collateralAmount");

  const loan = val<LoanData>("loan");
  const platformStats = val<PlatformStatsData>("platformStats");

  // Local form state
  const [localBorrowAmt, setLocalBorrowAmt] = useState("");
  const [localCollateralAmt, setLocalCollateralAmt] = useState("");
  const [localRepayAmt, setLocalRepayAmt] = useState("");
  const [localAddCollateral, setLocalAddCollateral] = useState("");

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

  // Health factor color
  const healthColor =
    healthFactor >= 2 ? "#00e599" : healthFactor >= 1.2 ? "#f59e0b" : "#ef4444";
  const healthPercent = Math.min(healthFactor / 3, 1) * 100;

  return (
    <div className="selfloan-play-area">
      {/* Platform Stats */}
      <div className="selfloan-hero-stats">
        <div className="selfloan-hero-stat">
          <span className="selfloan-hero-stat-value">
            ${neoPrice > 0 ? neoPrice.toFixed(2) : "--"}
          </span>
          <span className="selfloan-hero-stat-label">{t("neoPrice")}</span>
        </div>
        <div className="selfloan-hero-stat">
          <span className="selfloan-hero-stat-value">
            {platformStats?.totalBorrowed?.toLocaleString() ?? "0"}
          </span>
          <span className="selfloan-hero-stat-label">{t("totalBorrowed")}</span>
        </div>
        <div className="selfloan-hero-stat">
          <span className="selfloan-hero-stat-value">
            {platformStats?.totalCollateral?.toLocaleString() ?? "0"}
          </span>
          <span className="selfloan-hero-stat-label">{t("totalCollateral")}</span>
        </div>
        <div className="selfloan-hero-stat">
          <span className="selfloan-hero-stat-value">
            {neoBalance > 0 ? neoBalance.toFixed(2) : "0"}
          </span>
          <span className="selfloan-hero-stat-label">{t("yourBalance")}</span>
        </div>
      </div>

      {/* Loan Status Card */}
      {loan && (
        <NeoCard variant="erobo" title={t("loanStatus")}>
          <div className="selfloan-status">
            <div className="selfloan-status-row">
              <div className="selfloan-status-item">
                <span className="selfloan-status-label">{t("currentLTV")}</span>
                <span className="selfloan-status-value">{currentLTV.toFixed(1)}%</span>
              </div>
              <div className="selfloan-status-item">
                <span className="selfloan-status-label">{t("borrowed")}</span>
                <span className="selfloan-status-value">
                  {(loan as LoanData).borrowed?.toLocaleString() ?? "0"}
                </span>
              </div>
              <div className="selfloan-status-item">
                <span className="selfloan-status-label">{t("collateral")}</span>
                <span className="selfloan-status-value">
                  {(loan as LoanData).collateral?.toLocaleString() ?? "0"} NEO
                </span>
              </div>
            </div>

            {/* Health Factor Gauge */}
            <div className="selfloan-health">
              <div className="selfloan-health-header">
                <span className="selfloan-health-label">{t("healthFactor")}</span>
                <span className="selfloan-health-value" style={{ color: healthColor }}>
                  {healthFactor > 0 ? healthFactor.toFixed(2) : "--"}
                </span>
              </div>
              <div className="selfloan-health-track">
                <div
                  className="selfloan-health-bar"
                  style={{ width: `${healthPercent}%`, background: healthColor }}
                />
              </div>
              <div className="selfloan-health-markers">
                <span>{t("liquidation")}</span>
                <span>{t("safe")}</span>
              </div>
            </div>
          </div>
        </NeoCard>
      )}

      {/* Borrow Form */}
      <NeoCard variant="erobo" title={t("borrow")}>
        <div className="selfloan-form">
          <NeoInput
            label={t("collateralAmount")}
            placeholder="0.00"
            type="number"
            value={localCollateralAmt || collateralAmount}
            suffix="NEO"
            onChange={handleSetCollateralAmount}
          />
          <NeoInput
            label={t("borrowAmount")}
            placeholder="0.00"
            type="number"
            value={localBorrowAmt || borrowAmount}
            suffix="USD"
            onChange={handleSetBorrowAmount}
          />
          {selectedLtvPercent > 0 && (
            <div className="selfloan-ltv-indicator">
              <span className="selfloan-ltv-label">{t("selectedLTV")}</span>
              <span className="selfloan-ltv-value">{selectedLtvPercent}%</span>
              <div className="selfloan-ltv-track">
                <div
                  className="selfloan-ltv-bar"
                  style={{ width: `${Math.min(selectedLtvPercent, 100)}%` }}
                />
              </div>
            </div>
          )}
          <NeoButton
            variant="primary"
            block
            loading={isBorrowing}
            disabled={!localCollateralAmt || !localBorrowAmt || isBorrowing || !isConnected}
            onClick={handleBorrow}
          >
            {isConnected ? t("borrow") : t("connectWallet")}
          </NeoButton>
        </div>
      </NeoCard>

      {/* Repay Section */}
      {loan && (
        <NeoCard variant="erobo" title={t("repay")}>
          <div className="selfloan-form">
            <NeoInput
              label={t("repayAmount")}
              placeholder="0.00"
              type="number"
              value={localRepayAmt}
              suffix="USD"
              onChange={setLocalRepayAmt}
            />
            <NeoButton
              variant="success"
              block
              loading={isRepaying}
              disabled={!localRepayAmt || isRepaying}
              onClick={handleRepay}
            >
              {t("repay")}
            </NeoButton>

            <div className="selfloan-divider" />

            <NeoInput
              label={t("addCollateral")}
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
              {t("addCollateral")}
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
