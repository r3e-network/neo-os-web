import React, { useEffect, useRef, useCallback, useState } from "react";
import type { PlayAreaProps } from "@shared/react";
import { useStateBindings } from "@shared/react";
import { PlayStage } from "@shared/components-react/v2";
import {
  ruleOf,
  payoutFixed8,
  gasDisplay,
  formatClock,
  DIFFICULTY_RULES,
  ACTION_NAMES,
  EVOLUTION_STAGES,
  evolutionStage,
} from "./logic/game-rules";
import "./PlayArea.scss";

/** A pet care-action op — structurally a generic session op. */
type TeeOp = { type: "feed" } | { type: "play" } | { type: "pet" } | { type: "rest" };

interface LeaderEntry {
  player: string;
  totalWon: number;
  solved: number;
}

interface SolveRow {
  gameId: string;
  difficulty: number;
  payout: number;
  solveMs: number;
  undos: number;
  happinessAchieved: number;
}

/** Maximum stat value for bar display */
const MAX_STAT = 100;
const GAS_FIXED8 = 100_000_000;
const PET_POTION_ART = {
  lab: "./art/nursery-lab.webp",
  egg: "./art/pet-egg.webp",
  stages: [
    "./art/pet-baby.webp",
    "./art/pet-teen.webp",
    "./art/pet-adult.webp",
  ],
  actions: {
    feed: "./art/action-feed.webp",
    play: "./art/action-play.webp",
    pet: "./art/action-pet.webp",
    rest: "./art/action-rest.webp",
  },
  badges: [
    "./art/badge-easy.webp",
    "./art/badge-medium.webp",
    "./art/badge-hard.webp",
  ],
} as const;

function gasAmountDisplay(value: number): string {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return "0.00";
  return amount.toFixed(2);
}

function difficultyKey(difficulty: number): "easy" | "medium" | "hard" {
  return difficulty === 0 ? "easy" : difficulty === 1 ? "medium" : "hard";
}

export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { str, num, bool, val } = useStateBindings(state);

  // Extract state values
  const credit = num("credit", 0);
  const poolFree = num("poolFree", 0);
  const activeGameId = val<string | null>("activeGameId", null) ?? null;
  const gameStatus = str("gameStatus", "idle");
  const gameDifficulty = num("gameDifficulty", 0);
  const deadline = num("deadline", 0);
  const undosUsed = num("undosUsed", 0);
  const actionsUsed = num("actionsUsed", 0);
  const lastPayout = num("lastPayout", 0);
  const lastElapsedMs = num("lastElapsedMs", 0);
  const happinessAchieved = num("happinessAchieved", 0);
  const petHappiness = num("petHappiness", 50);
  const petHunger = num("petHunger", 50);
  const petEnergy = num("petEnergy", 50);
  const petStage = num("petStage", 0);
  const leaderboard = val<LeaderEntry[]>("leaderboard", []) ?? [];
  const myRank = num("myRank", 0);
  const myTotalWon = num("myTotalWon", 0);
  const myHistory = val<SolveRow[]>("myHistory", []) ?? [];
  const isStarting = bool("isStarting");
  const isDealing = bool("isDealing");
  const isSubmitting = bool("isSubmitting");
  const lastStatus = str("lastStatus", "");

  const [selectedDiff, setSelectedDiff] = useState<number>(0);
  // Immediate local care-action cue, released on a timer so a button never
  // sticks in its action state while the action streams to the TEE session.
  const [actionPreview, setActionPreview] = useState<string | null>(null);
  const actionPreviewTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [now, setNow] = useState(Date.now());

  const startActionPreview = useCallback((name: string) => {
    if (actionPreviewTimeout.current) clearTimeout(actionPreviewTimeout.current);
    setActionPreview(name);
    actionPreviewTimeout.current = setTimeout(() => {
      setActionPreview(null);
      actionPreviewTimeout.current = null;
    }, 400);
  }, []);

  useEffect(
    () => () => {
      if (actionPreviewTimeout.current) clearTimeout(actionPreviewTimeout.current);
    },
    [],
  );

  // Timer for countdown
  useEffect(() => {
    if (gameStatus === "playing" && deadline > 0) {
      timerRef.current = setInterval(() => setNow(Date.now()), 250);
      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
  }, [gameStatus, deadline]);

  const timeLeft = deadline > 0 ? Math.max(0, deadline - now) : 0;
  const isLow = timeLeft > 0 && timeLeft < 30000;
  const rule =
    gameStatus !== "idle" && gameStatus !== "solved"
      ? ruleOf(gameDifficulty)
      : null;
  const startDifficulty =
    gameStatus === "idle" && !activeGameId ? selectedDiff : gameDifficulty;
  const startRule = ruleOf(startDifficulty);
  const rewardPoolReady = poolFree >= startRule.reward / GAS_FIXED8;

  // Action handlers with an immediate local preview cue.
  const handleAction = useCallback(
    async (actionType: string) => {
      startActionPreview(actionType);
      const op: TeeOp = { type: actionType } as TeeOp;
      await dispatch("recordAction", op);
    },
    [dispatch, startActionPreview],
  );

  // Stat bar color — use CSS custom properties for theming
  const statColor = (value: number): string => {
    if (value >= 70) return "var(--pp-jade)";
    if (value >= 40) return "var(--pp-gold)";
    return "var(--mx2-danger)";
  };

  // Build scene content
  const sceneContent = (() => {
    // Lobby — pick difficulty
    if (gameStatus === "idle" && !activeGameId) {
      const lobbyStageArt =
        PET_POTION_ART.stages[startDifficulty] ?? PET_POTION_ART.stages[0];
      return (
        <div className="pp-lobby">
          <section
            className="pp-lobby__nursery"
            aria-label={t("lobbyPreviewLabel", {
              difficulty: t(`difficulty_${difficultyKey(startDifficulty)}`),
              happiness: startRule.targetHappiness,
            })}
          >
            <img
              className="pp-lobby__nursery-art"
              src={PET_POTION_ART.lab}
              alt=""
              decoding="async"
              draggable={false}
            />
            <div className="pp-lobby__goal-hud" id="pp-lobby-goal">
              <span className="pp-lobby__plan-label">
                {t(`difficulty_${difficultyKey(startDifficulty)}`)}
              </span>
              <strong>{t("lobbyCareGoal", { happiness: startRule.targetHappiness })}</strong>
              <p>{t(`pathObjective_${difficultyKey(startDifficulty)}`)}</p>
            </div>
            <div className="pp-lobby__playpen" aria-hidden="true" aria-describedby="pp-lobby-goal">
              <span className="pp-lobby__playpen-light" />
              <img
                className="pp-lobby__pet-art"
                src={lobbyStageArt}
                alt=""
                decoding="async"
                draggable={false}
              />
            </div>
            <div className="pp-lobby__pool-hud" aria-label={t("pathSummary")}>
              <div className="pp-lobby__care-ribbon">
                <span>{t("entryAmount", { amount: gasDisplay(startRule.entry) })}</span>
                <span>{t("winAmount", { amount: gasDisplay(startRule.reward) })}</span>
                <span>{formatClock(startRule.limitMs)}</span>
              </div>
            </div>
          </section>
          <div className="pp-lobby__dock">
            <div className="pp-lobby__dock-head">
              <span>{t("difficultyTitle")}</span>
              <strong>{t(`difficulty_${difficultyKey(startDifficulty)}`)}</strong>
            </div>
            <div className="pp-lobby__plans" role="radiogroup" aria-label={t("difficultyTitle")}>
              {DIFFICULTY_RULES.map((r) => {
                const d = r.difficulty;
                const active = selectedDiff === d;
                return (
                  <button
                    key={d}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    className={`mx2-btn pp-plan ${active ? "pp-plan--active" : ""}`}
                    onClick={() => setSelectedDiff(d)}
                    disabled={isStarting}
                  >
                    <span className="pp-plan__orb">
                      <img
                        className="pp-plan__bottle"
                        src={PET_POTION_ART.badges[d]}
                        alt=""
                        decoding="async"
                        draggable={false}
                      />
                    </span>
                    <span className="pp-plan__copy">
                      <span className="pp-plan__name">
                        {t(`difficulty_${difficultyKey(d)}`)}
                      </span>
                      <span className="pp-plan__target">
                        {t("happinessTarget", { happiness: r.targetHappiness })}
                      </span>
                    </span>
                    <span className="pp-plan__reward">
                      {t("winAmount", { amount: gasDisplay(r.reward) })}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="pp-lobby__statusbar" data-ready={rewardPoolReady || undefined}>
            <span className="pp-lobby__status">
              {rewardPoolReady ? t("lobbyReady") : t("statusPoolLow")}
            </span>
            <span>{t("poolLine", { pool: gasAmountDisplay(poolFree) })}</span>
            {credit > 0 && (
              <span>{t("creditLine", { credit: gasAmountDisplay(credit) })}</span>
            )}
          </div>
          {isStarting && <p className="pp-lobby__starting" aria-live="polite">{t("statusStarting")}</p>}
        </div>
      );
    }

    // Awaiting bind / dealing
    if (gameStatus === "awaiting-bind" || isDealing) {
      return (
        <div className="pp-shuffle" aria-busy="true" aria-live="polite">
          <div className="pp-shuffle__pet">
            <img
              className="pp-shuffle__egg-art"
              src={PET_POTION_ART.egg}
              alt=""
              decoding="async"
              draggable={false}
            />
          </div>
          <p>{t("statusShuffling")}</p>
          {lastStatus === "deal-pending" && (
            <button
              type="button"
              className="mx2-btn mx2-btn--ghost pp-shuffle__retry"
              onClick={() => void dispatch("retryDeal")}
            >
              {t("checkDealAgain") ?? "Retry"}
            </button>
          )}
        </div>
      );
    }

    // Playing — show pet + stats + actions
    if (gameStatus === "playing") {
      const stageArt = PET_POTION_ART.stages[petStage] ?? PET_POTION_ART.stages[0];
      const stageName = EVOLUTION_STAGES[petStage] ?? "baby";
      const activeActionArt = actionPreview
        ? PET_POTION_ART.actions[actionPreview as keyof typeof PET_POTION_ART.actions]
        : null;

      return (
        <div className="pp-table" aria-busy={isSubmitting || undefined}>
          <img
            className="pp-table__lab-art"
            src={PET_POTION_ART.lab}
            alt=""
            decoding="async"
            draggable={false}
          />
          {/* Timer */}
          <div className="pp-timer" data-low={isLow}>
            <span className="pp-timer__clock">{formatClock(timeLeft)}</span>
            <div className="pp-timer__track">
              <i
                style={{
                  width: rule ? `${(timeLeft / rule.limitMs) * 100}%` : "100%",
                }}
              />
            </div>
            <span className="pp-timer__reward">
              {rule ? gasDisplay(payoutFixed8(rule.reward, 0)) : ""}
            </span>
          </div>

          {/* Pet display */}
          <div className={`pp-pet pp-pet--${stageName}`} data-action={actionPreview ?? undefined}>
            <div className="pp-pet__stage-scene">
              <img
                className="pp-pet__creature"
                src={stageArt}
                alt={t("petStage", { stage: t(`stage_${stageName}`) })}
                decoding="async"
                draggable={false}
              />
              {activeActionArt && (
                <img
                  className={`pp-pet__care pp-pet__care--${actionPreview}`}
                  src={activeActionArt}
                  alt=""
                  decoding="async"
                  draggable={false}
                />
              )}
            </div>
            <div className="pp-pet__stage">
              {t("petStage", {
                stage: t(`stage_${stageName}`),
              })}
            </div>
            {/* Target indicator */}
            {rule && (
              <div className="pp-pet__target">
                {t("happinessTarget", { happiness: rule.targetHappiness })}
              </div>
            )}
          </div>

          {/* Stat bars */}
          <div className="pp-stats">
            <div className="pp-stat">
              <span className="pp-stat__label">{t("statHappiness")}</span>
              <div
                className="pp-stat__track"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={MAX_STAT}
                aria-valuenow={petHappiness}
                aria-label={t("statHappiness")}
              >
                <div
                  className="pp-stat__fill"
                  style={{
                    width: `${(petHappiness / MAX_STAT) * 100}%`,
                    background: statColor(petHappiness),
                  }}
                />
              </div>
              <span className="pp-stat__value">{petHappiness}</span>
            </div>
            <div className="pp-stat">
              <span className="pp-stat__label">{t("statHunger")}</span>
              <div
                className="pp-stat__track"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={MAX_STAT}
                aria-valuenow={petHunger}
                aria-label={t("statHunger")}
              >
                <div
                  className="pp-stat__fill"
                  style={{
                    width: `${(petHunger / MAX_STAT) * 100}%`,
                    background: statColor(petHunger),
                  }}
                />
              </div>
              <span className="pp-stat__value">{petHunger}</span>
            </div>
            <div className="pp-stat">
              <span className="pp-stat__label">{t("statEnergy")}</span>
              <div
                className="pp-stat__track"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={MAX_STAT}
                aria-valuenow={petEnergy}
                aria-label={t("statEnergy")}
              >
                <div
                  className="pp-stat__fill"
                  style={{
                    width: `${(petEnergy / MAX_STAT) * 100}%`,
                    background: statColor(petEnergy),
                  }}
                />
              </div>
              <span className="pp-stat__value">{petEnergy}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="pp-actions">
            {ACTION_NAMES.map((name) => {
              const isAnimating = actionPreview === name;
              return (
                <button
                  key={name}
                  type="button"
                  className={`mx2-btn pp-action-btn ${isAnimating ? "pp-action-btn--active" : ""}`}
                  onClick={() => handleAction(name)}
                  disabled={isSubmitting || actionsUsed >= 40}
                  data-action={name}
                  aria-pressed={isAnimating}
                >
                  <img
                    className="pp-action-btn__asset"
                    src={PET_POTION_ART.actions[name]}
                    alt=""
                    decoding="async"
                    draggable={false}
                  />
                  <span className="pp-action-btn__label">
                    {t(`action${name.charAt(0).toUpperCase() + name.slice(1)}`)}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Action counter */}
          <div className="pp-counter">
            {t("actionsCounter", { used: actionsUsed, max: 40 })}
          </div>

          {/* Status / claim hint — the PlayStage rail primary owns the claim action */}
          <div className="pp-footer-actions">
            {lastStatus === "all-correct" && !isSubmitting && (
              <span className="pp-footer-actions__reached">{t("targetReachedHint")}</span>
            )}
            {isSubmitting && <span>{t("statusSubmitting")}</span>}
            {timeLeft <= 0 && lastStatus !== "all-correct" && (
              <button
                type="button"
                className="mx2-btn mx2-btn--ghost pp-footer-actions__expire"
                onClick={() => void dispatch("expireGame")}
              >
                {t("timeUpAction")}
              </button>
            )}
          </div>
        </div>
      );
    }

    // Solved
    if (gameStatus === "solved") {
      const stageArt =
        PET_POTION_ART.stages[evolutionStage(happinessAchieved)] ??
        PET_POTION_ART.stages[2];
      return (
        <div className="pp-result" data-state="won">
          <img
            className="pp-result__pet"
            src={stageArt}
            alt={t("stage_adult")}
            decoding="async"
            draggable={false}
          />
          <strong>
            {t("statusSolved", { payout: gasDisplay(lastPayout) })}
          </strong>
          <div className="pp-result__stats">
            <span>
              {t("scoreTime")}: {formatClock(lastElapsedMs)}
            </span>
            <span>
              {t("scoreHappiness")}: {happinessAchieved}
            </span>
          </div>
        </div>
      );
    }

    // Expired
    if (gameStatus === "expired" || gameStatus === "refunded") {
      return (
        <div className="pp-result" data-state="expired">
          <img
            className="pp-result__pet"
            src={PET_POTION_ART.egg}
            alt=""
            decoding="async"
            draggable={false}
          />
          <strong>{t("expiredBanner") ?? "Game expired"}</strong>
          <span>{t("expiredBannerHint") ?? "The pet ran away..."}</span>
        </div>
      );
    }

    return null;
  })();

  // Score items for PlayStage
  const scoreItems: Array<{ label: string; value: string; accent?: boolean }> = [];
  if (rule) {
    scoreItems.push({
      label: t("scoreReward"),
      value: `${gasDisplay(payoutFixed8(rule.reward, undosUsed))} GAS`,
      accent: true,
    });
  }
  if (gameStatus === "playing" && deadline > 0) {
    scoreItems.push({ label: t("scoreTime"), value: formatClock(timeLeft) });
  }
  if (lastPayout > 0) {
    scoreItems.push({ label: t("scoreWon"), value: `${gasAmountDisplay(myTotalWon)} GAS` });
  }

  // Leaderboard drawer content
  const drawerContent = (
    <div className="pp-drawer">
      <div className="pp-drawer__head">
        <img src="./logo.webp" alt="" width={40} height={40} draggable={false} />
        <p>{t("leaderboardIntro")}</p>
      </div>
      <h4>{t("leaderboardTitle")}</h4>
      {leaderboard.length === 0 ? (
        <p className="pp-drawer__empty">{t("leaderboardEmpty")}</p>
      ) : (
        <ol className="pp-ranks">
          {leaderboard.map((entry, i) => (
            <li
              key={entry.player}
              className="pp-ranks__row"
              data-me={i + 1 === myRank}
            >
              <span className="pp-ranks__rank">#{i + 1}</span>
              <span className="pp-ranks__addr">
                {entry.player.slice(0, 8)}…{entry.player.slice(-4)}
              </span>
              <span className="pp-ranks__solves">
                {t("solvesCount", { count: entry.solved })}
              </span>
              <span className="pp-ranks__won">{gasAmountDisplay(entry.totalWon)}</span>
              {i + 1 === myRank && (
                <span className="pp-ranks__me">{t("youTag")}</span>
              )}
            </li>
          ))}
        </ol>
      )}
      <button
        type="button"
        onClick={() => void dispatch("refreshLeaderboard")}
        className="mx2-btn mx2-btn--ghost pp-ranks__refresh"
      >
        {t("refreshRanks")}
      </button>

      {/* History */}
      <h4 className="pp-drawer__subhead">{t("historyTitle")}</h4>
      {myHistory.length === 0 ? (
        <p className="pp-drawer__empty">{t("historyEmpty")}</p>
      ) : (
        <ul className="pp-history">
          {myHistory.map((h) => (
            <li key={h.gameId} className="pp-history__row">
              <span>#{h.gameId}</span>
              <span>
                {t(
                  `difficulty_${["easy", "medium", "hard"][h.difficulty]}`,
                )}
              </span>
              <span>
                {t("scoreHappiness")}: {h.happinessAchieved}
              </span>
              <span className="pp-history__won">+{gasDisplay(h.payout)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  const isPlaying = gameStatus === "playing";

  return (
    <div className="pp-playarea mx2 mx2-cat-game">
      <PlayStage
        category="game"
        className="pp-stage"
        stage={{
          eyebrow: t("appEyebrow"),
          title: isPlaying
            ? t("playingTitle", { difficulty: t(`difficulty_${difficultyKey(gameDifficulty)}`) })
            : gameStatus === "solved"
              ? t("statusWonTitle")
              : t("lobbyTitle"),
          subtitle: t("appSubtitle"),
          badges: (
            <span className="mx2-badge" data-tone="accent">
              <span className="mx2-badge__dot" /> {t("networkBadge")}
            </span>
          ),
        }}
        scene={
          <div className="pp-scene" data-state={gameStatus}>
            <div className="pp-scene__lab" aria-hidden="true" />
            {sceneContent}
          </div>
        }
        score={scoreItems}
        actions={{
          primary:
            gameStatus === "idle" && !activeGameId
              ? {
                  label: t("startAction"),
                  onClick: () => {
                    if (!rewardPoolReady) return;
                    void dispatch("startGame", selectedDiff);
                  },
                  disabled: isStarting || !rewardPoolReady,
                  loading: isStarting,
                  hint: rewardPoolReady
                    ? t("startHint", { amount: gasDisplay(startRule.entry) })
                    : t("statusPoolLow"),
                }
              : gameStatus === "solved" ||
                  gameStatus === "expired" ||
                  gameStatus === "refunded"
                ? {
                    label: t("startAction"),
                    onClick: () => {
                      if (!rewardPoolReady) return;
                      setSelectedDiff(gameDifficulty);
                      void dispatch("startGame", gameDifficulty);
                    },
                    disabled: !rewardPoolReady,
                    hint: rewardPoolReady
                      ? t("startHint", { amount: gasDisplay(startRule.entry) })
                      : t("statusPoolLow"),
                  }
                : isPlaying && lastStatus === "all-correct"
                  ? {
                      label: t("submitAction"),
                      onClick: () => void dispatch("submitSolution"),
                      disabled: isSubmitting,
                      loading: isSubmitting,
                    }
                  : undefined,
          secondary: credit > 0
            ? [
                {
                  label: t("withdrawAction", { amount: gasAmountDisplay(credit) }),
                  onClick: () => void dispatch("withdrawWinnings"),
                },
              ]
            : undefined,
        }}
        drawerToggleLabel={t("leaderboardTitle")}
        drawer={{ children: drawerContent }}
      />
    </div>
  );
}
