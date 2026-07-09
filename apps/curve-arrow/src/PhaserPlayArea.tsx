/**
 * PhaserPlayArea.tsx — Phaser 3 wrapper for the Curve Arrow miniapp.
 *
 * All blockchain / wallet / oracle logic stays in main.tsx; this component:
 *   1. Reads observable state and builds a flat bridge-state snapshot.
 *   2. Mounts <PhaserGameComponent> which injects that snapshot into the
 *      running CurveArrowScene via the GameBridge.
 *   3. Forwards CurveArrowScene dispatch calls back to main.tsx actions.
 *
 * Bridge state shape consumed by CurveArrowScene:
 *   gameStatus      string  — "idle"|"committed"|"dealt"|"solved"|"expired"
 *   clues           string  — JSON: { levels: [{ target, obstacles }] }
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
 *   "recordShot"      { holds: number[] }
 *   "submitSolution"  {}
 *   "expireGame"      {}
 */
import { useCallback, useState } from "react";
import { ChevronDown, RefreshCcw, RotateCcw, ShieldCheck, Trophy, WalletCards } from "lucide-react";
import { useStateBindings } from "@shared/react";
import type { PlayAreaProps } from "@shared/react";
import { PlayStage } from "@shared/components-react/v2";
import { PhaserGameComponent } from "@framework/phaser";
import { CurveArrowScene } from "./scenes/CurveArrowScene";
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
  scene: [CurveArrowScene],
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
  const appMode        = str("appMode", "gamefi");
  const isGuest        = appMode === "guest";

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
    appMode,
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
  const hudItems = isGuest
    ? [
        {
          label: t("guestGoalMetric"),
          value: t("targetRibbon", { target: rule.targetLevels }),
          accent: true,
        },
        {
          label: t("timeMetric"),
          value: gameStatus === "dealt" ? formatClock(remainMs) : formatClock(rule.limitMs),
          accent: timeUp,
        },
        {
          label: t("guestBestMetric"),
          value: `${Math.round(myTotalWon)}`,
          accent: false,
        },
      ]
    : [
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

  // Drawer detail cells — GAS/pool/credit framing in gamefi, local framing in guest.
  const drawerCells = isGuest
    ? [
        { label: t("guestModeLabel"), value: t("guestLocalRun") },
        { label: t("guestBestMetric"), value: `${Math.round(myTotalWon)}` },
        { label: t("scoreLevels"), value: t("targetRibbon", { target: rule.targetLevels }) },
        { label: t("timeMetric"), value: formatClock(rule.limitMs) },
      ]
    : [
        { label: t("progressionStatusLabel"), value: routeStatus },
        { label: t("creditLabel"), value: `${creditGas.toFixed(2)} GAS` },
        { label: t("scoreReward"), value: `${gasDisplay(rule.rewardFixed8)} GAS` },
        { label: t("scoreWon"), value: `${myTotalWon.toFixed(2)} GAS` },
      ];

  return (
    <div className="curve-arrow-playarea mx2 mx2-cat-game" aria-busy={busy || undefined}>
      <PlayStage
        category="game"
        className="curve-arrow-playstage"
        stage={{
          eyebrow:  t("appEyebrow"),
          title:    stageTitle,
          subtitle: t("appSubtitle"),
          badges: (
            <>
              <span className="mx2-badge" data-tone="accent">
                <span className="mx2-badge__dot" />
                {isGuest ? t("guestBadge") : t("networkBadge")}
              </span>
              {!isGuest && myRank > 0 && (
                <span className="mx2-badge">{t("rankBadge", { rank: myRank })}</span>
              )}
            </>
          ),
        }}
        scene={
          <div className="curve-arrow-stage-shell">
            <PhaserGameComponent
              config={GAME_CONFIG}
              state={bridgeState}
              dispatch={handleDispatch}
              className="curve-arrow-phaser-canvas"
              ariaLabel="Curve Arrow archery game"
              loadingLabel="Opening archery range"
            />
            <div className="curve-arrow-stage-hud" aria-label={t("routeSummary")}>
              {hudItems.map((item) => (
                <div
                  className="curve-arrow-stage-hud__metric"
                  data-accent={item.accent ? "true" : undefined}
                  key={`${item.label}-${item.value}`}
                >
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
              ))}
              <button
                type="button"
                className="curve-arrow-stage-hud__drawer"
                onClick={() => setDrawerOpen((open) => !open)}
                aria-expanded={drawerOpen}
              >
                <span>{t("drawerTitleShort")}</span>
                <ChevronDown size={16} aria-hidden="true" data-open={drawerOpen ? "true" : undefined} />
              </button>
            </div>
            {drawerOpen && (
              <section className="curve-arrow-ingame-drawer" aria-label={t("drawerTitle")}>
                <div className="curve-arrow-ingame-drawer__head">
                  <Trophy size={18} aria-hidden="true" />
                  <div>
                    <h3>{t("drawerTitle")}</h3>
                    <p>{isGuest ? t("guestDrawerHint") : t("fairnessShort")}</p>
                  </div>
                  <img
                    className="curve-arrow-ingame-drawer__medal"
                    src="./art/reward-medal.webp"
                    alt=""
                    aria-hidden="true"
                  />
                </div>
                <div className="curve-arrow-ingame-drawer__grid">
                  {drawerCells.map((cell) => (
                    <span key={cell.label}>
                      <small>{cell.label}</small>
                      <strong>{cell.value}</strong>
                    </span>
                  ))}
                </div>
                {drawerActions.length > 0 && (
                  <div className="curve-arrow-ingame-drawer__actions">
                    {drawerActions.map((action) => (
                      <button type="button" key={action.label} onClick={action.onClick}>
                        {action.icon}
                        <span>{action.label}</span>
                      </button>
                    ))}
                  </div>
                )}
                <div className="curve-arrow-ingame-drawer__fairness">
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
