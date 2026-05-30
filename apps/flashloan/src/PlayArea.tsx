/**
 * PlayArea.tsx -- Flash Loan
 *
 * Stats row, loan request form (amount + callback contract),
 * lookup, and recent loan history.
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

interface LoanDetails {
  id: string;
  borrower: string;
  amount: string;
  fee: string;
  callbackContract: string;
  callbackMethod: string;
  timestamp: string;
  status: "pending" | "success" | "failed";
}

interface ExecutedLoan {
  id: number;
  amount: number;
  fee: number;
  status: "success" | "failed";
  timestamp: string;
}

export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { str, bool, num, val } = useStateBindings(state);

  const isLoading = bool("isLoading");
  const address = str("address");
  const poolBalance = str("poolBalance", "0");
  const totalLoans = num("totalLoans");
  const totalVolume = num("totalVolume");
  const totalFees = num("totalFees");
  const validationError = str("validationError");
  const loanDetails = val<LoanDetails | null>("loanDetails", null);
  const recentLoans = val<ExecutedLoan[]>("recentLoans") ?? [];

  const [loanAmount, setLoanAmount] = useState("");
  const [callbackContract, setCallbackContract] = useState("");
  const [lookupId, setLookupId] = useState("");

  const canRequest =
    address.trim() !== "" &&
    loanAmount.trim() !== "" &&
    callbackContract.trim() !== "";

  const handleRequestLoan = async () => {
    if (!canRequest) return;
    await dispatch("requestLoan", {
      amount: loanAmount,
      callbackContract,
      callbackMethod: "onFlashLoan",
    });
    setLoanAmount("");
  };

  const handleLookup = async () => {
    if (!lookupId.trim()) return;
    await dispatch("lookupLoan", lookupId.trim());
  };

  const loanStatusClass = (status: string) => {
    switch (status) {
      case "success": return "flashloan-status--repaid";
      case "failed": return "flashloan-status--liquidated";
      case "pending": return "flashloan-status--active";
      default: return "";
    }
  };

  return (
    <div className="flashloan-play-area">
      {/* Hero — identity + pool snapshot in one card */}
      <NeoCard variant="erobo" className="flashloan-hero">
        <div className="flashloan-hero__head">
          <div className="flashloan-hero__badge" aria-hidden="true">
            <svg
              viewBox="0 0 24 24"
              width="24"
              height="24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.9"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z" />
            </svg>
          </div>
          <div className="flashloan-hero__text">
            <h2 className="flashloan-hero__title">{t("title") || "Flash Loan"}</h2>
            <p className="flashloan-hero__subtitle">
              {t("flashloanInfo") ||
                "Borrow and repay atomically in a single transaction via a callback contract."}
            </p>
          </div>
        </div>
        <div className="flashloan-hero__stats">
          <div className="flashloan-stat">
            <span className="flashloan-stat__value">{poolBalance}</span>
            <span className="flashloan-stat__label">{t("poolBalance") || "Pool Balance"}</span>
          </div>
          <div className="flashloan-stat">
            <span className="flashloan-stat__value">{totalLoans}</span>
            <span className="flashloan-stat__label">{t("totalLoans") || "Loans Executed"}</span>
          </div>
          <div className="flashloan-stat">
            <span className="flashloan-stat__value">{totalVolume.toFixed(2)}</span>
            <span className="flashloan-stat__label">{t("totalVolume") || "Total Volume (GAS)"}</span>
          </div>
          <div className="flashloan-stat">
            <span className="flashloan-stat__value">{totalFees.toFixed(2)}</span>
            <span className="flashloan-stat__label">{t("totalFees") || "Total Fees (GAS)"}</span>
          </div>
        </div>
      </NeoCard>

      {/* Loan Request */}
      <NeoCard variant="erobo" className="flashloan-request-card">
        <h3 className="flashloan-section-title">{t("requestLoan") || "Request Flash Loan"}</h3>
        <div className="flashloan-loan-form">
          <NeoInput
            type="number"
            value={loanAmount}
            placeholder={t("enterLoanAmount") || "10"}
            label={t("loanAmount") || "Amount (GAS)"}
            min={0}
            onChange={setLoanAmount}
          />
          <NeoInput
            value={callbackContract}
            placeholder={t("callbackContractPlaceholder") || "0x..."}
            label={t("callbackContract") || "Callback Contract"}
            onChange={setCallbackContract}
          />
          <p className="flashloan-fixed-callback">
            {t("callbackMethodFixed") || "Callback method is fixed to onFlashLoan for safety."}
          </p>
          {!address && (
            <p className="flashloan-connect-hint">
              {t("connectWalletToUse") || "Connect wallet to use Flash Loan"}
            </p>
          )}
          {validationError && (
            <p className="flashloan-validation-error">{validationError}</p>
          )}
          <NeoButton
            variant="primary"
            size="lg"
            block
            loading={isLoading}
            disabled={isLoading || !canRequest}
            onClick={handleRequestLoan}
          >
            {t("requestLoan") || "Request Loan"}
          </NeoButton>
        </div>
      </NeoCard>

      {/* Lookup Loan */}
      <NeoCard variant="erobo" className="flashloan-lookup-card">
        <h3 className="flashloan-section-title">{t("lookupLoan") || "Lookup Loan"}</h3>
        <div className="flashloan-loan-form">
          <NeoInput
            value={lookupId}
            placeholder={t("loanIdPlaceholder") || "Loan ID"}
            label={t("loanId") || "Loan ID"}
            onChange={setLookupId}
          />
          <NeoButton variant="secondary" size="md" disabled={!lookupId.trim()} onClick={handleLookup}>
            {t("lookup") || "Lookup"}
          </NeoButton>
        </div>
        {loanDetails && (
          <div className="flashloan-loan-details">
            <div className="flashloan-loan-row">
              <span className="flashloan-cell-pool">#{loanDetails.id}</span>
              <span className="flashloan-cell-amount">{loanDetails.amount}</span>
              <span className="flashloan-cell-fee">+{loanDetails.fee}</span>
              <span className={`flashloan-cell-status ${loanStatusClass(loanDetails.status)}`}>
                {t(loanDetails.status) || loanDetails.status}
              </span>
            </div>
            <p className="flashloan-loan-callback">
              <strong>{t("callbackContract") || "Callback"}:</strong> {loanDetails.callbackContract} → {loanDetails.callbackMethod}
            </p>
          </div>
        )}
      </NeoCard>

      {/* Recent Loans */}
      {recentLoans.length > 0 && (
        <NeoCard variant="erobo" className="flashloan-recent-card">
          <h3 className="flashloan-section-title">{t("recentLoans") || "Recent Loans"}</h3>
          <div className="flashloan-table">
            <div className="flashloan-table-header">
              <span>{t("loanId") || "ID"}</span>
              <span>{t("amount") || "Amount"}</span>
              <span>{t("fee") || "Fee"}</span>
              <span>{t("status") || "Status"}</span>
            </div>
            {recentLoans.map((loan) => (
              <div key={loan.id} className="flashloan-table-row">
                <span className="flashloan-cell-pool">#{loan.id}</span>
                <span className="flashloan-cell-amount">{loan.amount}</span>
                <span className="flashloan-cell-fee">{loan.fee}</span>
                <span className={`flashloan-cell-status ${loanStatusClass(loan.status)}`}>
                  {t(loan.status) || loan.status}
                </span>
              </div>
            ))}
          </div>
        </NeoCard>
      )}
    </div>
  );
}
