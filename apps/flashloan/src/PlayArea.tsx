/**
 * PlayArea.tsx -- Flash Loan
 *
 * Full UI: stats row, pool selector, loan request form, active/recent loans.
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

interface Pool {
  id: string;
  name: string;
  token: string;
  liquidity: number;
  fee: number;
}

interface Loan {
  id: string;
  pool: string;
  amount: number;
  fee: number;
  status: "active" | "repaid" | "liquidated";
  timestamp?: number;
}

export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { str, bool, num, val } = useStateBindings(state);

  const isLoading = bool("isLoading");
  const isRequesting = bool("isRequesting");
  const totalLiquidity = str("totalLiquidity", "0");
  const totalBorrowed = str("totalBorrowed", "0");
  const activeLoanCount = num("activeLoanCount");
  const loanAmount = str("loanAmount", "");
  const pools = val<Pool[]>("pools") ?? [];
  const activeLoans = val<Loan[]>("activeLoans") ?? [];
  const recentLoans = val<Loan[]>("recentLoans") ?? [];
  const selectedPool = val<Pool>("selectedPool");

  const [localLoanAmount, setLocalLoanAmount] = useState("");
  const [selectedPoolId, setSelectedPoolId] = useState<string | null>(null);

  const handleSelectPool = (poolId: string) => {
    setSelectedPoolId(poolId);
  };

  const handleRequestLoan = async () => {
    const amount = localLoanAmount || loanAmount;
    const poolId = selectedPoolId || selectedPool?.id;
    if (!amount || !poolId) return;
    await dispatch("requestLoan", { poolId, amount });
    setLocalLoanAmount("");
  };

  const handleRepayLoan = async (loanId: string) => {
    await dispatch("repayLoan", loanId);
  };

  const loanStatusClass = (status: string) => {
    switch (status) {
      case "active": return "flashloan-status--active";
      case "repaid": return "flashloan-status--repaid";
      case "liquidated": return "flashloan-status--liquidated";
      default: return "";
    }
  };

  if (isLoading) {
    return (
      <div className="flashloan-play-area">
        <div className="flashloan-loading">
          <div className="flashloan-loading-spinner" />
          <span>{t("loading") || "Loading..."}</span>
        </div>
      </div>
    );
  }

  const activePoolId = selectedPoolId || selectedPool?.id;

  return (
    <div className="flashloan-play-area">
      {/* Stats Row */}
      <div className="flashloan-hero-stats">
        <div className="flashloan-hero-stat">
          <span className="flashloan-hero-stat-value">{totalLiquidity}</span>
          <span className="flashloan-hero-stat-label">{t("totalLiquidity")}</span>
        </div>
        <div className="flashloan-hero-stat">
          <span className="flashloan-hero-stat-value">{totalBorrowed}</span>
          <span className="flashloan-hero-stat-label">{t("totalBorrowed")}</span>
        </div>
        <div className="flashloan-hero-stat">
          <span className="flashloan-hero-stat-value">{activeLoanCount}</span>
          <span className="flashloan-hero-stat-label">{t("activeLoans")}</span>
        </div>
      </div>

      {/* Pool Selector + Loan Request */}
      <NeoCard variant="erobo" className="flashloan-request-card">
        <h3 className="flashloan-section-title">{t("selectPool")}</h3>
        {pools.length === 0 ? (
          <div className="flashloan-empty">{t("noPools")}</div>
        ) : (
          <div className="flashloan-pool-grid">
            {pools.map((pool) => (
              <div
                key={pool.id}
                className={`flashloan-pool-item${activePoolId === pool.id ? " flashloan-pool-item--selected" : ""}`}
                onClick={() => handleSelectPool(pool.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") handleSelectPool(pool.id); }}
              >
                <span className="flashloan-pool-token">{pool.token}</span>
                <span className="flashloan-pool-name">{pool.name}</span>
                <span className="flashloan-pool-liquidity">{pool.liquidity}</span>
                <span className="flashloan-pool-fee">{pool.fee}% {t("fee")}</span>
              </div>
            ))}
          </div>
        )}

        <div className="flashloan-loan-form">
          <NeoInput
            type="number"
            value={localLoanAmount || loanAmount}
            placeholder={t("enterLoanAmount")}
            label={t("loanAmount")}
            min={0}
            onChange={setLocalLoanAmount}
          />
          <NeoButton
            variant="primary"
            size="lg"
            block
            loading={isRequesting}
            disabled={isRequesting || !(localLoanAmount || loanAmount) || !activePoolId}
            onClick={handleRequestLoan}
          >
            {t("requestLoan")}
          </NeoButton>
        </div>
      </NeoCard>

      {/* Active Loans */}
      {activeLoans.length > 0 && (
        <NeoCard variant="erobo" className="flashloan-active-card">
          <h3 className="flashloan-section-title">{t("activeLoans")}</h3>
          <div className="flashloan-loan-list">
            {activeLoans.map((loan) => (
              <div key={loan.id} className="flashloan-loan-row">
                <div className="flashloan-loan-info">
                  <span className="flashloan-loan-pool">{loan.pool}</span>
                  <span className="flashloan-loan-amount">{loan.amount}</span>
                  <span className="flashloan-loan-fee">+{loan.fee} {t("fee")}</span>
                </div>
                <NeoButton
                  variant="warning"
                  size="sm"
                  onClick={() => handleRepayLoan(loan.id)}
                >
                  {t("repay")}
                </NeoButton>
              </div>
            ))}
          </div>
        </NeoCard>
      )}

      {/* Recent Loans */}
      {recentLoans.length > 0 && (
        <NeoCard variant="erobo" className="flashloan-recent-card">
          <h3 className="flashloan-section-title">{t("recentLoans")}</h3>
          <div className="flashloan-table">
            <div className="flashloan-table-header">
              <span>{t("pool")}</span>
              <span>{t("amount")}</span>
              <span>{t("fee")}</span>
              <span>{t("status")}</span>
            </div>
            {recentLoans.map((loan) => (
              <div key={loan.id} className="flashloan-table-row">
                <span className="flashloan-cell-pool">{loan.pool}</span>
                <span className="flashloan-cell-amount">{loan.amount}</span>
                <span className="flashloan-cell-fee">{loan.fee}</span>
                <span className={`flashloan-cell-status ${loanStatusClass(loan.status)}`}>
                  {t(loan.status)}
                </span>
              </div>
            ))}
          </div>
        </NeoCard>
      )}
    </div>
  );
}
