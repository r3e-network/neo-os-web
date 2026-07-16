import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { useNowMs, useStateBindings } from "@shared/react";
import type { PlayAreaProps } from "@shared/react";
import { PlayStage } from "@shared/components-react/v2";
import { LazyPhaserGameComponent as PhaserGameComponent } from "@framework/phaser/LazyPhaserGameComponent";
import { clampDifficulty } from "@framework/game-rules";
import { ChevronDown, Coins, RefreshCw, ShieldCheck, WalletCards, X } from "lucide-react";
import {
  canReleaseExpiredGame,
  formatClock,
  gasDisplay,
  payoutFixed8,
  releaseAtOf,
  ruleOf,
  SETTLEMENT_GRACE_MS,
} from "./logic/game-rules";
import "./PlayArea.scss";

const GAME_CONFIG = { width: 420, height: 580 } as const;
const loadColorClashScene = () =>
  import("./scenes/ColorClashScene").then((module) => module.ColorClashScene);
const DIFF_KEYS = ["easy", "medium", "hard"] as const;

interface LeaderRow {
  address?: string;
  player?: string;
  rank?: number;
  totalWon?: number;
  solves?: number;
  solved?: number;
  isUser?: boolean;
}

interface HistoryRow {
  gameId: string;
  difficulty: number;
  payout: number | string;
  solveMs: number;
  undos: number;
  seqAchieved: number;
}

function shortAddr(addr: string): string {
  return addr.length > 14 ? `${addr.slice(0, 8)}...${addr.slice(-4)}` : addr;
}

function gasAmountDisplay(amount: number): string {
  if (!Number.isFinite(amount)) return "0.00";
  return amount.toLocaleString("en-US", {
    minimumFractionDigits: Math.abs(amount) >= 10 ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

function payoutDisplay(value: number | string): string {
  return typeof value === "number" ? `${gasDisplay(value)} GAS` : value;
}

export default function PhaserPlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { str, bool, val, num } = useStateBindings(state);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const difficultyRadioRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const gameStatus = str("gameStatus", "idle");
  const gameDifficulty = clampDifficulty(num("gameDifficulty"));
  const selectedDifficulty = clampDifficulty(
    val<number>("selectedDifficulty", gameDifficulty) ?? gameDifficulty,
  );
  const activeGameId = str("activeGameId", "0");
  const sequence = str("sequence", "");
  const playerSequence = str("playerSequence", "");
  const commitment = str("commitment", "");
  const appMode = str("appMode", "guest");
  const isGuest = appMode === "guest";
  const deadline = val<number>("deadline", 0) ?? 0;
  const dealtAt = val<number>("dealtAt", 0) ?? 0;
  const undosUsed = val<number>("undosUsed", 0) ?? 0;
  const seqAchieved = val<number>("seqAchieved", 0) ?? 0;
  const roundNumber = val<number>("roundNumber", 0) ?? 0;
  const roundPhase = str("roundPhase", "lobby");
  const poolFree = val<number>("poolFree", 0) ?? 0;
  const credit = val<number>("credit", 0) ?? 0;
  const myRank = val<number>("myRank", 0) ?? 0;
  const myTotalWon = val<number>("myTotalWon", 0) ?? 0;
  const mySolves = val<number>("mySolves", 0) ?? 0;
  const leaderboard = val<LeaderRow[]>("leaderboard", []) ?? [];
  const myHistory = val<HistoryRow[]>("myHistory", []) ?? [];
  const isStarting = bool("isStarting");
  const isDealing = bool("isDealing");
  const isSubmitting = bool("isSubmitting");
  const isPressing = bool("isPressing");
  const isRecovering = bool("isRecovering");
  const settlementGraceMs = val<number>("settlementGraceMs", SETTLEMENT_GRACE_MS)
    ?? SETTLEMENT_GRACE_MS;
  const lastStatus = str("lastStatus", "");
  // Platform credits (Credits v2) — GameFi-only, hidden when the host injects
  // no credits config (dev/standalone) and always hidden in guest mode.
  const creditsAvailable = bool("creditsAvailable");
  const creditsBalance = val<number>("creditsBalance", -1) ?? -1;
  const creditsStale = bool("creditsStale");
  const creditsBusy = bool("creditsBusy");
  const creditsNeedsTopUp = bool("creditsNeedsTopUp");
  const creditsReviveEnabled = bool("creditsReviveEnabled");
  const creditsReviveCost = val<number>("creditsReviveCost", 5) ?? 5;
  const creditsBuyGas = val<number>("creditsBuyGas", 1) ?? 1;
  const creditsBuyCredits = val<number>("creditsBuyCredits", 50) ?? 50;
  const creditsRate = val<number>("creditsRate", 50) ?? 50;
  const isLobby = ["idle", "solved", "expired", "refunded"].includes(gameStatus);
  const activeDifficulty = isLobby ? selectedDifficulty : gameDifficulty;
  const rule = ruleOf(activeDifficulty);
  const isPlaying = gameStatus === "dealt";
  const dealPending = gameStatus === "committed" || lastStatus === "deal-pending";
  const timedSession = isPlaying || dealPending;
  const settlementPending = !isGuest && (
    gameStatus === "unknown" || lastStatus === "settlement-pending"
  );
  // The lobby can stay open for minutes; the clock re-anchors as soon as a
  // fresh deadline arrives so the first rendered value is never inflated.
  const nowMs = useNowMs(1_000, {
    enabled: (timedSession || settlementPending) && deadline > 0,
    resetKey: `${deadline}|${timedSession}|${settlementPending}`,
  });
  const remainingMs = deadline > 0 ? Math.max(0, deadline - nowMs) : 0;
  const timeUp = timedSession && deadline > 0 && remainingMs <= 0;
  const recoveryPending = !isGuest && (
    settlementPending || (timedSession && (roundPhase === "wrong" || timeUp))
  );
  const releaseRemainingMs = recoveryPending
    ? Math.max(0, releaseAtOf(deadline, settlementGraceMs) - nowMs)
    : 0;
  const isSolved = gameStatus === "solved";
  const busy = isStarting || isDealing || isSubmitting || isPressing || isRecovering;
  const releaseReady = !isGuest && canReleaseExpiredGame(
    deadline,
    settlementGraceMs,
    nowMs,
  );
  const completedSequence = roundPhase === "complete" || lastStatus === "all-correct";
  // Credits UI gates: the chip needs only a configured host + GameFi mode;
  // the retry offer additionally needs a settled failed run AND a game whose
  // paid starts are currently enabled (never sell a retry that start refuses).
  const showCreditsChip = !isGuest && creditsAvailable;
  const showCreditsOffer = showCreditsChip
    && creditsReviveEnabled
    && (gameStatus === "expired" || gameStatus === "refunded");
  const creditsInsufficient = creditsNeedsTopUp
    || (creditsBalance >= 0 && creditsBalance < creditsReviveCost);
  const creditsBalanceDisplay = creditsBalance >= 0 ? String(creditsBalance) : "--";
  const canPressPads = isPlaying
    && roundPhase === "input"
    && !busy
    && !timeUp
    && playerSequence.length < sequence.length;
  const guestProgress = Math.max(seqAchieved, playerSequence.length);
  const guestTopScore = leaderboard.reduce(
    (best, entry) => Math.max(best, Number(entry.totalWon ?? 0)),
    Math.max(0, myTotalWon),
  );

  useEffect(() => {
    if (!drawerOpen) return undefined;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDrawerOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [drawerOpen]);

  const difficultyOptions = DIFF_KEYS.map((key, index) => ({
    id: index,
    label: t(`difficulty_${key}`),
    target: t("targetSeqLabel", { count: ruleOf(index).targetSeq }),
  }));
  const colorLabels = [t("color_red"), t("color_blue"), t("color_green"), t("color_yellow")];

  const handleDifficultyKeyDown = (
    event: ReactKeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    if (!isLobby || busy) return;
    const direction =
      event.key === "ArrowRight" || event.key === "ArrowDown"
        ? 1
        : event.key === "ArrowLeft" || event.key === "ArrowUp"
          ? -1
          : 0;
    if (direction === 0) return;
    event.preventDefault();
    const nextIndex = (index + direction + difficultyOptions.length) % difficultyOptions.length;
    difficultyRadioRefs.current[nextIndex]?.focus();
    void dispatch("setDifficulty", nextIndex);
  };

  const semanticPrimary: {
    action: string;
    args?: unknown[];
    disabled: boolean;
    label: string;
  } | null = (() => {
    if (dealPending && timeUp) {
      return {
        action: "expireGame",
        disabled: busy || !releaseReady,
        label: releaseReady ? t("releaseAction") : t("releaseWaitAction"),
      };
    }
    if (dealPending) {
      return {
        action: "retryDeal",
        disabled: busy,
        label: isDealing ? t("statusShuffling") : t("checkDealAgain"),
      };
    }
    if (isLobby) {
      return {
        action: "startGame",
        args: [selectedDifficulty],
        disabled: busy,
        label: isStarting ? t("statusShuffling") : t("startAction"),
      };
    }
    if (settlementPending) {
      return releaseReady
        ? { action: "expireGame", disabled: busy, label: t("releaseAction") }
        : {
            action: "checkSettlement",
            disabled: busy,
            label: isRecovering ? t("settlementCheckingTitle") : t("checkSettlementAction"),
          };
    }
    if (completedSequence) {
      return {
        action: "submitSolution",
        disabled: busy || timeUp,
        label: isSubmitting
          ? (isGuest ? t("guestStatusSaving") : t("statusSubmitting"))
          : (isGuest ? t("guestSubmitAction") : t("submitAction")),
      };
    }
    if (isGuest && roundPhase === "wrong") {
      return {
        action: "startGame",
        args: [selectedDifficulty],
        disabled: busy,
        label: t("guestRestartAction"),
      };
    }
    if (roundPhase === "wrong" || timeUp) {
      return {
        action: "expireGame",
        disabled: busy || (!isGuest && !releaseReady),
        label: isGuest
          ? t("guestRestartAction")
          : releaseReady
            ? t("releaseAction")
            : t("releaseWaitAction"),
      };
    }
    return null;
  })();

  const bridgeState = {
    appMode,
    activeGameId,
    gameStatus,
    gameDifficulty,
    selectedDifficulty,
    sequence,
    playerSequence,
    commitment,
    deadline,
    dealtAt,
    undosUsed,
    seqAchieved,
    roundNumber,
    roundPhase,
    isPressing,
    isStarting,
    isDealing,
    isSubmitting,
    isRecovering,
    settlementGraceMs,
    poolFree,
    credit,
    lastStatus,
    actionStart: t("startAction"),
    actionStarting: t("statusShuffling"),
    actionSubmit: isGuest ? t("guestSubmitAction") : t("submitAction"),
    actionSubmitting: isGuest ? t("guestStatusSaving") : t("statusSubmitting"),
    actionRetry: t("checkDealAgain"),
    actionCheckSettlement: t("checkSettlementAction"),
    actionRelease: t("releaseAction"),
    actionReleaseWait: t("releaseWaitAction"),
    actionTimeUp: t("timeUpAction"),
    actionRestart: t("guestRestartAction"),
    phaseReady: t("sceneReady"),
    phaseWatch: t("sceneWatch"),
    phaseRepeat: t("sceneRepeat"),
    phaseWrong: t("sceneWrong"),
    phaseCorrect: t("sceneCorrect"),
    phaseWin: t("sceneWin"),
    phaseEnd: t("sceneEnd"),
    roundLabel: t("roundLabel"),
    statusWatch: t("watchPhase"),
    statusRepeat: t("repeatKeyboardHint"),
    statusWrong: t("wrongPress"),
    statusComplete: t("guestSubmitHint"),
    statusReleaseWait: t("releaseWaitStatus"),
    statusReleaseReady: t("releaseReadyStatus"),
    colorRed: t("color_red"),
    colorBlue: t("color_blue"),
    colorGreen: t("color_green"),
    colorYellow: t("color_yellow"),
    modeEasy: t("difficulty_easy"),
    modeMedium: t("difficulty_medium"),
    modeHard: t("difficulty_hard"),
    modeEasyTarget: t("targetSeqLabel", { count: 8 }),
    modeMediumTarget: t("targetSeqLabel", { count: 12 }),
    modeHardTarget: t("targetSeqLabel", { count: 16 }),
  };

  const stageTitle = isGuest
    ? isSubmitting
      ? t("guestStatusSaving")
      : isPlaying && roundPhase === "wrong"
        ? t("guestFailedTitle")
        : isPlaying && roundPhase === "watching"
          ? t("watchPhase")
          : isPlaying && roundPhase === "input"
            ? t("repeatPhase")
            : isPlaying && roundPhase === "complete"
              ? t("guestSolvedTitle")
              : isPlaying
                ? t("guestPlayingTitle")
        : isSolved
          ? t("guestSolvedTitle")
          : gameStatus === "expired" || gameStatus === "refunded"
            ? t("guestExpiredTitle")
            : t("guestLobbyTitle")
    : isSubmitting
      ? t("statusSubmitting")
      : isRecovering
        ? t("settlementCheckingTitle")
      : recoveryPending
          ? t("releaseWaitTitle")
        : isDealing || dealPending
          ? t("statusShuffling")
        : isPlaying && roundPhase === "watching"
          ? t("watchPhase")
          : isPlaying && roundPhase === "wrong"
            ? t("wrongPress")
            : isPlaying
              ? t("repeatPhase")
          : isSolved
            ? t("statusWonTitle")
            : gameStatus === "expired" || gameStatus === "refunded"
              ? t("expiredBanner")
            : t("lobbyTitle");

  const scoreItems = isGuest
    ? [
        {
          label: t("guestProgressLabel"),
          value: `${guestProgress}/${rule.targetSeq}`,
          accent: true,
        },
        {
          label: t("scoreTime"),
          value: isPlaying && deadline > 0 ? formatClock(remainingMs) : formatClock(rule.limitMs),
        },
        {
          // No local best yet is the expected first-run state, not a missing
          // read — say so rather than printing a "--" void on the stat rail.
          label: t("guestBestLabel"),
          value: guestTopScore > 0 ? t("guestScoreValue", { count: guestTopScore }) : t("guestNoScore"),
        },
        { label: t("guestModeLabel"), value: t("guestModeValue") },
      ]
    : [
        {
          label: t("scoreReward"),
          value: `${gasDisplay(payoutFixed8(rule.reward, undosUsed))} GAS`,
          accent: true,
        },
        {
          label: recoveryPending ? t("scoreReleaseIn") : t("scoreTime"),
          value: recoveryPending
            ? formatClock(releaseRemainingMs)
            : isPlaying && deadline > 0
              ? formatClock(remainingMs)
              : formatClock(rule.limitMs),
        },
        { label: t("scoreWon"), value: `${gasAmountDisplay(myTotalWon)} GAS` },
        { label: t("rankLabel"), value: myRank > 0 ? `#${myRank}` : "--" },
      ];
  const drawerToggleLabel = isGuest ? t("guestBoardTitle") : t("leaderboardTitle");
  const drawerTitle = isGuest ? t("guestDrawerTitle") : t("drawerTitle");
  const drawerId = "color-clash-ingame-drawer";

  const drawerContent = (
    <div className="cclash-drawer">
      <div className="cclash-drawer__head">
        <img src="./logo.webp" alt="" width={40} height={40} draggable={false} />
        <p>{isGuest ? t("guestLeaderboardIntro") : t("leaderboardIntro")}</p>
        <button
          type="button"
          className="cclash-drawer__close"
          aria-label={t("close")}
          title={t("close")}
          onClick={() => setDrawerOpen(false)}
        >
          <X size={17} aria-hidden="true" />
        </button>
      </div>

      <section className="cclash-drawer__summary" aria-label={t("sidebarTitle")}>
        <div>
          <span>{isGuest ? t("guestProgressLabel") : t("scoreWon")}</span>
          <strong>{isGuest ? `${guestProgress}/${rule.targetSeq}` : `${gasAmountDisplay(myTotalWon)} GAS`}</strong>
        </div>
        <div>
          <span>{isGuest ? t("guestBestLabel") : t("rankLabel")}</span>
          {/* Same first-run zero-states as the stat rail above: an unplayed
              board and an unranked wallet are expected, not error states. */}
          <strong>{isGuest ? (guestTopScore > 0 ? t("guestScoreValue", { count: guestTopScore }) : t("guestNoScore")) : (myRank > 0 ? `#${myRank}` : t("rankUnranked"))}</strong>
        </div>
        <div>
          <span>{isGuest ? t("guestModeLabel") : t("solvesCount", { count: mySolves })}</span>
          <strong>{isGuest ? t("guestModeValue") : mySolves}</strong>
        </div>
      </section>

      <section className="cclash-drawer__section" aria-label={drawerToggleLabel}>
        <div className="cclash-drawer__section-head">
          <h4>{drawerToggleLabel}</h4>
          <button type="button" className="mx2-btn mx2-btn--ghost" onClick={() => void dispatch("refreshLeaderboard")}>
            <RefreshCw size={16} aria-hidden="true" />
            {isGuest ? t("guestRefreshBoard") : t("refreshRanks")}
          </button>
        </div>
        {leaderboard.length === 0 ? (
          <p className="cclash-drawer__empty">{isGuest ? t("guestLeaderboardEmpty") : t("leaderboardEmpty")}</p>
        ) : (
          <ol className="cclash-ranks">
            {leaderboard.slice(0, 10).map((rawEntry, index) => {
              const address = String(rawEntry.address ?? rawEntry.player ?? "");
              const solves = Number(rawEntry.solves ?? rawEntry.solved ?? 0);
              const rank = rawEntry.rank ?? index + 1;
              const isUser = rawEntry.isUser ?? (myRank > 0 && rank === myRank);
              return (
                <li key={address || index} className="cclash-ranks__row" data-me={isUser ? "true" : undefined}>
                  <span className="cclash-ranks__rank">#{rank}</span>
                  <span className="cclash-ranks__addr">{shortAddr(address)}</span>
                  <span className="cclash-ranks__solves">{t("solvesCount", { count: solves })}</span>
                  <span className="cclash-ranks__won">
                    {isGuest
                      ? t("guestScoreValue", { count: Number(rawEntry.totalWon ?? 0) })
                      : `${gasAmountDisplay(Number(rawEntry.totalWon ?? 0))} GAS`}
                  </span>
                  {isUser && <span className="cclash-ranks__me">{t("youTag")}</span>}
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <section className="cclash-drawer__section" aria-label={isGuest ? t("guestHistoryTitle") : t("historyTitle")}>
        <h4>{isGuest ? t("guestHistoryTitle") : t("historyTitle")}</h4>
        {myHistory.length === 0 ? (
          <p className="cclash-drawer__empty">{isGuest ? t("guestHistoryEmpty") : t("historyEmpty")}</p>
        ) : (
          <ul className="cclash-history">
            {myHistory.slice(0, 8).map((row) => (
              <li key={row.gameId} className="cclash-history__row">
                <span>#{row.gameId}</span>
                <span>{t(`difficulty_${DIFF_KEYS[clampDifficulty(row.difficulty)]}`)}</span>
                <span>{t("scoreSeqLen")}: {row.seqAchieved}</span>
                <span className="cclash-history__won">
                  +{isGuest
                    ? t("guestScoreValue", { count: row.seqAchieved })
                    : payoutDisplay(row.payout)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="cclash-drawer__section cclash-drawer__rules" aria-label={t("rulesTitle")}>
        <h4>{t("rulesTitle")}</h4>
        <p>{isGuest ? t("guestRulesCopy") : t("rulesCopy")}</p>
      </section>

      <section className="cclash-drawer__section cclash-drawer__fairness" aria-label={isGuest ? t("guestFairnessTitle") : t("fairnessTitle")}>
        <h4><ShieldCheck size={16} aria-hidden="true" /> {isGuest ? t("guestFairnessTitle") : t("fairnessTitle")}</h4>
        <p>{isGuest ? t("guestFairnessCopy") : t("fairnessCopy")}</p>
        {!isGuest && activeGameId !== "0" && commitment && (
          <p className="cclash-drawer__commitment">
            {t("commitmentLine", { gameId: activeGameId, commitment: shortAddr(commitment) })}
          </p>
        )}
      </section>

      {!isGuest && credit > 0 && (
        <section className="cclash-drawer__credit" aria-label={t("withdrawTitle")}>
          <span>
            {t("creditLabel")}: <strong>{gasAmountDisplay(credit)} GAS</strong>
            <em>{t("withdrawHint")}</em>
          </span>
          <button type="button" className="mx2-btn mx2-btn--ghost" onClick={() => void dispatch("withdrawWinnings")}>
            <WalletCards size={16} aria-hidden="true" />
            {t("withdrawAction", { amount: gasAmountDisplay(credit) })}
          </button>
        </section>
      )}
    </div>
  );

  return (
    <div className="cclash-playarea mx2 mx2-cat-game" aria-busy={busy || undefined}>
      <PlayStage
        category="game"
        className="cclash-stage"
        stage={{
          eyebrow: isGuest ? t("guestEyebrow") : t("appEyebrow"),
          title: stageTitle,
          subtitle: isGuest ? t("guestSubtitle") : t("appSubtitle"),
          badges: (
            <>
              <span className="mx2-badge" data-tone="accent">
                <span className="mx2-badge__dot" /> {isGuest ? t("guestModeBadge") : t("networkBadge")}
              </span>
              {!isGuest && myRank > 0 && <span className="mx2-badge">{t("rankBadge", { rank: myRank })}</span>}
              {!isGuest && credit > 0 && (
                <span className="mx2-badge" data-tone="success">
                  <WalletCards size={14} aria-hidden="true" /> {t("creditLabel")}
                </span>
              )}
            </>
          ),
        }}
        scene={
          <div className="cclash-stage-shell">
            <PhaserGameComponent
              config={GAME_CONFIG}
              loadScene={loadColorClashScene}
              state={bridgeState}
              dispatch={dispatch}
              className="cclash-phaser-canvas"
              ariaLabel={t("colorClashStageAlt")}
              loadingLabel={t("openingColorBoard")}
              errorLabel={t("colorClashActionFailed")}
              retryLabel={t("retry")}
              continueLabel={t("continue")}
              enableSoundLabel={t("enableGameSound")}
              muteSoundLabel={t("muteGameSound")}
            />

            <div className="cclash-a11y-layer">
              <div
                className="cclash-a11y-difficulties"
                role="radiogroup"
                aria-label={t("difficultyTitle")}
              >
                {difficultyOptions.map((option, index) => {
                  const selected = option.id === selectedDifficulty;
                  return (
                    <button
                      key={option.id}
                      ref={(node) => {
                        difficultyRadioRefs.current[index] = node;
                      }}
                      type="button"
                      role="radio"
                      className="cclash-a11y-hit cclash-a11y-difficulty"
                      data-index={index}
                      aria-checked={selected}
                      aria-label={`${option.label}. ${option.target}`}
                      tabIndex={selected ? 0 : -1}
                      disabled={!isLobby || busy}
                      onClick={() => void dispatch("setDifficulty", option.id)}
                      onKeyDown={(event) => handleDifficultyKeyDown(event, index)}
                    >
                      <span>{option.label}</span>
                    </button>
                  );
                })}
              </div>

              <div
                className="cclash-a11y-pads"
                role="group"
                aria-label={t("lobbyConsoleLabel")}
              >
                {colorLabels.map((color, index) => (
                  <button
                    key={color}
                    type="button"
                    className="cclash-a11y-hit cclash-a11y-pad"
                    data-index={index}
                    aria-label={t("pressButton", { color })}
                    disabled={!canPressPads}
                    onClick={() => void dispatch("recordPress", index)}
                  >
                    <span>{color}</span>
                  </button>
                ))}
              </div>

              {semanticPrimary && (
                <button
                  type="button"
                  className="cclash-a11y-hit cclash-a11y-primary"
                  aria-label={semanticPrimary.label}
                  disabled={semanticPrimary.disabled}
                  onClick={() => void dispatch(
                    semanticPrimary.action,
                    ...(semanticPrimary.args ?? []),
                  )}
                >
                  <span>{semanticPrimary.label}</span>
                </button>
              )}
            </div>
            <p className="cclash-a11y-status" aria-live="polite" aria-atomic="true">
              {stageTitle}. {roundNumber > 0 ? `${t("roundLabel")} ${roundNumber}.` : ""}{" "}
              {isPlaying && deadline > 0 ? `${formatClock(remainingMs)}.` : ""}
            </p>

            {showCreditsChip && (
              <button
                type="button"
                className="cclash-credits-chip"
                data-stale={creditsStale ? "true" : undefined}
                title={creditsStale ? t("creditsStaleHint") : t("creditsChipRefresh")}
                aria-label={`${t("creditsChipLabel")}: ${creditsBalanceDisplay}. ${t("creditsChipRefresh")}`}
                onClick={() => void dispatch("refreshCredits")}
              >
                <Coins size={14} aria-hidden="true" />
                <span>{t("creditsChipLabel")}</span>
                <strong>{creditsBalanceDisplay}</strong>
              </button>
            )}

            {showCreditsOffer && (
              <section className="cclash-credits-offer" aria-label={t("creditsOfferTitle")}>
                <h4>
                  <Coins size={15} aria-hidden="true" /> {t("creditsOfferTitle")}
                </h4>
                {creditsInsufficient ? (
                  <>
                    <p>{t("creditsInsufficientBody", { cost: creditsReviveCost, rate: creditsRate })}</p>
                    <button
                      type="button"
                      className="mx2-btn mx2-btn--primary cclash-credits-offer__buy"
                      disabled={creditsBusy}
                      onClick={() => void dispatch("buyCredits")}
                    >
                      {t("creditsBuyAction", { gas: creditsBuyGas, credits: creditsBuyCredits })}
                    </button>
                  </>
                ) : (
                  <>
                    <p>{t("creditsOfferBody", { cost: creditsReviveCost })}</p>
                    <button
                      type="button"
                      className="mx2-btn mx2-btn--primary cclash-credits-offer__retry"
                      disabled={creditsBusy}
                      onClick={() => void dispatch("retryWithCredits")}
                    >
                      {t("creditsOfferAction", { cost: creditsReviveCost })}
                    </button>
                  </>
                )}
                <p className="cclash-credits-offer__balance">
                  {t("creditsBalanceLine", { balance: creditsBalanceDisplay })}
                  {creditsStale && <em> · {t("creditsStaleTag")}</em>}
                </p>
              </section>
            )}

            <div className="cclash-stage-hud" aria-label={drawerTitle}>
              {scoreItems.map((item) => (
                <div
                  className="cclash-stage-hud__metric"
                  data-accent={item.accent ? "true" : undefined}
                  key={`${item.label}-${item.value}`}
                >
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
              ))}
              <button
                type="button"
                className="cclash-stage-hud__drawer"
                onClick={() => setDrawerOpen((open) => !open)}
                aria-expanded={drawerOpen}
                aria-controls={drawerId}
              >
                <span>{drawerToggleLabel}</span>
                <ChevronDown size={15} data-open={drawerOpen ? "true" : undefined} aria-hidden="true" />
              </button>
            </div>

            {drawerOpen && (
              <section id={drawerId} className="cclash-ingame-drawer" aria-label={drawerTitle}>
                {drawerContent}
              </section>
            )}
          </div>
        }
        actions={{}}
      />
    </div>
  );
}
