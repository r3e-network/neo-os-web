import { NeoCard, NeoButton } from "@shared/components-react";
import { BET_PRESETS } from "../composables/useCoinFlip";
import "./WagerControls.scss";

interface WagerControlsProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  choice: "heads" | "tails";
  betAmount: string;
  canBet: boolean;
  isFlipping: boolean;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
}

export default function WagerControls({ t, choice, betAmount, canBet, isFlipping, dispatch }: WagerControlsProps) {
  const handleFlip = async () => { await dispatch("placeBet"); };
  const updateChoice = (side: "heads" | "tails") => { dispatch("setChoice", side); };
  const updateBetAmount = (amount: string) => { dispatch("setBetAmount", amount); };

  return (
    <div className="bet-section">
      <div className="choice-grid">
        {(["heads", "tails"] as const).map((side) => (
          <div key={side} className={`choice-card ${choice === side ? side : "inactive"}`} onClick={() => updateChoice(side)}>
            <div className="card-inner">
              <div className="symbol-ring">{side === "heads" ? <div className="neo-symbol">N</div> : <div className="gas-symbol">G</div>}</div>
              <span className="choice-name">{t(side)}</span>
            </div>
          </div>
        ))}
      </div>
      <NeoCard variant="erobo" className="wager-panel">
        <div className="panel-header">
          <span className="label">{t("wager")}</span>
          <div className="balance-pill"><span className="val">{t("wagerRange")}</span><span className="unit">{t("tokenGas")}</span></div>
        </div>
        <div className="wager-grid">
          {BET_PRESETS.map((amount) => (
            <div key={amount} className={`wager-option${betAmount === amount ? " selected" : ""}`} onClick={() => updateBetAmount(amount)}>
              <span className="amount-val">{amount}</span><span className="amount-unit">{t("tokenGas")}</span>
            </div>
          ))}
        </div>
        <NeoButton variant="primary" size="lg" block disabled={!canBet} loading={isFlipping} className="flip-btn" aria-label={isFlipping ? t("flipping") : t("flipCoin")} onClick={handleFlip}>
          <div className="btn-content"><span>{isFlipping ? t("flipping") : t("flipCoin")}</span></div>
        </NeoButton>
      </NeoCard>
    </div>
  );
}
