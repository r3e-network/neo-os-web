/**
 * PhaserPlayArea.tsx — Phaser 3 wrapper for Sheep Solitaire.
 *
 * Bridges the observable state from main.tsx into the Phaser SheepScene
 * and forwards dispatch calls back to the blockchain layer.
 */
import { useEffect, useRef, useState } from "react";
import { ChevronDown, RotateCcw, ShieldCheck, Trophy, WalletCards } from "lucide-react";
import { useNowMs, useStateBindings } from "@shared/react";
import type { PlayAreaProps } from "@shared/react";
import { PlayStage } from "@shared/components-react/v2";
import { LazyPhaserGameComponent as PhaserGameComponent } from "@framework/phaser/LazyPhaserGameComponent";
import { SETTLE_GRACE_MS } from "./logic/game-rules";
import { getLocale, type Locale } from "@shared/utils/i18n";
import "./PlayArea.scss";

// P2 (§9.4): mobile-first full-screen field — the scene is designed at
// 390×844 logical and letterbox-bleeds the meadow on other aspect ratios.
const GAME_CONFIG = {
  width: 390,
  height: 844,
  backgroundColor: "transparent",
  transparent: true,
} as const;

const loadSheepScene = () =>
  import("./scenes/SheepScene").then((module) => module.SheepScene);

interface SheepCardView {
  id: number;
  symbol?: number;
  exposed?: boolean;
  picked?: boolean;
}

function formatCountdown(ms: number): string {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}

export default function PhaserPlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { str, bool, val, num } = useStateBindings(state);
  const storedLanguage = val<Locale>("language", getLocale());
  const [drawerOpen, setDrawerOpen] = useState(false);
  // Player-facing language switch (zh / en). A local copy forces a re-render
  // that re-resolves every `t(...)` call and the Phaser `loc` dictionary; the
  // `languageChange` event keeps the shared framework locale in sync.
  const [lang, setLang] = useState<Locale>(() => {
    return storedLanguage;
  });
  useEffect(() => {
    const sync = (e: Event) => {
      const next = String((e as CustomEvent<{ language?: string }>).detail?.language ?? "");
      setLang(next.startsWith("zh") ? "zh" : "en");
    };
    window.addEventListener("languageChange", sync);
    return () => window.removeEventListener("languageChange", sync);
  }, []);
  const toggleLang = (): void => {
    const next: Locale = lang === "zh" ? "en" : "zh";
    setLang(next);
    void dispatch("setLanguage", next);
  };
  const drawerToggleRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);

  // Guest (free / local) mode surfaces from app.mode via main.tsx. When guest,
  // the panel drops all GAS-at-stake / pool / reward framing for local framing.
  const isGuest     = str("appMode", "guest") === "guest";
  const gameStatus  = str("gameStatus", "idle");
  const isDealing   = bool("isDealing");
  const isStarting  = bool("isStarting");
  const isSubmitting = bool("isSubmitting");
  const isGameOver  = bool("isGameOver");
  const failureReason = str("failureReason", "none");
  const isTeeBusy   = bool("isTeeBusy");
  const isRecovering = bool("isRecovering");
  const isFinancialAction = bool("isFinancialAction");
  const newPaidRunsEnabled = bool("newPaidRunsEnabled");
  const credit      = num("credit", 0);
  const poolFree    = num("poolFree", 0);
  const pileCards   = val<SheepCardView[]>("pileCards") ?? [];
  const slotCards   = val<unknown[]>("slotCards") ?? [];
  const activeGameId = str("activeGameId", "0");
  const startedAt   = num("startedAt", 0);
  const deadline    = num("deadline", 0);
  const undosUsed   = num("undosUsed", 0);
  const shuffleLeft = num("shuffleLeft", 1);
  const remove3Left = num("remove3Left", 1);
  // P1 — daily two-level challenge surface (the scene branches on these).
  const level       = num("level", 1);
  const playMode    = str("playMode", "practice");
  const revivesLeft = num("revivesLeft", 0);
  const dailyDate   = num("dailyDate", 0);
  // Guest grants a single free undo per run; GameFi keeps the contract's 3.
  const maxUndos    = isGuest ? 1 : 3;
  const hasClock = (gameStatus === "dealt" || gameStatus === "solved")
    && deadline > 0
    && (!isGuest || !isGameOver);
  const nowMs = useNowMs(1_000, {
    enabled: hasClock,
    resetKey: `${deadline}|${gameStatus}|${isGameOver}|${isGuest}|${startedAt}`,
  });
  const deadlineExpired = gameStatus === "dealt" && deadline > 0 && nowMs >= deadline;
  const releaseAt = deadline > 0 ? deadline + SETTLE_GRACE_MS : 0;
  const releaseRemainingMs = Math.max(0, releaseAt - nowMs);
  const cardsLeft   = pileCards.filter((card) => !card?.picked).length + slotCards.length;
  const trayUsed    = slotCards.length;
  const canRelease  = isGuest
    ? (gameStatus === "dealt" || isGameOver)
    : (gameStatus === "dealt" || gameStatus === "solved") && releaseAt > 0 && nowMs > releaseAt;
  const canWithdraw = !isGuest && credit > 0 && gameStatus !== "dealt" && !isFinancialAction;
  const exposedCards = pileCards.filter((card) => card.exposed && !card.picked).slice(0, 9);
  const boardBusy = isTeeBusy || isRecovering || isFinancialAction;

  useEffect(() => {
    if (!drawerOpen) return;
    drawerRef.current?.focus();
  }, [drawerOpen]);

  // Localized copy for the presentation-only Phaser scene. The scene never
  // calls t(); it reads these resolved strings via this.str/this.val so zh users
  // see translated in-canvas text. English defaults still live in the scene as
  // fallbacks. Interpolated subs (payout/credit) are passed as templates the
  // scene fills with values it already holds.
  // Guest play is untimed — the old "5:00/8:00/12:00" clock copy is gone.
  const diffTileCounts = [8, 12, 15];
  const loc = {
    title:    t("appEyebrow"),
    subtitle: t("boardTagline"),
    diffNames: [t("easyLabel"), t("mediumLabel"), t("hardLabel")],
    diffInfos: diffTileCounts.map((count) => t("tileTypesLabel", { count })),
    // P2 home view + HUD copy (scene renders these in-canvas).
    homeStartDaily:   t("homeStartDaily"),
    homePractice:     t("homePractice"),
    practiceTitle:    t("practiceTitle"),
    practiceBack:     t("practiceBack"),
    hudRemaining:     t("hudRemaining"),
    hudLevelPractice: t("hudLevelPractice"),
    hudLevelN:        t("hudLevelN"),
    // Guest boards carry no entry / reward: show the clear goal + a free tag
    // instead of "Entry 0.02 GAS" / "Win 0.10 GAS".
    diffEntries: isGuest
      ? diffTileCounts.map(() => t("freePlayLabel"))
      : !newPaidRunsEnabled
      ? diffTileCounts.map(() => t("paidRunsUnavailableShort"))
      : ["0.02", "0.10", "0.20"].map((amount) => t("entryAmount", { amount })),
    diffRewards: isGuest
      ? diffTileCounts.map((count) => t("clearGoalLabel", { count: count * 3 }))
      : !newPaidRunsEnabled
      ? diffTileCounts.map(() => t("recoverAction"))
      : ["0.10", "0.50", "1.00"].map((amount) => t("winAmount", { amount })),
    undo:     t("undoLabel"),
    shuffle:  t("shuffleLabel"),
    remove3:  t("remove3Label"),
    tray:     t("trayLabel"),
    loadTitle: gameStatus === "unknown"
      ? t("recoveryTitle")
      : isGuest ? t("guestDealing") : t("loadingBoard"),
    loadSub: gameStatus === "unknown"
      ? t("recoveryHint")
      : isGuest ? t("guestModeLine") : t("securingPuzzle"),
    progress:  t("progressStat"),
    matched:   t("matchedStat"),
    matchCleared: t("matchCleared"),
    matchCombo:   t("matchCombo"),
    wonTitle:      isGuest ? t("guestClearedTitle") : t("wonTitle"),
    creditedTitle: isGuest ? t("guestClearedTitle") : t("creditedTitle"),
    gameOverTitle: t("gameOverTitle"),
    boardClearedSub:  isGuest ? t("guestRunSub") : t("boardClearedSub"),
    boardVerifiedSub: isGuest ? t("guestRunSub") : t("boardVerifiedSub"),
    payoutSub:     t("payoutSub"),
    creditReadySub: t("creditReadySub"),
    trayFullSub:   t("trayFullSub"),
    timeUpTitle:   t("timeUpTitle"),
    timeUpSub:     isGuest ? t("guestTimeUpSub") : t("timeUpSub"),
    releaseReady:  t("releaseAction"),
    releaseWait:   t("releaseIn", { clock: formatCountdown(releaseRemainingMs) }),
    playAgain:    isGuest ? t("guestPlayAgainAction") : t("playAgainAction"),
    claim:        isGuest ? t("guestPlayAgainAction") : t("claimRewardAction"),
    withdraw:     t("withdrawShortAction"),
    backToRoutes: isGuest ? t("guestPlayAgainAction") : t("backToRoutesAction"),
    tryAgain:     t("tryAgainAction"),
    // P1 — daily two-level challenge copy (the scene renders these in-canvas;
    // without them the zh locale silently fell back to the English defaults).
    dailyChallengeTitle:   t("dailyChallengeTitle"),
    dailyChallengeSub:     t("dailyChallengeSub"),
    level1ClearedTitle:    t("level1ClearedTitle"),
    level1ClearedSub:      t("level1ClearedSub"),
    enterLevel2:           t("enterLevel2"),
    dailyFullyClearedTitle: t("dailyFullyClearedTitle"),
    dailyFullyClearedAny:  t("dailyFullyClearedAny"),
    reviveSub:             t("reviveSub"),
    reviveAction:          t("reviveAction"),
    retryLevel2Sub:        t("retryLevel2Sub"),
    retryLevel2:           t("retryLevel2"),
  };

  // Bridge state snapshot: all values must be plain (serializable)
  const bridgeState = {
    appMode: isGuest ? "guest" : "gamefi",
    activeGameId,
    startedAt,
    gameStatus,
    gameDifficulty: num("gameDifficulty", 0),
    pileCards,
    slotCards,
    dealtAt:        num("dealtAt", 0),
    deadline,
    shuffleLeft,
    remove3Left,
    undosUsed,
    isStarting,
    isDealing,
    isSubmitting,
    isPicking:      bool("isPicking"),
    isUndoing:      bool("isUndoing"),
    isMatching:     bool("isMatching"),
    isGameOver,
    failureReason,
    deadlineExpired,
    canExpire: canRelease,
    newPaidRunsEnabled,
    isTeeBusy,
    isRecovering,
    isFinancialAction,
    lastStatus:     str("lastStatus", ""),
    lastPayout:     str("lastPayout", ""),
    credit,
    poolFree,
    // P1 — daily two-level challenge state (SheepScene branches on playMode /
    // level / revivesLeft for the L1→L2 / revive / retry flows).
    level,
    playMode,
    revivesLeft,
    dailyDate,
    loc,
  };

  // Derive stage header text — guest drops the on-chain / GAS framing.
  const isLoading = isStarting || isDealing || gameStatus === "committed";
  const stageTitle = gameStatus === "unknown"
    ? t("recoveryTitle")
    : isLoading
    ? (isGuest ? t("guestDealing") : t("statusSealing"))
    : gameStatus === "solved"
    ? (isGuest ? t("guestClearedTitle") : t("statusSolved", { payout: str("lastPayout", "") }))
    : deadlineExpired || failureReason === "timeout"
    ? t("timeUpTitle")
    : isGameOver
    ? t("gameOverBanner")
    : gameStatus === "dealt"
    ? (isGuest ? t("guestDealtStage") : t("statusDealt"))
    : t("statusReady");

  const stageSubtitle = gameStatus === "unknown"
    ? t("recoveryHint")
    : deadlineExpired
    ? t("timeUpSub")
    : gameStatus === "dealt"
    ? (isGuest ? t("guestDealtStage") : t("statusDealt"))
    : t("rollDescription");

  const hudItems = [
    {
      label: gameStatus === "dealt"
        ? t("scoreCards")
        : (isGuest ? t("modeMetric") : t("poolMetric")),
      value: gameStatus === "dealt"
        ? String(cardsLeft)
        : (isGuest ? t("freePlayLabel") : `${poolFree.toFixed(2)} GAS`),
      accent: gameStatus === "dealt",
    },
    {
      // Untimed (guest) runs have no clock — surface the tray meter instead.
      label: gameStatus === "dealt" && deadline > 0 ? t("scoreTime") : t("trayMetric"),
      value: gameStatus === "dealt" && deadline > 0
        ? formatCountdown(deadline - nowMs)
        : `${trayUsed}/7`,
      accent: deadlineExpired || trayUsed >= 5,
    },
    {
      label: t("toolsMetric"),
      value: `${Math.max(0, maxUndos - undosUsed)} + ${shuffleLeft}/${remove3Left}`,
      accent: false,
    },
  ];

  const showRelease = isGuest
    ? canRelease
    : activeGameId !== "0" && (gameStatus === "committed" || deadlineExpired || isGameOver || canRelease);

  const drawerActions = [
    ...(showRelease
      ? [{
          label: isGuest
            ? t("guestResetAction")
            : canRelease ? t("expireGame") : t("releaseIn", { clock: formatCountdown(releaseRemainingMs) }),
          icon: <RotateCcw size={16} aria-hidden="true" />,
          onClick: () => void dispatch("expireGame"),
          disabled: !canRelease || boardBusy,
        }]
      : []),
    ...(gameStatus === "unknown"
      ? [{
          label: isRecovering ? t("recoveryTitle") : t("recoverAction"),
          icon: <RotateCcw size={16} aria-hidden="true" />,
          onClick: () => void dispatch("recoverGame"),
          disabled: isRecovering || isFinancialAction,
        }]
      : []),
    ...(canWithdraw
      ? [{
          label: t("withdrawAction", { amount: credit.toFixed(2) }),
          icon: <WalletCards size={16} aria-hidden="true" />,
          onClick: () => void dispatch("withdrawWinnings", {}),
          disabled: boardBusy,
        }]
      : []),
  ];

  return (
    <div className="sheep-playarea mx2 mx2-cat-game">
      <PlayStage
        category="game"
        className="sheep-playstage"
        stage={{
          eyebrow: t("rollTab"),
          title:   stageTitle,
          subtitle: stageSubtitle,
          badges: (
            <span className="mx2-badge" data-tone="accent">
              <span className="mx2-badge__dot" />
              {isGuest ? t("guestBadge") : (str("chainLabel", "") || "Neo")}
            </span>
          ),
        }}
        scene={
          <div className="sheep-stage-shell">
            <button
              type="button"
              className="sheep-lang-toggle"
              onClick={toggleLang}
              aria-label={lang === "zh" ? "Switch to English" : "切换到中文"}
              title={lang === "zh" ? "Switch to English" : "切换到中文"}
            >
              {lang === "zh" ? "EN" : "中"}
            </button>
            <PhaserGameComponent
              config={GAME_CONFIG}
              loadScene={loadSheepScene}
              state={bridgeState}
              dispatch={dispatch}
              className="sheep-phaser-canvas"
              ariaLabel={t("gameAriaLabel")}
              loadingLabel={t("gameLoadingLabel")}
              errorLabel={t("gameLoadError")}
              retryLabel={t("retryLoadAction")}
            />
            <p className="sheep-stage-live" aria-live="polite" aria-atomic="true">
              {stageTitle}. {stageSubtitle}
            </p>
            <section className="sheep-a11y-controls" aria-label={t("keyboardControls")}>
              {(gameStatus === "idle" || gameStatus === "expired" || gameStatus === "refunded") && (
                <div>
                  <button
                    type="button"
                    disabled={boardBusy || (!isGuest && !newPaidRunsEnabled)}
                    onClick={() => void dispatch("startGame", { mode: "daily", level: 1 })}
                  >
                    {t("dailyChallengeTitle")}
                  </button>
                  {[t("easyLabel"), t("mediumLabel"), t("hardLabel")].map((route, difficulty) => (
                    <button
                      type="button"
                      key={route}
                      disabled={boardBusy || (!isGuest && !newPaidRunsEnabled)}
                      onClick={() => void dispatch("startGame", { difficulty })}
                    >
                      {t("openRouteAction", { route })}
                    </button>
                  ))}
                </div>
              )}
              {gameStatus === "solved" && playMode === "daily" && level === 1 && (
                <button
                  type="button"
                  disabled={boardBusy}
                  onClick={() => void dispatch("advanceLevel")}
                >
                  {t("enterLevel2")}
                </button>
              )}
              {gameStatus === "dealt" && !isGameOver && !deadlineExpired && (
                <div>
                  {exposedCards.map((card, index) => (
                    <button
                      type="button"
                      key={card.id}
                      disabled={boardBusy || trayUsed >= 7}
                      onClick={() => void dispatch("pickCard", { cardId: card.id })}
                    >
                      {t("pickTileAction", {
                        index: index + 1,
                        symbol: Math.max(1, (card.symbol ?? 0) + 1),
                      })}
                    </button>
                  ))}
                  <button
                    type="button"
                    disabled={boardBusy || trayUsed === 0 || undosUsed >= maxUndos}
                    onClick={() => void dispatch("useUndo")}
                  >
                    {t("undoAction", { left: Math.max(0, maxUndos - undosUsed) })}
                  </button>
                  <button
                    type="button"
                    disabled={boardBusy || shuffleLeft <= 0}
                    onClick={() => void dispatch("useShuffle")}
                  >
                    {t("shuffleAction", { left: shuffleLeft })}
                  </button>
                  <button
                    type="button"
                    disabled={boardBusy || trayUsed < 3 || remove3Left <= 0}
                    onClick={() => void dispatch("useRemove3")}
                  >
                    {t("remove3Action", { left: remove3Left })}
                  </button>
                </div>
              )}
            </section>
            {gameStatus === "unknown" && (
              <div className="sheep-recovery-banner" role="status">
                <ShieldCheck size={18} aria-hidden="true" />
                <div>
                  <strong>{t("recoveryTitle")}</strong>
                  <span>{t("recoveryHint")}</span>
                </div>
                <button
                  type="button"
                  disabled={isRecovering || isFinancialAction}
                  onClick={() => void dispatch("recoverGame")}
                >
                  {isRecovering ? t("recoveryTitle") : t("recoverAction")}
                </button>
              </div>
            )}
            {!isGuest && !newPaidRunsEnabled && activeGameId === "0" && gameStatus === "idle" && (
              <div className="sheep-paid-pause" role="note">
                {t("paidRunsUnavailable")}
              </div>
            )}
            <div className="sheep-stage-hud" aria-label={t("routeSummary")}>
              {hudItems.map((item) => (
                <div
                  className="sheep-stage-hud__metric"
                  data-accent={item.accent ? "true" : undefined}
                  key={`${item.label}-${item.value}`}
                >
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
              ))}
              <button
                type="button"
                className="sheep-stage-hud__drawer"
                ref={drawerToggleRef}
                onClick={() => setDrawerOpen((open) => !open)}
                aria-expanded={drawerOpen}
                aria-controls="sheep-ingame-drawer"
              >
                <span>{t("historyTitle")}</span>
                <ChevronDown size={16} aria-hidden="true" data-open={drawerOpen ? "true" : undefined} />
              </button>
            </div>
            {drawerOpen && (
              <section
                className="sheep-ingame-drawer"
                id="sheep-ingame-drawer"
                ref={drawerRef}
                tabIndex={-1}
                aria-label={t("drawerTitle")}
                onKeyDown={(event) => {
                  if (event.key !== "Escape") return;
                  setDrawerOpen(false);
                  drawerToggleRef.current?.focus();
                }}
              >
                <div className="sheep-ingame-drawer__head">
                  <Trophy size={18} aria-hidden="true" />
                  <div>
                    <h3>{t("historyTitle")}</h3>
                    <p>{isGuest ? t("guestFairnessNote") : t("fairnessNote")}</p>
                  </div>
                </div>
                <div className="sheep-ingame-drawer__grid">
                  <span>
                    <small>{isGuest ? t("modeMetric") : t("creditLabel")}</small>
                    <strong>{isGuest ? t("freePlayLabel") : `${credit.toFixed(2)} GAS`}</strong>
                  </span>
                  <span>
                    <small>{t("scoreTime")}</small>
                    <strong>{deadline > 0 ? "Live" : "--"}</strong>
                  </span>
                  <span>
                    <small>{t("scoreCards")}</small>
                    <strong>{cardsLeft}</strong>
                  </span>
                  <span>
                    <small>{t("scoreUndos")}</small>
                    <strong>{Math.max(0, maxUndos - undosUsed)}</strong>
                  </span>
                </div>
                {drawerActions.length > 0 && (
                  <div className="sheep-ingame-drawer__actions">
                    {drawerActions.map((action) => (
                      <button
                        type="button"
                        key={action.label}
                        onClick={action.onClick}
                        disabled={action.disabled}
                      >
                        {action.icon}
                        <span>{action.label}</span>
                      </button>
                    ))}
                  </div>
                )}
                <div className="sheep-ingame-drawer__fairness">
                  <ShieldCheck size={17} aria-hidden="true" />
                  <p>
                    {isGuest
                      ? (activeGameId !== "0" ? t("guestActiveLine") : t("guestFairnessNote"))
                      : (activeGameId !== "0" ? t("activeGameLine", { gameId: activeGameId }) : t("fairnessShort"))}
                  </p>
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
