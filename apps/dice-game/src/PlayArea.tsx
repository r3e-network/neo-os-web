import { useEffect, useMemo, useRef, useState } from "react";
import { useStateBindings } from "@shared/react";
import type { PlayAreaProps } from "@shared/react";
import { formatHash } from "@shared/utils/format";
import { ParticleBurst, CoinArt } from "@shared/art";
import {
  OpenUiProvider,
  OpenUiTextField,
  PlayStage,
} from "@shared/components-react/v2";
import { Dices } from "lucide-react";
import "./PlayArea.scss";

const FACES = ["1", "2", "3", "4", "5", "6"];
const STAKE_PRESETS = ["0.10", "0.50", "1.00", "5.00"];
const MIN_STAKE = 0.05;
const PAYOUT_MULTIPLIER = 5.7;
const CHIP_PRESETS = [
  { amount: "0.10", asset: "./art/chip-green.webp" },
  { amount: "0.50", asset: "./art/chip-blue.webp" },
  { amount: "1.00", asset: "./art/chip-red.webp" },
  { amount: "5.00", asset: "./art/chip-black.webp" },
] as const;

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

function diceFaceUrl(face: string | number): string {
  const safeFace = Math.min(6, Math.max(1, Number(face) || 6));
  return `./art/die-white-${safeFace}.webp`;
}

function chipAssetUrl(stake: string): string {
  return CHIP_PRESETS.find((chip) => normalizeAmount(chip.amount) === normalizeAmount(stake))?.asset
    ?? CHIP_PRESETS[0].asset;
}

function companionFace(face: number, offset: number): number {
  return ((face + offset - 1 + 6) % 6) + 1;
}

function normalizeAmount(value: string): string {
  const trimmed = value.trim();
  if (!/^\d+(\.\d{1,8})?$/.test(trimmed)) return trimmed;
  const [whole = "0", fraction = ""] = trimmed.split(".");
  const normalizedWhole = whole.replace(/^0+(?=\d)/, "") || "0";
  const normalizedFraction = fraction.replace(/0+$/, "");
  return normalizedFraction
    ? `${normalizedWhole}.${normalizedFraction}`
    : normalizedWhole;
}

function isValidStake(value: string, maxStake: number): boolean {
  const raw = value.trim();
  if (!/^\d+(\.\d{1,8})?$/.test(raw)) return false;
  const numeric = Number(raw);
  return Number.isFinite(numeric) && numeric >= MIN_STAKE && numeric <= maxStake;
}

export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { str, bool, val } = useStateBindings(state);
  const selectedFace = str("selectedFace", "6");
  const stakeAmount = str("stakeAmount", "0.10 GAS");
  const payoutPreview = str("payoutPreview", "0.57 GAS");
  const lastStatus = str("lastStatus", t("statusReady"));
  const isSubmitting = bool("isSubmitting");
  const rollHistory = val<RollHistoryItem[]>("rollHistory", []) ?? [];
  const chainLabel = str("chainLabel");
  const maxStake = val<number>("maxStake", 20) ?? 20;
  const maxPayableStake = val<number>("maxPayableStake", 0) ?? 0;
  const directCredit = val<number>("directCredit", 0) ?? 0;
  const lastRoll = str("lastRoll");
  const lastOutcome = (str("lastOutcome") || "") as RollOutcome;
  const isResolving = bool("isResolving");
  const isUnresolved = bool("isUnresolved");
  const isEvmChain = chainLabel.startsWith("Neo X");

  const [faceInput, setFaceInput] = useState(selectedFace);
  const [amountInput, setAmountInput] = useState(amountFromStake(stakeAmount));
  const [formError, setFormError] = useState("");
  const [throwPulse, setThrowPulse] = useState(0);
  const [fineStakeOpen, setFineStakeOpen] = useState(false);
  // Local "throw preview" gives immediate dice motion on submit, independent of
  // when the store's isSubmitting flips (the wallet prompt can take a moment).
  const [throwPreview, setThrowPreview] = useState(false);
  const throwPreviewTimeout = useRef<number | null>(null);

  const effectiveMaxStake = useMemo(
    () => (maxPayableStake > 0 ? Math.min(maxStake, maxPayableStake) : maxStake),
    [maxStake, maxPayableStake],
  );
  const stakeIsValid = useMemo(
    () => isValidStake(amountInput, effectiveMaxStake),
    [amountInput, effectiveMaxStake],
  );
  const normalizedAmount = useMemo(() => normalizeAmount(amountInput), [amountInput]);
  const numericStake = Number(normalizedAmount);
  const displayStake =
    stakeIsValid && Number.isFinite(numericStake)
      ? `${numericStake.toFixed(2)} GAS`
      : "--";
  const winPayout =
    stakeIsValid && Number.isFinite(numericStake)
      ? `${(numericStake * PAYOUT_MULTIPLIER).toFixed(2)} GAS`
      : payoutPreview;
  const selectedStakePreset = useMemo(
    () =>
      STAKE_PRESETS.find(
        (preset) =>
          normalizeAmount(preset) === normalizeAmount(amountInput) &&
          Number(preset) <= effectiveMaxStake,
      ) ?? "",
    [amountInput, effectiveMaxStake],
  );
  const selectedChipAsset = chipAssetUrl(selectedStakePreset || normalizedAmount);

  const controlsLocked = isSubmitting || isResolving || throwPreview;
  const showResult =
    (lastOutcome === "won" || lastOutcome === "lost" || lastOutcome === "refunded") &&
    Boolean(lastRoll);
  const isRolling = isResolving || isSubmitting || throwPreview;
  const visibleFace = (isRolling ? faceInput : showResult ? lastRoll : faceInput) || "6";
  const faceNum = Number(visibleFace) || 6;

  const statusText = isUnresolved
    ? t("statusSettlementPending")
    : isResolving
      ? t("statusRevealing")
      : isSubmitting
        ? t("statusSubmitting")
        : lastOutcome === "won"
          ? t("statusWon")
          : lastOutcome === "lost"
            ? t("statusLost")
            : lastOutcome === "refunded"
              ? t("statusRefunded")
              : lastStatus;

  useEffect(
    () => () => {
      if (throwPreviewTimeout.current !== null) {
        window.clearTimeout(throwPreviewTimeout.current);
      }
    },
    [],
  );
  useEffect(() => setFaceInput(selectedFace), [selectedFace]);
  useEffect(() => setAmountInput(amountFromStake(stakeAmount)), [stakeAmount]);

  const chooseFace = (face: string) => {
    setFaceInput(face);
  };
  const chooseStake = (stake: string) => {
    setAmountInput(stake);
    setFineStakeOpen(false);
  };
  const startThrow = () => {
    if (throwPreviewTimeout.current !== null) {
      window.clearTimeout(throwPreviewTimeout.current);
    }
    setThrowPreview(true);
    setThrowPulse((tick) => tick + 1);
    throwPreviewTimeout.current = window.setTimeout(() => {
      setThrowPreview(false);
      throwPreviewTimeout.current = null;
    }, 1100);
  };

  const handleSubmit = async () => {
    if (controlsLocked) return;
    if (!stakeIsValid) {
      setFormError(t("invalidStake"));
      return;
    }
    setFormError("");
    startThrow();
    try {
      await dispatch("placeDiceBet", {
        chosenNumber: faceInput,
        amount: normalizedAmount,
      });
    } catch (error) {
      setFormError(error instanceof Error ? error.message : t("statusFailed"));
    }
  };

  const stageTitle = isRolling
    ? t("throwingTitle")
    : showResult
      ? lastOutcome === "won"
        ? t("statusWon")
        : lastOutcome === "lost"
          ? t("statusLost")
          : t("statusRefunded")
      : t("readyTitle");

  const faceBettingRing = (
    <div className="dice-bet-spots" aria-label={t("pickYourFace")}>
      {FACES.map((face) => {
        const active = faceInput === face;
        return (
          <button
            key={face}
            type="button"
            className={[
              "mx2-btn mx2-btn--ghost dice-bet-spot",
              active ? "dice-bet-spot--active" : null,
            ]
              .filter(Boolean)
              .join(" ")}
            aria-pressed={active}
            aria-label={`${t("dieShowing", { face })} · ${t("rollDice")}`}
            aria-describedby="dice-betting-hint"
            onClick={() => chooseFace(face)}
            disabled={controlsLocked}
          >
            <img
              className="dice-bet-spot__die"
              src={diceFaceUrl(face)}
              alt=""
              draggable={false}
            />
            <span className="dice-bet-spot__label">{face}</span>
          </button>
        );
      })}
    </div>
  );

  const stakeTray = (
    <div className="dice-chip-tray" aria-label={t("stakeRackTitle")}>
      {CHIP_PRESETS.map((chip) => {
        const unpayable = Number(chip.amount) > effectiveMaxStake;
        const active =
          !unpayable && normalizeAmount(amountInput) === normalizeAmount(chip.amount);
        return (
          <button
            key={chip.amount}
            type="button"
            className={[
              "mx2-btn mx2-btn--ghost dice-chip-btn",
              active ? "dice-chip-btn--active" : null,
            ]
              .filter(Boolean)
              .join(" ")}
            aria-pressed={active}
            aria-label={`${chip.amount} ${t("tokenGas")}`}
            title={
              unpayable && maxPayableStake > 0
                ? t("statusStakeOverLiquidity", {
                    max: maxPayableStake.toFixed(2),
                    tokenGas: t("tokenGas"),
                  })
                : undefined
            }
            onClick={() => chooseStake(chip.amount)}
            disabled={controlsLocked || unpayable}
          >
            <img src={chip.asset} alt="" draggable={false} />
            <span>{chip.amount}</span>
          </button>
        );
      })}
      <button
        type="button"
        className="mx2-btn mx2-btn--ghost dice-chip-btn dice-chip-btn--custom"
        aria-expanded={fineStakeOpen}
        onClick={() => setFineStakeOpen((open) => !open)}
        disabled={controlsLocked}
      >
        <span>{t("customStakeHint")}</span>
      </button>
    </div>
  );

  const sceneInteraction = (
    <div className="dice-controls" data-custom-open={fineStakeOpen ? "true" : "false"}>
      {stakeTray}
      {fineStakeOpen && (
        <div className="dice-controls__fine">
          <OpenUiTextField
            className="dice-controls__fine-field"
            inputClassName="dice-controls__fine-input"
            label={t("customStakeTitle")}
            type="text"
            inputMode="decimal"
            value={amountInput}
            onChange={(e) => setAmountInput(e.target.value)}
            disabled={controlsLocked}
            aria-invalid={!stakeIsValid}
            aria-required="true"
            aria-describedby={formError ? "dice-stake-error" : undefined}
            placeholder="0.10"
          />
          <span className="dice-controls__fine-unit">GAS</span>
        </div>
      )}
      {formError && (
        <p id="dice-stake-error" className="dice-controls__error" role="alert">
          {formError}
        </p>
      )}
    </div>
  );

  const scene = (
    <div
      className="dice-scene"
      data-state={isRolling ? "rolling" : showResult ? lastOutcome : "idle"}
    >
      {/* Visually-hidden descriptions for screen readers */}
      <span id="dice-betting-hint" className="dice-sr-only">
        {t("pickYourFace")}
      </span>
      <span id="dice-roll-hint" className="dice-sr-only">
        {t("rollDice")}
      </span>
      <div className="dice-scene__felt" aria-hidden="true">
        <span className="dice-scene__felt-track" />
      </div>
      <div className="dice-scene__table-rim" aria-hidden="true" />
      <div className="dice-scene__hud" aria-hidden="true">
        <div className="dice-scene__hud-card dice-scene__hud-card--face">
          <span>{t("youPicked")}</span>
          <strong>{faceInput}</strong>
        </div>
        <div className="dice-scene__hud-card">
          <span>{t("payoutPreview")}</span>
          <strong>{winPayout}</strong>
        </div>
      </div>
      <div className="dice-scene__throw-path" aria-hidden="true">
        <span className="dice-scene__trail dice-scene__trail--one" />
        <span className="dice-scene__trail dice-scene__trail--two" />
        <span className="dice-scene__trail dice-scene__trail--three" />
      </div>
      <div className="dice-scene__landing-ring" aria-hidden="true" />
      <div className="dice-scene__table-mat" aria-hidden="true" />
      <div className="dice-scene__dealer-rail" aria-hidden="true">
        <span className="dice-scene__rail-line" />
        <span className="dice-scene__rail-mark">5.70x</span>
        <span className="dice-scene__rail-line" />
      </div>
      <div className="dice-scene__play-table">
        {faceBettingRing}
        <div className="dice-scene__live-zone">
          <img
            className="dice-scene__side-die dice-scene__side-die--left"
            src={diceFaceUrl(companionFace(faceNum, -1))}
            alt=""
            draggable={false}
          />
          <button
            type="button"
            key={`${visibleFace}-${throwPulse}-${isRolling}-${showResult}`}
            className={[
              "mx2-btn dice-scene__die-anchor",
              isRolling ? "mx2-roll" : null,
              showResult ? "mx2-land" : null,
            ]
              .filter(Boolean)
              .join(" ")}
            onClick={() => void handleSubmit()}
            disabled={controlsLocked || !stakeIsValid}
            aria-label={`${t("rollDice")} - ${t("selectedFace")} ${faceInput}`}
            aria-describedby="dice-roll-hint"
          >
            <img
              className="dice-scene__die"
              src={diceFaceUrl(faceNum)}
              alt={t("dieShowing", { face: faceNum })}
              draggable={false}
            />
          </button>
          <img
            className="dice-scene__side-die dice-scene__side-die--right"
            src={diceFaceUrl(companionFace(faceNum, 1))}
            alt=""
            draggable={false}
          />
        </div>
      </div>
      {lastOutcome === "won" && <ParticleBurst coins count={10} />}
      <div className="dice-scene__stake-chip" aria-hidden="true">
        <img src={selectedChipAsset} alt="" draggable={false} />
        <span>{stakeIsValid ? numericStake.toFixed(2) : "?"}</span>
      </div>
      <p className="dice-scene__status" aria-live="polite">
        {statusText}
      </p>
      <div className="dice-scene__bet-lane" aria-label={t("betLaneLabel")}>
        <span className="dice-scene__bet-node dice-scene__bet-node--face">
          <img src={diceFaceUrl(faceInput)} alt="" draggable={false} />
          <span>{t("selectedFace")} {faceInput}</span>
        </span>
        <span className="dice-scene__bet-beam" aria-hidden="true" />
        <span
          className="dice-scene__bet-node dice-scene__bet-node--stake"
          aria-label={`${t("stakeAmount")} ${displayStake}`}
        >
          <img src={selectedChipAsset} alt="" draggable={false} />
          <span aria-hidden="true">{displayStake}</span>
        </span>
        <span className="dice-scene__bet-beam" aria-hidden="true" />
        <span className="dice-scene__bet-node dice-scene__bet-node--payout">
          <CoinArt size={18} variant="gas" />
          <span>{winPayout}</span>
        </span>
      </div>
      {sceneInteraction}
    </div>
  );

  return (
    <OpenUiProvider>
      <div
        className="dice-playarea mx2 mx2-cat-game"
        aria-busy={controlsLocked || undefined}
      >
        <PlayStage
          category="game"
          stage={{
            eyebrow: t("rollTab"),
            title: stageTitle,
            subtitle: t("rollDescription"),
            badges: (
              <>
                <span className="mx2-badge" data-tone="accent">
                  <span className="mx2-badge__dot" /> {chainLabel || t("networkLabel")}
                </span>
                {directCredit > 0 && (
                  <span className="mx2-badge">
                    <CoinArt size={14} variant="gas" /> {directCredit.toFixed(2)}
                  </span>
                )}
              </>
            ),
          }}
          scene={scene}
          actions={{
            primary: {
              label: t("rollAction"),
              onClick: () => void handleSubmit(),
              disabled: controlsLocked || !stakeIsValid,
              loading: isRolling,
              icon: <Dices size={18} aria-hidden="true" />,
              hint: t("rollDice"),
            },
            secondary:
              directCredit > 0 && !isEvmChain
                ? [
                    {
                      label: t("withdrawCredit"),
                      onClick: () => void dispatch("withdrawCredit", {}),
                      hint: t("directCreditLabel"),
                    },
                  ]
                : undefined,
          }}
          drawerToggleLabel={t("diceHistoryTitle")}
          drawer={{
            title: t("diceHistoryTitle"),
            children: (
              <div className="dice-drawer">
                <section className="dice-drawer__section dice-drawer__section--history">
                  <div className="dice-drawer__section-head">
                    <strong>{t("networkLabel")}</strong>
                    <span>{chainLabel || t("networkLabel")}</span>
                  </div>
                  {rollHistory.length > 0 ? (
                    <ul className="mx2-history">
                      {rollHistory.map((row) => (
                        <li
                          key={row.id ?? `${row.txid || row.at || row.face}-${row.result}`}
                          className="mx2-history__item"
                          data-outcome={row.outcome || undefined}
                        >
                          <span className="mx2-history__face">
                            {row.face ? `${t("selectedFace")} ${row.face}` : "—"}
                          </span>
                          <span className="mx2-history__stake">{row.stake || row.payout}</span>
                          <span className="mx2-history__result">{row.result}</span>
                          {row.txid && (
                            <code className="mx2-history__tx">
                              {formatHash(row.txid, 6, 4)}
                            </code>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="dice-drawer__empty">{t("diceHistoryEmpty")}</p>
                  )}
                </section>

                <div className="dice-drawer__rule-grid">
                  <article className="dice-drawer__rule-card">
                    <span className="dice-drawer__rule-index">1</span>
                    <strong>{t("howItWorks")}</strong>
                    <p>{t("docHowItWorks")}</p>
                  </article>
                  <article className="dice-drawer__rule-card">
                    <span className="dice-drawer__rule-index">2</span>
                    <strong>{t("safetyModel")}</strong>
                    <p>{t("docSafetyModel")}</p>
                  </article>
                  {!isEvmChain && (
                    <article className="dice-drawer__rule-card">
                      <span className="dice-drawer__rule-index">3</span>
                      <strong>{t("diceVrfRouteTitle")}</strong>
                      <p>{t("vrfTrustLine")}</p>
                    </article>
                  )}
                  <article className="dice-drawer__rule-card">
                    <span className="dice-drawer__rule-index">{isEvmChain ? "3" : "4"}</span>
                    <strong>{t("diceRiskTitle")}</strong>
                    <p>{t("diceRiskCopy")}</p>
                  </article>
                </div>

                <section className="dice-drawer__limits" aria-label={t("maxStakeNote")}>
                  <span>
                    <small>{t("maxStakeNote")}</small>
                    <strong>{effectiveMaxStake} GAS</strong>
                  </span>
                  <span>
                    <small>{t("rangeLabel")}</small>
                    <strong>{MIN_STAKE}–{effectiveMaxStake} GAS</strong>
                  </span>
                  <span>
                    <small>{t("feeLabel")}</small>
                    <strong>5%</strong>
                  </span>
                </section>

                {isUnresolved && (
                  <button
                    type="button"
                    className="mx2-btn mx2-btn--ghost dice-drawer__recheck"
                    onClick={() => void dispatch("recheckSettlement", {})}
                  >
                    {t("checkAgain")}
                  </button>
                )}
              </div>
            ),
          }}
        />
      </div>
    </OpenUiProvider>
  );
}
