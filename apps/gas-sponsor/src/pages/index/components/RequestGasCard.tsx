import type { CSSProperties } from "react";
import { AlertCircle, Fuel, Gauge } from "lucide-react";
import { NeoButton } from "@shared/components-react";

interface RequestGasCardProps {
  serviceAvailable: boolean;
  serviceNotice: string;
  isConnected: boolean;
  isEligible: boolean;
  remainingQuota: number;
  requestAmount: string;
  maxRequestAmount: string;
  isRequesting: boolean;
  quickAmounts: number[];
  onRequestAmountChange: (val: string) => void;
  onRequest: () => void;
  t: (key: string) => string;
}

export default function RequestGasCard({
  serviceAvailable,
  serviceNotice,
  isConnected,
  isEligible,
  remainingQuota,
  requestAmount,
  maxRequestAmount,
  isRequesting,
  quickAmounts,
  onRequestAmountChange,
  onRequest,
  t,
}: RequestGasCardProps) {
  const formatBalance = (val: string | number) =>
    parseFloat(String(val)).toFixed(4);
  const selectedAmount = Number.parseFloat(requestAmount || "0");
  const maxAmount = Number.parseFloat(maxRequestAmount || "0");
  const pumpFillPercent =
    Number.isFinite(selectedAmount) && Number.isFinite(maxAmount) && maxAmount > 0
      ? Math.max(0, Math.min(100, (selectedAmount / maxAmount) * 100))
      : 0;
  const requestState = isRequesting
    ? "requesting"
    : isConnected && isEligible && remainingQuota > 0
      ? "armed"
      : "idle";

  // When the sponsorship API is unconfigured or down, do not present a "balance
  // exceeds threshold" / enabled request that throws — state it honestly.
  if (!serviceAvailable) {
    return (
      <div className="not-eligible-msg">
        <AlertCircle size={22} aria-hidden="true" />
        <span className="warning-title">{t("sponsorServiceTitle")}</span>
        <span className="warning-desc">
          {serviceNotice || t("sponsorServiceUnavailable")}
        </span>
      </div>
    );
  }
  if (!isEligible) {
    return (
      <div className="not-eligible-msg">
        <Gauge size={22} aria-hidden="true" />
        <span className="warning-title">{t("notEligibleTitle")}</span>
        <span className="warning-desc">{t("balanceExceeds")}</span>
      </div>
    );
  }
  if (remainingQuota <= 0) {
    return (
      <div className="not-eligible-msg">
        <AlertCircle size={22} aria-hidden="true" />
        <span className="warning-title">{t("quotaExhausted")}</span>
        <span className="warning-desc">{t("tryTomorrow")}</span>
      </div>
    );
  }

  return (
    <div className={`request-form request-form--${requestState}`}>
      <div className="request-console">
        <div
          className="request-console__screen"
          style={
            { "--pump-fill": `${pumpFillPercent}%` } as CSSProperties &
              Record<"--pump-fill", string>
          }
        >
          <span className="pump-label">
            <Fuel size={15} aria-hidden="true" />
            {t("requestAmount")}
          </span>
          <div className="pump-amount-row">
            <span className="pump-amount">{requestAmount || "0.00"}</span>
            <span className="pump-unit">{t("tokenGas")}</span>
          </div>
          <div className="pump-meter" aria-hidden="true">
            <span className="pump-meter__track">
              <span className="pump-meter__fill" />
            </span>
            <span className="pump-meter__drop pump-meter__drop--one" />
            <span className="pump-meter__drop pump-meter__drop--two" />
            <span className="pump-meter__drop pump-meter__drop--three" />
          </div>
          <div className="pump-limits">
            <span className="limit-text">
              {t("maxRequest")}: {formatBalance(maxRequestAmount)}{" "}
              {t("tokenGas")}
            </span>
            <span className="limit-text">
              {t("remaining")}: {formatBalance(remainingQuota)} {t("tokenGas")}
            </span>
          </div>
        </div>
        <label className="custom-amount-field">
          <span>{t("customAmount")}</span>
          <input
            value={requestAmount}
            type="number"
            min={0}
            step="0.001"
            inputMode="decimal"
            aria-label={t("amountToRequest")}
            placeholder={t("amountToRequestPlaceholder")}
            onChange={(event) =>
              onRequestAmountChange(event.currentTarget.value)
            }
          />
          <em>{t("tokenGas")}</em>
        </label>
      </div>
      <div
        className="quick-amounts"
        role="group"
        aria-label={t("quickAmountLabel")}
      >
        {quickAmounts.map((amount) => (
          <button
            key={amount}
            type="button"
            className={`quick-btn ${Math.abs(amount - selectedAmount) < 0.00000001 ? "quick-btn--active" : ""}`}
            aria-pressed={Math.abs(amount - selectedAmount) < 0.00000001}
            aria-label={amount + " " + t("tokenGas")}
            onClick={() => onRequestAmountChange(amount.toString())}
          >
            <span>{amount}</span>
          </button>
        ))}
      </div>
      {!isConnected && <p className="request-guard">{t("connectToCheck")}</p>}
      {/* Gate the loud primary on a connected wallet so it never promises an
          action that can't complete pre-connection (matches sibling apps). */}
      <NeoButton
        variant="primary"
        size="lg"
        block
        loading={isRequesting}
        disabled={!isConnected || !isEligible || remainingQuota <= 0}
        aria-label={isConnected ? t("requestGas") : t("connectToRequest")}
        onClick={onRequest}
      >
        {isRequesting
          ? t("requesting")
          : isConnected
            ? t("requestGas")
            : t("connectToRequest")}
      </NeoButton>
    </div>
  );
}
