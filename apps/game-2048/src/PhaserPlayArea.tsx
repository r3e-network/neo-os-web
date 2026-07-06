/**
 * PhaserPlayArea.tsx — Phaser 3 wrapper for game-2048.
 *
 * Replaces the React-canvas PlayArea.tsx for the Phaser renderer.
 * All blockchain logic stays in main.tsx; this component bridges the
 * observable state into Game2048Scene and forwards dispatch calls back.
 */
import { useStateBindings } from "@shared/react";
import type { PlayAreaProps } from "@shared/react";
import { PlayStage } from "@shared/components-react/v2";
import { PhaserGameComponent } from "@shared/phaser/PhaserGameComponent";
import { Game2048Scene } from "./scenes/Game2048Scene";
import "./PlayArea.scss";

const GAME_CONFIG = {
  // Cast to mutable array so it satisfies Phaser's SceneType[] expectation
  scene: [Game2048Scene] as (typeof Game2048Scene)[],
  width:  400,
  height: 580,
  backgroundColor: "transparent",
  transparent: true,
};

export default function PhaserPlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { str, bool, val } = useStateBindings(state);

  const gameStatus    = str("gameStatus", "idle");
  const gameDifficulty = val<number>("gameDifficulty", 0) ?? 0;
  const isStarting    = bool("isStarting");
  const isDealing     = bool("isDealing");
  const isSubmitting  = bool("isSubmitting");
  const isMoving      = bool("isMoving");
  const runBoard      = val<number[]>("runBoard") ?? [];
  const runMoveCount  = val<number>("runMoveCount", 0) ?? 0;
  const runMaxExp     = val<number>("runMaxExp", 0) ?? 0;
  const creditGas     = val<number>("credit", 0) ?? 0;
  const lastStatus    = str("lastStatus", t("statusReady"));

  // Bridge state pushed into the Phaser scene via GameBridge
  const bridgeState = {
    gameStatus,
    gameDifficulty,
    runBoard,
    runMoveCount,
    runMaxExp,
    isStarting,
    isDealing,
    isSubmitting,
    isMoving,
    creditGas,
    lastStatus,
  };

  const isPlaying  = gameStatus === "dealt";
  const isSolved   = gameStatus === "solved";
  const isExpired  = gameStatus === "expired";
  const isIdle     = gameStatus === "idle";
  const isCommitted = gameStatus === "committed";
  const busy       = isStarting || isDealing || isSubmitting || isMoving;

  const stageTitle = isSolved
    ? t("statusWonTitle")
    : isPlaying
      ? t("playingTitle", { tile: 2 ** (runMaxExp || 1) })
      : isCommitted
        ? t("statusShuffling")
        : t("lobbyTitle");

  const primaryAction = isPlaying
    ? {
        label:    t("submitAction"),
        onClick:  () => void dispatch("submitRun", {}),
        disabled: busy,
        loading:  isSubmitting,
      }
    : isCommitted
      ? {
          label:    t("statusShuffling"),
          onClick:  () => void dispatch("retryDeal", {}),
          disabled: isDealing,
          loading:  isDealing,
        }
      : (isExpired || isSolved)
        ? {
            label:    t("startAction"),
            onClick:  () => void dispatch("startGame", { difficulty: gameDifficulty }),
            disabled: busy,
            loading:  isStarting,
          }
        : undefined; // lobby handles start inside the Phaser scene

  const secondaryActions = [
    ...(isPlaying
      ? [{
          label:   t("useUndo") ?? "Undo",
          onClick: () => void dispatch("useUndo", {}),
          disabled: busy || runMoveCount === 0,
        }]
      : []),
    ...((isExpired || (isCommitted && !isDealing))
      ? [{
          label:   t("releaseAction") ?? "Release",
          onClick: () => void dispatch("expireGame", {}),
        }]
      : []),
    ...(creditGas > 0 && !isPlaying
      ? [{
          label:   t("withdrawAction", { amount: creditGas.toFixed(2) }),
          onClick: () => void dispatch("withdrawWinnings", {}),
        }]
      : []),
  ];

  return (
    <div className="rush-playarea mx2 mx2-cat-game" aria-busy={busy || undefined}>
      <PlayStage
        category="game"
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
            height={520}
          />
        }
        actions={{
          primary:   primaryAction,
          secondary: secondaryActions.length > 0 ? secondaryActions : undefined,
        }}
        drawerToggleLabel={t("drawerTitle")}
        drawer={{ children: <p>{t("rulesCopy")}</p> }}
      />
    </div>
  );
}
