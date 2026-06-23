import { NeoButton } from "@shared/components-react";
import { Fuel, Minus, Plus } from "lucide-react";
import "./BuyKeysCard.scss";

interface BuyKeysCardProps {
  keyCount: string;
  estimatedCost: string;
  isPaying: boolean;
  disabled?: boolean;
  validationError: string | null;
  helperText?: string;
  submitLabel?: string;
  t: (key: string, params?: Record<string, string | number>) => string;
  onKeyCountChange: (value: string) => void;
  onBuy: () => void;
}

export default function BuyKeysCard({
  keyCount,
  estimatedCost,
  isPaying,
  disabled = false,
  validationError,
  helperText,
  submitLabel,
  t,
  onKeyCountChange,
  onBuy,
}: BuyKeysCardProps) {
  const adjustKeys = (delta: number) => {
    const current = Math.max(1, Number(keyCount) || 1);
    onKeyCountChange(String(Math.max(1, current + delta)));
  };

  return (
    <>
      <span className="card-title-glass">{t("buyKeys")}</span>
      <div className="key-selector">
        <button className="key-adjust-btn minus" type="button" onClick={() => adjustKeys(-1)} disabled={Number(keyCount) <= 1} aria-label="Decrease">
          <Minus className="adjust-icon" size={18} aria-hidden="true" />
        </button>
        <div className="key-display">
          <span className="key-count-value">{keyCount}</span>
          <span className="key-count-unit">{t("keysSuffix")}</span>
        </div>
        <button className="key-adjust-btn plus" type="button" onClick={() => adjustKeys(1)} aria-label="Increase">
          <Plus className="adjust-icon" size={18} aria-hidden="true" />
        </button>
      </div>
      <div className="key-presets">
        {[1, 3, 5, 10].map((n) => (
          <button key={n} className={`preset-chip${keyCount === String(n) ? " active" : ""}`} type="button" onClick={() => onKeyCountChange(String(n))}>
            {n}
          </button>
        ))}
      </div>
      <div className="cost-row-glass">
        <span className="cost-label-glass">{t("estimatedCost")}</span>
        <span className="cost-value-glass">
          <Fuel className="cost-gas-icon" size={17} aria-hidden="true" />
          {estimatedCost} {t("tokenGas")}
        </span>
      </div>
      <span className="hint-text-glass">{helperText ?? t("keyPrice")}</span>
      {validationError && (
        <span className="buy-keys-error" role="alert">
          {validationError}
        </span>
      )}
      <NeoButton
        variant="primary"
        size="lg"
        block
        loading={isPaying}
        disabled={disabled}
        aria-label={isPaying ? t("buying") : (submitLabel ?? t("buyKeys"))}
        onClick={onBuy}
      >
        {isPaying ? t("buying") : (submitLabel ?? t("buyKeys"))}
      </NeoButton>
      <span className="buy-keys-risk-note">{t("nonRefundableNote")}</span>
    </>
  );
}
