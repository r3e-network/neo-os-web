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

export default function PhaserPlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { str, bool, val, num } = useStateBindings(state);

  const gameStatus  = str("gameStatus", "idle");
  const isDealing   = bool("isDealing");
  const isStarting  = bool("isStarting");
  const isSubmitting = bool("isSubmitting");
  const isGameOver  = bool("isGameOver");

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
          <PhaserGameComponent
            config={GAME_CONFIG}
            state={bridgeState}
            dispatch={dispatch}
            height={580}
          />
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
