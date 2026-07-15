import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { ChevronDown, Flame, Trophy, WalletCards, X } from "lucide-react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import { PlayStage } from "@shared/components-react/v2";
import { LazyPhaserGameComponent as PhaserGameComponent } from "@framework/phaser/LazyPhaserGameComponent";
import "./PlayArea.scss";

interface P {
  t: (k: string, p?: Record<string, string | number>) => string;
  state: Record<string, Observable>;
  dispatch: (n: string, ...a: unknown[]) => Promise<void>;
}

const GAME_CONFIG = { width: 420, height: 600 } as const;
const loadBurnLeagueScene = () =>
  import("./scenes/BurnLeagueScene").then((module) => module.BurnLeagueScene);
const EMPTY_LEADERBOARD: LeaderboardEntry[] = [];
const BURN_PRESETS = ["1", "5", "10", "25"] as const;

interface LeaderboardEntry {
  address: string;
  burned: number;
  rank: number;
  isUser?: boolean;
}

interface SettleResult {
  won: boolean;
  amount: string;
  token: number;
}

type SeasonPhase = "dormant" | "active" | "ended";

function shortAddr(address: string): string {
  return address.length > 14 ? `${address.slice(0, 6)}...${address.slice(-4)}` : address;
}

function burnedAmount(entry: LeaderboardEntry): string {
  return Number.isFinite(entry.burned) ? `${entry.burned.toFixed(2)} GAS` : "--";
}

/** Strip a GAS suffix so guest (local) mode renders a bare heat number. */
function stripGas(value: string): string {
  return String(value ?? "").replace(/\s*GAS\b/i, "").trim() || "0";
}

export default function PhaserPlayArea({ t, state, dispatch }: P) {
  const { str, bool, num, val } = useStateBindings(state);
  // Two-mode surface: guest is a local burn-streak game with NO GAS / pool /
  // reward / season framing; gamefi copy stays exactly as-is.
  const mode = str("appMode", "gamefi");
  const guest = mode === "guest";
  const guestStreak = num("guestStreak", 0);
  const seasonPhase = (str("seasonPhase", "dormant") || "dormant") as SeasonPhase;
  const prizePoolDisplay = str("prizePoolDisplay", "0");
  const userBurnedDisplay = str("userBurnedDisplay", "0");
  const formattedRank = str("formattedRank", "--");
  const countdown = str("countdown", "00:00:00");
  const burnAmount = str("burnAmount", "1");
  const isBurning = bool("isBurning");
  const isSettling = bool("isSettling");
  const isLoading = bool("isLoading");
  const isConnectingWallet = bool("isConnectingWallet");
  const needsSettle = bool("needsSettle");
  const leagueDataAvailable = bool("leagueDataAvailable");
  const walletConnected = bool("walletConnected");
  const walletGasBalance = str("walletGasBalance", "0");
  const burnConfirmArmed = bool("burnConfirmArmed");
  const burnConfirmAmount = str("burnConfirmAmount", "");
  const burnTransactionState = str("burnTransactionState", "idle");
  const hasUnknownBurn = bool("hasUnknownBurn");
  const leaderboardPreview =
    val<LeaderboardEntry[]>("leaderboardPreview", EMPTY_LEADERBOARD) ?? EMPTY_LEADERBOARD;
  const serviceNotice = str("serviceNotice", "");
  const actionNotice = str("actionNotice", "");
  const burnValidationError = str("burnValidationError", "");
  const seasonStatusLabel = str("seasonStatusLabel", "");
  const formattedSeason = str("formattedSeason", "--");
  const seasonDurationLabel = str("seasonDurationLabel", "--");
  const leaderLabel = str("leaderLabel", "--");
  const topBurnedDisplay = str("topBurnedDisplay", "--");
  const projectedTotalDisplay = str("projectedTotalBurnedDisplay", "--");
  const prepaidCredit = num("prepaidCredit");
  const prepaidCreditDisplay = str("prepaidCreditDisplay", "0");
  const userIsLeader = bool("userIsLeader");
  const settleResult = val<SettleResult | null>("lastSettleResult");
  const hasLeaderboard = leaderboardPreview.length > 0;
  const topEntry = leaderboardPreview[0];
  // Guest "top run" = the best banked heat on the local board ("--" when none).
  const guestTopValue = Number(stripGas(topBurnedDisplay)) > 0 ? stripGas(topBurnedDisplay) : "--";
  const [celebration, setCelebration] = useState<SettleResult | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const lastCelebratedToken = useRef<number | null>(null);
  const drawerTriggerRef = useRef<HTMLButtonElement | null>(null);
  const drawerCloseRef = useRef<HTMLButtonElement | null>(null);
  const celebrationDismissRef = useRef<HTMLButtonElement | null>(null);
  const presetRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const runAction = useCallback((name: string, ...args: unknown[]) => {
    // The framework already turns rejected actions into a concise recovery
    // overlay/toast. Consume the rethrow here so keyboard and drawer controls
    // never add an unhandled promise rejection on top of that feedback.
    void dispatch(name, ...args).catch(() => {
      /* MiniAppRoot already displayed the action failure. */
    });
  }, [dispatch]);

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
    drawerTriggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!settleResult || settleResult.token === lastCelebratedToken.current) return;
    lastCelebratedToken.current = settleResult.token;
    setCelebration(settleResult);
  }, [settleResult]);

  useEffect(() => {
    if (!drawerOpen) return;
    drawerCloseRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      closeDrawer();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [closeDrawer, drawerOpen]);

  useEffect(() => {
    if (celebration) celebrationDismissRef.current?.focus();
  }, [celebration]);

  const bridgeState = {
    seasonPhase,
    prizePoolDisplay,
    userBurnedDisplay,
    formattedRank,
    countdown,
    burnAmount,
    isBurning,
    isSettling,
    isLoading,
    isConnectingWallet,
    needsSettle,
    leagueDataAvailable,
    walletConnected,
    walletGasBalance,
    burnConfirmArmed,
    burnConfirmAmount,
    burnTransactionState,
    hasUnknownBurn,
    leaderboardPreview,
    serviceNotice,
    actionNotice,
    burnValidationError,
    seasonStatusLabel,
    formattedSeason,
    seasonDurationLabel,
    leaderLabel,
    topBurnedDisplay,
    minBurnGas: num("minBurnGas"),
    maxBurnGas: num("maxBurnGas"),
    prepaidCredit,
    prepaidCreditDisplay,
    // Two-mode surface + localized guest labels the scene swaps in (gamefi
    // ignores them). Passing them (not hardcoding in-scene) keeps the canvas
    // guest copy localized in every locale.
    appMode: mode,
    guestStreak,
    guestPoolLabel: t("guestBest"),
    guestSeasonLabel: t("guestStreakLabel"),
    guestRunLabel: t("guestRun"),
    guestBoardLabel: t("guestBoardTitle"),
    guestEmptyLabel: t("guestNoRuns"),
    guestBurnVerb: t("guestStokeVerb"),
    guestBankAction: t("guestBankAction"),
    guestUnit: t("guestHeatUnit"),
    guestStokingAction: t("guestStoking"),
    guestIntroAction: t("guestIntro"),
    settleAction: t("settleSeason"),
    connectAction: t("burnConnectAction"),
    connectingAction: t("burnConnectingAction"),
    igniteAction: t("burnIgniteAction", { amount: burnAmount }),
    confirmBurnAction: t("burnConfirmAction", { amount: burnAmount }),
    recheckBurnAction: t("burnRecheckAction"),
    checkingBurnAction: t("burnCheckingAction"),
    burningAction: t("burning"),
    burnInsufficientHint: t("burnInsufficientHint"),
    tokenGasLabel: t("tokenGas"),
    sceneText: {
      poolLabel: t("prizePool"),
      seasonLabel: t("seasonLabel"),
      burnedLabel: t("youBurned"),
      rankLabel: t("rank"),
      rankUnranked: t("rankUnranked"),
      boardTitle: t("leaderboard"),
      emptyBoard: t("sceneNoBurns"),
      fuelLabel: t("burnPresets"),
      phaseEnded: t("seasonEnded"),
      phaseDormant: t("startPool"),
      ready: t("sceneReady"),
      walletBurning: t("sceneWalletBurning"),
      endedStatus: t("sceneEndedStatus"),
      dormantStatus: t("sceneDormantStatus"),
      emptyStatus: t("sceneEmptyStatus"),
      activeStatus: t("sceneActiveStatus"),
      guestContinue: t("sceneGuestContinue"),
    },
  };

  const seasonLine =
    seasonPhase === "active"
      ? `${t("seasonEndsIn")} ${countdown} - ${t("seasonLengthLabel")}: ${seasonDurationLabel}`
      : seasonPhase === "ended"
        ? t("seasonEndedHint", { amount: prizePoolDisplay })
        : seasonDurationLabel !== "--"
          ? t("seasonDormantHintWithLength", { length: seasonDurationLabel })
          : t("seasonDormantHint");

  const stageTitle = guest
    ? isBurning
      ? t("burning")
      : t("guestStageTitle")
    : isConnectingWallet
      ? t("burnConnectingAction")
      : hasUnknownBurn
        ? t("burnCheckingTitle")
        : burnConfirmArmed
          ? t("burnConfirmTitle")
    : isBurning
      ? t("burning")
      : needsSettle
        ? t("settleSeason")
        : userIsLeader
          ? t("youLeadBadge")
          : t("readyToBurn");

  const leaderDisplay = topEntry
    ? shortAddr(topEntry.address)
    : leaderLabel !== "--"
      ? shortAddr(leaderLabel)
      : t("noLeaderYet");
  const scoreItems = guest ? [
    { label: t("guestBest"), value: stripGas(prizePoolDisplay), accent: true },
    { label: t("guestRun"), value: stripGas(userBurnedDisplay) },
    { label: t("yourRank"), value: formattedRank },
    { label: t("guestTopRun"), value: guestTopValue },
  ] : [
    { label: t("prizePool"), value: prizePoolDisplay, accent: true },
    { label: t("youBurned"), value: userBurnedDisplay },
    { label: t("yourRank"), value: formattedRank },
    { label: t("currentLeader"), value: leaderDisplay },
  ];
  const drawerTitle = guest ? t("guestBoardTitle") : t("leaderboard");
  const drawerId = "burn-league-ingame-drawer";
  const minBurnGas = num("minBurnGas", 1);
  const maxBurnGas = num("maxBurnGas", 1_000);
  const burnValue = Number(burnAmount);
  const walletGas = Number(walletGasBalance);
  const hasEnoughFunding = guest || (
    Number.isFinite(burnValue) &&
    Number.isFinite(walletGas) &&
    walletGas + prepaidCredit >= burnValue
  );
  const canSelectFuel =
    !isBurning &&
    !isSettling &&
    !isLoading &&
    !isConnectingWallet &&
    !hasUnknownBurn;
  const primaryAction: "connect" | "burn" | "settle" | "recheck" = guest
    ? "burn"
    : !walletConnected
      ? "connect"
      : hasUnknownBurn
        ? "recheck"
        : needsSettle
          ? "settle"
          : "burn";
  const confirmingThisAmount = burnConfirmArmed && burnConfirmAmount === burnAmount;
  const primaryActionLabel = primaryAction === "connect"
    ? isConnectingWallet ? t("burnConnectingAction") : t("burnConnectAction")
    : primaryAction === "recheck"
      ? burnTransactionState === "broadcast" ? t("burnCheckingAction") : t("burnRecheckAction")
      : primaryAction === "settle"
        ? t("settleSeason")
        : isBurning
          ? t("burning")
          : guest
            ? `${t("guestStokeVerb")} ${burnAmount}`
            : confirmingThisAmount
              ? t("burnConfirmAction", { amount: burnAmount })
              : t("burnIgniteAction", { amount: burnAmount });
  const canBurn =
    seasonPhase !== "ended" &&
    !isBurning &&
    !isSettling &&
    !isLoading &&
    !isConnectingWallet &&
    (guest || walletConnected) &&
    (guest || leagueDataAvailable) &&
    (guest || !serviceNotice) &&
    (guest || !hasUnknownBurn) &&
    !burnValidationError &&
    Number.isFinite(burnValue) &&
    burnValue >= minBurnGas &&
    burnValue <= maxBurnGas &&
    hasEnoughFunding;
  const primaryDisabled = primaryAction === "connect"
    ? guest || walletConnected || isConnectingWallet || isBurning || isSettling
    : primaryAction === "recheck"
      ? guest || !walletConnected || !hasUnknownBurn || isLoading || isBurning || isSettling
      : primaryAction === "settle"
        ? guest || !walletConnected || !needsSettle || hasUnknownBurn || isLoading || isBurning || isSettling
        : !canBurn;
  const liveStatus =
    burnValidationError ||
    actionNotice ||
    serviceNotice ||
    (!guest && walletConnected && !hasEnoughFunding ? t("burnInsufficientHint") : "") ||
    primaryActionLabel;

  const invokePrimary = () => {
    if (primaryAction === "connect") runAction("connectWallet");
    else if (primaryAction === "recheck") runAction("recheckBurn");
    else if (primaryAction === "settle") runAction("settle");
    else runAction("burn", burnAmount);
  };

  const handlePresetKeyDown = (
    event: ReactKeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    const direction =
      event.key === "ArrowRight" || event.key === "ArrowDown"
        ? 1
        : event.key === "ArrowLeft" || event.key === "ArrowUp"
          ? -1
          : 0;
    if (direction === 0 || !canSelectFuel) return;
    event.preventDefault();
    const nextIndex = (index + direction + BURN_PRESETS.length) % BURN_PRESETS.length;
    presetRefs.current[nextIndex]?.focus();
    runAction("setBurnAmount", BURN_PRESETS[nextIndex]);
  };

  return (
    <div className="burn-league-play-area mx2 mx2-cat-game">
      <PlayStage
        category="game"
        className="burn-phaser-stage"
        stage={{
          eyebrow: guest
            ? t("guestEyebrow")
            : seasonPhase === "active"
              ? t("liveLeague")
              : seasonStatusLabel || t("seasonStatus"),
          title: stageTitle,
          subtitle: guest ? t("guestSubtitle") : t("subtitle"),
          badges: guest ? (
            <>
              {guestStreak > 0 && (
                <span className="mx2-badge" data-tone="success">
                  <Flame size={14} aria-hidden="true" /> {t("guestStreakBadge", { streak: guestStreak })}
                </span>
              )}
            </>
          ) : (
            <>
              {formattedSeason !== "--" && (
                <span className="mx2-badge" data-tone="accent">
                  <span className="mx2-badge__dot" /> {t("seasonLabel")} {formattedSeason}
                </span>
              )}
              {seasonPhase === "active" && (
                <span className="mx2-badge" data-tone="success">
                  <Flame size={14} aria-hidden="true" /> {t("seasonEndsIn")} {countdown}
                </span>
              )}
              {userIsLeader && (
                <span className="mx2-badge" data-tone="success">
                  <Trophy size={14} aria-hidden="true" /> {t("youLeadBadge")}
                </span>
              )}
            </>
          ),
        }}
        scene={
          <div className="burn-stage-shell">
            <div className="burn-game-surface">
              <PhaserGameComponent
                config={GAME_CONFIG}
                loadScene={loadBurnLeagueScene}
                state={bridgeState}
                dispatch={dispatch}
                className="burn-phaser-canvas"
                ariaLabel={t("arenaAlt")}
                loadingLabel={t("burnArenaLoading")}
                errorLabel={t("gameActionFailed")}
                retryLabel={t("retry")}
                continueLabel={t("continue")}
                enableSoundLabel={t("enableGameSound")}
                muteSoundLabel={t("muteGameSound")}
              />

              <div className="burn-a11y-layer">
                <div
                  className="burn-a11y-presets"
                  role="radiogroup"
                  aria-label={t("burnPresets")}
                >
                  {BURN_PRESETS.map((amount, index) => {
                    const selected = burnAmount === amount;
                    return (
                      <button
                        key={amount}
                        ref={(node) => {
                          presetRefs.current[index] = node;
                        }}
                        type="button"
                        role="radio"
                        className="burn-a11y-hit burn-a11y-preset"
                        data-index={index}
                        aria-checked={selected}
                        aria-label={`${t("burnPresets")}: ${amount}`}
                        tabIndex={selected ? 0 : -1}
                        disabled={!canSelectFuel}
                        onClick={() => runAction("setBurnAmount", amount)}
                        onKeyDown={(event) => handlePresetKeyDown(event, index)}
                      >
                        <span>{amount}</span>
                      </button>
                    );
                  })}
                </div>
                <button
                  type="button"
                  className="burn-a11y-hit burn-a11y-primary"
                  aria-label={primaryActionLabel}
                  disabled={primaryDisabled}
                  onClick={invokePrimary}
                >
                  <span>{primaryActionLabel}</span>
                </button>
              </div>
              <p className="burn-a11y-status" aria-live="polite" aria-atomic="true">
                {liveStatus}
              </p>
            </div>

            <div className="burn-stage-hud" aria-label={drawerTitle}>
              {scoreItems.map((item, index) =>
                guest && guestStreak > 0 && index === scoreItems.length - 1 ? (
                  <button
                    type="button"
                    className="burn-stage-hud__bank"
                    key="bank-guest-run"
                    disabled={isBurning || isSettling || isLoading}
                    onClick={() => runAction("bankGuestRun")}
                  >
                    <Trophy size={15} aria-hidden="true" />
                    <span>{t("guestBankAction")}</span>
                  </button>
                ) : (
                  <div
                    className="burn-stage-hud__metric"
                    data-accent={item.accent ? "true" : undefined}
                    key={`${item.label}-${item.value}`}
                  >
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                  </div>
                ),
              )}
              <button
                ref={drawerTriggerRef}
                type="button"
                className="burn-stage-hud__drawer"
                onClick={() => {
                  if (drawerOpen) closeDrawer();
                  else setDrawerOpen(true);
                }}
                aria-expanded={drawerOpen}
                aria-controls={drawerId}
              >
                <span>{drawerTitle}</span>
                <ChevronDown size={15} data-open={drawerOpen ? "true" : undefined} aria-hidden="true" />
              </button>
            </div>

            {drawerOpen && (
              <section id={drawerId} className="burn-ingame-drawer" aria-label={drawerTitle}>
                <button
                  ref={drawerCloseRef}
                  type="button"
                  className="burn-drawer__close"
                  onClick={closeDrawer}
                  aria-label={t("closeDrawer")}
                >
                  <X size={17} aria-hidden="true" />
                </button>
                <div className="burn-drawer">
                  {guest ? (
                    <section className="burn-drawer__summary" aria-label={t("guestBoardTitle")}>
                      <h4>{t("guestSummaryTitle")}</h4>
                      <p>{t("guestSummaryLine")}</p>
                      <dl className="burn-drawer__metrics">
                        <div>
                          <dt>{t("guestBest")}</dt>
                          <dd>{stripGas(prizePoolDisplay)}</dd>
                        </div>
                        <div>
                          <dt>{t("guestStreakLabel")}</dt>
                          <dd>{guestStreak > 0 ? `x${guestStreak}` : "--"}</dd>
                        </div>
                        <div>
                          <dt>{t("guestTopRun")}</dt>
                          <dd>{guestTopValue}</dd>
                        </div>
                      </dl>
                    </section>
                  ) : (
                    <section className="burn-drawer__summary" aria-label={t("seasonStatus")}>
                      <h4>{t("seasonLabel")} {formattedSeason}</h4>
                      <p>{seasonLine}</p>
                      <dl className="burn-drawer__metrics">
                        <div>
                          <dt>{t("prizePool")}</dt>
                          <dd>{prizePoolDisplay}</dd>
                        </div>
                        <div>
                          <dt>{t("currentLeader")}</dt>
                          <dd>{leaderDisplay}</dd>
                        </div>
                        <div>
                          <dt>{t("burned")}</dt>
                          <dd>{topBurnedDisplay}</dd>
                        </div>
                      </dl>
                    </section>
                  )}

                  <section
                    className="burn-drawer__board"
                    aria-label={guest ? t("guestBoardTitle") : t("leaderboard")}
                  >
                    <h4>{guest ? t("guestBoardTitle") : t("leaderboard")}</h4>
                    {hasLeaderboard ? (
                      <ul className="mx2-history burn-drawer__leaderboard">
                        {leaderboardPreview.slice(0, 10).map((entry) => (
                          <li
                            key={entry.address}
                            className={[
                              "mx2-history__item",
                              entry.rank <= 3 ? "mx2-history__item--podium" : null,
                              entry.isUser ? "mx2-history__item--you" : null,
                            ].filter(Boolean).join(" ")}
                            data-rank={entry.rank}
                          >
                            <span className="mx2-history__face" aria-hidden="true">#{entry.rank}</span>
                            <span className="mx2-history__stake">
                              {shortAddr(entry.address)}
                              {entry.isUser && (
                                <em className="burn-drawer__you-tag"> {guest ? t("guestYouTag") : t("youBurned")}</em>
                              )}
                            </span>
                            <span className="mx2-history__result">
                              {guest ? `${entry.burned.toFixed(0)} ${t("guestHeatUnit")}` : burnedAmount(entry)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="burn-drawer__empty">{guest ? t("guestNoRuns") : t("noEntries")}</p>
                    )}
                  </section>

                  {guest ? (
                    <section className="burn-drawer__rules" aria-label={t("guestHowTitle")}>
                      <h4>{t("guestHowTitle")}</h4>
                      <ol className="burn-drawer__steps">
                        <li>{t("guestStepPick")}</li>
                        <li>{t("guestStepStoke")}</li>
                        <li>{t("guestStepStreak")}</li>
                        <li>{t("guestStepBank")}</li>
                      </ol>
                    </section>
                  ) : (
                    <section className="burn-drawer__rules" aria-label={t("howItWorks")}>
                      <h4>{t("howItWorks")}</h4>
                      <ol className="burn-drawer__steps">
                        <li>{t("howStepPick")}</li>
                      <li>{t("howStepBurn")}</li>
                      <li>{t("howStepClimb")}</li>
                      <li>{t("howStepWin")}</li>
                      <li>{t("tieRule")}</li>
                    </ol>
                    </section>
                  )}

                  {guest ? (
                    <p className="burn-drawer__note">{t("guestNextStoke")}: {stripGas(projectedTotalDisplay)}</p>
                  ) : (
                    projectedTotalDisplay !== "--" && (
                      <p className="burn-drawer__note">{t("projectedTotal")}: {projectedTotalDisplay}</p>
                    )
                  )}

                  {!guest && prepaidCredit > 0 && walletConnected && (
                    <section className="burn-drawer__credit" aria-label={t("prepaidCreditLabel")}>
                      <span>
                        {t("prepaidCreditLabel")}: <strong>{prepaidCreditDisplay}</strong>
                        <em>{t("prepaidCreditHint")}</em>
                      </span>
                      <button
                        type="button"
                        className="mx2-btn mx2-btn--ghost"
                        disabled={isLoading || isBurning || isSettling || hasUnknownBurn}
                        onClick={() => runAction("withdrawCredit")}
                      >
                        <WalletCards size={16} aria-hidden="true" />
                        {t("withdrawCredit")}
                      </button>
                    </section>
                  )}
                </div>
              </section>
            )}
          </div>
        }
        actions={{}}
      />
      {celebration && (
        <div
          className="burn-celebrate"
          role="dialog"
          aria-modal="true"
          aria-labelledby="burn-celebration-title"
          aria-describedby="burn-celebration-body"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              setCelebration(null);
            } else if (event.key === "Tab") {
              event.preventDefault();
              celebrationDismissRef.current?.focus();
            }
          }}
        >
          <div className="burn-celebrate__card mx2-rise-in">
            <div className="burn-celebrate__medal mx2-float">
              <Trophy size={34} aria-hidden="true" />
            </div>
            <h3 id="burn-celebration-title">
              {celebration.won ? t("settleWinTitle") : t("settleDoneTitle")}
            </h3>
            <p className="burn-celebrate__amount">{celebration.amount}</p>
            <p id="burn-celebration-body" className="burn-celebrate__body">
              {celebration.won
                ? t("settleWinBody", { amount: celebration.amount })
                : t("settleDoneBody", { amount: celebration.amount })}
            </p>
            <button
              ref={celebrationDismissRef}
              type="button"
              className="mx2-btn mx2-btn--primary"
              onClick={() => setCelebration(null)}
            >
              {t("celebrationDismiss")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
