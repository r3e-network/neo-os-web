import { NeoButton } from "@shared/components-react";
import "./BuyKeysCard.scss";

interface BuyKeysCardProps {
  keyCount: string;
  estimatedCost: string;
  isPaying: boolean;
  validationError: string | null;
  t: (key: string, params?: Record<string, string | number>) => string;
  onKeyCountChange: (value: string) => void;
  onBuy: () => void;
}

export default function BuyKeysCard({ keyCount, estimatedCost, isPaying, t, onKeyCountChange, onBuy }: BuyKeysCardProps) {
  const adjustKeys = (delta: number) => {
    const current = Math.max(1, Number(keyCount) || 1);
    onKeyCountChange(String(Math.max(1, current + delta)));
  };

  return (
    <>
      <span className="card-title-glass">{t("buyKeys")}</span>
      <div className="key-selector">
        <button className="key-adjust-btn minus" type="button" onClick={() => adjustKeys(-1)} disabled={Number(keyCount) <= 1} aria-label="Decrease">
          <span className="adjust-icon">&minus;</span>
        </button>
        <div className="key-display">
          <span className="key-count-value">{keyCount}</span>
          <span className="key-count-unit">{t("keysSuffix")}</span>
        </div>
        <button className="key-adjust-btn plus" type="button" onClick={() => adjustKeys(1)} aria-label="Increase">
          <span className="adjust-icon">&plus;</span>
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
          <span className="cost-gas-icon" aria-hidden="true">&#x26FD;</span>
          {estimatedCost} {t("tokenGas")}
        </span>
      </div>
      <span className="hint-text-glass">{t("keyPrice")}</span>
      <NeoButton variant="primary" size="lg" block disabled={isPaying} aria-label={t("buyKeys")} onClick={onBuy}>
        {isPaying ? t("buying") : t("buyKeys")}
      </NeoButton>
    </>
  );
}
