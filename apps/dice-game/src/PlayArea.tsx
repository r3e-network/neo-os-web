import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useStateBindings } from "@shared/react";
import type { PlayAreaProps } from "@shared/react";
import { formatHash } from "@shared/utils/format";
import "./PlayArea.scss";

const FACES = ["1", "2", "3", "4", "5", "6"];
const STAKE_PRESETS = ["0.10", "0.50", "1.00", "5.00"];
const MIN_STAKE = 0.05;
const MAX_STAKE = 20;
const PAYOUT_MULTIPLIER = 5.7;
const HOUSE_FEE_PERCENT = 5;

type RollHistoryItem = {
  face: string;
  stake: string;
  result: string;
  payout: string;
  txid?: string;
  at?: string;
};

function amountFromStake(stake: string): string {
  return stake.replace(/\s*GAS$/i, "").trim() || "0.10";
}

function normalizeAmount(value: string): string {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return value.trim();
  return numeric.toFixed(8).replace(/\.?0+$/, "");
}

function isValidStake(value: string): boolean {
  const raw = value.trim();
  if (!/^\d+(\.\d{1,8})?$/.test(raw)) return false;
  const numeric = Number(raw);
  return Number.isFinite(numeric) && numeric >= MIN_STAKE && numeric <= MAX_STAKE;
}

function payoutFor(value: string, fallback: string): string {
  if (!isValidStake(value)) return fallback;
  return `${(Number(value) * PAYOUT_MULTIPLIER).toFixed(2)} GAS`;
}

export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { str, bool, val } = useStateBindings(state);
  const selectedFace = str("selectedFace", "6");
  const stakeAmount = str("stakeAmount", "0.10 GAS");
  const payoutPreview = str("payoutPreview", "0.57 GAS");
  const lastTxid = str("lastTxid");
  const lastStatus = str("lastStatus", t("statusReady"));
  const isSubmitting = bool("isSubmitting", false);
  const rollHistory = val<RollHistoryItem[]>("rollHistory", []) ?? [];
  const [faceInput, setFaceInput] = useState(selectedFace);
  const [amountInput, setAmountInput] = useState(amountFromStake(stakeAmount));
  const [formError, setFormError] = useState("");
  const stakeIsValid = useMemo(() => isValidStake(amountInput), [amountInput]);
  const activePayout = payoutFor(amountInput, payoutPreview);
  const normalizedAmount = useMemo(() => normalizeAmount(amountInput), [amountInput]);
  const numericStake = Number(normalizedAmount);
  const netPayout =
    stakeIsValid && Number.isFinite(numericStake)
      ? `${(numericStake * PAYOUT_MULTIPLIER - numericStake).toFixed(2)} GAS`
      : "0 GAS";

  useEffect(() => {
    setFaceInput(selectedFace);
  }, [selectedFace]);

  useEffect(() => {
    setAmountInput(amountFromStake(stakeAmount));
  }, [stakeAmount]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!stakeIsValid) {
      setFormError(t("invalidStake"));
      return;
    }
    setFormError("");
    try {
      await dispatch("placeDiceBet", {
        chosenNumber: faceInput,
        amount: normalizedAmount,
      });
    } catch (error) {
      setFormError(error instanceof Error ? error.message : t("statusFailed"));
    }
  };

  return (
    <section className="dice-playarea" aria-label={t("rollDice")}>
      <div className="dice-shell">
        <div className="dice-stage" aria-live="polite">
          <div className="dice-stage__visual">
            <div className="dice-cube">
              <span>{faceInput}</span>
            </div>
            <div className="dice-stage__caption">
              <span>{t("diceWalletLabel")}</span>
              <strong>{stakeIsValid ? `${normalizedAmount} GAS` : stakeAmount}</strong>
            </div>
          </div>

          <div className="dice-stage__details">
            <p className="dice-eyebrow">{t("diceHeroTitle")}</p>
            <h2>{isSubmitting ? t("pendingTitle") : t("readyTitle")}</h2>
            <p>{isSubmitting ? t("pendingBody") : t("diceHeroSubtitle")}</p>
            <div className="dice-metric-grid">
              <span>
                {t("oddsLabel")}
                <strong>1 / 6</strong>
              </span>
              <span>
                {t("feeLabel")}
                <strong>5%</strong>
              </span>
              <span>
                {t("rangeLabel")}
                <strong>0.05-20 GAS</strong>
              </span>
            </div>
            <div className="dice-rule-strip" aria-label={t("diceRoundSummary")}>
              <span>{t("diceRuleCommit")}</span>
              <span>{t("diceRuleCallback")}</span>
              <span>{t("diceRuleRefund")}</span>
            </div>
          </div>
        </div>

        <div className="dice-bet-panel">
          <div className="dice-panel-heading">
            <span>{t("diceStakeDeskTitle")}</span>
            <strong>{t("rollAction")}</strong>
          </div>

          <form className="dice-bet-form" onSubmit={handleSubmit}>
            <div className="dice-bet-summary" aria-label={t("diceBetSummary")}>
              <span>
                {t("selectedFace")}
                <strong>{faceInput}</strong>
              </span>
              <span>
                {t("stakeAmount")}
                <strong>{stakeIsValid ? `${normalizedAmount} GAS` : "--"}</strong>
              </span>
              <span>
                {t("payoutPreview")}
                <strong>{activePayout}</strong>
              </span>
              <span>
                {t("netWinLabel")}
                <strong>{netPayout}</strong>
              </span>
            </div>

            <div className="dice-face-grid" aria-label={t("selectedFace")}>
              {FACES.map((face) => (
                <button
                  key={face}
                  type="button"
                  aria-pressed={face === faceInput}
                  className={`dice-face-grid__item${face === faceInput ? " dice-face-grid__item--active" : ""}`}
                  disabled={isSubmitting}
                  onClick={() => setFaceInput(face)}
                >
                  {face}
                </button>
              ))}
            </div>

            <label className="dice-stake-field">
              <span>{t("stakeAmount")}</span>
              <input
                type="number"
                inputMode="decimal"
                min={MIN_STAKE}
                max={MAX_STAKE}
                step="0.01"
                value={amountInput}
                aria-label={t("stakeAmount")}
                aria-invalid={!stakeIsValid}
                disabled={isSubmitting}
                onChange={(event) => setAmountInput(event.currentTarget.value)}
              />
              <em>
                {stakeIsValid
                  ? `${t("stakeHelp")} ${activePayout}`
                  : t("invalidStake")}
              </em>
            </label>

            <div className="dice-stake-presets" aria-label={t("stakePresets")}>
              {STAKE_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setAmountInput(preset)}
                >
                  {preset} GAS
                </button>
              ))}
            </div>

            <button
              type="submit"
              className="dice-roll-button"
              disabled={isSubmitting || !stakeIsValid}
            >
              {isSubmitting ? t("statusSubmitting") : t("rollAction")}
            </button>
          </form>

          <div className={`dice-status-bar${formError ? " dice-status-bar--error" : ""}`} aria-live="polite">
            <span>{formError || lastStatus}</span>
            <strong>
              {t("dicePayoutLabel")}: {activePayout}
            </strong>
            {lastTxid && (
              <code>
                {t("lastTx")}: {formatHash(lastTxid, 10, 8)}
              </code>
            )}
          </div>
        </div>

        <details className="dice-route-panel">
          <summary className="dice-panel-heading">
            <span>{t("diceVrfRouteTitle")}</span>
            <strong>{t("safetyModel")}</strong>
          </summary>
          <div className="dice-route-body">
            <p>{t("diceVrfRouteCopy")}</p>
            <div className="dice-route-steps" aria-label={t("howItWorks")}>
              <span>
                <strong>1</strong>
                {t("diceCommitStep")}
              </span>
              <span>
                <strong>2</strong>
                {t("diceOracleStep")}
              </span>
              <span>
                <strong>3</strong>
                {t("diceSettleStep")}
              </span>
            </div>
            <div className="dice-risk-note">
              <span>{t("diceRiskTitle")}</span>
              <strong>{HOUSE_FEE_PERCENT}%</strong>
              <p>{t("diceRiskCopy")}</p>
            </div>
          </div>
        </details>

        <div className="dice-history-panel">
          <div className="dice-panel-heading">
            <span>{t("diceHistoryTitle")}</span>
            <strong>{t("dicePayoutLabel")}</strong>
          </div>
          <div className="dice-history-list">
            {rollHistory.length === 0 ? (
              <p>{t("diceHistoryEmpty")}</p>
            ) : (
              rollHistory.map((item) => (
                <div className="dice-history-row" key={`${item.txid || item.at || item.face}-${item.result}`}>
                  <span>{item.face}</span>
                  <strong>{item.result}</strong>
                  <em>{item.payout}</em>
                  {item.txid && <code>{formatHash(item.txid, 10, 8)}</code>}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
