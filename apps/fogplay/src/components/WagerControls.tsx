import { NeoCard, NeoButton, NeoInput } from "@shared/components-react";
import { BET_PRESETS } from "../composables/useCoinFlip";
import "./WagerControls.scss";

interface WagerControlsProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  choice: "heads" | "tails";
  betAmount: string;
  canBet: boolean;
  isFlipping: boolean;
  validationError?: string;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
}

export default function WagerControls({ t, choice, betAmount, canBet, isFlipping, validationError, dispatch }: WagerControlsProps) {
  const handleFlip = async () => { await dispatch("placeBet"); };
  const updateChoice = (side: "heads" | "tails") => { dispatch("setChoice", side); };
  const updateBetAmount = (amount: string) => { dispatch("setBetAmount", amount); };

  return (
    <div className="bet-section">
      <NeoCard variant="erobo" className="wager-panel">
        <div className="panel-step">
          <span className="step-label">{`${t("heads")} / ${t("tails")}`}</span>
          <div className="choice-grid">
            {(["heads", "tails"] as const).map((side) => (
              <button
                key={side}
                type="button"
                className={`choice-card ${choice === side ? side : "inactive"}`}
                onClick={() => updateChoice(side)}
                aria-pressed={choice === side}
              >
                <div className="card-inner">
                  <div className="symbol-ring">{side === "heads" ? <div className="neo-symbol">N</div> : <div className="gas-symbol">G</div>}</div>
                  <span className="choice-name">{t(side)}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="panel-step">
          <div className="panel-header">
            <span className="label">{t("wager")}</span>
            <div className="balance-pill"><span className="val">{t("wagerRange")}</span><span className="unit">{t("tokenGas")}</span></div>
          </div>
          <div className="wager-grid">
            {BET_PRESETS.map((amount) => (
              <button
                key={amount}
                type="button"
                className={`wager-option${betAmount === amount ? " selected" : ""}`}
                onClick={() => updateBetAmount(amount)}
                aria-pressed={betAmount === amount}
              >
                <span className="amount-val">{amount}</span><span className="amount-unit">{t("tokenGas")}</span>
              </button>
            ))}
          </div>
          <div className="custom-bet-inline">
            <NeoInput
              type="number"
              label={t("customBet") || "Custom Bet Amount"}
              value={betAmount}
              placeholder="1"
              suffix={t("tokenGas") || "GAS"}
              min={0.05}
              max={100}
              error={validationError ?? undefined}
              onChange={updateBetAmount}
              aria-label={t("betAmount") || "Bet amount"}
            />
          </div>
        </div>

        <NeoButton variant="primary" size="lg" block disabled={!canBet} loading={isFlipping} className="flip-btn" aria-label={isFlipping ? t("flipping") : t("flipCoin")} onClick={handleFlip}>
          <div className="btn-content"><span>{isFlipping ? t("flipping") : t("flipCoin")}</span></div>
        </NeoButton>
      </NeoCard>
    </div>
  );
}
