/**
 * PhaserPlayArea.tsx — Phaser 3 wrapper for the Dice Game.
 *
 * Replaces the React-canvas PlayArea.tsx. All blockchain logic stays in
 * main.tsx; this component bridges the observable state into the Phaser
 * DiceScene and forwards Phaser dispatch calls back to main.tsx.
 */
import { useStateBindings } from "@shared/react";
import type { PlayAreaProps } from "@shared/react";
import { PlayStage } from "@shared/components-react/v2";
import { PhaserGameComponent } from "@framework/phaser";
import { DiceScene } from "./scenes/DiceScene";
import "./PlayArea.scss";

const GAME_CONFIG = {
  scene: [DiceScene],
  width:  400,
  height: 600,
  backgroundColor: "transparent",
  transparent: true,
} as const;

export default function PhaserPlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { str, bool, val } = useStateBindings(state);

  // Build the bridge state snapshot (plain object from observables)
  const bridgeState = {
    selectedFace:    str("selectedFace", "6"),
    stakeAmount:     str("stakeAmount", "0.10 GAS"),
    payoutPreview:   str("payoutPreview", "0.57 GAS"),
    lastStatus:      str("lastStatus", t("statusReady")),
    lastOutcome:     str("lastOutcome", ""),
    lastRoll:        str("lastRoll", ""),
    chainLabel:      str("chainLabel", ""),
    isSubmitting:    bool("isSubmitting"),
    isResolving:     bool("isResolving"),
    isUnresolved:    bool("isUnresolved"),
    maxStake:        val<number>("maxStake", 20) ?? 20,
    maxPayableStake: val<number>("maxPayableStake", 0) ?? 0,
    directCredit:    val<number>("directCredit", 0) ?? 0,
    walletConnected: bool("walletConnected"),
    rollHistory:     val("rollHistory") ?? [],
  };

  const isRolling  = bool("isSubmitting") || bool("isResolving");
  const lastOutcome = str("lastOutcome", "");
  const stageTitle  = isRolling
    ? t("throwingTitle")
    : lastOutcome === "won"  ? t("statusWon")
    : lastOutcome === "lost" ? t("statusLost")
    : t("readyTitle");

  return (
    <div className="dice-playarea mx2 mx2-cat-game">
      <PlayStage
        category="game"
        stage={{
          eyebrow:  t("rollTab"),
          title:    stageTitle,
          subtitle: t("rollDescription"),
          badges: (
            <span className="mx2-badge" data-tone="accent">
              <span className="mx2-badge__dot" />
              {str("chainLabel") || t("networkLabel")}
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
        actions={{
          secondary: (val<number>("directCredit", 0) ?? 0) > 0
            ? [{
                label:   t("withdrawAction", { amount: (val<number>("directCredit", 0) ?? 0).toFixed(2) }),
                onClick: () => void dispatch("withdrawCredit", {}),
              }]
            : undefined,
        }}
        drawerToggleLabel={t("historyTitle")}
        drawer={{ children: <p>{t("fairnessNote")}</p> }}
      />
    </div>
  );
}
