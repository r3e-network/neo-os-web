/**
 * PhaserPlayArea.tsx — Phaser 3 wrapper for the Dice Game.
 *
 * Replaces the React-canvas PlayArea.tsx. All blockchain logic stays in
 * main.tsx; this component bridges the observable state into the Phaser
 * DiceScene and forwards Phaser dispatch calls back to main.tsx.
 */
import { useEffect, useRef, useState } from "react";
import { useStateBindings } from "@shared/react";
import type { PlayAreaProps } from "@shared/react";
import { formatHash } from "@shared/utils/format";
import { PlayStage } from "@shared/components-react/v2";
import { LazyPhaserGameComponent as PhaserGameComponent } from "@framework/phaser/LazyPhaserGameComponent";
import { CoinArt } from "@shared/art";
import { ChevronDown, RefreshCw, ShieldCheck, Trophy, WalletCards, X } from "lucide-react";
import "./PlayArea.scss";

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

const GAME_CONFIG = {
  width: 520,
  height: 660,
  backgroundColor: "transparent",
  transparent: true,
} as const;

const loadDiceScene = () =>
  import("./scenes/DiceScene").then((module) => module.DiceScene);

const RULES_DRAWER_ID = "dice-rules-history-drawer";

export default function PhaserPlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { str, bool, val } = useStateBindings(state);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerToggleRef = useRef<HTMLButtonElement>(null);
  const drawerCloseRef = useRef<HTMLButtonElement>(null);
  const mode = str("mode", "guest");
  const isGuest = mode === "guest";
  const selectedFace = Math.max(1, Math.min(6, Number(str("selectedFace", "6")) || 6));
  const selectedStake = Math.max(0, Number.parseFloat(str("stakeAmount", "0.10")) || 0.1);
  const chainLabel = str("chainLabel") || t("networkLabel");
  const maxStake = val<number>("maxStake", 20) ?? 20;
  const maxPayableStake = val<number>("maxPayableStake", 0) ?? 0;
  const directCredit = val<number>("directCredit", 0) ?? 0;
  const walletGasBalance = Number(val<string | number>("walletGasBalance", 0) ?? 0);
  const walletGasAvailable = Number.isFinite(walletGasBalance) ? walletGasBalance : 0;
  const rollHistory = val<RollHistoryItem[]>("rollHistory", []) ?? [];
  const isUnresolved = bool("isUnresolved");
  const walletConnected = bool("walletConnected");
  const isEvmChain = chainLabel.startsWith("Neo X");
  const effectiveMaxStake = maxPayableStake > 0 ? Math.min(maxStake, maxPayableStake) : maxStake;
  // In guest (local practice) the amounts are practice chips, not GAS at stake —
  // reframe the currency word so no GAS-at-stake framing leaks. GameFi is "GAS".
  const localizeAmount = (value: string): string =>
    isGuest ? value.replace(/\bGAS\b/g, t("guestUnit")) : value;

  // Build the bridge state snapshot (plain object from observables)
  const bridgeState = {
    selectedFace:    String(selectedFace),
    stakeAmount:     str("stakeAmount", "0.10 GAS"),
    payoutPreview:   str("payoutPreview", "0.57 GAS"),
    lastStatus:      str("lastStatus", t("statusReady")),
    lastOutcome:     str("lastOutcome", ""),
    lastRoll:        str("lastRoll", ""),
    lastPayout:      str("lastPayout", ""),
    chainLabel,
    isSubmitting:    bool("isSubmitting"),
    isResolving:     bool("isResolving"),
    isUnresolved,
    maxStake,
    maxPayableStake,
    directCredit,
    walletGasBalance: walletGasAvailable,
    walletConnected,
    isEvmChain,
    sceneText: {
      throwDice: t("sceneThrowDice"),
      rolling: t("sceneRolling"),
      connectWallet: t("sceneConnectWallet"),
      revealPending: t("sceneRevealPending"),
      lowerStake: t("sceneLowerStake"),
      houseLimit: t("sceneHouseLimit"),
      insufficientGas: t("sceneInsufficientGas"),
      tableTitle: t("sceneTableTitle"),
      tableHint: t("sceneTableHint"),
      predictionRail: t("scenePredictionRail"),
      chipRail: t("sceneChipRail"),
      onTable: t("sceneOnTable"),
      hitPays: t("sceneHitPays"),
      practiceChips: t("guestUnit"),
      youWin: t("sceneYouWin"),
      houseWins: t("sceneHouseWins"),
      refunded: t("sceneRefunded"),
      rolled: t("sceneRolled"),
      betterLuck: t("sceneBetterLuck"),
      stakeReturned: t("sceneStakeReturned"),
    },
    rollHistory,
    mode,
  };

  const isRolling  = bool("isSubmitting") || bool("isResolving");
  const stakeWithinNetwork =
    selectedStake >= 0.05 && selectedStake <= maxStake;
  const hasGameFiCover =
    isEvmChain || (
      maxPayableStake >= selectedStake &&
      directCredit + walletGasAvailable >= selectedStake
    );
  const semanticPrimaryDisabled =
    isRolling || (
      !isGuest &&
      walletConnected &&
      !isUnresolved &&
      (!stakeWithinNetwork || !hasGameFiCover)
    );
  const semanticPrimaryLabel = isUnresolved
    ? t("sceneRevealPending")
    : !isGuest && !walletConnected
      ? t("sceneConnectWallet")
      : !stakeWithinNetwork
        ? t("sceneLowerStake")
        : !isGuest && !isEvmChain && maxPayableStake < selectedStake
          ? t("sceneHouseLimit")
          : !isGuest && !isEvmChain && directCredit + walletGasAvailable < selectedStake
            ? t("sceneInsufficientGas")
            : t("sceneThrowDice");
  const lastOutcome = str("lastOutcome", "");
  const stageTitle  = isRolling
    ? t("throwingTitle")
    : isUnresolved ? t("statusSettlementPending")
    : lastOutcome === "won"  ? t("statusWon")
    : lastOutcome === "lost" ? t("statusLost")
    : t("readyTitle");
  const hudItems = [
    {
      label: t("faceMetric"),
      value: bridgeState.selectedFace,
      accent: true,
    },
    {
      label: t("stakeMetric"),
      value: localizeAmount(bridgeState.stakeAmount),
      accent: false,
    },
    {
      label: t("payoutMetric"),
      value: localizeAmount(bridgeState.payoutPreview),
      accent: lastOutcome === "won",
    },
  ];
  const drawerActions = [
    ...(isUnresolved
      ? [{
          label: t("checkAgain"),
          icon: <RefreshCw size={15} aria-hidden="true" />,
          onClick: () => void dispatch("recheckSettlement", {}),
          hint: t("settlementPendingBody"),
        }]
      : []),
    ...(!isGuest && directCredit > 0 && !isEvmChain
      ? [{
          label: t("withdrawCredit"),
          icon: <WalletCards size={15} aria-hidden="true" />,
          onClick: () => void dispatch("withdrawCredit", {}),
          hint: t("directCreditLabel"),
        }]
      : []),
  ];

  const closeDrawer = () => {
    setDrawerOpen(false);
    window.requestAnimationFrame(() => drawerToggleRef.current?.focus());
  };

  useEffect(() => {
    if (!drawerOpen) return;
    const frame = window.requestAnimationFrame(() => drawerCloseRef.current?.focus());
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setDrawerOpen(false);
      window.requestAnimationFrame(() => drawerToggleRef.current?.focus());
    };
    document.addEventListener("keydown", onEscape);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onEscape);
    };
  }, [drawerOpen]);

  return (
    <div className="dice-playarea mx2 mx2-cat-game" aria-busy={isRolling || undefined}>
      <PlayStage
        category="game"
        className="dice-playstage"
        stage={{}}
        scene={
          <div className="dice-stage-shell">
            <div className="dice-stage-status" aria-live="polite">
              <div>
                <span>{t("rollTab")}</span>
                <strong>{stageTitle}</strong>
              </div>
              <span className="dice-stage-status__mode">
                <span className="mx2-badge__dot" />
                {isGuest ? t("guestBadge") : chainLabel}
              </span>
              {!isGuest && directCredit > 0 && !isEvmChain && (
                <span className="dice-stage-status__credit">
                  <CoinArt size={14} variant="gas" /> {directCredit.toFixed(2)}
                </span>
              )}
            </div>
            <PhaserGameComponent
              config={GAME_CONFIG}
              loadScene={loadDiceScene}
              state={bridgeState}
              dispatch={dispatch}
              className="dice-phaser-canvas"
              ariaLabel={t("diceCanvasAria")}
              loadingLabel={t("diceCanvasLoading")}
              errorLabel={t("gameActionFailed")}
              retryLabel={t("retry")}
              continueLabel={t("continue")}
              enableSoundLabel={t("enableGameSound")}
              muteSoundLabel={t("muteGameSound")}
            />
            <div className="dice-a11y-controls" aria-label={t("accessibleDiceControls")}>
              <span id="dice-face-control-label">{t("faceTrayHint")}</span>
              <div role="radiogroup" aria-labelledby="dice-face-control-label">
                {[1, 2, 3, 4, 5, 6].map((face) => (
                  <button
                    key={face}
                    type="button"
                    role="radio"
                    aria-checked={selectedFace === face}
                    disabled={isRolling || isUnresolved}
                    onClick={() => void dispatch("setSelectedFace", { face: String(face) })}
                  >
                    {t("dieShowing", { face })}
                  </button>
                ))}
              </div>
              <span id="dice-chip-control-label">{t("stakePresets")}</span>
              <div role="radiogroup" aria-labelledby="dice-chip-control-label">
                {["0.10", "0.50", "1.00", "5.00"].map((amount) => (
                  <button
                    key={amount}
                    type="button"
                    role="radio"
                    aria-checked={Math.abs(selectedStake - Number(amount)) < 0.001}
                    disabled={isRolling || isUnresolved}
                    onClick={() => void dispatch("setStakeAmount", { amount })}
                  >
                    {amount} {isGuest ? t("guestUnit") : "GAS"}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="dice-a11y-controls__primary"
                disabled={semanticPrimaryDisabled}
                onClick={() => {
                  if (isUnresolved) void dispatch("recheckSettlement", {});
                  else if (!isGuest && !walletConnected) void dispatch("connectWallet", {});
                  else void dispatch("placeDiceBet", {
                    chosenNumber: String(selectedFace),
                    amount: selectedStake.toFixed(2),
                  });
                }}
              >
                {semanticPrimaryLabel}
              </button>
              <p role="status" aria-live="polite">{str("lastStatus", t("statusReady"))}</p>
            </div>
            <div className="dice-stage-hud" aria-label={t("rollSummary")}>
              {hudItems.map((item) => (
                <div
                  className="dice-stage-hud__metric"
                  data-accent={item.accent ? "true" : undefined}
                  key={`${item.label}-${item.value}`}
                >
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
              ))}
              <button
                ref={drawerToggleRef}
                type="button"
                className="dice-stage-hud__drawer"
                onClick={() => setDrawerOpen((open) => !open)}
                aria-expanded={drawerOpen}
                aria-controls={RULES_DRAWER_ID}
              >
                <span>{t("drawerTitleShort")}</span>
                <ChevronDown size={16} aria-hidden="true" data-open={drawerOpen ? "true" : undefined} />
              </button>
            </div>
            {drawerOpen && (
              <section
                id={RULES_DRAWER_ID}
                className="dice-ingame-drawer"
                role="dialog"
                aria-label={t("diceHistoryTitle")}
              >
                <div className="dice-ingame-drawer__head">
                  <Trophy size={18} aria-hidden="true" />
                  <div>
                    <h3>{t("diceHistoryTitle")}</h3>
                    <p>{isGuest ? t("guestFairnessShort") : t("fairnessShort")}</p>
                  </div>
                  <button
                    ref={drawerCloseRef}
                    type="button"
                    className="dice-ingame-drawer__close"
                    onClick={closeDrawer}
                    aria-label={t("closeRules")}
                  >
                    <X size={17} aria-hidden="true" />
                  </button>
                </div>
                <div className="dice-ingame-drawer__grid">
                  <span>
                    <small>{t("networkLabel")}</small>
                    <strong>{isGuest ? t("guestNetworkValue") : chainLabel}</strong>
                  </span>
                  <span>
                    <small>{isGuest ? t("guestMaxLabel") : t("maxStakeNote")}</small>
                    <strong>{isGuest ? t("guestUnlimitedValue") : `${effectiveMaxStake} GAS`}</strong>
                  </span>
                  <span>
                    <small>{t("rangeLabel")}</small>
                    <strong>{isGuest ? t("guestRangeValue") : `0.05-${effectiveMaxStake} GAS`}</strong>
                  </span>
                  <span>
                    <small>{t("feeLabel")}</small>
                    <strong>{isGuest ? t("guestFeeValue") : "5%"}</strong>
                  </span>
                </div>
                {drawerActions.length > 0 && (
                  <div className="dice-ingame-drawer__actions">
                    {drawerActions.map((action) => (
                      <button type="button" key={action.label} onClick={action.onClick} title={action.hint}>
                        {action.icon}
                        <span>{action.label}</span>
                      </button>
                    ))}
                  </div>
                )}
                <div className="dice-drawer">
                  <section className="dice-drawer__section dice-drawer__section--history">
                    <div className="dice-drawer__section-head">
                      <strong>{t("networkLabel")}</strong>
                      <span>{isGuest ? t("guestNetworkValue") : chainLabel}</span>
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
                              {row.face ? `${t("selectedFace")} ${row.face}` : "-"}
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
                      <p>{isGuest ? t("guestHowItWorksBody") : t("docHowItWorks")}</p>
                    </article>
                    <article className="dice-drawer__rule-card">
                      <span className="dice-drawer__rule-index">2</span>
                      <strong>{t("safetyModel")}</strong>
                      <p>{isGuest ? t("guestSafetyBody") : t("docSafetyModel")}</p>
                    </article>
                    {!isEvmChain && !isGuest && (
                      <article className="dice-drawer__rule-card">
                        <span className="dice-drawer__rule-index">3</span>
                        <strong>{t("diceVrfRouteTitle")}</strong>
                        <p>{t("vrfTrustLine")}</p>
                      </article>
                    )}
                    <article className="dice-drawer__rule-card">
                      <span className="dice-drawer__rule-index">{isEvmChain || isGuest ? "3" : "4"}</span>
                      <strong>{isGuest ? t("guestPayoutTitle") : t("diceRiskTitle")}</strong>
                      <p>{isGuest ? t("guestRiskBody") : t("diceRiskCopy")}</p>
                    </article>
                  </div>
                </div>
                <div className="dice-ingame-drawer__fairness">
                  <ShieldCheck size={17} aria-hidden="true" />
                  <p>{isGuest ? t("guestRulesShort") : t("rulesShort")}</p>
                </div>
              </section>
            )}
          </div>
        }
        actions={{}}
      />
    </div>
  );
}
