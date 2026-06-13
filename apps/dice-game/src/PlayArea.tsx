import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useStateBindings } from "@shared/react";
import type { PlayAreaProps } from "@shared/react";
import { formatHash } from "@shared/utils/format";
import "./PlayArea.scss";

const FACES = ["1", "2", "3", "4", "5", "6"];
const STAKE_PRESETS = ["0.10", "0.50", "1.00", "5.00"];
const MIN_STAKE = 0.05;
const PAYOUT_MULTIPLIER = 5.7;
const HOUSE_FEE_PERCENT = 5;

type RollOutcome = "" | "pending" | "won" | "lost" | "refunded";

type RollHistoryItem = {
  id?: string;
  face: string;
  stake: string;
  result: string;
  payout: string;
  outcome?: RollOutcome;
  rolled?: string;
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

function isValidStake(value: string, maxStake: number): boolean {
  const raw = value.trim();
  if (!/^\d+(\.\d{1,8})?$/.test(raw)) return false;
  const numeric = Number(raw);
  return Number.isFinite(numeric) && numeric >= MIN_STAKE && numeric <= maxStake;
}

function payoutFor(value: string, fallback: string, maxStake: number): string {
  if (!isValidStake(value, maxStake)) return fallback;
  return `${(Number(value) * PAYOUT_MULTIPLIER).toFixed(2)} GAS`;
}

export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { str, bool, val } = useStateBindings(state);
  const selectedFace = str("selectedFace", "6");
  const stakeAmount = str("stakeAmount", "0.10 GAS");
  const payoutPreview = str("payoutPreview", "0.57 GAS");
  const lastTxid = str("lastTxid");
  const lastStatus = str("lastStatus", t("statusReady"));
  const isSubmitting = bool("isSubmitting");
  const rollHistory = val<RollHistoryItem[]>("rollHistory", []) ?? [];
  const chainLabel = str("chainLabel");
  const maxStake = val<number>("maxStake", 20) ?? 20;
  const houseLiquidity = val<number>("houseLiquidity", 0) ?? 0;
  const directCredit = val<number>("directCredit", 0) ?? 0;
  const maxPayableStake = val<number>("maxPayableStake", 0) ?? 0;
  const lastRoll = str("lastRoll");
  const lastOutcome = (str("lastOutcome") || "") as RollOutcome;
  const isResolving = bool("isResolving");
  const isUnresolved = bool("isUnresolved");
  // The N3 (non-EVM) path is the one whose VRF settlement waits on the Morpheus
  // oracle callback and can leave non-withdrawable roll credit; the EVM path is
  // atomic. The chain badge is set from the detected network.
  const isEvmChain = chainLabel.startsWith("Neo X");

  const [faceInput, setFaceInput] = useState(selectedFace);
  const [amountInput, setAmountInput] = useState(amountFromStake(stakeAmount));
  const [formError, setFormError] = useState("");
  // The effective cap is the smaller of the network stake cap and what the house
  // can currently pay a win on (maxPayableStake, read on Neo N3). When liquidity
  // is unknown (0, e.g. EVM or pre-load) the network cap stands alone.
  const effectiveMaxStake = useMemo(
    () => (maxPayableStake > 0 ? Math.min(maxStake, maxPayableStake) : maxStake),
    [maxStake, maxPayableStake],
  );
  const stakeIsValid = useMemo(
    () => isValidStake(amountInput, effectiveMaxStake),
    [amountInput, effectiveMaxStake],
  );
  const activePayout = payoutFor(amountInput, payoutPreview, effectiveMaxStake);
  const normalizedAmount = useMemo(() => normalizeAmount(amountInput), [amountInput]);
  const numericStake = Number(normalizedAmount);
  const netPayout =
    stakeIsValid && Number.isFinite(numericStake)
      ? `${(numericStake * PAYOUT_MULTIPLIER - numericStake).toFixed(2)} GAS`
      : "0 GAS";

  // The dice shows the settled roll once revealed, animates while rolling, and
  // otherwise previews the chosen face.
  const showResult = (lastOutcome === "won" || lastOutcome === "lost" || lastOutcome === "refunded") && Boolean(lastRoll);
  const cubeFace = isResolving ? "?" : showResult ? lastRoll : faceInput;
  const stageState = isResolving ? "rolling" : showResult ? lastOutcome : "idle";

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

  const outcomeLabel =
    lastOutcome === "won"
      ? t("outcomeWon")
      : lastOutcome === "lost"
        ? t("outcomeLost")
        : lastOutcome === "refunded"
          ? t("outcomeRefunded")
          : "";
  const outcomeBody =
    lastOutcome === "won"
      ? t("resultWonBody")
      : lastOutcome === "lost"
        ? t("resultLostBody")
        : lastOutcome === "refunded"
          ? t("resultRefundedBody")
          : "";

  return (
    <section className="dice-playarea" aria-label={t("rollDice")}>
      <div className="dice-shell">
        <div className="dice-stage" aria-live="polite" data-state={stageState}>
          <div className="dice-stage__visual">
            <div className={`dice-cube dice-cube--${stageState}`}>
              <span>{cubeFace}</span>
            </div>
            <div className="dice-stage__caption">
              <span className="dice-stage__caption-cell">
                {t("selectedFace")}
                <strong>{faceInput}</strong>
              </span>
              <span className="dice-stage__caption-cell dice-stage__caption-cell--end">
                {t("payoutPreview")}
                <strong>{activePayout}</strong>
              </span>
            </div>
          </div>

          <div className="dice-stage__details">
            <div className="dice-stage__eyebrow-row">
              <p className="dice-eyebrow">{t("diceHeroTitle")}</p>
              {chainLabel && (
                <span
                  className={`dice-chain-badge${chainLabel.startsWith("Neo X") ? " dice-chain-badge--evm" : ""}`}
                  title={`${t("networkLabel")}: ${chainLabel}`}
                >
                  <span className="dice-chain-badge__dot" aria-hidden="true" />
                  {chainLabel}
                </span>
              )}
            </div>
            <h2>
              {isResolving
                ? t("resolvingTitle")
                : isUnresolved
                  ? t("statusSettlementPending")
                  : showResult
                    ? outcomeLabel
                    : t("readyTitle")}
            </h2>
            <p>
              {isResolving
                ? t("resolvingBody")
                : isUnresolved
                  ? t("settlementPendingBody")
                  : showResult
                    ? outcomeBody
                    : t("diceHeroSubtitle")}
            </p>

            {(isResolving || isUnresolved || showResult) && (
              <div
                className={`dice-result dice-result--${isUnresolved ? "pending" : stageState}`}
                role="status"
              >
                {isResolving ? (
                  <>
                    <span className="dice-result__spinner" aria-hidden="true" />
                    <span className="dice-result__label">{t("statusRolling")}</span>
                  </>
                ) : isUnresolved ? (
                  <>
                    <span className="dice-result__label">{t("statusSettlementPending")}</span>
                    <button
                      type="button"
                      className="dice-recheck-button"
                      onClick={() => void dispatch("recheckSettlement", {})}
                    >
                      {t("checkAgain")}
                    </button>
                  </>
                ) : (
                  <>
                    <span className="dice-result__roll">
                      {t("rolledLabel")} <strong>{lastRoll}</strong>
                    </span>
                    <span className="dice-result__verdict">{outcomeLabel}</span>
                  </>
                )}
              </div>
            )}

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
                <strong>
                  {MIN_STAKE}-{maxStake} GAS
                </strong>
              </span>
              {houseLiquidity > 0 && (
                <span title={t("maxPayableLabel")}>
                  {t("houseLiquidityLabel")}
                  <strong>{houseLiquidity.toFixed(2)} GAS</strong>
                </span>
              )}
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
                max={effectiveMaxStake}
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
                  : `${t("invalidStake")} · ${t("maxStakeNote")} ${effectiveMaxStake} GAS`}
              </em>
            </label>

            <div className="dice-stake-presets" aria-label={t("stakePresets")}>
              {STAKE_PRESETS.map((preset) => {
                // Grey out presets above the network cap OR above what the house
                // can currently pay — pressing one would strand the GAS as credit.
                const unpayable = Number(preset) > effectiveMaxStake;
                return (
                  <button
                    key={preset}
                    type="button"
                    className={unpayable ? "dice-preset--unpayable" : undefined}
                    disabled={isSubmitting || unpayable}
                    title={
                      unpayable && maxPayableStake > 0
                        ? t("statusStakeOverLiquidity", {
                            max: maxPayableStake.toFixed(2),
                            tokenGas: t("tokenGas"),
                          })
                        : undefined
                    }
                    onClick={() => setAmountInput(preset)}
                  >
                    {preset} GAS
                  </button>
                );
              })}
            </div>

            <button
              type="submit"
              className="dice-roll-button"
              disabled={isSubmitting || !stakeIsValid}
            >
              {isSubmitting ? t("statusSubmitting") : t("rollAction")}
            </button>

            {!isEvmChain && <p className="dice-trust-line">{t("vrfTrustLine")}</p>}
          </form>

          {directCredit > 0 && (
            <div className="dice-credit-banner" role="status">
              {t("directCreditBanner", {
                amount: directCredit.toFixed(2),
                tokenGas: t("tokenGas"),
              })}
            </div>
          )}

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
                <div
                  className={`dice-history-row${item.outcome ? ` dice-history-row--${item.outcome}` : ""}`}
                  key={item.id ?? `${item.txid || item.at || item.face}-${item.result}`}
                >
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
