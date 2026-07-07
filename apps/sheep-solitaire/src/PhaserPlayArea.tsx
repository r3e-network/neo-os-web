/**
 * PhaserPlayArea.tsx — Phaser 3 wrapper for Sheep Solitaire.
 *
 * Bridges the observable state from main.tsx into the Phaser SheepScene
 * and forwards dispatch calls back to the blockchain layer.
 */
import { useStateBindings } from "@shared/react";
import type { PlayAreaProps } from "@shared/react";
import { PlayStage } from "@shared/components-react/v2";
import { PhaserGameComponent } from "@framework/phaser";
import { SheepScene } from "./scenes/SheepScene";
import "./PlayArea.scss";

const GAME_CONFIG = {
  scene: [SheepScene],
  width: 400,
  height: 640,
  backgroundColor: "transparent",
  transparent: true,
} as const;

const LOBBY_CARD_BOUNDS = [
  { difficulty: 0, x: 200, y: 122, w: 340, h: 158 },
  { difficulty: 1, x: 200, y: 292, w: 340, h: 158 },
  { difficulty: 2, x: 200, y: 462, w: 340, h: 158 },
] as const;

export default function PhaserPlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { str, bool, val, num } = useStateBindings(state);

  const gameStatus  = str("gameStatus", "idle");
  const isDealing   = bool("isDealing");
  const isStarting  = bool("isStarting");
  const isSubmitting = bool("isSubmitting");
  const isGameOver  = bool("isGameOver");
  const isLobbyInteractive =
    (gameStatus === "idle" || gameStatus === "expired" || gameStatus === "refunded") &&
    !isStarting &&
    !isDealing;

  // Bridge state snapshot: all values must be plain (serializable)
  const bridgeState = {
    gameStatus,
    gameDifficulty: num("gameDifficulty", 0),
    pileCards:      val("pileCards") ?? [],
    slotCards:      val("slotCards") ?? [],
    shuffleLeft:    num("shuffleLeft", 1),
    remove3Left:    num("remove3Left", 1),
    undosUsed:      num("undosUsed", 0),
    isStarting,
    isDealing,
    isSubmitting,
    isUndoing:      bool("isUndoing"),
    isMatching:     bool("isMatching"),
    isGameOver,
    lastStatus:     str("lastStatus", ""),
    lastPayout:     str("lastPayout", ""),
    credit:         num("credit", 0),
    poolFree:       num("poolFree", 0),
  };

  // Derive stage header text
  const isLoading = isStarting || isDealing || gameStatus === "committed";
  const stageTitle = isLoading
    ? t("statusSealing")
    : gameStatus === "solved"
    ? t("statusSolved", { payout: str("lastPayout", "") })
    : isGameOver
    ? t("gameOverBanner")
    : gameStatus === "dealt"
    ? t("statusDealt")
    : t("statusReady");

  const stageSubtitle = gameStatus === "dealt"
    ? t("statusDealt")
    : t("rollDescription");

  const handleLobbyPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isLobbyInteractive) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * GAME_CONFIG.width;
    const y = ((event.clientY - rect.top) / rect.height) * GAME_CONFIG.height;
    const hit = LOBBY_CARD_BOUNDS.find((card) =>
      x >= card.x - card.w / 2 &&
      x <= card.x + card.w / 2 &&
      y >= card.y - card.h / 2 &&
      y <= card.y + card.h / 2,
    );
    if (!hit) return;

    event.preventDefault();
    event.stopPropagation();
    const bridge = (window as typeof window & {
      __phaserBridge?: { dispatch(action: string, ...args: unknown[]): void };
    }).__phaserBridge;
    if (bridge) {
      bridge.dispatch("startGame", { difficulty: hit.difficulty });
    } else {
      void dispatch("startGame", { difficulty: hit.difficulty });
    }
  };

  return (
    <div className="sheep-playarea mx2 mx2-cat-game">
      <PlayStage
        category="game"
        stage={{
          eyebrow: t("rollTab"),
          title:   stageTitle,
          subtitle: stageSubtitle,
          badges: (
            <span className="mx2-badge" data-tone="accent">
              <span className="mx2-badge__dot" />
              {str("chainLabel", "") || "Neo"}
            </span>
          ),
        }}
        scene={
          <div className="sheep-phaser-shell">
            <PhaserGameComponent
              config={GAME_CONFIG}
              state={bridgeState}
              dispatch={dispatch}
              height={580}
            />
            {isLobbyInteractive ? (
              <div
                className="sheep-phaser-lobby-hitarea"
                aria-hidden="true"
                onPointerDown={handleLobbyPointerDown}
              />
            ) : null}
          </div>
        }
        actions={{
          primary: gameStatus === "solved"
            ? {
                label:   t("submitSolution"),
                onClick: () => void dispatch("submitRun"),
              }
            : undefined,
          secondary: gameStatus === "dealt" && !isGameOver
            ? [
                {
                  label:   t("expireGame"),
                  onClick: () => void dispatch("expireGame"),
                },
              ]
            : undefined,
        }}
        drawerToggleLabel={t("historyTitle")}
        drawer={{ children: <p>{t("fairnessNote")}</p> }}
      />
    </div>
  );
}
