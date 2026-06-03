/**
 * PlayArea.tsx - Flash Loan
 *
 * Contract-backed request workspace, on-chain loan lookup, and recent execution
 * history for the PlatformDeFi FlashLoan contract.
 */

import { useEffect, useMemo, useState } from "react";
import { NeoButton, NeoCard, NeoInput } from "@shared/components-react";
import type { PlayAreaProps } from "@shared/react/defineMiniApp";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import { formatGas, toFixed8 } from "@shared/utils/format";
import { getLaunchParam } from "@shared/utils/launch-params";
import "./PlayArea.scss";

const CALLBACK_METHOD = "onFlashLoan";
const FEE_BPS = 9;
const AMOUNT_PRESETS = ["1", "10", "100"];

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

interface ContractStats {
  minLoan: number;
  maxLoan: number;
  feeBasisPoints: number;
  cooldownMs: number;
  maxDailyLoans: number;
}

interface LastRequest {
  txid: string;
  amount: string;
  fee: string;
  borrower: string;
  callbackContract: string;
  callbackMethod: string;
}

function estimateFee(amount: string) {
  try {
    const raw = BigInt(toFixed8(amount) || "0");
    return formatGas((raw * BigInt(FEE_BPS)) / 10_000n);
  } catch {
    return "0";
  }
}

function estimateRepayment(amount: string) {
  try {
    const raw = BigInt(toFixed8(amount) || "0");
    const fee = (raw * BigInt(FEE_BPS)) / 10_000n;
    return formatGas(raw + fee);
  } catch {
    return "0";
  }
}

function compactTxid(value: string) {
  if (!value) return "";
  return value.length > 18 ? `${value.slice(0, 10)}...${value.slice(-8)}` : value;
}

export default function PlayArea({
  t,
  state,
  dispatch,
  launchContext,
  setStatus,
}: PlayAreaProps) {
  const { str, bool, num, val } = useStateBindings(state);

  const isLoading = bool("isLoading");
  const address = str("address");
  const poolBalance = num("poolBalance");
  const totalLoans = num("totalLoans");
  const totalVolume = num("totalVolume");
  const totalFees = num("totalFees");
  const validationError = str("validationError");
  const loanDetails = val<LoanDetails | null>("loanDetails", null);
  const recentLoans = val<ExecutedLoan[]>("recentLoans", []) ?? [];
  const lastRequest = val<LastRequest | null>("lastRequest", null);
  const contractStats = val<ContractStats>("contractStats", {
    minLoan: 1,
    maxLoan: 100000,
    feeBasisPoints: FEE_BPS,
    cooldownMs: 300000,
    maxDailyLoans: 10,
  })!;

  const [loanAmount, setLoanAmount] = useState("");
  const [callbackContract, setCallbackContract] = useState("");
  const [lookupId, setLookupId] = useState("");

  useEffect(() => {
    const launchedAmount = getLaunchParam(launchContext, [
      "amount",
      "borrow",
      "borrowAmount",
      "loanAmount",
    ]);
    const launchedCallback = getLaunchParam(launchContext, [
      "callbackContract",
      "callback",
      "contract",
      "targetContract",
    ]);
    const launchedLoanId = getLaunchParam(launchContext, ["loanId", "id"]);

    if (launchedAmount) setLoanAmount(launchedAmount);
    if (launchedCallback) setCallbackContract(launchedCallback);
    if (launchedLoanId) setLookupId(launchedLoanId);
  }, [launchContext.signature]);

  const canRequest = loanAmount.trim() !== "" && callbackContract.trim() !== "";
  const feePreview = useMemo(() => estimateFee(loanAmount), [loanAmount]);
  const repaymentPreview = useMemo(() => estimateRepayment(loanAmount), [loanAmount]);
  const requestActionLabel = address
    ? t("signRequestFlashLoan") || "Sign requestFlashLoan"
    : t("connectAndSign") || "Connect and Sign";

  const handleConnect = async () => {
    await dispatch("connectWallet");
  };

  const handleRequestLoan = async () => {
    if (!canRequest) {
      setStatus(t("flashloanFormIncomplete") || "Enter amount and callback contract.", "error");
      return;
    }
    await dispatch("requestLoan", {
      amount: loanAmount.trim(),
      callbackContract: callbackContract.trim(),
      callbackMethod: CALLBACK_METHOD,
    });
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
            <p className="flashloan-hero__eyebrow">{t("eyebrow") || "Atomic liquidity"}</p>
            <h2 className="flashloan-hero__title">{t("title") || "Flash Loan"}</h2>
            <p className="flashloan-hero__subtitle">
              {t("flashloanInfo") ||
                "The callback contract receives principal and must repay principal plus fee in the same transaction."}
            </p>
          </div>
          <div className={`flashloan-wallet ${address ? "flashloan-wallet--connected" : ""}`}>
            <span className="flashloan-wallet__label">
              {address ? t("walletConnected") || "Wallet connected" : t("walletRequired") || "Wallet required"}
            </span>
            <span className="flashloan-wallet__value">
              {address || t("notAvailable") || "—"}
            </span>
          </div>
        </div>
        <div className="flashloan-hero__stats">
          <div className="flashloan-stat">
            <span className="flashloan-stat__value">{poolBalance.toFixed(4)}</span>
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
            <span className="flashloan-stat__value">{totalFees.toFixed(4)}</span>
            <span className="flashloan-stat__label">{t("totalFees") || "Total Fees (GAS)"}</span>
          </div>
        </div>
      </NeoCard>

      <div className="flashloan-workspace">
        <NeoCard variant="erobo" className="flashloan-request-card">
          <div className="flashloan-card-head">
            <div className="flashloan-card-heading">
              <p className="flashloan-card-eyebrow">{t("requestLoanEyebrow") || "Atomic liquidity"}</p>
              <h3 className="flashloan-section-title">{t("requestLoanTitle") || "Request Flash Loan"}</h3>
            </div>
            <span className="flashloan-method-pill">requestFlashLoan</span>
          </div>
          <div className="flashloan-loan-form">
            <NeoInput
              type="number"
              value={loanAmount}
              placeholder={t("amountPlaceholder") || "Enter amount in GAS"}
              label={t("loanAmount") || "Loan Amount"}
              min={0}
              onChange={setLoanAmount}
            />
            <div className="flashloan-presets" aria-label={t("amountPresets") || "Amount presets"}>
              {AMOUNT_PRESETS.map((amount) => (
                <button
                  key={amount}
                  type="button"
                  className={`flashloan-preset ${loanAmount === amount ? "flashloan-preset--active" : ""}`}
                  onClick={() => setLoanAmount(amount)}
                >
                  {amount} GAS
                </button>
              ))}
            </div>
            <NeoInput
              value={callbackContract}
              placeholder={t("callbackContractPlaceholder") || "0x..."}
              label={t("callbackContract") || "Callback Contract"}
              onChange={setCallbackContract}
            />
            <div className="flashloan-fixed-callback">
              <span>{t("callbackMethod") || "Callback Method"}</span>
              <strong>{CALLBACK_METHOD}</strong>
            </div>
            {validationError && (
              <p className="flashloan-validation-error" role="alert">{validationError}</p>
            )}
            <div className="flashloan-actions">
              {!address && (
                <NeoButton
                  variant="secondary"
                  size="md"
                  loading={isLoading}
                  disabled={isLoading}
                  onClick={handleConnect}
                >
                  {t("connectWallet") || "Connect Wallet"}
                </NeoButton>
              )}
              <NeoButton
                variant="primary"
                size="lg"
                block
                loading={isLoading}
                disabled={isLoading || !canRequest}
                onClick={handleRequestLoan}
              >
                {requestActionLabel}
              </NeoButton>
            </div>
          </div>
        </NeoCard>

        <NeoCard variant="erobo" className="flashloan-preview-card">
          <div className="flashloan-card-head">
            <div className="flashloan-card-heading">
              <p className="flashloan-card-eyebrow">{t("loanCalculatorEyebrow") || "Calculator"}</p>
              <h3 className="flashloan-section-title">{t("loanCalculator") || "Loan Calculator"}</h3>
            </div>
            <span className="flashloan-method-pill flashloan-method-pill--rate">{contractStats.feeBasisPoints / 100}%</span>
          </div>
          <div className="flashloan-preview-grid">
            <div className="flashloan-preview-item">
              <span>{t("minLoan") || "Min Loan"}</span>
              <strong>{contractStats.minLoan.toLocaleString()} GAS</strong>
            </div>
            <div className="flashloan-preview-item">
              <span>{t("maxLoan") || "Max Loan"}</span>
              <strong>{contractStats.maxLoan.toLocaleString()} GAS</strong>
            </div>
            <div className="flashloan-preview-item">
              <span>{t("estimatedFee") || "Estimated Fee"}</span>
              <strong>{feePreview} GAS</strong>
            </div>
            <div className="flashloan-preview-item flashloan-preview-item--total">
              <span>{t("totalRepayment") || "Total Repayment"}</span>
              <strong>{repaymentPreview} GAS</strong>
            </div>
          </div>
          <div className="flashloan-flow">
            <span>{t("borrow") || "Borrow"}</span>
            <span className="flashloan-flow-arrow" aria-hidden="true">→</span>
            <span>{t("execute") || "Execute"}</span>
            <span className="flashloan-flow-arrow" aria-hidden="true">→</span>
            <span>{t("repay") || "Repay"}</span>
          </div>
          <div className="flashloan-request-summary" aria-live="polite">
            {lastRequest ? (
              <>
                <div>
                  <span>{t("latestTx") || "Latest Tx"}</span>
                  <strong title={lastRequest.txid}>{compactTxid(lastRequest.txid)}</strong>
                </div>
                <div>
                  <span>{t("borrower") || "Borrower"}</span>
                  <strong>{lastRequest.borrower}</strong>
                </div>
                <div>
                  <span>{t("amount") || "Amount"}</span>
                  <strong>{lastRequest.amount} GAS</strong>
                </div>
              </>
            ) : (
              <p>{t("noRequestYet") || "No flash-loan transaction has been submitted in this session."}</p>
            )}
          </div>
        </NeoCard>
      </div>

      <div className="flashloan-workspace flashloan-workspace--secondary">
        <NeoCard variant="erobo" className="flashloan-lookup-card">
          <div className="flashloan-card-head">
            <div className="flashloan-card-heading">
              <p className="flashloan-card-eyebrow">{t("statusLookupEyebrow") || "On-chain lookup"}</p>
              <h3 className="flashloan-section-title">{t("statusLookup") || "Loan Status Lookup"}</h3>
            </div>
            <span className="flashloan-method-pill">getFlashLoan</span>
          </div>
          <div className="flashloan-lookup-row">
            <NeoInput
              value={lookupId}
              placeholder={t("loanIdPlaceholder") || "Enter loan ID"}
              label={t("loanId") || "Loan ID"}
              onChange={setLookupId}
            />
            <NeoButton variant="secondary" size="md" disabled={!lookupId.trim() || isLoading} onClick={handleLookup}>
              {t("checkStatus") || "Check Status"}
            </NeoButton>
          </div>
          {loanDetails && (
            <div className="flashloan-loan-details">
              <div className="flashloan-loan-row">
                <span className="flashloan-cell-pool">#{loanDetails.id}</span>
                <span className="flashloan-cell-amount">{loanDetails.amount} GAS</span>
                <span className="flashloan-cell-fee">+{loanDetails.fee} GAS</span>
                <span className={`flashloan-cell-status ${loanStatusClass(loanDetails.status)}`}>
                  {t(`status${loanDetails.status[0]?.toUpperCase()}${loanDetails.status.slice(1)}`) || loanDetails.status}
                </span>
              </div>
              <p className="flashloan-loan-callback">
                <strong>{t("callbackContract") || "Callback"}:</strong> {loanDetails.callbackContract} {"→"} {loanDetails.callbackMethod}
              </p>
            </div>
          )}
        </NeoCard>

        <NeoCard variant="erobo" className="flashloan-recent-card">
          <div className="flashloan-card-heading flashloan-card-heading--solo">
            <p className="flashloan-card-eyebrow">{t("recentLoansEyebrow") || "History"}</p>
            <h3 className="flashloan-section-title">{t("recentLoans") || "Recent Executions"}</h3>
          </div>
          {recentLoans.length > 0 ? (
            <div className="flashloan-table">
              <div className="flashloan-table-header">
                <span>{t("loanId") || "ID"}</span>
                <span>{t("amount") || "Amount"}</span>
                <span>{t("feeShort") || "Fee"}</span>
                <span>{t("statusLabel") || "Status"}</span>
              </div>
              {recentLoans.map((loan) => (
                <div key={loan.id} className="flashloan-table-row">
                  <span className="flashloan-cell-pool">#{loan.id}</span>
                  <span className="flashloan-cell-amount">{loan.amount.toFixed(4)} GAS</span>
                  <span className="flashloan-cell-fee">{loan.fee.toFixed(4)} GAS</span>
                  <span className={`flashloan-cell-status ${loanStatusClass(loan.status)}`}>
                    {t(loan.status) || loan.status}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="flashloan-empty">{t("noHistory") || "No executions yet"}</p>
          )}
        </NeoCard>
      </div>
    </div>
  );
}
