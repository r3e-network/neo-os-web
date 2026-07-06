import { useStateBindings } from "@shared/react";
import type { PlayAreaProps } from "@shared/react";
import { PlayStage } from "@shared/components-react/v2";
import { PhaserGameComponent } from "@framework/phaser";
import { PetPotionScene } from "./scenes/PetPotionScene";
import "./PlayArea.scss";

const GAME_CONFIG = { scene: [PetPotionScene], width: 420, height: 580 } as const;

export default function PhaserPlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { str, bool, val } = useStateBindings(state);
  const bridgeState = {
    gameStatus:       str("gameStatus", "idle"),
    gameDifficulty:   val<number>("gameDifficulty", 0) ?? 0,
    petStage:         val<number>("petStage", 0) ?? 0,
    petHappiness:     val<number>("petHappiness", 50) ?? 50,
    petHunger:        val<number>("petHunger", 50) ?? 50,
    petEnergy:        val<number>("petEnergy", 50) ?? 50,
    happinessAchieved: val<number>("happinessAchieved", 0) ?? 0,
    actionsUsed:      val<number>("actionsUsed", 0) ?? 0,
    credit:           val<number>("credit", 0) ?? 0,
    poolFree:         val<number>("poolFree", 0) ?? 0,
    isStarting:       bool("isStarting"),
    isDealing:        bool("isDealing"),
    isSubmitting:     bool("isSubmitting"),
    lastStatus:       str("lastStatus", ""),
  };
  const isPlaying = str("gameStatus", "idle") === "dealt";
  const isIdle    = str("gameStatus", "idle") === "idle";
  return (
    <div className="pp-playarea mx2 mx2-cat-game">
      <PlayStage
        category="game"
        stage={{
          eyebrow:  t("appEyebrow"),
          title:    isPlaying ? t("playingTitle") : isIdle ? t("lobbyTitle") : str("gameStatus", ""),
          subtitle: t("appSubtitle"),
        }}
        scene={<PhaserGameComponent config={GAME_CONFIG} state={bridgeState} dispatch={dispatch} height={520} />}
        actions={{
          primary: isPlaying
            ? { label: t("submitAction"), onClick: () => void dispatch("submitSolution"), disabled: bool("isSubmitting") }
            : { label: t("startAction"),  onClick: () => void dispatch("startGame", val<number>("gameDifficulty", 0) ?? 0), disabled: bool("isStarting"), loading: bool("isStarting") },
          secondary: (val<number>("credit", 0) ?? 0) > 0
            ? [{ label: t("withdrawAction"), onClick: () => void dispatch("withdrawWinnings") }]
            : undefined,
        }}
        drawerToggleLabel={t("drawerTitle")}
        drawer={{ children: <p>{t("rulesTitle")}</p> }}
      />
    </div>
  );
}
