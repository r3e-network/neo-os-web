import { useEffect, useState } from "react";
import { useStateBindings } from "@shared/react";
import type { PlayAreaProps } from "@shared/react";
import { PlayStage } from "@shared/components-react/v2";
import { PhaserGameComponent } from "@framework/phaser";
import { Activity, HeartPulse, RefreshCw, ShieldCheck, Trophy, WalletCards } from "lucide-react";
import { PetPotionScene } from "./scenes/PetPotionScene";
import { formatClock, gasDisplay, MAX_MOVES, ruleOf } from "./logic/game-rules";
import type { LeaderEntry, SolveRow } from "./main";
import "./PlayArea.scss";

const GAME_CONFIG = { scene: [PetPotionScene], width: 420, height: 540 } as const;
const DIFFICULTY_KEYS = ["easy", "medium", "hard"] as const;

function ruleFor(difficulty: number) {
  try {
    return ruleOf(difficulty);
  } catch {
    return ruleOf(0);
  }
}

function difficultyKey(difficulty: number): (typeof DIFFICULTY_KEYS)[number] {
  return DIFFICULTY_KEYS[difficulty] ?? "easy";
}

function difficultyLabel(t: PlayAreaProps["t"], difficulty: number): string {
  return t(`difficulty_${difficultyKey(difficulty)}`);
}

function actionLabel(t: PlayAreaProps["t"], action: string): string {
  switch (action) {
    case "feed": return t("actionFeed");
    case "play": return t("actionPlay");
    case "pet": return t("actionPet");
    case "rest": return t("actionRest");
    default: return action;
  }
}

function gasLabel(value: number): string {
  return `${value.toFixed(value >= 10 ? 1 : 2)} GAS`;
}

function fixed8Label(value: bigint | number): string {
  const numeric = typeof value === "bigint" ? Number(value) : value;
  return `${(Number.isFinite(numeric) ? numeric / 1e8 : 0).toFixed(2)} GAS`;
}

function shortHash(value: string, head = 8, tail = 6): string {
  if (!value) return "--";
  return value.length > head + tail + 1 ? `${value.slice(0, head)}...${value.slice(-tail)}` : value;
}

function historyPayout(row: SolveRow): string {
  return typeof row.payout === "string" ? row.payout : String(row.payout ?? "0 GAS");
}

export default function PhaserPlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { str, bool, num, val } = useStateBindings(state);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const gameStatus = str("gameStatus", "idle");
  const gameDifficulty = num("gameDifficulty");
  const activeGameId = str("activeGameId", "0");
  const deadline = val<number>("deadline", 0) ?? 0;
  const dealtAt = val<number>("dealtAt", 0) ?? 0;
  const commitment = str("commitment", "");
  const credit = val<number>("credit", 0) ?? 0;
  const poolFree = val<number>("poolFree", 0) ?? 0;
  const actionsUsed = val<number>("actionsUsed", 0) ?? 0;
  const happinessAchieved = val<number>("happinessAchieved", 0) ?? 0;
  const petHappiness = val<number>("petHappiness", 50) ?? 50;
  const petHunger = val<number>("petHunger", 50) ?? 50;
  const petEnergy = val<number>("petEnergy", 50) ?? 50;
  const petStage = val<number>("petStage", 0) ?? 0;
  const actionHistory = val<string[]>("actionHistory", []) ?? [];
  const lastElapsedMs = val<number>("lastElapsedMs", 0) ?? 0;
  const lastPayoutFixed8 = val<bigint>("lastPayoutFixed8", 0n) ?? 0n;
  const lastStatus = str("lastStatus", "");
  const isStarting = bool("isStarting");
  const isDealing = bool("isDealing");
  const isSubmitting = bool("isSubmitting");
  const leaderboard = val<LeaderEntry[]>("leaderboard", []) ?? [];
  const myRank = val<number>("myRank", 0) ?? 0;
  const mySolves = val<number>("mySolves", 0) ?? 0;
  const myTotalWon = val<number>("myTotalWon", 0) ?? 0;
  const myHistory = val<SolveRow[]>("myHistory", []) ?? [];
  const appMode = str("appMode", "gamefi");
  const isGuest = appMode === "guest";

  const rule = ruleFor(gameDifficulty);
  const isPlaying = gameStatus === "dealt";
  const isCommitted = gameStatus === "committed";
  const isSolved = gameStatus === "solved";
  const isExpired = gameStatus === "expired" || gameStatus === "refunded";
  const busy = isStarting || isDealing || isSubmitting;
  const remainingMs = deadline > 0 ? Math.max(0, deadline - nowMs) : 0;
  const elapsedMs = dealtAt > 0 ? Math.max(0, nowMs - dealtAt) : 0;
  const currentHappiness = Math.max(happinessAchieved, petHappiness);
  const targetReached = isPlaying && currentHappiness >= rule.targetHappiness;
  const timeUp = isPlaying && deadline > 0 && remainingMs <= 0;

  useEffect(() => {
    if (!isPlaying) return undefined;
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [isPlaying]);

  const bridgeState = {
    gameStatus,
    activeGameId:     activeGameId,
    gameDifficulty,
    petStage,
    petHappiness,
    petHunger,
    petEnergy,
    happinessAchieved,
    actionsUsed,
    deadline:         deadline,
    credit,
    poolFree,
    isStarting,
    isDealing,
    isSubmitting,
    lastStatus,
    // Play mode (guest | gamefi) — lets the scene drop the GAS reward tier and
    // entry/reward subtitle in guest while keeping the GAMEFI lobby exactly as-is.
    appMode,
    // Localized in-canvas tag (the scene has no translator of its own).
    guestLaneTag: t("guestRunValue"),
  };

  const stageTitle = isStarting || isDealing
    ? t("statusShuffling")
    : isSubmitting
      ? t("statusSubmitting")
      : isPlaying
        ? t("playingTitle", { difficulty: difficultyLabel(t, gameDifficulty) })
        : isSolved
          ? t("statusWonTitle")
          : isExpired
            ? t("expiredBanner")
            : t("lobbyTitle");

  const score = isPlaying || isSolved || isExpired
    ? [
        { label: t("scoreHappiness"), value: `${Math.round(currentHappiness)}/${rule.targetHappiness}`, accent: true },
        { label: t("actionTrailTitle"), value: `${actionsUsed}/${MAX_MOVES}` },
        { label: t("scoreTime"), value: isPlaying ? formatClock(remainingMs) : formatClock(rule.limitMs) },
      ]
    : isGuest
      ? [
          // Guest has no stake — local framing instead of "REWARD AT STAKE" / pool / credit.
          { label: t("guestRunLabel"), value: t("guestRunValue"), accent: true },
          { label: t("scoreHappiness"), value: `0/${rule.targetHappiness}` },
          { label: t("scoreTime"), value: formatClock(rule.limitMs) },
        ]
      : [
          { label: t("scoreReward"), value: `${gasDisplay(rule.reward)} GAS`, accent: true },
          { label: t("poolLabel"), value: gasLabel(poolFree) },
          { label: t("creditLabel"), value: gasLabel(credit) },
        ];

  const secondary = [
    ...(isCommitted && !isDealing && activeGameId !== "0"
      ? [{
          label: t("checkDealAgain"),
          onClick: () => void dispatch("retryDeal"),
          icon: <RefreshCw size={16} aria-hidden="true" />,
          hint: t("statusDealPending"),
        }]
      : []),
    ...((timeUp || (isCommitted && !isDealing)) && activeGameId !== "0"
      ? [{
          label: t("releaseAction"),
          onClick: () => void dispatch("expireGame"),
          icon: <RefreshCw size={16} aria-hidden="true" />,
          hint: t("releaseHint"),
        }]
      : []),
    ...(credit > 0 && !isPlaying
      ? [{
          label: t("withdrawAction", { amount: credit.toFixed(2) }),
          onClick: () => void dispatch("withdrawWinnings"),
          icon: <WalletCards size={16} aria-hidden="true" />,
          hint: t("withdrawHint"),
        }]
      : []),
    {
      label: t("refreshRanks"),
      onClick: () => void dispatch("refreshLeaderboard"),
      icon: <Trophy size={16} aria-hidden="true" />,
      hint: t("leaderboardIntro"),
    },
  ];

  return (
    <div className="pp-playarea mx2 mx2-cat-game">
      <PlayStage
        category="game"
        className="pp-playstage"
        stage={{
          eyebrow: t("appEyebrow"),
          title: stageTitle,
          subtitle: t("appSubtitle"),
          badges: (
            <span className="mx2-badge" data-tone="accent">
              <span className="mx2-badge__dot" /> {t("networkBadge")}
            </span>
          ),
        }}
        scene={(
          <PhaserGameComponent
            config={GAME_CONFIG}
            state={bridgeState}
            dispatch={dispatch}
            className="pp-phaser-canvas"
            ariaLabel="Pet Potion nursery game"
            loadingLabel="Opening pet nursery"
          />
        )}
        score={score}
        actions={{
          secondary,
          secondaryToggleLabel: t("moreActions"),
        }}
        drawerToggleLabel={t("drawerTitle")}
        drawer={{
          title: t("drawerTitle"),
          children: (
            <div className="pp-drawer">
              <div className="pp-drawer__inner">
                <div className="pp-drawer__head">
                  <img src="./logo.webp" alt="" width={42} height={42} draggable={false} />
                  <p>{isGuest ? t("guestModeLine") : t("leaderboardIntro")}</p>
                </div>

                <div className="pp-drawer__summary" aria-label={t("drawerSummaryLabel")}>
                  <div>
                    <span>{t("rankLabel")}</span>
                    <strong>{myRank > 0 ? `#${myRank}` : "--"}</strong>
                  </div>
                  <div>
                    <span>{isGuest ? t("guestBestLabel") : t("scoreWon")}</span>
                    <strong>{isGuest ? `${Math.round(myTotalWon)}` : gasLabel(myTotalWon)}</strong>
                  </div>
                  <div>
                    <span>{t("historyTitle")}</span>
                    <strong>{t("solvesCount", { count: mySolves })}</strong>
                  </div>
                  {!isGuest && (
                    <div>
                      <span>{t("poolLabel")}</span>
                      <strong>{gasLabel(poolFree)}</strong>
                    </div>
                  )}
                  {!isGuest && (
                    <div>
                      <span>{t("creditLabel")}</span>
                      <strong>{gasLabel(credit)}</strong>
                    </div>
                  )}
                </div>

                {!isGuest && credit > 0 && (
                  <section className="pp-drawer__credit" aria-label={t("withdrawTitle")}>
                    <span>
                      <small>{t("withdrawHint")}</small>
                      <strong>{gasLabel(credit)}</strong>
                    </span>
                    <button
                      type="button"
                      className="mx2-btn mx2-btn--ghost"
                      disabled={busy}
                      onClick={() => void dispatch("withdrawWinnings")}
                    >
                      <WalletCards size={16} aria-hidden="true" />
                      <span>{t("withdrawTitle")}</span>
                    </button>
                  </section>
                )}

                <section className="pp-drawer__section">
                  <div className="pp-drawer__section-head">
                    <HeartPulse size={16} aria-hidden="true" />
                    <h4>{isPlaying ? t("activeRunTitle") : t("difficultyTitle")}</h4>
                  </div>
                  <div className="pp-run-card">
                    <span>{difficultyLabel(t, gameDifficulty)}</span>
                    <strong>{Math.round(currentHappiness)}/{rule.targetHappiness}</strong>
                    <small>
                      {t("activeRouteLine", {
                        actions: actionsUsed,
                        max: MAX_MOVES,
                        time: isPlaying ? formatClock(remainingMs) : formatClock(rule.limitMs),
                      })}
                    </small>
                  </div>
                  {targetReached && (
                    <p className="pp-drawer__notice" data-tone="success">{t("targetReachedHint")}</p>
                  )}
                  {lastStatus === "deal-pending" && (
                    <p className="pp-drawer__notice">{t("statusDealPending")}</p>
                  )}
                  {(isSolved || isExpired) && (
                    <p className="pp-drawer__notice" data-tone={isSolved ? "success" : undefined}>
                      {isGuest
                        ? t("guestResultLine", {
                            happiness: Math.round(currentHappiness),
                            time: formatClock(lastElapsedMs),
                          })
                        : t("lastResultLine", {
                            payout: fixed8Label(lastPayoutFixed8),
                            time: formatClock(lastElapsedMs),
                          })}
                    </p>
                  )}
                  {actionHistory.length > 0 && (
                    <div className="pp-action-trail" aria-label={t("actionTrailTitle")}>
                      {actionHistory.slice(-8).map((action, index) => (
                        <span key={`${action}-${index}`}>{actionLabel(t, action)}</span>
                      ))}
                    </div>
                  )}
                </section>

                <section className="pp-drawer__section">
                  <div className="pp-drawer__section-head">
                    <Trophy size={16} aria-hidden="true" />
                    <h4>{t("leaderboardTitle")}</h4>
                  </div>
                  <ol className="pp-ranks">
                    {leaderboard.slice(0, 8).map((entry) => (
                      <li key={entry.address} className="pp-ranks__row" data-me={entry.isUser ? "true" : undefined}>
                        <span className="pp-ranks__rank">#{entry.rank}</span>
                        <span className="pp-ranks__addr">{shortHash(entry.address)}</span>
                        <span className="pp-ranks__solves">{t("solvesCount", { count: entry.solves })}</span>
                        <span className="pp-ranks__won">{isGuest ? `${Math.round(entry.totalWon)}` : gasLabel(entry.totalWon)}</span>
                        {entry.isUser && <span className="pp-ranks__me">{t("youTag")}</span>}
                      </li>
                    ))}
                  </ol>
                  {leaderboard.length === 0 && (
                    <p className="pp-drawer__empty">{t("leaderboardEmpty")}</p>
                  )}
                  <button
                    type="button"
                    className="mx2-btn mx2-btn--ghost pp-ranks__refresh"
                    onClick={() => void dispatch("refreshLeaderboard")}
                  >
                    <RefreshCw size={16} aria-hidden="true" />
                    <span>{t("refreshRanks")}</span>
                  </button>
                </section>

                <section className="pp-drawer__section">
                  <div className="pp-drawer__section-head">
                    <Activity size={16} aria-hidden="true" />
                    <h4>{t("historyTitle")}</h4>
                  </div>
                  <ul className="pp-history">
                    {myHistory.slice(0, 8).map((row) => (
                      <li key={row.gameId} className="pp-history__row">
                        <span>{difficultyLabel(t, row.difficulty)}</span>
                        <span>{t("happinessCurrent", { happiness: row.happinessAchieved })}</span>
                        <span>{formatClock(row.solveMs)}</span>
                        <strong>{historyPayout(row)}</strong>
                      </li>
                    ))}
                  </ul>
                  {myHistory.length === 0 && (
                    <p className="pp-drawer__empty">{t("historyEmpty")}</p>
                  )}
                </section>

                <section className="pp-drawer__section pp-drawer__fairness">
                  <div className="pp-drawer__section-head">
                    <ShieldCheck size={16} aria-hidden="true" />
                    <h4>{isGuest ? t("rulesTitle") : t("fairnessTitle")}</h4>
                  </div>
                  {isGuest ? (
                    <p>{t("guestRulesCopy")}</p>
                  ) : (
                    <>
                      <p>{t("rulesCopy")}</p>
                      <p>{t("fairnessCopy")}</p>
                      {commitment && (
                        <p className="pp-drawer__seed">
                          {t("commitmentLine", {
                            gameId: activeGameId,
                            commitment: shortHash(commitment, 12, 8),
                          })}
                        </p>
                      )}
                    </>
                  )}
                </section>
              </div>
            </div>
          ),
        }}
      />
    </div>
  );
}
