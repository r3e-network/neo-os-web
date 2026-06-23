import { Check } from "lucide-react";
import { NeoCard, NeoButton, NeoInput } from "@shared/components-react";
import { BET_PRESETS } from "../composables/useCoinFlip";
import coinHeadsUrl from "../static/coin_heads.png";
import coinTailsUrl from "../static/coin_tails.png";
import "./WagerControls.scss";

interface WagerControlsProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  choice: "heads" | "tails";
  betAmount: string;
  canBet: boolean;
  isFlipping: boolean;
  validationError?: string;
  /** "house can pay up to X GAS" — empty until the bankroll is read. */
  maxPayable?: string;
  /** Numeric max payable bet (GAS) — presets above it are disabled. 0 = unknown. */
  maxPayableBet?: number;
  /** Recoverable prepaid bet credit (formatted GAS). */
  credit?: string;
  /** Whether the player has prepaid credit to recover. */
  hasCredit?: boolean;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
  onFlipStart?: () => void;
}

export default function WagerControls({
  t,
  choice,
  betAmount,
  canBet,
  isFlipping,
  validationError,
  maxPayable,
  maxPayableBet = 0,
  credit,
  hasCredit,
  dispatch,
  onFlipStart,
}: WagerControlsProps) {
  const handleFlip = async () => {
    if (!canBet || isFlipping) return;
    onFlipStart?.();
    await dispatch("placeBet");
  };
  const handleWithdraw = async () => {
    await dispatch("withdrawCredit");
  };
  const updateChoice = (side: "heads" | "tails") => {
    dispatch("setChoice", side);
  };
  const updateBetAmount = (amount: string) => {
    dispatch("setBetAmount", amount);
  };
  const sideArt: Record<"heads" | "tails", string> = {
    heads: coinHeadsUrl,
    tails: coinTailsUrl,
  };
  const numericBet = Number(betAmount);
  const formattedStake = betAmount || "0";
  const formattedPayout =
    Number.isFinite(numericBet) && numericBet > 0
      ? (numericBet * 2).toFixed(2)
      : "0.00";
  const selectedCoinArt = sideArt[choice];
  const betSectionClassName = [
    "bet-section",
    `bet-section--choice-${choice}`,
    canBet ? "bet-section--ready" : "bet-section--blocked",
    isFlipping ? "bet-section--flipping" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={betSectionClassName} aria-busy={isFlipping || undefined}>
      <NeoCard variant="erobo" className="wager-panel wager-panel--table">
        <div className="wager-table-rail">
          <div className="wager-table-rail__side">
            <span className="wager-table-rail__label">{t("youPicked")}</span>
            <span className="wager-table-rail__coin" aria-hidden="true">
              <img
                src={selectedCoinArt}
                alt=""
                loading="lazy"
                decoding="async"
                draggable={false}
              />
            </span>
            <strong className="wager-table-rail__value">{t(choice)}</strong>
          </div>

          <div
            className="wager-chip-stack"
            aria-label={`${t("wager")} ${formattedStake} ${t("tokenGas")}`}
          >
            <span className="wager-chip-stack__coins" aria-hidden="true">
              {[0, 1, 2].map((index) => (
                <img
                  key={index}
                  src={selectedCoinArt}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  draggable={false}
                />
              ))}
            </span>
            <span className="wager-chip-stack__copy">
              <strong>{formattedStake}</strong>
              <span>{t("tokenGas")}</span>
            </span>
            <span className="wager-chip-stack__payout">
              {t("payoutPreviewLabel")} {formattedPayout} {t("tokenGas")}
            </span>
          </div>
        </div>

        <div
          className="wager-runway"
          aria-label={`${t("youPicked")} ${t(choice)}. ${t("wager")} ${formattedStake} ${t("tokenGas")}.`}
        >
          <span className="wager-runway__line" aria-hidden="true" />
          <span
            className="wager-runway__coin wager-runway__coin--one"
            aria-hidden="true"
          >
            <img
              src={selectedCoinArt}
              alt=""
              loading="lazy"
              decoding="async"
              draggable={false}
            />
          </span>
          <span
            className="wager-runway__coin wager-runway__coin--two"
            aria-hidden="true"
          >
            <img
              src={selectedCoinArt}
              alt=""
              loading="lazy"
              decoding="async"
              draggable={false}
            />
          </span>
          <span className="wager-runway__label">
            <span>{t(choice)}</span>
            <strong>
              {formattedStake} {t("tokenGas")}
            </strong>
          </span>
        </div>

        <div className="wager-fog-field" aria-hidden="true">
          <span className="wager-fog-field__mist wager-fog-field__mist--one" />
          <span className="wager-fog-field__mist wager-fog-field__mist--two" />
          <span className="wager-fog-field__orbit" />
          <span className="wager-fog-field__coin wager-fog-field__coin--selected">
            <img
              src={selectedCoinArt}
              alt=""
              loading="lazy"
              decoding="async"
              draggable={false}
            />
          </span>
          <span className="wager-fog-field__coin wager-fog-field__coin--shadow">
            <img
              src={sideArt[choice === "heads" ? "tails" : "heads"]}
              alt=""
              loading="lazy"
              decoding="async"
              draggable={false}
            />
          </span>
          <span className="wager-fog-field__spark wager-fog-field__spark--one" />
          <span className="wager-fog-field__spark wager-fog-field__spark--two" />
          <span className="wager-fog-field__spark wager-fog-field__spark--three" />
        </div>

        <div className="panel-step panel-step--choice">
          <span className="step-label">{`${t("heads")} / ${t("tails")}`}</span>
          <div className="choice-grid">
            {(["heads", "tails"] as const).map((side) => (
              <button
                key={side}
                type="button"
                className={[
                  "choice-card",
                  `choice-card--${side}`,
                  choice === side ? `selected ${side}` : "inactive",
                ].join(" ")}
                onClick={() => updateChoice(side)}
                aria-pressed={choice === side}
              >
                <div className="card-inner">
                  <span
                    className={`symbol-ring symbol-ring--${side}`}
                    aria-hidden="true"
                  >
                    <img
                      src={sideArt[side]}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      draggable={false}
                    />
                  </span>
                  <span className="choice-name">{t(side)}</span>
                </div>
                <span className="choice-check" aria-hidden="true">
                  <Check size={13} strokeWidth={3} />
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="panel-step panel-step--stake">
          <div className="panel-header">
            <span className="label">{t("wager")}</span>
            <div className="balance-pill">
              <span className="val">{t("wagerRange")}</span>
              <span className="unit">{t("tokenGas")}</span>
            </div>
          </div>
          <div className="wager-grid">
            {BET_PRESETS.map((amount) => {
              // Grey out presets the house can't currently pay 2x (bankroll cap).
              const unpayable =
                maxPayableBet > 0 && Number(amount) > maxPayableBet;
              return (
                <button
                  key={amount}
                  type="button"
                  className={[
                    "wager-option",
                    betAmount === amount ? "selected" : "",
                    unpayable ? "unpayable" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => updateBetAmount(amount)}
                  aria-pressed={betAmount === amount}
                  aria-label={`${amount} ${t("tokenGas")}`}
                  disabled={unpayable}
                  title={
                    unpayable
                      ? t("maxPayableHint", { max: maxPayable ?? "" })
                      : undefined
                  }
                >
                  <span className="wager-option__chip" aria-hidden="true">
                    <img
                      src={selectedCoinArt}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      draggable={false}
                    />
                  </span>
                  <span className="wager-option__copy">
                    <span className="amount-val">{amount}</span>
                    <span className="amount-unit">{t("tokenGas")}</span>
                  </span>
                </button>
              );
            })}
          </div>
          <div className="custom-bet-inline custom-bet-inline--table">
            <span className="custom-bet-inline__coin" aria-hidden="true">
              <img
                src={selectedCoinArt}
                alt=""
                loading="lazy"
                decoding="async"
                draggable={false}
              />
            </span>
            <NeoInput
              type="text"
              label={t("customBet")}
              value={betAmount}
              placeholder="1"
              suffix={t("tokenGas")}
              inputMode="decimal"
              pattern="[0-9]*[.]?[0-9]*"
              error={validationError ?? undefined}
              onChange={updateBetAmount}
              aria-label={t("betAmount")}
            />
          </div>
          {maxPayable ? (
            <p className="wager-cap-hint">
              {t("maxPayableHint", { max: maxPayable })}
            </p>
          ) : null}
        </div>

        {hasCredit ? (
          <div className="credit-chip" role="status">
            <span className="credit-chip__label">{t("prepaidCredit")}</span>
            <span className="credit-chip__value">{credit}</span>
            <NeoButton
              variant="ghost"
              size="sm"
              className="credit-chip__withdraw"
              disabled={isFlipping}
              onClick={handleWithdraw}
            >
              {t("withdrawCredit")}
            </NeoButton>
          </div>
        ) : null}

        <NeoButton
          variant="primary"
          size="lg"
          block
          disabled={!canBet || isFlipping}
          loading={isFlipping}
          className="flip-btn"
          aria-label={isFlipping ? t("flipping") : t("flipCoin")}
          onClick={handleFlip}
        >
          <div className="btn-content">
            <span>{isFlipping ? t("flipping") : t("flipCoin")}</span>
          </div>
        </NeoButton>
      </NeoCard>
    </div>
  );
}
