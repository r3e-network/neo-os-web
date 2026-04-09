import { NeoInput, NeoButton } from "@shared/components-react";

interface RequestGasCardProps {
  isEligible: boolean; remainingQuota: number; requestAmount: string; maxRequestAmount: string;
  isRequesting: boolean; quickAmounts: number[];
  onRequestAmountChange: (val: string) => void; onRequest: () => void; t: (key: string) => string;
}

export default function RequestGasCard({ isEligible, remainingQuota, requestAmount, maxRequestAmount, isRequesting, quickAmounts, onRequestAmountChange, onRequest, t }: RequestGasCardProps) {
  const formatBalance = (val: string | number) => parseFloat(String(val)).toFixed(4);

  if (!isEligible) {
    return <div className="not-eligible-msg"><span className="warning-title">{t("notEligibleTitle")}</span><span className="warning-desc">{t("balanceExceeds")}</span></div>;
  }
  if (remainingQuota <= 0) {
    return <div className="not-eligible-msg"><span className="warning-title">{t("quotaExhausted")}</span><span className="warning-desc">{t("tryTomorrow")}</span></div>;
  }

  return (
    <div className="request-form">
      <div className="fuel-pump-display">
        <div className="pump-screen">
          <span className="pump-label">{t("requestAmount")}</span>
          <span className="pump-amount">{requestAmount || "0.00"}</span>
          <span className="pump-unit">{t("tokenGas")}</span>
        </div>
        <div className="pump-limits">
          <span className="limit-text">{t("maxRequest")}: {formatBalance(maxRequestAmount)} {t("tokenGas")}</span>
          <span className="limit-text">{t("remaining")}: {formatBalance(remainingQuota)} {t("tokenGas")}</span>
        </div>
      </div>
      <NeoInput value={requestAmount} type="number" label={t("amountToRequest")} placeholder={t("amountToRequestPlaceholder")} onChange={onRequestAmountChange} />
      <div className="quick-amounts">
        {quickAmounts.map((amount) => (
          <button key={amount} type="button" className="quick-btn" aria-label={amount + " " + t("tokenGas")} onClick={() => onRequestAmountChange(amount.toString())}>
            <span>{amount}</span>
          </button>
        ))}
      </div>
      <NeoButton variant="primary" size="lg" block loading={isRequesting} disabled={!isEligible || remainingQuota <= 0} aria-label={t("requestGas")} onClick={onRequest}>
        {isRequesting ? t("requesting") : t("requestGas")}
      </NeoButton>
    </div>
  );
}
