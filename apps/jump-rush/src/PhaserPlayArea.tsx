/**
 * PhaserPlayArea.tsx — Phaser 3 wrapper for Jump Rush.
 *
 * Bridges the observable state from main.tsx into the JumpRushScene and
 * forwards Phaser dispatch calls back to main.tsx.
 * All blockchain / TEE logic stays in main.tsx; this component is pure UI.
 */
import { useStateBindings } from "@shared/react";
import type { PlayAreaProps } from "@shared/react";
import { PlayStage } from "@shared/components-react/v2";
import { PhaserGameComponent } from "@framework/phaser";
import { RefreshCw, RotateCcw, ShieldCheck, Trophy, WalletCards, Zap } from "lucide-react";
import { JumpRushScene } from "./scenes/JumpRushScene";
import { DIFFICULTY_RULES, formatClock, gasDisplay, ruleOf, rewardPctAfterUndos, MAX_UNDOS } from "./logic/game-rules";
import type { LeaderEntry, RunRow } from "./main";
import "./PlayArea.scss";

const SUBMIT_BUFFER_MS  = 15_000;
const MIN_SOLVE_BUFFER_MS = 10_000;

const GAME_CONFIG = {
  scene:           [JumpRushScene] as Phaser.Types.Scenes.SceneType[],
  width:           400,
  height:          580,
  backgroundColor: "transparent",
  transparent:     true,
};

function shortAddress(value: string): string {
  if (!value) return "--";
  return value.length > 14 ? `${value.slice(0, 8)}...${value.slice(-6)}` : value;
}

function gasLabel(value: number): string {
  return `${value.toFixed(value >= 10 ? 1 : 2)} GAS`;
}

function runTimeLabel(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "--";
  return formatClock(ms);
}

export default function PhaserPlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { str, bool, val } = useStateBindings(state);

  // ── Core observable state ────────────────────────────────────────────────
  const gameStatus      = str("gameStatus", "idle");
  const gameDifficulty  = val<number>("gameDifficulty", 0) ?? 0;
  const activeGameId    = str("activeGameId", "0");
  const poolFree        = val<number>("poolFree", 0) ?? 0;
  const creditGas       = val<number>("credit", 0) ?? 0;
  const deadline        = val<number>("deadline", 0) ?? 0;
  const dealtAt         = val<number>("dealtAt", 0) ?? 0;
  const undosUsed       = val<number>("undosUsed", 0) ?? 0;
  const lastPayout      = str("lastPayout", "");
  const commitment      = str("commitment", "");
  const leaderboard     = val<LeaderEntry[]>("leaderboard", []) ?? [];
  const myRank          = val<number>("myRank", 0) ?? 0;
  const myTotalWon      = val<number>("myTotalWon", 0) ?? 0;
  const myHistory       = val<RunRow[]>("myHistory", []) ?? [];
  const lastElapsedMs   = val<number>("lastElapsedMs", 0) ?? 0;

  const isStarting      = bool("isStarting");
  const isDealing       = bool("isDealing");
  const isSubmitting    = bool("isSubmitting");
  const isUndoing       = bool("isUndoing");
  const busy            = isStarting || isDealing || isSubmitting || isUndoing;

  const platformsView   = val<number[]>("platformsView", []) ?? [];

  // ── Derived values ───────────────────────────────────────────────────────
  const nowMs           = Date.now();
  const rule            = ruleOf(gameStatus === "idle" ? 0 : gameDifficulty);
  const remainingMs     = deadline > 0 ? Math.max(0, deadline - nowMs) : 0;
  const elapsedMs       = dealtAt > 0 ? nowMs - dealtAt : 0;
  const timeUp          = gameStatus === "dealt" && deadline > 0 && remainingMs <= 0;
  const submitWindowClosed = gameStatus === "dealt" && deadline > 0 && remainingMs <= SUBMIT_BUFFER_MS;
  const minSolveReached = dealtAt > 0 && elapsedMs >= rule.minSolveMs + MIN_SOLVE_BUFFER_MS;
  const rewardPoolReady = poolFree >= Number(gasDisplay(rule.rewardFixed8));
  const undosLeft       = MAX_UNDOS - undosUsed;
  const projectedPayout = (Number(gasDisplay(rule.rewardFixed8)) * rewardPctAfterUndos(undosUsed)) / 100;
  const selectedEntryGas = Number(gasDisplay(rule.entryFixed8));
  const canUseUndo      = gameStatus === "dealt" && undosLeft > 0 && !busy && activeGameId !== "0";
  const canRelease      = timeUp || (gameStatus === "committed" && !isDealing);
  const visibleRanks    = leaderboard.slice(0, 5);
  const visibleHistory  = myHistory.slice(0, 5);

  // ── Bridge state forwarded to Phaser scene ───────────────────────────────
  const bridgeState = {
    gameStatus,
    gameDifficulty,
    activeGameId,
    poolFree,
    credit:       creditGas,
    deadline,
    dealtAt,
    remainingMs,
    elapsedMs,
    timeLimitMs:  rule.limitMs,
    platformsView,
    isStarting,
    isDealing,
    isSubmitting,
    isUndoing,
    timeUp,
    submitWindowClosed,
    minSolveReached,
    rewardPoolReady,
    undosUsed,
    undosLeft,
    maxUndos:     MAX_UNDOS,
    projectedPayout,
    rewardGas:    Number(gasDisplay(rule.rewardFixed8)),
    entryGas:     Number(gasDisplay(rule.entryFixed8)),
    lastPayout,
    commitment,
    difficultyRules: DIFFICULTY_RULES.map((r) => ({
      difficulty: r.difficulty,
      key:        r.key,
      entryGas:   Number(gasDisplay(r.entryFixed8)),
      rewardGas:  Number(gasDisplay(r.rewardFixed8)),
      limitMs:    r.limitMs,
      minSolveMs: r.minSolveMs,
      targetJumps: r.targetJumps,
    })),
  };

  // ── Stage title ──────────────────────────────────────────────────────────
  const stageTitle = isSubmitting
    ? t("statusSubmitting")
    : isDealing || isStarting
      ? t("statusShuffling")
      : gameStatus === "dealt"
        ? t("playingTitle", { difficulty: t(`difficulty_${rule.key}`) })
        : gameStatus === "solved"
          ? t("statusWonTitle")
          : t("lobbyTitle");

  // ── Score bar items ──────────────────────────────────────────────────────
  const scoreItems = gameStatus === "idle"
    ? [
        { label: t("scoreReward"), value: gasLabel(Number(gasDisplay(rule.rewardFixed8))), accent: true },
        { label: t("poolShort"), value: gasLabel(poolFree) },
        { label: t("creditShort"), value: gasLabel(creditGas) },
      ]
    : [
        { label: t("scoreReward"), value: `${projectedPayout.toFixed(2)} GAS`, accent: true },
        {
          label: t("scoreTime"),
          value: gameStatus === "dealt" ? formatClock(remainingMs) : formatClock(rule.limitMs),
        },
        { label: t("scoreUndos"), value: `${undosLeft}/${MAX_UNDOS}` },
      ];

  // ── Action buttons ───────────────────────────────────────────────────────
  const primaryAction =
    gameStatus === "committed"
      ? {
          label:    t("statusShuffling"),
          onClick:  () => void dispatch("retryDeal", {}),
          disabled: isDealing,
          loading:  isDealing,
          hint:     t("shufflingCopy"),
        }
      : gameStatus === "dealt"
        ? timeUp || submitWindowClosed
          ? {
              label:    t("timeUpAction"),
              onClick:  () => void dispatch("expireGame", {}),
              disabled: busy,
              hint:     t("releaseHint"),
            }
          : undefined // Phaser scene owns the jump interaction; no overlay button
        : undefined; // Phaser scene owns lobby difficulty selection and start.

  const secondaryActions = [
    ...(canUseUndo
      ? [
          {
            label:   t("undoAction"),
            onClick: () => void dispatch("useUndo", {}),
            icon:    <RotateCcw size={16} aria-hidden="true" />,
            hint:    t("undoHint"),
          },
        ]
      : []),
    ...(creditGas > 0 && gameStatus !== "dealt"
      ? [
          {
            label:   t("withdrawAction", { amount: creditGas.toFixed(2) }),
            onClick: () => void dispatch("withdrawWinnings", {}),
            icon:    <WalletCards size={16} aria-hidden="true" />,
            hint:    t("withdrawHint"),
          },
        ]
      : []),
    ...(canRelease
      ? [
          {
            label:   t("releaseAction"),
            onClick: () => void dispatch("expireGame", {}),
            icon:    <RefreshCw size={16} aria-hidden="true" />,
            hint:    t("releaseHint"),
          },
        ]
      : []),
    {
      label:   t("refreshRanks"),
      onClick: () => void dispatch("refreshLeaderboard", {}),
      icon:    <Trophy size={16} aria-hidden="true" />,
      hint:    t("leaderboardIntro"),
    },
  ];

  return (
    <div className="jr-playarea mx2 mx2-cat-game">
      <PlayStage
        category="game"
        className="jr-playstage"
        stage={{
          eyebrow:  t("appEyebrow"),
          title:    stageTitle,
          subtitle: t("appSubtitle"),
          badges: (
            <span className="mx2-badge" data-tone="accent">
              <span className="mx2-badge__dot" /> Neo
            </span>
          ),
        }}
        scene={
          <PhaserGameComponent
            config={GAME_CONFIG}
            state={bridgeState}
            dispatch={dispatch}
            className="jr-phaser-canvas"
            ariaLabel="Jump Rush platform game"
            loadingLabel="Loading jump route"
          />
        }
        score={scoreItems}
        actions={{
          primary:              primaryAction,
          secondary:            secondaryActions.length > 0 ? secondaryActions : undefined,
          secondaryToggleLabel: t("moreActions"),
        }}
        drawerToggleLabel={t("drawerTitle")}
        drawer={{
          title:    t("drawerTitle"),
          children: (
            <div className="jr-drawer">
              <div className="jr-drawer__summary" aria-label={t("drawerSummaryLabel")}>
                <div>
                  <span>{t("rankLabel")}</span>
                  <strong>{myRank > 0 ? `#${myRank}` : "--"}</strong>
                </div>
                <div>
                  <span>{t("scoreWon")}</span>
                  <strong>{gasLabel(myTotalWon)}</strong>
                </div>
                <div>
                  <span>{t("creditLabel")}</span>
                  <strong>{gasLabel(creditGas)}</strong>
                </div>
              </div>

              <section className="jr-drawer__panel jr-drawer__panel--run">
                <div className="jr-drawer__panel-head">
                  <Zap size={16} aria-hidden="true" />
                  <h4>{gameStatus === "dealt" ? t("activeRunTitle") : t("nextRunTitle")}</h4>
                </div>
                <div className="jr-run-card">
                  <span>{t(`difficulty_${rule.key}`)}</span>
                  <strong>{gameStatus === "dealt" ? formatClock(remainingMs) : formatClock(rule.limitMs)}</strong>
                  <small>
                    {t("runEconomyLine", {
                      entry:  selectedEntryGas.toFixed(selectedEntryGas >= 1 ? 0 : 2),
                      reward: Number(gasDisplay(rule.rewardFixed8)).toFixed(Number(gasDisplay(rule.rewardFixed8)) >= 1 ? 0 : 1),
                    })}
                  </small>
                </div>
                {!rewardPoolReady && gameStatus !== "dealt" && (
                  <p className="jr-drawer__notice">{t("statusPoolLow")}</p>
                )}
                {gameStatus === "solved" && lastPayout && (
                  <p className="jr-drawer__notice" data-tone="success">
                    {t("lastRunLine", { payout: lastPayout, time: runTimeLabel(lastElapsedMs) })}
                  </p>
                )}
              </section>

              <section className="jr-drawer__panel">
                <div className="jr-drawer__panel-head">
                  <Trophy size={16} aria-hidden="true" />
                  <h4>{t("leaderboardTitle")}</h4>
                  <button type="button" onClick={() => void dispatch("refreshLeaderboard", {})}>
                    <RefreshCw size={14} aria-hidden="true" />
                    <span>{t("refreshRanks")}</span>
                  </button>
                </div>
                {visibleRanks.length > 0 ? (
                  <ol className="jr-ranks jr-ranks--phaser">
                    {visibleRanks.map((entry) => (
                      <li key={`${entry.rank}-${entry.address}`} className="jr-ranks__row" data-me={entry.isUser ? "true" : undefined}>
                        <span className="jr-ranks__rank">#{entry.rank}</span>
                        <span className="jr-ranks__addr">{shortAddress(entry.address)}</span>
                        <span className="jr-ranks__runs">{t("solvesCount", { count: entry.runs })}</span>
                        <strong className="jr-ranks__won">{gasLabel(entry.totalWon)}</strong>
                        {entry.isUser && <span className="jr-ranks__me">{t("youTag")}</span>}
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="jr-drawer__empty">{t("leaderboardEmpty")}</p>
                )}
              </section>

              <section className="jr-drawer__panel">
                <h4>{t("historyTitle")}</h4>
                {visibleHistory.length > 0 ? (
                  <ul className="jr-history">
                    {visibleHistory.map((run) => (
                      <li key={`${run.gameId}-${run.elapsedMs}-${run.payout}`}>
                        <span>{t(`difficulty_${ruleOf(run.difficulty).key}`)}</span>
                        <strong>{run.payout}</strong>
                        <small>
                          {run.jumps} / {run.perfects} · {runTimeLabel(run.elapsedMs)} · {t("historyUndos", { undos: run.undos })}
                        </small>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="jr-drawer__empty">{t("historyEmpty")}</p>
                )}
              </section>

              <section className="jr-drawer__panel jr-drawer__panel--guide">
                <div className="jr-drawer__guide-title">
                  <ShieldCheck size={16} aria-hidden="true" />
                  <h4>{t("fairnessTitle")}</h4>
                </div>
                <p>{t("rulesCopy")}</p>
                <p>{t("fairnessCopy")}</p>
              </section>

              {commitment && (
                <p className="jr-drawer__seed">
                  {t("commitmentLine", {
                    commitment: `${commitment.slice(0, 12)}…${commitment.slice(-8)}`,
                    gameId:     activeGameId,
                  })}
                </p>
              )}
            </div>
          ),
        }}
      />
    </div>
  );
}
