/**
 * PhaserPlayArea.tsx — Phaser 3 wrapper for Merge Kingdom.
 *
 * Bridges the observable state from main.tsx into the Phaser
 * MergeKingdomScene and forwards scene dispatch calls back to the
 * blockchain layer. All chain/wallet/oracle logic remains in main.tsx.
 *
 * bridgeState keys pushed into the Phaser scene:
 *   gameStatus      string   "idle"|"committed"|"dealt"|"solved"|"expired"
 *   board           number[][] 4×4 grid (0 = empty)
 *   moveCount       number
 *   tileAchieved    number   highest tile value this session
 *   gameDifficulty  number   0=Easy 1=Medium 2=Hard
 *   deadline        number   Unix-epoch ms when the game expires (0=none)
 *   isStarting      boolean
 *   isDealing       boolean
 *   isSubmitting    boolean
 *   walletConnected boolean
 *   poolFree        number   pool GAS available for payouts
 *   credit          number   pending GAS credit (GAS units, not Fixed8)
 *   lastPayoutFixed8 number  Fixed8 payout of the last completed game
 *   lastElapsedMs   number   elapsed ms of the last completed game
 *   lastStatus      string   human-readable status key
 */
import { useEffect, useState } from "react";
import * as Phaser from "phaser";
import { useStateBindings } from "@shared/react";
import type { PlayAreaProps } from "@shared/react";
import { PlayStage } from "@shared/components-react/v2";
import { PhaserGameComponent } from "@framework/phaser";
import { RefreshCw, ShieldCheck, Trophy, WalletCards } from "lucide-react";
import { MergeKingdomScene, SCENE_W, SCENE_H } from "./scenes/MergeKingdomScene";
import { formatClock, gasDisplay, ruleOf } from "./logic/game-rules";
import type { LeaderEntry, SolveRow } from "./main";
import "./PlayArea.scss";

const GAME_CONFIG: Phaser.Types.Core.GameConfig = {
  scene: [MergeKingdomScene],
  width:  SCENE_W,
  height: SCENE_H,
  backgroundColor: "transparent",
  transparent: true,
};

const DIFFICULTY_KEYS = ["easy", "medium", "hard"] as const;
const SUBMIT_BUFFER_MS = 15_000;

function ruleFor(difficulty: number) {
  try {
    return ruleOf(difficulty);
  } catch {
    return ruleOf(0);
  }
}

function difficultyLabel(t: PlayAreaProps["t"], difficulty: number): string {
  const key = DIFFICULTY_KEYS[difficulty] ?? "easy";
  return t(`difficulty_${key}`);
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

  const status = str("gameStatus", "idle");
  const gameDifficulty = num("gameDifficulty");
  const activeGameId = str("activeGameId", "0");
  const deadline = val<number>("deadline", 0) ?? 0;
  const dealtAt = val<number>("dealtAt", 0) ?? 0;
  const creditGas = num("credit");
  const poolFree = num("poolFree");
  const tileAchieved = val<number>("tileAchieved", 0) ?? 0;
  const moveCount = val<number>("moveCount", 0) ?? 0;
  const commitment = str("commitment", "");
  const undosUsed = val<number>("undosUsed", 0) ?? 0;
  const leaderboard = val<LeaderEntry[]>("leaderboard", []) ?? [];
  const myRank = val<number>("myRank", 0) ?? 0;
  const myTotalWon = val<number>("myTotalWon", 0) ?? 0;
  const mySolves = val<number>("mySolves", 0) ?? 0;
  const myHistory = val<SolveRow[]>("myHistory", []) ?? [];
  const lastPayoutFixed8 = val<bigint>("lastPayoutFixed8", 0n) ?? 0n;
  const lastElapsedMs = val<number>("lastElapsedMs", 0) ?? 0;
  const lastStatus = str("lastStatus", "");
  const isStarting = bool("isStarting");
  const isDealing = bool("isDealing");
  const isSubmitting = bool("isSubmitting");
  const walletConnected = bool("walletConnected");

  const rule = ruleFor(gameDifficulty);
  const isPlaying = status === "dealt";
  const isSolved = status === "solved";
  const isExpired = status === "expired";
  const isCommitted = status === "committed";
  const busy = isStarting || isDealing || isSubmitting;
  const remainingMs = deadline > 0 ? Math.max(0, deadline - nowMs) : 0;
  const elapsedMs = dealtAt > 0 ? Math.max(0, nowMs - dealtAt) : 0;
  const targetReached = tileAchieved >= rule.targetTile;
  const timeUp = isPlaying && deadline > 0 && remainingMs <= 0;
  const submitWindowClosed = isPlaying && deadline > 0 && remainingMs <= SUBMIT_BUFFER_MS;
  const canSubmit = isPlaying && targetReached && !timeUp && !submitWindowClosed;

  useEffect(() => {
    if (status !== "dealt") return undefined;
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [status]);

  // ── Bridge state pushed into the Phaser scene ─────────────────────────────
  const bridgeState = {
    gameStatus:      status,
    board:           val<number[][]>("board", []),
    moveCount,
    tileAchieved,
    gameDifficulty,
    deadline,
    isStarting,
    isDealing,
    isSubmitting,
    walletConnected,
    poolFree,
    credit:          creditGas,
    lastPayoutFixed8:Number(lastPayoutFixed8),
    lastElapsedMs,
    lastStatus,
  };

  // ── Derive UI state for PlayStage chrome ──────────────────────────────────
  const stageTitle = isPlaying
    ? t("tileTarget", { tile: rule.targetTile })
    : isSolved
      ? t("statusWonTitle")
      : isExpired
        ? t("statusExpired")
        : isCommitted
          ? t("statusShuffling")
        : t("lobbyTitle");

  // ── Action buttons (PlayStage rail) ───────────────────────────────────────
  let primary: Parameters<typeof PlayStage>[0]["actions"]["primary"];

  if (canSubmit) {
    primary = {
      label:    t("submitAction"),
      onClick:  () => void dispatch("submitSolution"),
      disabled: busy,
      loading:  isSubmitting,
      icon:     <Trophy size={18} aria-hidden="true" />,
      hint:     t("submitHint"),
    };
  } else if (isSolved || isExpired) {
    primary = {
      label:    t("startAction"),
      onClick:  () => void dispatch("startGame", gameDifficulty),
      disabled: busy || !walletConnected,
      loading:  isStarting || isDealing,
      hint: !walletConnected
        ? t("walletRequiredStatus")
        : t("startHint", { amount: gasDisplay(rule.entry) }),
    };
  }

  const secondary = [
    ...((timeUp || (isCommitted && !isDealing)) && activeGameId !== "0"
      ? [{
          label:   t("releaseAction"),
          onClick: () => void dispatch("expireGame"),
          icon:    <RefreshCw size={16} aria-hidden="true" />,
          hint:    t("releaseHint"),
        }]
      : []),
    ...(isCommitted && !isDealing
      ? [{
          label:   t("checkDealAgain"),
          onClick: () => void dispatch("retryDeal"),
          icon:    <RefreshCw size={16} aria-hidden="true" />,
          hint:    t("statusDealPending"),
        }]
      : []),
    ...(creditGas > 0 && !isPlaying
      ? [{
        label:   t("withdrawAction", { amount: creditGas.toFixed(2) }),
        onClick: () => void dispatch("withdrawWinnings"),
        icon:    <WalletCards size={16} aria-hidden="true" />,
        hint:    t("withdrawHint"),
      }]
      : []),
    {
      label:   t("refreshRanks"),
      onClick: () => void dispatch("refreshLeaderboard"),
      icon:    <Trophy size={16} aria-hidden="true" />,
      hint:    t("leaderboardIntro"),
    },
  ];

  const score = isPlaying || isSolved || isExpired
    ? [
        { label: t("scoreReward"), value: `${gasDisplay(rule.reward)} GAS`, accent: true },
        { label: t("scoreTile"), value: `${tileAchieved}/${rule.targetTile}` },
        { label: t("scoreTime"), value: isPlaying ? formatClock(remainingMs) : formatClock(rule.limitMs) },
      ]
    : undefined;

  return (
    <div className="mk-playarea mx2 mx2-cat-game">
      <PlayStage
        category="game"
        className="mk-playstage"
        stage={{
          eyebrow:  t("appEyebrow"),
          title:    stageTitle,
          subtitle: t("appSubtitle"),
          badges: (
            <span className="mx2-badge" data-tone="accent">
              <span className="mx2-badge__dot" /> {t("networkBadge")}
            </span>
          ),
        }}
        scene={
          <PhaserGameComponent
            config={GAME_CONFIG}
            state={bridgeState}
            dispatch={dispatch}
            className="mk-phaser-canvas"
            ariaLabel="Merge Kingdom board game"
            loadingLabel="Opening kingdom board"
          />
        }
        score={score}
        actions={{
          primary,
          secondary,
          secondaryToggleLabel: t("moreActions"),
        }}
        drawerToggleLabel={t("drawerTitle")}
        drawer={{
          title: t("drawerTitle"),
          children: (
            <div className="mk-drawer">
              <div className="mk-drawer__inner">
                <div className="mk-drawer__head">
                  <img src="./logo.webp" alt="" width={42} height={42} draggable={false} />
                  <p>{t("leaderboardIntro")}</p>
                </div>

                <div className="mk-drawer__summary" aria-label={t("drawerSummaryLabel")}>
                  <div>
                    <span>{t("rankLabel")}</span>
                    <strong>{myRank > 0 ? `#${myRank}` : "--"}</strong>
                  </div>
                  <div>
                    <span>{t("scoreWon")}</span>
                    <strong>{gasLabel(myTotalWon)}</strong>
                  </div>
                  <div>
                    <span>{t("historyTitle")}</span>
                    <strong>{t("solvesCount", { count: mySolves })}</strong>
                  </div>
                  <div>
                    <span>{t("poolLabel")}</span>
                    <strong>{gasLabel(poolFree)}</strong>
                  </div>
                  <div>
                    <span>{t("creditLabel")}</span>
                    <strong>{gasLabel(creditGas)}</strong>
                  </div>
                </div>

                {creditGas > 0 && (
                  <section className="mk-drawer__credit" aria-label={t("withdrawTitle")}>
                    <span>
                      <small>{t("withdrawHint")}</small>
                      <strong>{gasLabel(creditGas)}</strong>
                    </span>
                    <button
                      type="button"
                      className="mx2-btn mx2-btn--ghost"
                      onClick={() => void dispatch("withdrawWinnings")}
                    >
                      <WalletCards size={16} aria-hidden="true" />
                      <span>{t("withdrawTitle")}</span>
                    </button>
                  </section>
                )}

                <section className="mk-drawer__section">
                  <div className="mk-drawer__section-head">
                    <Trophy size={16} aria-hidden="true" />
                    <h4>{t("leaderboardTitle")}</h4>
                  </div>
                  <ol className="mk-ranks">
                    {leaderboard.slice(0, 8).map((entry) => (
                      <li key={entry.address} className="mk-ranks__row" data-me={entry.isUser ? "true" : undefined}>
                        <span className="mk-ranks__rank">#{entry.rank}</span>
                        <span className="mk-ranks__addr">{shortHash(entry.address)}</span>
                        <span className="mk-ranks__solves">{t("solvesCount", { count: entry.solves })}</span>
                        <span className="mk-ranks__won">{gasLabel(entry.totalWon)}</span>
                        {entry.isUser && <span className="mk-ranks__me">{t("youTag")}</span>}
                      </li>
                    ))}
                  </ol>
                  {leaderboard.length === 0 && (
                    <p className="mk-drawer__empty">{t("leaderboardEmpty")}</p>
                  )}
                  <button
                    type="button"
                    className="mx2-btn mx2-btn--ghost mk-ranks__refresh"
                    onClick={() => void dispatch("refreshLeaderboard")}
                  >
                    <RefreshCw size={16} aria-hidden="true" />
                    <span>{t("refreshRanks")}</span>
                  </button>
                </section>

                <section className="mk-drawer__section">
                  <div className="mk-drawer__section-head">
                    <Trophy size={16} aria-hidden="true" />
                    <h4>{t("historyTitle")}</h4>
                  </div>
                  <ul className="mk-history">
                    {myHistory.slice(0, 8).map((row) => (
                      <li key={row.gameId} className="mk-history__row">
                        <span>{difficultyLabel(t, row.difficulty)}</span>
                        <span>{t("tileAchieved", { tile: Number(row.tileAchieved ?? 0) })}</span>
                        <span>{formatClock(row.solveMs)}</span>
                        <strong>{historyPayout(row)}</strong>
                      </li>
                    ))}
                  </ul>
                  {myHistory.length === 0 && (
                    <p className="mk-drawer__empty">{t("historyEmpty")}</p>
                  )}
                </section>

                <section className="mk-drawer__section mk-drawer__fairness">
                  <div className="mk-drawer__section-head">
                    <ShieldCheck size={16} aria-hidden="true" />
                    <h4>{t("fairnessTitle")}</h4>
                  </div>
                  <p>{t("rulesCopy")}</p>
                  <p>{t("fairnessCopy")}</p>
                  {commitment && (
                    <p className="mk-drawer__seed">
                      {t("commitmentLine", {
                        gameId: activeGameId,
                        commitment: shortHash(commitment, 12, 8),
                      })}
                    </p>
                  )}
                  {(isSolved || isExpired) && (
                    <p className="mk-drawer__seed">
                      {t("lastResultLine", {
                        payout: fixed8Label(lastPayoutFixed8),
                        time: formatClock(lastElapsedMs),
                      })}
                    </p>
                  )}
                  {isPlaying && (
                    <p className="mk-drawer__seed">
                      {t("activeRouteLine", {
                        route: difficultyLabel(t, gameDifficulty),
                        moves: moveCount,
                        target: rule.targetTile,
                        time: formatClock(remainingMs || elapsedMs),
                      })}
                    </p>
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
