import { NeoButton } from "@shared/components-react";
import "./BetControls.scss";

interface BetControlsProps {
  choice: "heads" | "tails";
  betAmount: string;
  isFlipping: boolean;
  canBet: boolean;
  t: (key: string, params?: Record<string, string | number>) => string;
  onChoiceChange: (side: "heads" | "tails") => void;
  onBetAmountChange: (amount: string) => void;
  onFlip: () => void;
}

export default function BetControls({ choice, betAmount, isFlipping, canBet, t, onChoiceChange, onBetAmountChange, onFlip }: BetControlsProps) {
  return (
    <div className="premium-controls">
      <div className="choice-grid">
        {(["heads", "tails"] as const).map((side) => (
          <div key={side} className={`choice-card ${choice === side ? side : "inactive"}`} onClick={() => onChoiceChange(side)}>
            <div className="card-inner">
              <div className="symbol-ring">{side === "heads" ? <div className="neo-symbol">N</div> : <div className="gas-symbol">G</div>}</div>
              <span className="choice-name">{t(side)}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="wager-panel">
        <div className="panel-header"><span className="label">{t("wager")}</span></div>
        <div className="wager-grid">
          {["1", "5", "10", "50"].map((amount) => (
            <div key={amount} className={`wager-option${betAmount === amount ? " selected" : ""}`} onClick={() => onBetAmountChange(amount)}>
              <span className="amount-val">{amount}</span><span className="amount-unit">{t("tokenGas")}</span>
            </div>
          ))}
        </div>
        <div className="action-zone">
          <NeoButton variant="primary" size="lg" block disabled={isFlipping || !canBet} loading={isFlipping} onClick={onFlip} className="premium-flip-btn" aria-label={isFlipping ? t("flipping") : t("flipCoin")}>
            <div className="btn-content"><span>{isFlipping ? t("flipping") : t("flipCoin")}</span></div>
          </NeoButton>
        </div>
      </div>
    </div>
  );
}
