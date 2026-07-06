/**
 * PhaserPlayArea.tsx — Phaser 3 wrapper for the Snake Bounty miniapp.
 *
 * Replaces PlayArea.tsx when the Phaser renderer is active.
 * All blockchain / wallet / oracle logic stays in main.tsx; this component:
 *   1. Reads observable state and builds a flat bridge-state snapshot.
 *   2. Mounts <PhaserGameComponent> which injects that snapshot into the
 *      running SnakeScene via the GameBridge.
 *   3. Forwards SnakeScene dispatch calls back to main.tsx actions.
 *
 * Bridge state shape consumed by SnakeScene:
 *   gameStatus      string  — "idle"|"committed"|"dealt"|"solved"|"expired"
 *   clues           string  — JSON: { body, direction, food, foodQueue }
 *   gameDifficulty  number  — 0=easy, 1=medium, 2=hard
 *   deadline        number  — ms epoch deadline
 *   dealtAt         number  — ms epoch when game was dealt
 *   poolFree        number  — available reward pool (human GAS units)
 *   isStarting      boolean
 *   isDealing       boolean
 *   isSubmitting    boolean
 *   lastStatus      string
 *
 * Actions forwarded to main.tsx:
 *   "startGame"       { difficulty: number }
 *   "recordMove"      { dir: number }
 *   "submitSolution"  {}
 *   "expireGame"      {}
 */
import { useCallback } from "react";
import { useStateBindings } from "@shared/react";
import type { PlayAreaProps } from "@shared/react";
import { PlayStage } from "@shared/components-react/v2";
import { PhaserGameComponent } from "@shared/phaser/PhaserGameComponent";
import { SnakeScene } from "./scenes/SnakeScene";
import {
  ruleOf,
  formatClock,
  gasDisplay,
} from "./logic/game-rules";
import type { Difficulty } from "./logic/game-rules";
import { Play, Check, Clock } from "lucide-react";
import "./PlayArea.scss";

// ── Game config ───────────────────────────────────────────────────────────────

import type Phaser from "phaser";

const GAME_CONFIG: Phaser.Types.Core.GameConfig = {
  scene: [SnakeScene],
  width:  440,
  height: 580,
  backgroundColor: "transparent",
  transparent: true,
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function PhaserPlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { str, bool, val, num } = useStateBindings(state);

  // ── Observable bindings ───────────────────────────────────────────────────
  const gameStatus     = str("gameStatus", "idle");
  const clues          = str("clues", "");
  const gameDifficulty = (num("gameDifficulty") ?? 0) as Difficulty;
  const deadline       = val<number>("deadline", 0) ?? 0;
  const dealtAt        = val<number>("dealtAt", 0) ?? 0;
  const poolFree       = val<number>("poolFree", 0) ?? 0;
  const isStarting     = bool("isStarting");
  const isDealing      = bool("isDealing");
  const isSubmitting   = bool("isSubmitting");
  const lastStatus     = str("lastStatus", t("statusReady"));
  const walletConnected = bool("walletConnected");
  const creditGas      = val<number>("credit", 0) ?? 0;
  const myTotalWon     = val<number>("myTotalWon", 0) ?? 0;
  const myRank         = val<number>("myRank", 0) ?? 0;

  const rule     = ruleOf(gameDifficulty);
  const nowMs    = Date.now();
  const remainMs = deadline > 0 ? Math.max(0, deadline - nowMs) : 0;
  const busy     = isStarting || isDealing || isSubmitting;

  // ── Bridge state snapshot (plain object pushed into the Phaser scene) ─────
  const bridgeState = {
    gameStatus,
    clues,
    gameDifficulty,
    deadline,
    dealtAt,
    poolFree,
    isStarting,
    isDealing,
    isSubmitting,
    lastStatus,
    walletConnected,
  };

  // ── Dispatch forwarding ───────────────────────────────────────────────────
  const handleDispatch = useCallback(
    (action: string, args: unknown) => dispatch(action, args as Record<string, unknown>),
    [dispatch],
  );

  // ── Stage title ───────────────────────────────────────────────────────────
  const stageTitle =
    isDealing || gameStatus === "committed" ? t("statusStarted")
    : gameStatus === "dealt"               ? t("playingTitle", { difficulty: t(`difficulty_${rule.key}`) })
    : gameStatus === "solved"              ? t("statusWonTitle")
    : gameStatus === "expired"             ? t("expiredBanner")
    : t("lobbyTitle");

  // ── Primary action ────────────────────────────────────────────────────────
  const canStart  = walletConnected && poolFree >= Number(gasDisplay(rule.entryFixed8));
  const timeUp    = gameStatus === "dealt" && deadline > 0 && remainMs <= 0;

  type PrimaryAction = {
    label: string;
    onClick: () => void;
    disabled?: boolean;
    loading?: boolean;
    icon?: React.ReactNode;
    hint?: string;
  };

  let primaryAction: PrimaryAction;
  if (gameStatus === "dealt") {
    if (timeUp) {
      primaryAction = {
        label:    t("timeUpAction"),
        onClick:  () => { void dispatch("expireGame", {}); },
        disabled: busy,
        hint:     t("timeUpHint"),
      };
    } else {
      primaryAction = {
        label:    t("submitAction"),
        onClick:  () => { void dispatch("submitSolution", {}); },
        disabled: busy,
        loading:  isSubmitting,
        icon:     <Check size={16} aria-hidden="true" />,
        hint:     t("submitHint"),
      };
    }
  } else if (gameStatus === "committed") {
    primaryAction = {
      label:   t("statusShuffling"),
      onClick: () => { void dispatch("retryDeal", {}); },
      disabled: isDealing,
      loading:  isDealing,
      icon:    <Clock size={16} aria-hidden="true" />,
    };
  } else {
    primaryAction = {
      label:    t("startAction"),
      onClick:  () => { void dispatch("startGame", { difficulty: gameDifficulty }); },
      disabled: busy || !canStart,
      loading:  isStarting,
      icon:     <Play size={16} aria-hidden="true" />,
      hint:     !walletConnected
                  ? t("walletRequiredStatus")
                  : !canStart
                  ? t("statusPoolLow")
                  : t("startHint", { amount: gasDisplay(rule.entryFixed8) }),
    };
  }

  // ── Secondary actions ─────────────────────────────────────────────────────
  const secondaryActions = [
    ...(timeUp || (gameStatus === "committed" && !isDealing)
      ? [{
          label:   t("releaseAction"),
          onClick: () => { void dispatch("expireGame", {}); },
          hint:    t("releaseHint"),
        }]
      : []),
    ...(creditGas > 0 && gameStatus !== "dealt"
      ? [{
          label:   t("withdrawAction", { amount: creditGas.toFixed(2) }),
          onClick: () => { void dispatch("withdrawWinnings", {}); },
          hint:    t("withdrawHint"),
        }]
      : []),
  ];

  return (
    <div className="snake-playarea mx2 mx2-cat-game" aria-busy={busy || undefined}>
      <PlayStage
        category="game"
        stage={{
          eyebrow:  t("appEyebrow"),
          title:    stageTitle,
          subtitle: t("appSubtitle"),
          badges: (
            <>
              <span className="mx2-badge" data-tone="accent">
                <span className="mx2-badge__dot" />
                {t("networkBadge")}
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
            dispatch={handleDispatch}
            height={520}
          />
        }
        score={[
          {
            label:  t("scoreReward"),
            value:  `${gasDisplay(rule.rewardFixed8)} GAS`,
            accent: true,
          },
          {
            label: t("scoreTime"),
            value: gameStatus === "dealt" ? formatClock(remainMs) : formatClock(rule.limitMs),
          },
          {
            label: t("scoreWon"),
            value: `${myTotalWon.toFixed(2)} GAS`,
          },
        ]}
        actions={{
          primary:   primaryAction,
          secondary: secondaryActions.length > 0 ? secondaryActions : undefined,
        }}
        drawerToggleLabel={t("drawerTitle")}
        drawer={{
          title:    t("drawerTitle"),
          children: (
            <div className="snake-drawer__head">
              <p>{t("rulesCopy")}</p>
              <p>{t("fairnessCopy")}</p>
            </div>
          ),
        }}
      />
    </div>
  );
}
