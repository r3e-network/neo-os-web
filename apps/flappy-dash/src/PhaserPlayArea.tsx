/**
 * PhaserPlayArea.tsx — Phaser 3 wrapper for Flappy Dash.
 *
 * Bridges observable state from main.tsx into the Phaser FlappyScene and
 * forwards Phaser dispatch calls back to the blockchain layer.
 *
 * The React shell (PlayStage) provides the outer chrome (title, badges,
 * score row, actions, drawer). The Phaser canvas handles all game rendering
 * including the lobby difficulty-picker, the game itself, and overlays.
 */
import Phaser from "phaser";
import { useStateBindings } from "@shared/react";
import type { PlayAreaProps } from "@shared/react";
import { PlayStage } from "@shared/components-react/v2";
import { PhaserGameComponent } from "@framework/phaser";
import { FlappyScene } from "./scenes/FlappyScene";
import { formatClock, gasDisplay, ruleOf } from "./logic/game-rules";
import type { LeaderEntry, SolveRow } from "./main";
import "./PlayArea.scss";

const GAME_CONFIG: Phaser.Types.Core.GameConfig = {
  scene: [FlappyScene],
  width:  400,
  height: 600,
  backgroundColor: "transparent",
  transparent: true,
};

export default function PhaserPlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { str, bool, val } = useStateBindings(state);

  // ── Observables ─────────────────────────────────────────────────────────
  const gameStatus     = str("gameStatus", "idle");
  const seed           = str("seed", "");
  const activeGameId   = str("activeGameId", "0");
  const gameDifficulty = val<number>("gameDifficulty", 0) ?? 0;
  const deadline       = val<number>("deadline", 0) ?? 0;
  const poolFree       = val<number>("poolFree", 0) ?? 0;
  const creditGas      = val<number>("credit", 0) ?? 0;
  const isStarting     = bool("isStarting");
  const isDealing      = bool("isDealing");
  const isSubmitting   = bool("isSubmitting");
  const lastPayout     = str("lastPayout", "");
  const myRank         = val<number>("myRank", 0) ?? 0;
  const myTotalWon     = val<number>("myTotalWon", 0) ?? 0;
  const leaderboard    = val<LeaderEntry[]>("leaderboard", []) ?? [];
  const myHistory      = val<SolveRow[]>("myHistory", []) ?? [];
  const lastStatus     = str("lastStatus", "");

  const rule    = ruleOf(gameDifficulty);
  const nowMs   = Date.now();
  const remMs   = gameStatus === "dealt" && deadline > 0 ? Math.max(0, deadline - nowMs) : 0;
  const timeUp  = gameStatus === "dealt" && deadline > 0 && remMs <= 0;

  // ── Bridge state pushed into the Phaser scene ────────────────────────────
  const bridgeState = {
    gameStatus,
    seed,
    activeGameId,
    gameDifficulty,
    deadline,
    poolFree,
    isStarting,
    isDealing,
    isSubmitting,
    lastPayout,
    myRank,
    myTotalWon,
  };

  // ── PlayStage chrome ─────────────────────────────────────────────────────
  const stageTitle =
    isDealing || gameStatus === "committed"
      ? t("statusShuffling")
      : gameStatus === "dealt"
        ? t("playingTitle", { difficulty: t(`difficulty_${rule.key}`) })
        : gameStatus === "solved"
          ? t("statusWonTitle")
          : t("lobbyTitle");

  const scoreItems =
    gameStatus === "idle"
      ? undefined
      : [
          {
            label: t("scoreReward"),
            value: `${gasDisplay(rule.rewardFixed8)} GAS`,
            accent: true,
          },
          {
            label: t("scoreTime"),
            value: gameStatus === "dealt" ? formatClock(remMs) : formatClock(rule.limitMs),
          },
          {
            label: t("scorePipes"),
            value: `0/${rule.targetPipes}`,
          },
          { label: t("scoreWon"), value: `${myTotalWon.toFixed(2)} GAS` },
        ];

  // Secondary action: expire when time is up or deal is stalled
  const secondaryActions = [
    ...(timeUp || (gameStatus === "committed" && !isDealing)
      ? [
          {
            label:   t("releaseAction"),
            onClick: () => void dispatch("expireGame", {}),
            hint:    t("releaseHint"),
          },
        ]
      : []),
    ...(creditGas > 0 && gameStatus !== "dealt"
      ? [
          {
            label:   t("withdrawAction", { amount: creditGas.toFixed(2) }),
            onClick: () => void dispatch("withdrawWinnings", {}),
            hint:    t("withdrawHint"),
          },
        ]
      : []),
  ];

  function shortHash(value: string, head = 10, tail = 6): string {
    if (!value || value.length <= head + tail + 1) return value;
    return `${value.slice(0, head)}…${value.slice(-tail)}`;
  }

  return (
    <div className="flappy-playarea mx2 mx2-cat-game">
      <PlayStage
        category="game"
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
            </>
          ),
        }}
        scene={
          <PhaserGameComponent
            config={GAME_CONFIG}
            state={bridgeState}
            dispatch={dispatch}
            height={520}
            className="flappy-phaser-canvas"
          />
        }
        score={scoreItems}
        actions={{
          secondary: secondaryActions.length > 0 ? secondaryActions : undefined,
        }}
        drawerToggleLabel={t("drawerTitle")}
        drawer={{
          title: t("drawerTitle"),
          children: (
            <>
              <div className="flappy-drawer__head">
                <p>{t("leaderboardIntro")}</p>
              </div>
              <h4>{t("leaderboardTitle")}</h4>
              {leaderboard.length > 0 ? (
                <ol className="flappy-ranks">
                  {leaderboard.slice(0, 10).map((entry) => (
                    <li
                      key={entry.address}
                      className="flappy-ranks__row"
                      data-me={entry.isUser ? "true" : undefined}
                    >
                      <span className="flappy-ranks__rank">#{entry.rank}</span>
                      <span className="flappy-ranks__addr">{shortHash(entry.address)}</span>
                      <span className="flappy-ranks__solves">
                        {t("solvesCount", { count: entry.solves })}
                      </span>
                      <span className="flappy-ranks__won">{entry.totalWon.toFixed(2)} GAS</span>
                      {entry.isUser && (
                        <span className="flappy-ranks__me">{t("youTag")}</span>
                      )}
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
                {t("refreshRanks")}
              </button>
              <h4>{t("historyTitle")}</h4>
              {myHistory.length > 0 ? (
                <ul className="mx2-history">
                  {myHistory.map((row) => (
                    <li key={row.gameId} className="mx2-history__item" data-outcome="won">
                      <span className="mx2-history__face">
                        {t(`difficulty_${ruleOf(Number(row.difficulty)).key}`)}
                      </span>
                      <span className="mx2-history__stake">
                        {formatClock(Number(row.elapsedMs))}
                      </span>
                      <span className="mx2-history__result">
                        {t("historyPipes", { pipes: (row as { pipes?: number }).pipes ?? 0 })}
                      </span>
                      <span className="mx2-history__stake">{row.payout}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>{t("historyEmpty")}</p>
              )}
              <h4>{t("rulesTitle")}</h4>
              <p>{t("rulesCopy")}</p>
              <h4>{t("fairnessTitle")}</h4>
              <p>{t("fairnessCopy")}</p>
              {lastStatus && <p className="flappy-drawer__seed">{lastStatus}</p>}
            </>
          ),
        }}
      />
    </div>
  );
}
