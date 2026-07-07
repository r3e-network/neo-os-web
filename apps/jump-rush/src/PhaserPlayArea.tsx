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
import { JumpRushScene } from "./scenes/JumpRushScene";
import { DIFFICULTY_RULES, formatClock, gasDisplay, ruleOf, rewardPctAfterUndos, MAX_UNDOS } from "./logic/game-rules";
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
  const lastStatus      = str("lastStatus", t("statusReady"));
  const commitment      = str("commitment", "");

  const isStarting      = bool("isStarting");
  const isDealing       = bool("isDealing");
  const isSubmitting    = bool("isSubmitting");

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
    lastStatus,
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
    ? undefined
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
    ...(creditGas > 0 && gameStatus !== "dealt"
      ? [
          {
            label:   t("withdrawAction", { amount: creditGas.toFixed(2) }),
            onClick: () => void dispatch("withdrawWinnings", {}),
            hint:    t("withdrawHint"),
          },
        ]
      : []),
    ...(timeUp || (gameStatus === "committed" && !isDealing)
      ? [
          {
            label:   t("releaseAction"),
            onClick: () => void dispatch("expireGame", {}),
            hint:    t("releaseHint"),
          },
        ]
      : []),
  ];

  return (
    <div className="jr-playarea mx2 mx2-cat-game">
      <PlayStage
        category="game"
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
          />
        }
        score={scoreItems}
        actions={{
          primary:   primaryAction,
          secondary: secondaryActions.length > 0 ? secondaryActions : undefined,
        }}
        drawerToggleLabel={t("drawerTitle")}
        drawer={{
          title:    t("drawerTitle"),
          children: (
            <>
              <h4>{t("rulesTitle")}</h4>
              <p>{t("rulesCopy")}</p>
              <h4>{t("fairnessTitle")}</h4>
              <p>{t("fairnessCopy")}</p>
              {commitment && (
                <p className="jr-drawer__seed">
                  {t("commitmentLine", {
                    commitment: `${commitment.slice(0, 12)}…${commitment.slice(-8)}`,
                    gameId:     activeGameId,
                  })}
                </p>
              )}
            </>
          ),
        }}
      />
    </div>
  );
}
