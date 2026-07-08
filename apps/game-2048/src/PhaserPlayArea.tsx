/**
 * PhaserPlayArea.tsx — Phaser 3 wrapper for game-2048.
 *
 * Replaces the React-canvas PlayArea.tsx for the Phaser renderer.
 * All blockchain logic stays in main.tsx; this component bridges the
 * observable state into Game2048Scene and forwards dispatch calls back.
 */
import { useEffect, useState } from "react";
import { useStateBindings } from "@shared/react";
import type { PlayAreaProps } from "@shared/react";
import { PlayStage } from "@shared/components-react/v2";
import { PhaserGameComponent } from "@framework/phaser";
import { ChevronDown, RefreshCw, RotateCcw, Trophy, WalletCards } from "lucide-react";
import { Game2048Scene } from "./scenes/Game2048Scene";
import { hasAnyMove, tileValue } from "./logic/engine-2048";
import {
  MAX_MOVES,
  MAX_UNDOS,
  formatClock,
  gasDisplay,
  rewardPctAfterUndos,
  ruleOf,
} from "./logic/game-rules";
import type { LeaderEntry, SolveRow } from "./main";
import "./PlayArea.scss";

const SUBMIT_BUFFER_MS = 15_000;
const MIN_SOLVE_BUFFER_MS = 10_000;

const GAME_CONFIG = {
  // Cast to mutable array so it satisfies Phaser's SceneType[] expectation
  scene: [Game2048Scene] as (typeof Game2048Scene)[],
  width:  400,
  height: 580,
  backgroundColor: "transparent",
  transparent: true,
};

function shortHash(value: string, head = 10, tail = 6): string {
  if (!value || value.length <= head + tail + 1) return value;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}

function historyPayout(row: SolveRow): string {
  return typeof row.payout === "string" ? row.payout : String(row.payout ?? "0 GAS");
}

export default function PhaserPlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { str, bool, val } = useStateBindings(state);

  const activeGameId   = str("activeGameId", "0");
  const commitmentHex  = str("commitment", "");
  const gameStatus     = str("gameStatus", "idle");
  const gameDifficulty = val<number>("gameDifficulty", 0) ?? 0;
  const isStarting     = bool("isStarting");
  const isDealing      = bool("isDealing");
  const isSubmitting   = bool("isSubmitting");
  const isMoving       = bool("isMoving");
  const isUndoing      = bool("isUndoing");
  const runBoard       = val<number[]>("runBoard") ?? [];
  const runMoveCount   = val<number>("runMoveCount", 0) ?? 0;
  const runMaxExp      = val<number>("runMaxExp", 0) ?? 0;
  const creditGas      = val<number>("credit", 0) ?? 0;
  const poolFree       = val<number>("poolFree", 0) ?? 0;
  const dealtAt        = val<number>("dealtAt", 0) ?? 0;
  const deadline       = val<number>("deadline", 0) ?? 0;
  const undosUsed      = val<number>("undosUsed", 0) ?? 0;
  const lastPayout     = str("lastPayout", "");
  const leaderboard    = val<LeaderEntry[]>("leaderboard", []) ?? [];
  const myHistory      = val<SolveRow[]>("myHistory", []) ?? [];
  const myRank         = val<number>("myRank", 0) ?? 0;
  const mySolves       = val<number>("mySolves", 0) ?? 0;
  const myTotalWon     = val<number>("myTotalWon", 0) ?? 0;
  const lastStatus     = str("lastStatus", t("statusReady"));
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (gameStatus !== "dealt") return undefined;
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [gameStatus]);

  const rule = ruleOf(gameDifficulty);
  const isPlaying = gameStatus === "dealt";
  const isSolved = gameStatus === "solved";
  const isCommitted = gameStatus === "committed";
  const hasActiveGame = activeGameId !== "0";
  const busy = isStarting || isDealing || isSubmitting || isMoving || isUndoing;
  const boardReady = runBoard.length === 16;
  const targetReached = boardReady && runMaxExp >= rule.targetExp;
  const boardDead = boardReady && !targetReached && !hasAnyMove(runBoard);
  const remainingMs = deadline > 0 ? deadline - nowMs : 0;
  const elapsedMs = dealtAt > 0 ? nowMs - dealtAt : 0;
  const minSolveReached = dealtAt > 0 && elapsedMs >= rule.minSolveMs + MIN_SOLVE_BUFFER_MS;
  const timeUp = isPlaying && deadline > 0 && remainingMs <= 0;
  const submitWindowClosed = isPlaying && deadline > 0 && remainingMs <= SUBMIT_BUFFER_MS;
  const canSubmit = isPlaying && targetReached && minSolveReached && !submitWindowClosed;
  const undosLeft = Math.max(0, MAX_UNDOS - undosUsed);
  const currentRewardPct = rewardPctAfterUndos(undosUsed);
  const projectedPayout = (Number(gasDisplay(rule.rewardFixed8)) * currentRewardPct) / 100;

  // Bridge state pushed into the Phaser scene via GameBridge
  const bridgeState = {
    activeGameId,
    commitment: commitmentHex,
    gameStatus,
    gameDifficulty,
    runBoard,
    runMoveCount,
    runMaxExp,
    isStarting,
    isDealing,
    isSubmitting,
    isMoving,
    isUndoing,
    creditGas,
    credit: creditGas,
    poolFree,
    dealtAt,
    deadline,
    undosUsed,
    myRank,
    mySolves,
    myTotalWon,
    lastStatus,
  };

  const stageTitle = isSolved
    ? t("statusWonTitle")
    : isPlaying
      ? t("playingTitle", { tile: rule.targetTile })
      : isCommitted
        ? t("statusShuffling")
        : t("lobbyTitle");

  const submitAction = canSubmit
    ? {
        label:    t("submitAction"),
        onClick:  () => void dispatch("submitRun", {}),
        disabled: busy,
        loading:  isSubmitting,
        icon:     <Trophy size={18} aria-hidden="true" />,
        hint:     t("submitHint"),
      }
    : undefined; // lobby/start/move live inside Phaser; outer rail only settles or recovers.

  const drawerActions = [
    ...(isPlaying
      ? [{
          label:   t("useUndo") ?? "Undo",
          onClick: () => void dispatch("useUndo", {}),
          disabled: busy || runMoveCount === 0 || undosLeft <= 0 || submitWindowClosed,
          loading:  isUndoing,
          icon:    <RotateCcw size={16} aria-hidden="true" />,
          hint:    t("undoHint"),
        }]
      : []),
    ...(((timeUp || (isCommitted && !isDealing)) && hasActiveGame)
      ? [{
          label:   t("releaseAction") ?? "Release",
          onClick: () => void dispatch("expireGame", {}),
          icon:    <RefreshCw size={16} aria-hidden="true" />,
          hint:    timeUp || boardDead ? t("timeUpHint") : t("releaseHint"),
        }]
      : []),
    ...(isCommitted && !isDealing
      ? [{
          label:   t("checkDealAgain"),
          onClick: () => void dispatch("retryDeal", {}),
          icon:    <RefreshCw size={16} aria-hidden="true" />,
          hint:    t("statusDealPending"),
        }]
      : []),
  ];

  const hudItems = [
    {
      label: t("scoreReward"),
      value: `${projectedPayout.toFixed(2)} GAS`,
      accent: true,
    },
    {
      label: t("scoreBest"),
      value: `${tileValue(runMaxExp)}/${rule.targetTile}`,
    },
    {
      label: t("scoreTime"),
      value: isPlaying ? formatClock(remainingMs) : formatClock(rule.limitMs),
    },
  ];

  return (
    <div className="rush-playarea mx2 mx2-cat-game rush-phaser-playarea" aria-busy={busy || undefined}>
      <PlayStage
        category="game"
        className="rush-playstage"
        stage={{
          eyebrow:  t("appEyebrow"),
          title:    stageTitle,
          subtitle: t("appSubtitle"),
          badges: (
            <>
              <span className="mx2-badge" data-tone="accent">
                <span className="mx2-badge__dot" /> {t("networkBadge")}
              </span>
              {myRank > 0 && (
                <span className="mx2-badge">{t("rankBadge", { rank: myRank })}</span>
              )}
              {targetReached && isPlaying && (
                <span className="mx2-badge" data-tone="accent">
                  <span className="mx2-badge__dot" /> {t("submitHint")}
                </span>
              )}
            </>
          ),
        }}
        scene={
          <div className="rush-stage-shell">
            <PhaserGameComponent
              config={GAME_CONFIG}
              state={bridgeState}
              dispatch={dispatch}
              className="rush-phaser-canvas"
              ariaLabel="2048 Rush tile merge game"
              loadingLabel="Loading tile table"
            />
            <div className="rush-stage-hud" aria-label={t("sidebarTitle")}>
              {hudItems.map((item) => (
                <div
                  className="rush-stage-hud__metric"
                  data-accent={item.accent ? "true" : undefined}
                  key={`${item.label}-${item.value}`}
                >
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
              ))}
              {submitAction && (
                <button
                  type="button"
                  className="rush-stage-hud__submit"
                  disabled={submitAction.disabled}
                  onClick={submitAction.onClick}
                  title={submitAction.hint}
                >
                  {submitAction.icon}
                  <span>{submitAction.loading ? t("statusSubmitting") : submitAction.label}</span>
                </button>
              )}
              <button
                type="button"
                className="rush-stage-hud__drawer"
                onClick={() => setDrawerOpen((open) => !open)}
                aria-expanded={drawerOpen}
              >
                <span>{t("drawerTitle")}</span>
                <ChevronDown size={16} aria-hidden="true" data-open={drawerOpen ? "true" : undefined} />
              </button>
            </div>
            {drawerOpen && (
              <section className="rush-ingame-drawer" aria-label={t("drawerTitle")}>
                <div className="rush-drawer__head">
                  <img src="./logo.webp" alt="" width={40} height={40} draggable={false} />
                  <p>{t("leaderboardIntro")}</p>
                </div>

                <div className="rush-drawer__summary">
                  <span>
                    <small>{t("rankLabel")}</small>
                    <strong>{myRank > 0 ? `#${myRank}` : "—"}</strong>
                  </span>
                  <span>
                    <small>{t("scoreWon")}</small>
                    <strong>{myTotalWon.toFixed(2)} GAS</strong>
                  </span>
                  <span>
                    <small>{t("historyTitle")}</small>
                    <strong>{t("solvesCount", { count: mySolves })}</strong>
                  </span>
                  <span>
                    <small>{t("scoreUndos")}</small>
                    <strong>{undosLeft}</strong>
                  </span>
                </div>

                {drawerActions.length > 0 && (
                  <div className="rush-ingame-drawer__actions">
                    {drawerActions.map((action) => (
                      <button
                        type="button"
                        key={action.label}
                        disabled={action.disabled}
                        onClick={action.onClick}
                        title={action.hint}
                      >
                        {action.icon}
                        <span>{action.loading ? action.hint : action.label}</span>
                      </button>
                    ))}
                  </div>
                )}

                {creditGas > 0 && (
                  <div className="rush-drawer__credit">
                    <span>
                      <small>{t("creditLabel")}</small>
                      <strong>{creditGas.toFixed(2)} GAS</strong>
                    </span>
                    <button
                      type="button"
                      className="mx2-btn mx2-btn--ghost"
                      onClick={() => void dispatch("withdrawWinnings", {})}
                    >
                      <WalletCards size={16} aria-hidden="true" />
                      <span>{t("withdrawTitle")}</span>
                    </button>
                  </div>
                )}

                <h4>{t("leaderboardTitle")}</h4>
                {leaderboard.length > 0 ? (
                  <ol className="rush-ranks">
                    {leaderboard.slice(0, 10).map((entry) => (
                      <li
                        key={entry.address}
                        className="rush-ranks__row"
                        data-me={entry.isUser ? "true" : undefined}
                      >
                        <span className="rush-ranks__rank">#{entry.rank}</span>
                        <span className="rush-ranks__addr">{shortHash(entry.address)}</span>
                        <span className="rush-ranks__solves">
                          {t("solvesCount", { count: entry.solves })}
                        </span>
                        <span className="rush-ranks__won">{entry.totalWon.toFixed(2)} GAS</span>
                        {entry.isUser && <span className="rush-ranks__me">{t("youTag")}</span>}
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p>{t("leaderboardEmpty")}</p>
                )}
                <button
                  type="button"
                  className="mx2-btn mx2-btn--ghost"
                  onClick={() => void dispatch("refreshLeaderboard", {})}
                >
                  <RefreshCw size={16} aria-hidden="true" />
                  <span>{t("refreshRanks")}</span>
                </button>

                <h4>{t("historyTitle")}</h4>
                {myHistory.length > 0 ? (
                  <ul className="rush-history">
                    {myHistory.map((row) => {
                      const historyRule = ruleOf(row.difficulty);
                      return (
                        <li key={row.gameId} className="rush-history__item">
                          <span className="rush-history__target">{historyRule.targetTile}</span>
                          <span className="rush-history__time">{formatClock(row.solveMs)}</span>
                          <span className="rush-history__undos">
                            {t("historyUndos", { undos: row.undos })}
                          </span>
                          <strong>{historyPayout(row)}</strong>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p>{t("historyEmpty")}</p>
                )}

                <h4>{t("rulesTitle")}</h4>
                <p>{t("rulesCopy")}</p>
                <h4>{t("fairnessTitle")}</h4>
                <p>{t("fairnessCopy")}</p>
                {commitmentHex && (
                  <p className="rush-drawer__seed">
                    {t("commitmentLine", {
                      commitment: shortHash(commitmentHex, 12, 8),
                      gameId: activeGameId,
                    })}
                  </p>
                )}
                {lastPayout && (
                  <p className="rush-drawer__seed">{t("solvedBanner", { payout: lastPayout })}</p>
                )}
              </section>
            )}
          </div>
        }
        actions={{}}
      />
    </div>
  );
}
