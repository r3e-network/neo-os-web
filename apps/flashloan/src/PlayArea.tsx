/**
 * PlayArea.tsx - Flash Loan
 *
 * Contract-backed request workspace, on-chain loan lookup, recent execution
 * history, and a liquidity-provider surface for the deployed MiniAppFlashLoan
 * contract (requestLoan / getLoanDetails / getPlatformStats / deposit / withdraw).
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

interface ProviderStats {
  currentBalance: number;
  totalDeposited: number;
  totalFeesEarned: number;
}

interface LastRequest {
  txid: string;
  amount: string;
  fee: string;
  borrower: string;
  callbackContract: string;
  callbackMethod: string;
}

function estimateFee(amount: string, bps: number) {
  try {
    const raw = BigInt(toFixed8(amount) || "0");
    return formatGas((raw * BigInt(bps)) / 10_000n);
  } catch {
    return "0";
  }
}

function estimateRepayment(amount: string, bps: number) {
  try {
    const raw = BigInt(toFixed8(amount) || "0");
    const fee = (raw * BigInt(bps)) / 10_000n;
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
  const serviceNotice = str("serviceNotice");
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
  const providerStats = val<ProviderStats>("providerStats", {
    currentBalance: 0,
    totalDeposited: 0,
    totalFeesEarned: 0,
  })!;

  const feeBps = contractStats.feeBasisPoints || FEE_BPS;
  const isMainnet = launchContext?.network === "mainnet";

  const [loanAmount, setLoanAmount] = useState("");
  const [callbackContract, setCallbackContract] = useState("");
  const [lookupId, setLookupId] = useState("");
  const [liquidityAmount, setLiquidityAmount] = useState("");
  const [depositReceiptId, setDepositReceiptId] = useState("");

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
  const feePreview = useMemo(() => estimateFee(loanAmount, feeBps), [loanAmount, feeBps]);
  const repaymentPreview = useMemo(
    () => estimateRepayment(loanAmount, feeBps),
    [loanAmount, feeBps],
  );
  const requestActionLabel = address ? t("signRequestFlashLoan") : t("connectAndSign");
  const cooldownMinutes = Math.round((contractStats.cooldownMs || 0) / 60000);
  const canDeposit =
    liquidityAmount.trim() !== "" && (!isMainnet || depositReceiptId.trim() !== "");
  const canWithdraw = liquidityAmount.trim() !== "";

  const handleConnect = async () => {
    await dispatch("connectWallet");
  };

  const handleRequestLoan = async () => {
    if (!canRequest) {
      setStatus(t("flashloanFormIncomplete"), "error");
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

  const handleDeposit = async () => {
    if (!canDeposit) return;
    await dispatch("provideLiquidity", {
      amount: liquidityAmount.trim(),
      receiptId: isMainnet ? depositReceiptId.trim() : undefined,
    });
    setLiquidityAmount("");
    setDepositReceiptId("");
  };

  const handleWithdraw = async () => {
    if (!canWithdraw) return;
    await dispatch("withdrawLiquidity", { amount: liquidityAmount.trim() });
    setLiquidityAmount("");
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
            <p className="flashloan-hero__eyebrow">{t("eyebrow")}</p>
            <h2 className="flashloan-hero__title">{t("title")}</h2>
            <p className="flashloan-hero__subtitle">{t("flashloanInfo")}</p>
          </div>
          <div className={`flashloan-wallet ${address ? "flashloan-wallet--connected" : ""}`}>
            <span className="flashloan-wallet__label">
              {address ? t("walletConnected") : t("walletRequired")}
            </span>
            <span className="flashloan-wallet__value">
              {address || t("walletNotConnected")}
            </span>
          </div>
        </div>
        {serviceNotice && (
          <div className="flashloan-service-notice" role="status">
            <span className="flashloan-service-notice__title">{t("statsStaleTitle")}</span>
            <span>{serviceNotice}</span>
          </div>
        )}
        <div className="flashloan-hero__stats">
          <div className="flashloan-stat">
            <span className="flashloan-stat__value">{poolBalance.toFixed(4)}</span>
            <span className="flashloan-stat__label">{t("poolBalance")}</span>
          </div>
          <div className="flashloan-stat">
            <span className="flashloan-stat__value">{totalLoans}</span>
            <span className="flashloan-stat__label">{t("totalLoans")}</span>
          </div>
          <div className="flashloan-stat">
            <span className="flashloan-stat__value">{totalVolume.toFixed(2)}</span>
            <span className="flashloan-stat__label">{t("totalVolume")}</span>
          </div>
          <div className="flashloan-stat">
            <span className="flashloan-stat__value">{totalFees.toFixed(4)}</span>
            <span className="flashloan-stat__label">{t("totalFees")}</span>
          </div>
        </div>
      </NeoCard>

      <div className="flashloan-workspace">
        <NeoCard variant="erobo" className="flashloan-request-card">
          <div className="flashloan-card-head">
            <div className="flashloan-card-heading">
              <p className="flashloan-card-eyebrow">{t("requestLoanEyebrow")}</p>
              <h3 className="flashloan-section-title">{t("requestLoanTitle")}</h3>
            </div>
            <span className="flashloan-method-pill">requestLoan</span>
          </div>
          <div className="flashloan-loan-form">
            <NeoInput
              type="number"
              value={loanAmount}
              placeholder={t("amountPlaceholder")}
              label={t("loanAmount")}
              min={0}
              onChange={setLoanAmount}
            />
            <div className="flashloan-presets" aria-label={t("amountPresets")}>
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
              placeholder={t("callbackContractPlaceholder")}
              label={t("callbackContract")}
              onChange={setCallbackContract}
            />
            <div className="flashloan-fixed-callback">
              <span>{t("callbackMethod")}</span>
              <strong>{CALLBACK_METHOD}</strong>
            </div>
            <p className="flashloan-callback-note">
              {t("callbackPrerequisite")}{" "}
              <a
                className="flashloan-callback-link"
                href="https://docs.neo.org/docs/n3/develop/write/basics"
                target="_blank"
                rel="noreferrer noopener"
              >
                {t("viewCallbackExample")}
              </a>
            </p>
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
                  {t("connectWallet")}
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
              <p className="flashloan-card-eyebrow">{t("loanCalculatorEyebrow")}</p>
              <h3 className="flashloan-section-title">{t("loanCalculator")}</h3>
            </div>
            <span className="flashloan-method-pill flashloan-method-pill--rate">{feeBps / 100}%</span>
          </div>
          <div className="flashloan-preview-grid">
            <div className="flashloan-preview-item">
              <span>{t("minLoan")}</span>
              <strong>{contractStats.minLoan.toLocaleString()} GAS</strong>
            </div>
            <div className="flashloan-preview-item">
              <span>{t("maxLoan")}</span>
              <strong>{contractStats.maxLoan.toLocaleString()} GAS</strong>
            </div>
            <div className="flashloan-preview-item">
              <span>{t("cooldownLabel")}</span>
              <strong>{t("cooldownValue", { minutes: cooldownMinutes })}</strong>
            </div>
            <div className="flashloan-preview-item">
              <span>{t("dailyLimitLabel")}</span>
              <strong>{t("dailyLimitValue", { count: contractStats.maxDailyLoans })}</strong>
            </div>
            <div className="flashloan-preview-item">
              <span>{t("estimatedFee")}</span>
              <strong>{feePreview} GAS</strong>
            </div>
            <div className="flashloan-preview-item flashloan-preview-item--total">
              <span>{t("totalRepayment")}</span>
              <strong>{repaymentPreview} GAS</strong>
            </div>
          </div>
          <div className="flashloan-flow">
            <span>{t("borrow")}</span>
            <span className="flashloan-flow-arrow" aria-hidden="true">→</span>
            <span>{t("execute")}</span>
            <span className="flashloan-flow-arrow" aria-hidden="true">→</span>
            <span>{t("repay")}</span>
          </div>
          <div className="flashloan-request-summary" aria-live="polite">
            {lastRequest ? (
              <>
                <div>
                  <span>{t("latestTx")}</span>
                  <strong title={lastRequest.txid}>{compactTxid(lastRequest.txid)}</strong>
                </div>
                <div>
                  <span>{t("borrower")}</span>
                  <strong>{lastRequest.borrower}</strong>
                </div>
                <div>
                  <span>{t("amount")}</span>
                  <strong>{lastRequest.amount} GAS</strong>
                </div>
              </>
            ) : (
              <p>{t("noRequestYet")}</p>
            )}
          </div>
        </NeoCard>
      </div>

      <NeoCard variant="erobo" className="flashloan-liquidity-card">
        <div className="flashloan-card-head">
          <div className="flashloan-card-heading">
            <p className="flashloan-card-eyebrow">{t("liquidityEyebrow")}</p>
            <h3 className="flashloan-section-title">{t("liquidityTitle")}</h3>
          </div>
          <span className="flashloan-method-pill">deposit / withdraw</span>
        </div>
        <p className="flashloan-liquidity-info">{t("liquidityInfo")}</p>
        <div className="flashloan-liquidity-stats">
          <div className="flashloan-preview-item">
            <span>{t("yourLiquidity")}</span>
            <strong>{providerStats.currentBalance.toFixed(4)} GAS</strong>
          </div>
          <div className="flashloan-preview-item">
            <span>{t("feesEarned")}</span>
            <strong>{providerStats.totalFeesEarned.toFixed(4)} GAS</strong>
          </div>
        </div>
        <div className="flashloan-liquidity-form">
          <NeoInput
            type="number"
            value={liquidityAmount}
            placeholder={t("liquidityAmountPlaceholder")}
            label={t("liquidityAmount")}
            min={0}
            onChange={setLiquidityAmount}
          />
          {isMainnet && (
            <NeoInput
              value={depositReceiptId}
              placeholder={t("receiptIdPlaceholder")}
              label={t("receiptIdLabel")}
              onChange={setDepositReceiptId}
            />
          )}
          <div className="flashloan-liquidity-actions">
            <NeoButton
              variant="primary"
              size="md"
              loading={isLoading}
              disabled={isLoading || !canDeposit}
              onClick={handleDeposit}
            >
              {t("deposit")}
            </NeoButton>
            <NeoButton
              variant="secondary"
              size="md"
              loading={isLoading}
              disabled={isLoading || !canWithdraw}
              onClick={handleWithdraw}
            >
              {t("withdraw")}
            </NeoButton>
          </div>
        </div>
      </NeoCard>

      <div className="flashloan-workspace flashloan-workspace--secondary">
        <NeoCard variant="erobo" className="flashloan-lookup-card">
          <div className="flashloan-card-head">
            <div className="flashloan-card-heading">
              <p className="flashloan-card-eyebrow">{t("statusLookupEyebrow")}</p>
              <h3 className="flashloan-section-title">{t("statusLookup")}</h3>
            </div>
            <span className="flashloan-method-pill">getLoanDetails</span>
          </div>
          <div className="flashloan-lookup-row">
            <NeoInput
              value={lookupId}
              placeholder={t("loanIdPlaceholder")}
              label={t("loanId")}
              onChange={setLookupId}
            />
            <NeoButton variant="secondary" size="md" disabled={!lookupId.trim() || isLoading} onClick={handleLookup}>
              {t("checkStatus")}
            </NeoButton>
          </div>
          {loanDetails && (
            <div className="flashloan-loan-details">
              <div className="flashloan-loan-row">
                <span className="flashloan-cell-pool">#{loanDetails.id}</span>
                <span className="flashloan-cell-amount">{loanDetails.amount} GAS</span>
                <span className="flashloan-cell-fee">+{loanDetails.fee} GAS</span>
                <span className={`flashloan-cell-status ${loanStatusClass(loanDetails.status)}`}>
                  {t(`status${loanDetails.status[0]?.toUpperCase()}${loanDetails.status.slice(1)}`)}
                </span>
              </div>
              <p className="flashloan-loan-callback">
                <strong>{t("callbackContract")}:</strong> {loanDetails.callbackContract} {"→"} {loanDetails.callbackMethod}
              </p>
            </div>
          )}
        </NeoCard>

        <NeoCard variant="erobo" className="flashloan-recent-card">
          <div className="flashloan-card-heading flashloan-card-heading--solo">
            <p className="flashloan-card-eyebrow">{t("recentLoansEyebrow")}</p>
            <h3 className="flashloan-section-title">{t("recentLoans")}</h3>
          </div>
          {recentLoans.length > 0 ? (
            <div className="flashloan-table">
              <div className="flashloan-table-header">
                <span>{t("loanId")}</span>
                <span>{t("amount")}</span>
                <span>{t("feeShort")}</span>
                <span>{t("statusLabel")}</span>
              </div>
              {recentLoans.map((loan) => (
                <div key={loan.id} className="flashloan-table-row">
                  <span className="flashloan-cell-pool">#{loan.id}</span>
                  <span className="flashloan-cell-amount">{loan.amount.toFixed(4)} GAS</span>
                  <span className="flashloan-cell-fee">{loan.fee.toFixed(4)} GAS</span>
                  <span className={`flashloan-cell-status ${loanStatusClass(loan.status)}`}>
                    {t(`status${loan.status[0]?.toUpperCase()}${loan.status.slice(1)}`)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="flashloan-empty">{t("noHistory")}</p>
          )}
        </NeoCard>
      </div>
    </div>
  );
}
