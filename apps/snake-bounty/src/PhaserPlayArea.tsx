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
import { useCallback, useState } from "react";
import { ChevronDown, RefreshCcw, RotateCcw, ShieldCheck, Trophy, WalletCards } from "lucide-react";
import { useStateBindings } from "@shared/react";
import type { PlayAreaProps } from "@shared/react";
import { PlayStage } from "@shared/components-react/v2";
import { PhaserGameComponent } from "@framework/phaser";
import { SnakeScene } from "./scenes/SnakeScene";
import {
  ruleOf,
  formatClock,
  gasDisplay,
} from "./logic/game-rules";
import type { Difficulty } from "./logic/game-rules";
import "./PlayArea.scss";

// ── Game config ───────────────────────────────────────────────────────────────

import type * as Phaser from "phaser";

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
  const [drawerOpen, setDrawerOpen] = useState(false);

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
  const progressionReady = bool("progressionReady");
  const requiredDifficulty = val<number>("progressionRequiredDifficulty", 0) ?? 0;
  const activeGameId   = str("activeGameId", "0");

  const rule     = ruleOf(gameDifficulty);
  const nowMs    = Date.now();
  const remainMs = deadline > 0 ? Math.max(0, deadline - nowMs) : 0;
  const busy     = isStarting || isDealing || isSubmitting;

  // ── Bridge state snapshot (plain object pushed into the Phaser scene) ─────
  const bridgeState = {
    activeGameId,
    gameStatus,
    clues,
    gameDifficulty,
    deadline,
    dealtAt,
    poolFree,
    credit: creditGas,
    isStarting,
    isDealing,
    isSubmitting,
    lastStatus,
    walletConnected,
    progressionReady,
    progressionRequiredDifficulty: requiredDifficulty,
  };

  // ── Dispatch forwarding ───────────────────────────────────────────────────
  const handleDispatch = useCallback(
    (action: string, ...args: unknown[]) => (
      args.length > 0
        ? dispatch(action, args[0] as Record<string, unknown>)
        : dispatch(action)
    ),
    [dispatch],
  );

  // ── Stage title ───────────────────────────────────────────────────────────
  const stageTitle =
    isDealing || gameStatus === "committed" ? t("statusStarted")
    : gameStatus === "dealt"               ? t("playingTitle", { difficulty: t(`difficulty_${rule.key}`) })
    : gameStatus === "solved"              ? t("statusWonTitle")
    : gameStatus === "expired"             ? t("expiredBanner")
    : t("lobbyTitle");

  // ── Route and recovery status ─────────────────────────────────────────────
  const routeLocked = progressionReady && gameDifficulty < requiredDifficulty;
  const timeUp    = gameStatus === "dealt" && deadline > 0 && remainMs <= 0;

  // ── Secondary actions ─────────────────────────────────────────────────────
  const drawerActions = [
    ...(gameStatus === "committed" && !isDealing
      ? [{
          label:   t("checkDealAgain"),
          icon:    <RefreshCcw size={16} aria-hidden="true" />,
          onClick: () => { void dispatch("retryDeal", {}); },
        }]
      : []),
    ...(timeUp || (gameStatus === "committed" && !isDealing)
      ? [{
          label:   timeUp ? t("timeUpAction") : t("releaseAction"),
          icon:    <RotateCcw size={16} aria-hidden="true" />,
          onClick: () => { void dispatch("expireGame", {}); },
        }]
      : []),
    ...(creditGas > 0 && gameStatus !== "dealt"
      ? [{
          label:   t("withdrawAction", { amount: creditGas.toFixed(2) }),
          icon:    <WalletCards size={16} aria-hidden="true" />,
          onClick: () => { void dispatch("withdrawWinnings", {}); },
        }]
      : []),
  ];

  const routeStatus = !progressionReady
    ? t("progressionUnavailableShort")
    : routeLocked
      ? t("progressionNextRoute", { difficulty: t(`difficulty_${ruleOf(requiredDifficulty).key}`) })
      : t(`difficulty_${rule.key}`);
  const hudItems = [
    {
      label: t("rewardMetric"),
      value: `${gasDisplay(rule.rewardFixed8)} GAS`,
      accent: true,
    },
    {
      label: t("timeMetric"),
      value: gameStatus === "dealt" ? formatClock(remainMs) : formatClock(rule.limitMs),
      accent: timeUp,
    },
    {
      label: t("wonMetric"),
      value: `${myTotalWon.toFixed(2)} GAS`,
      accent: false,
    },
  ];

  return (
    <div className="snake-playarea mx2 mx2-cat-game" aria-busy={busy || undefined}>
      <PlayStage
        category="game"
        className="snake-playstage"
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
          <div className="snake-stage-shell">
            <PhaserGameComponent
              config={GAME_CONFIG}
              state={bridgeState}
              dispatch={handleDispatch}
              className="snake-phaser-canvas"
              ariaLabel="Snake Bounty arcade game"
              loadingLabel="Opening bounty trail"
            />
            <div className="snake-stage-hud" aria-label={t("routeSummary")}>
              {hudItems.map((item) => (
                <div
                  className="snake-stage-hud__metric"
                  data-accent={item.accent ? "true" : undefined}
                  key={`${item.label}-${item.value}`}
                >
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
              ))}
              <button
                type="button"
                className="snake-stage-hud__drawer"
                onClick={() => setDrawerOpen((open) => !open)}
                aria-expanded={drawerOpen}
              >
                <span>{t("drawerTitleShort")}</span>
                <ChevronDown size={16} aria-hidden="true" data-open={drawerOpen ? "true" : undefined} />
              </button>
            </div>
            {drawerOpen && (
              <section className="snake-ingame-drawer" aria-label={t("drawerTitle")}>
                <div className="snake-ingame-drawer__head">
                  <Trophy size={18} aria-hidden="true" />
                  <div>
                    <h3>{t("drawerTitle")}</h3>
                    <p>{t("fairnessShort")}</p>
                  </div>
                </div>
                <div className="snake-ingame-drawer__grid">
                  <span>
                    <small>{t("progressionStatusLabel")}</small>
                    <strong>{routeStatus}</strong>
                  </span>
                  <span>
                    <small>{t("creditLabel")}</small>
                    <strong>{creditGas.toFixed(2)} GAS</strong>
                  </span>
                  <span>
                    <small>{t("scoreReward")}</small>
                    <strong>{gasDisplay(rule.rewardFixed8)} GAS</strong>
                  </span>
                  <span>
                    <small>{t("scoreWon")}</small>
                    <strong>{myTotalWon.toFixed(2)} GAS</strong>
                  </span>
                </div>
                {drawerActions.length > 0 && (
                  <div className="snake-ingame-drawer__actions">
                    {drawerActions.map((action) => (
                      <button type="button" key={action.label} onClick={action.onClick}>
                        {action.icon}
                        <span>{action.label}</span>
                      </button>
                    ))}
                  </div>
                )}
                <div className="snake-ingame-drawer__fairness">
                  <ShieldCheck size={17} aria-hidden="true" />
                  <p>{t("rulesShort")}</p>
                </div>
              </section>
            )}
          </div>
        }
        actions={{}}
      />
    </div>
  );
}
