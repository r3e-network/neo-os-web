/**
 * PhaserPlayArea.tsx — Phaser 3 wrapper for the Aim Master archery game.
 *
 * Bridges the React/framework observable state into the AimMasterScene and
 * forwards scene dispatch calls back to main.tsx. All blockchain / TEE logic
 * lives in main.tsx; this component owns only the Phaser canvas lifecycle.
 */
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { useStateBindings } from "@shared/react";
import type { PlayAreaProps } from "@shared/react";
import { PlayStage } from "@shared/components-react/v2";
import { LazyPhaserGameComponent as PhaserGameComponent } from "@framework/phaser/LazyPhaserGameComponent";
import type { LeaderEntry, SolveRow } from "@framework/game";
import { ChevronDown, RefreshCw, ShieldCheck, Trophy, WalletCards, X } from "lucide-react";
import {
  canReleaseAfterGrace,
  ruleOf,
  formatClock,
  gasDisplay,
} from "./logic/game-rules";
import "./PlayArea.scss";

import type * as Phaser from "phaser";

const GAME_CONFIG: Phaser.Types.Core.GameConfig = {
  width:  520,
  height: 720,
  backgroundColor: "transparent",
  transparent: true,
};

const loadAimMasterScene = () =>
  import("./scenes/AimMasterScene").then((module) => module.AimMasterScene);

function shortHash(value: string, head = 10, tail = 6): string {
  if (!value || value.length <= head + tail + 1) return value;
  return `${value.slice(0, head)}...${value.slice(-tail)}`;
}

export default function PhaserPlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { str, bool, val } = useStateBindings(state);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [a11yShotPulse, setA11yShotPulse] = useState(0);
  const drawerTriggerRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const drawerCloseRef = useRef<HTMLButtonElement>(null);
  const difficultyRefs = useRef<Array<HTMLButtonElement | null>>([]);

  // ── Bridge state snapshot ────────────────────────────────────────────────
  const bridgeState = {
    gameStatus:      str("gameStatus", "idle"),
    pattern:         str("pattern", ""),
    targetAccuracy:  val<number>("targetAccuracy", 3) ?? 3,
    gameDifficulty:  val<number>("gameDifficulty", 0) ?? 0,
    poolFree:        val<number>("poolFree", 0) ?? 0,
    ringsHit:        val<number>("ringsHit", 0) ?? 0,
    roundIndex:      val<number>("roundIndex", 0) ?? 0,
    roundResults:    val("roundResults") ?? [],
    scorePoints:     val<number>("scorePoints", 0) ?? 0,
    combo:           val<number>("combo", 0) ?? 0,
    maxCombo:        val<number>("maxCombo", 0) ?? 0,
    selectedDifficulty: val<number>("selectedDifficulty", 0) ?? 0,
    a11yShotPulse,
    isStarting:      bool("isStarting"),
    isDealing:       bool("isDealing"),
    isSubmitting:    bool("isSubmitting"),
    lastStatus:      str("lastStatus", ""),
    deadline:        val<number>("deadline", 0) ?? 0,
    dealtAt:         val<number>("dealtAt", 0) ?? 0,
    // Localized "how to play" hint rendered by the lobby scene (from messages).
    rulesShort:      t("rulesShort"),
    // Play mode + localized guest labels so the scene can branch GAS-centric
    // lobby copy (pool line, lane reward/entry) into local/practice framing.
    mode:            str("mode", "guest"),
    guestPoolLabel:  t("guestPoolLabel"),
    guestRewardLabel: t("guestRewardLabel"),
    guestEntryLabel: t("guestEntryLabel"),
    difficultyEasyLabel: t("difficulty_easy"),
    difficultyMediumLabel: t("difficulty_medium"),
    difficultyHardLabel: t("difficulty_hard"),
    difficultyEasyTarget: t("accuracyCount", { count: 3 }),
    difficultyMediumTarget: t("accuracyCount", { count: 5 }),
    difficultyHardTarget: t("accuracyCount", { count: 7 }),
    startActionLabel: t("startAction"),
    submitActionLabel: t("submitRound"),
    startingActionLabel: t("sceneStartingAction"),
    submittingActionLabel: t("sceneSubmittingAction"),
    hitsUnit: t("hitsMetric"),
    pointsUnit: t("scenePointsUnit"),
    shotUnit: t("sceneShotUnit"),
    shotsUnit: t("sceneShotsUnit"),
    comboUnit: t("sceneComboUnit"),
    bullseyeLabel: t("statusBullseye"),
    hitFeedbackLabel: t("sceneHitFeedback"),
    missFeedbackLabel: t("sceneMissFeedback"),
    poolLabel: t("scenePoolLabel"),
    entryLabel: t("sceneEntryLabel"),
    preparingLabel: t("scenePreparingRound"),
    sealingLabel: t("sceneSealingPattern"),
    localPreparingLabel: t("sceneLocalPreparing"),
    tapCenterLabel: t("sceneTapCenter"),
    submitVerifiedLabel: t("sceneSubmitVerified"),
    chooseLaneLabel: t("sceneChooseLane"),
    poolNeedsGasLabel: t("scenePoolNeedsGas"),
    startingSealedLabel: t("sceneStartingSealed"),
    shotFailedLabel: t("sceneShotFailed"),
    patternInvalidLabel: t("scenePatternInvalid"),
    settlementPendingLabel: t("statusSettlementPending"),
    minSolveHintTemplate: t("minSolveHint", { clock: "{clock}" }),
  };

  // ── Derived display values (for PlayStage chrome) ─────────────────────────
  const gameStatus     = str("gameStatus", "idle");
  const gameDifficulty = val<number>("gameDifficulty", 0) ?? 0;
  const activeGameId   = str("activeGameId", "0");
  const commitment     = str("commitment", "");
  const deadline       = val<number>("deadline", 0) ?? 0;
  const dealtAt        = val<number>("dealtAt", 0) ?? 0;
  const targetAccuracy = val<number>("targetAccuracy", 3) ?? 3;
  const ringsHit       = val<number>("ringsHit", 0) ?? 0;
  const scorePoints    = val<number>("scorePoints", 0) ?? 0;
  const selectedDifficulty = Math.max(
    0,
    Math.min(2, Math.round(val<number>("selectedDifficulty", 0) ?? 0)),
  );
  const creditGas      = val<number>("credit", 0) ?? 0;
  const myRank         = val<number>("myRank", 0) ?? 0;
  const myTotalWon     = val<number>("myTotalWon", 0) ?? 0;
  const leaderboard    = val<LeaderEntry[]>("leaderboard", []) ?? [];
  const myHistory      = val<SolveRow[]>("myHistory", []) ?? [];
  const isSubmitting   = bool("isSubmitting");
  const isDealing      = bool("isDealing") || bool("isStarting");
  const timeUp         = gameStatus === "dealt" && deadline > 0 && deadline <= nowMs;
  const settlementPending = gameStatus === "unknown" && activeGameId !== "0";
  const canRelease = activeGameId !== "0"
    && canReleaseAfterGrace(deadline, nowMs)
    && ["dealt", "committed", "unknown"].includes(gameStatus);
  const mode           = str("mode", "guest");
  const isGuest        = mode === "guest";
  // Fleet pool gate on the accessible start path: a paid run must never open
  // while the reward pool cannot cover the selected lane's payout. Guest (free
  // local) play has no reward pool and stays exempt. Mirrors the canvas gate
  // (AimMasterScene.selectedPoolIsReady) so keyboard users cannot bypass it.
  const poolFree       = val<number>("poolFree", 0) ?? 0;
  const startPoolReady = isGuest
    || poolFree >= Number(gasDisplay(ruleOf(selectedDifficulty).rewardFixed8));

  useEffect(() => {
    if (!["dealt", "committed", "unknown"].includes(gameStatus) || deadline <= 0) {
      return undefined;
    }
    // A completed round stops the ticker, so `nowMs` can be stale when the
    // player immediately starts another one. Refresh synchronously before the
    // first interval tick to avoid briefly showing an impossible countdown.
    const immediateNow = Date.now();
    setNowMs((current) => (
      Math.abs(immediateNow - current) > 1_000 ? immediateNow : current
    ));
    const timer = window.setInterval(() => setNowMs(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [deadline, gameStatus]);

  const closeDrawer = useCallback((restoreFocus = true) => {
    setDrawerOpen(false);
    if (restoreFocus) {
      window.requestAnimationFrame(() => drawerTriggerRef.current?.focus());
    }
  }, []);

  useEffect(() => {
    if (!drawerOpen) return undefined;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeDrawer();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(
        drawerRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter((element) => !element.hasAttribute("hidden"));
      if (focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable.at(-1)!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    window.requestAnimationFrame(() => drawerCloseRef.current?.focus());
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [closeDrawer, drawerOpen]);

  const rule = ruleOf(
    ["dealt", "committed", "unknown"].includes(gameStatus)
      ? gameDifficulty
      : selectedDifficulty,
  );

  // Remaining time (rough — scene handles precise countdown)
  const remainingMs = deadline > 0 ? Math.max(0, deadline - nowMs) : rule.limitMs;

  const stageTitle =
    isSubmitting ? t("submitRound")
    : isDealing   ? t("statusShuffling")
    : settlementPending ? t("statusSettlementPending")
    : gameStatus === "dealt"
      ? t("playingTitle", { difficulty: t(`difficulty_${rule.key}`) })
    : gameStatus === "solved"  ? t("statusWonTitle")
    : gameStatus === "expired" ? t("expiredBanner")
    : t("lobbyTitle");

  // Before a round exists (idle/solved/expired) the clock is not counting, but
  // both values are still known and honest: remainingMs falls back to the
  // selected lane's full limitMs above, and ringsHit is a real 0. The strip used
  // to drop them for "—", printing two em-dash voids beside "BEST SCORE 0" on
  // the entry HUD — and the in-game drawer below already renders exactly these
  // expressions unconditionally. `timeUp` still keys the accent off a live round.
  const roundLive = gameStatus === "dealt" || gameStatus === "committed" || settlementPending;
  const hudItems = [
    isGuest
      ? {
          // Guest has no GAS at stake — surface the local best score instead of
          // a "REWARD … GAS" line.
          label: t("guestBestLabel"),
          value: `${myTotalWon}`,
          accent: true,
        }
      : {
          label: t("rewardMetric"),
          value: `${gasDisplay(rule.rewardFixed8)} GAS`,
          accent: true,
        },
    {
      label: t("timeMetric"),
      value: formatClock(remainingMs),
      accent: timeUp,
    },
    {
      label: t("hitsMetric"),
      value: `${ringsHit}/${targetAccuracy}`,
      accent: false,
    },
  ];
  const drawerActions = [
    ...(gameStatus === "committed"
      ? [{
          label: t("checkDealAgain"),
          icon: <RefreshCw size={15} aria-hidden="true" />,
          onClick: () => void dispatch("retryDeal", {}),
          disabled: isDealing,
          hint: t("shufflingCopy"),
        }]
      : []),
    ...(settlementPending
      ? [{
          label: t("refreshGame"),
          icon: <RefreshCw size={15} aria-hidden="true" />,
          onClick: () => void dispatch("refreshGame", {}),
          hint: t("statusSettlementPending"),
        }]
      : []),
    ...(canRelease
      ? [{
          label: t("releaseAction"),
          icon: <RefreshCw size={15} aria-hidden="true" />,
          onClick: () => void dispatch("expireGame", {}),
          hint: t("releaseHint"),
        }]
      : []),
    ...(!isGuest && creditGas > 0 && gameStatus !== "dealt"
      ? [{
          label: t("withdrawAction", { amount: creditGas.toFixed(2) }),
          icon: <WalletCards size={15} aria-hidden="true" />,
          onClick: () => void dispatch("withdrawWinnings", {}),
          hint: t("withdrawHint"),
        }]
      : []),
  ];
  const difficultyOptions = [0, 1, 2].map((difficulty) => {
    const difficultyRule = ruleOf(difficulty);
    return {
      difficulty,
      label: t(`difficulty_${difficultyRule.key}`),
      detail: t("accuracyCount", { count: difficultyRule.targetAccuracy }),
    };
  });
  const lobbyAvailable = ["idle", "solved", "expired", "refunded"].includes(gameStatus)
    && !isDealing
    && !isSubmitting;
  const targetReached = ringsHit >= targetAccuracy;
  const minSolveReached = dealtAt > 0 && nowMs >= dealtAt + ruleOf(gameDifficulty).minSolveMs;
  const canSubmit = gameStatus === "dealt"
    && targetReached
    && !isSubmitting
    && (isGuest || minSolveReached || timeUp);
  const canShoot = gameStatus === "dealt" && !targetReached && !timeUp && !isSubmitting;
  const drawerId = "aim-ingame-drawer";

  const handleDifficultyKeyDown = (
    event: ReactKeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    const direction = event.key === "ArrowRight" || event.key === "ArrowDown"
      ? 1
      : event.key === "ArrowLeft" || event.key === "ArrowUp"
        ? -1
        : 0;
    if (direction === 0 || !lobbyAvailable) return;
    event.preventDefault();
    const nextIndex = (index + direction + difficultyOptions.length) % difficultyOptions.length;
    const next = difficultyOptions[nextIndex];
    if (!next) return;
    difficultyRefs.current[nextIndex]?.focus();
    void dispatch("selectDifficulty", { difficulty: next.difficulty });
  };

  const a11yStatus = `${stageTitle}. ${t("hitsMetric")}: ${ringsHit}/${targetAccuracy}. ${t("scenePointsUnit")}: ${scorePoints}. ${t("timeMetric")}: ${formatClock(remainingMs)}.`;

  return (
    <div className="aim-playarea mx2 mx2-cat-game" aria-busy={isDealing || isSubmitting || undefined}>
      <PlayStage
        category="game"
        className="aim-playstage"
        stage={{
          eyebrow:  t("appEyebrow"),
          title:    stageTitle,
          subtitle: isGuest ? t("guestSubtitle") : t("appSubtitle"),
          badges: (
            <>
              <span className="mx2-badge" data-tone="accent">
                <span className="mx2-badge__dot" />
                {isGuest ? t("guestModeValue") : t("networkBadge")}
              </span>
              {myRank > 0 && (
                <span className="mx2-badge">{t("rankBadge", { rank: myRank })}</span>
              )}
            </>
          ),
        }}
        scene={
          <div className="aim-stage-shell">
            <PhaserGameComponent
              config={GAME_CONFIG}
              loadScene={loadAimMasterScene}
              state={bridgeState}
              dispatch={dispatch}
              className="aim-phaser-canvas"
              ariaLabel={t("a11yStageLabel")}
              loadingLabel={t("a11yOpeningRange")}
              errorLabel={t("gameActionFailed")}
              retryLabel={t("retry")}
              continueLabel={t("continue")}
              enableSoundLabel={t("enableGameSound")}
              muteSoundLabel={t("muteGameSound")}
            />
            <div className="aim-a11y-layer">
              {lobbyAvailable && (
                <>
                  <div
                    className="aim-a11y-difficulties"
                    role="radiogroup"
                    aria-label={t("a11yDifficultyGroup")}
                  >
                    {difficultyOptions.map((option, index) => {
                      const selected = option.difficulty === selectedDifficulty;
                      return (
                        <button
                          key={option.difficulty}
                          ref={(node) => {
                            difficultyRefs.current[index] = node;
                          }}
                          type="button"
                          role="radio"
                          className="aim-a11y-hit aim-a11y-difficulty"
                          data-index={index}
                          aria-checked={selected}
                          aria-label={`${option.label}. ${option.detail}`}
                          tabIndex={selected ? 0 : -1}
                          onClick={() => void dispatch("selectDifficulty", {
                            difficulty: option.difficulty,
                          })}
                          onKeyDown={(event) => handleDifficultyKeyDown(event, index)}
                        >
                          <span>{option.label}</span>
                        </button>
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    className="aim-a11y-hit aim-a11y-start"
                    aria-label={startPoolReady
                      ? `${t("startAction")}: ${difficultyOptions[selectedDifficulty]?.label ?? ""}`
                      : t("scenePoolNeedsGas")}
                    disabled={!startPoolReady}
                    onClick={() => void dispatch("startGame", { difficulty: selectedDifficulty })}
                  >
                    <span>{startPoolReady ? t("startAction") : t("scenePoolNeedsGas")}</span>
                  </button>
                </>
              )}
              {gameStatus === "dealt" && (
                <>
                  <button
                    type="button"
                    className="aim-a11y-hit aim-a11y-shoot"
                    aria-label={t("a11yShoot")}
                    disabled={!canShoot}
                    onClick={() => setA11yShotPulse((pulse) => pulse + 1)}
                  >
                    <span>{t("a11yShoot")}</span>
                  </button>
                  <button
                    type="button"
                    className="aim-a11y-hit aim-a11y-submit"
                    aria-label={t("submitRound")}
                    disabled={!canSubmit}
                    onClick={() => void dispatch("submitSolution", {})}
                  >
                    <span>{t("submitRound")}</span>
                  </button>
                </>
              )}
            </div>
            <p className="aim-a11y-status" aria-live="polite" aria-atomic="true">
              {a11yStatus}
            </p>
            <div className="aim-stage-hud" aria-label={t("routeSummary")}>
              {hudItems.map((item) => (
                <div
                  className="aim-stage-hud__metric"
                  data-accent={item.accent ? "true" : undefined}
                  key={`${item.label}-${item.value}`}
                >
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
              ))}
              <button
                ref={drawerTriggerRef}
                type="button"
                className="aim-stage-hud__drawer"
                onClick={() => {
                  if (drawerOpen) closeDrawer();
                  else setDrawerOpen(true);
                }}
                aria-expanded={drawerOpen}
                aria-controls={drawerId}
              >
                <span>{t("drawerTitleShort")}</span>
                <ChevronDown size={16} aria-hidden="true" data-open={drawerOpen ? "true" : undefined} />
              </button>
            </div>
            {drawerOpen && (
              <section
                ref={drawerRef}
                id={drawerId}
                className="aim-ingame-drawer"
                role="dialog"
                aria-modal="true"
                aria-label={t("drawerTitle")}
              >
                <div className="aim-ingame-drawer__head">
                  <Trophy size={18} aria-hidden="true" />
                  <div>
                    <h3>{t("drawerTitle")}</h3>
                    <p>{isGuest ? t("guestModeLine") : t("fairnessShort")}</p>
                  </div>
                  <button
                    ref={drawerCloseRef}
                    type="button"
                    className="aim-ingame-drawer__close"
                    aria-label={t("close")}
                    title={t("close")}
                    onClick={() => closeDrawer()}
                  >
                    <X size={17} aria-hidden="true" />
                  </button>
                </div>
                <div className="aim-ingame-drawer__grid">
                  {isGuest ? (
                    <>
                      <span>
                        <small>{t("guestBestLabel")}</small>
                        <strong>{myTotalWon}</strong>
                      </span>
                      <span>
                        <small>{t("guestModeTag")}</small>
                        <strong>{t("guestModeValue")}</strong>
                      </span>
                    </>
                  ) : (
                    <>
                      <span>
                        <small>{t("creditLabel")}</small>
                        <strong>{creditGas.toFixed(2)} GAS</strong>
                      </span>
                      <span>
                        <small>{t("scoreWon")}</small>
                        <strong>{myTotalWon.toFixed(2)} GAS</strong>
                      </span>
                    </>
                  )}
                  <span>
                    <small>{t("scoreRings")}</small>
                    <strong>{ringsHit}/{targetAccuracy}</strong>
                  </span>
                  <span>
                    <small>{t("scoreTime")}</small>
                    <strong>{formatClock(remainingMs)}</strong>
                  </span>
                </div>
                {drawerActions.length > 0 && (
                  <div className="aim-ingame-drawer__actions">
                    {drawerActions.map((action) => (
                      <button
                        type="button"
                        key={action.label}
                        onClick={action.onClick}
                        disabled={action.disabled}
                        title={action.hint}
                      >
                        {action.icon}
                        <span>{action.label}</span>
                      </button>
                    ))}
                  </div>
                )}
                <div className="aim-drawer">
                  <div className="aim-drawer__head">
                    <img src="./logo.webp" alt="" width={40} height={40} draggable={false} />
                    <p>{isGuest ? t("guestLeaderboardIntro") : t("leaderboardIntro")}</p>
                  </div>
                  <h4>{t("leaderboardTitle")}</h4>
                  {leaderboard.length > 0 ? (
                    <ol className="aim-ranks">
                      {leaderboard.slice(0, 10).map((entry) => (
                        <li
                          key={entry.address}
                          className="aim-ranks__row"
                          data-me={entry.isUser ? "true" : undefined}
                        >
                          <span className="aim-ranks__rank">#{entry.rank}</span>
                          <span className="aim-ranks__addr">{shortHash(entry.address)}</span>
                          <span className="aim-ranks__solves">{t("solvesCount", { count: entry.solves })}</span>
                          <span className="aim-ranks__won">
                            {isGuest ? `${entry.totalWon}` : `${entry.totalWon.toFixed(2)} GAS`}
                          </span>
                          {entry.isUser && <span className="aim-ranks__me">{t("youTag")}</span>}
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p>{t("leaderboardEmpty")}</p>
                  )}
                  <button
                    type="button"
                    className="mx2-btn mx2-btn--ghost aim-drawer__refresh"
                    onClick={() => void dispatch("refreshLeaderboard", {})}
                  >
                    <RefreshCw size={16} aria-hidden="true" />
                    {t("refreshRanks")}
                  </button>
                  <h4>{t("historyTitle")}</h4>
                  {myHistory.length > 0 ? (
                    <ul className="mx2-history">
                      {myHistory.map((row) => {
                        const rowHits = Number(row.ringsHit ?? 0);
                        return (
                          <li
                            key={row.gameId}
                            className="mx2-history__item"
                            data-outcome={row.payout && Number.parseFloat(row.payout) > 0 ? "won" : "lost"}
                          >
                            <span className="mx2-history__face">
                              {t(`difficulty_${ruleOf(row.difficulty).key}`)}
                            </span>
                            <span className="mx2-history__stake">{formatClock(row.solveMs)}</span>
                            <span className="mx2-history__result">
                              {t("historyRings", { rings: Number.isFinite(rowHits) ? rowHits : 0 })}
                            </span>
                            <span className="mx2-history__stake">{row.payout}</span>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p>{t("historyEmpty")}</p>
                  )}
                  <h4>{isGuest ? t("guestModeTag") : t("rulesTitle")}</h4>
                  <p>{isGuest ? t("guestModeLine") : t("rulesCopy")}</p>
                  {!isGuest && (
                    <>
                      <h4>{t("fairnessTitle")}</h4>
                      <p>{t("fairnessCopy")}</p>
                      {!isGuest && commitment && (
                        <p className="aim-drawer__seed">
                          {t("commitmentLine", {
                            commitment: shortHash(commitment, 12, 8),
                            gameId: activeGameId,
                          })}
                        </p>
                      )}
                    </>
                  )}
                </div>
                <div className="aim-ingame-drawer__fairness">
                  <ShieldCheck size={17} aria-hidden="true" />
                  <p>{isGuest ? t("guestModeLine") : t("rulesShort")}</p>
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
