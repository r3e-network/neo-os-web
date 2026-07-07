import { useStateBindings } from "@shared/react";
import type { PlayAreaProps } from "@shared/react";
import { PlayStage } from "@shared/components-react/v2";
import { PhaserGameComponent } from "@framework/phaser";
import { ColorClashScene } from "./scenes/ColorClashScene";
import "./PlayArea.scss";

const GAME_CONFIG = { scene: [ColorClashScene], width: 420, height: 580 } as const;

export default function PhaserPlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { str, bool, val } = useStateBindings(state);
  const bridgeState = {
    gameStatus:      str("gameStatus", "idle"),
    gameDifficulty:  val<number>("gameDifficulty", 0) ?? 0,
    sequence:        str("sequence", ""),
    playerSequence:  str("playerSequence", ""),
    isStarting:      bool("isStarting"),
    isDealing:       bool("isDealing"),
    isSubmitting:    bool("isSubmitting"),
    poolFree:        val<number>("poolFree", 0) ?? 0,
    credit:          val<number>("credit", 0) ?? 0,
    lastStatus:      str("lastStatus", ""),
  };
  const isPlaying = str("gameStatus", "idle") === "dealt";
  const isSolved  = str("gameStatus", "idle") === "solved";
  return (
    <div className="cclash-playarea mx2 mx2-cat-game">
      <PlayStage
        category="game"
        stage={{
          eyebrow:  t("appEyebrow"),
          title:    isPlaying ? t("repeatPhase") : isSolved ? t("statusWonTitle") : t("lobbyTitle"),
          subtitle: t("appSubtitle"),
          badges: <span className="mx2-badge" data-tone="accent"><span className="mx2-badge__dot" /> {t("networkBadge")}</span>,
        }}
        scene={<PhaserGameComponent config={GAME_CONFIG} state={bridgeState} dispatch={dispatch} />}
        actions={{
          primary: isPlaying
            ? { label: t("submitAction"), onClick: () => void dispatch("submitSolution"), disabled: bool("isSubmitting") }
            : { label: t("startAction"), onClick: () => void dispatch("startGame", val<number>("gameDifficulty", 0) ?? 0), disabled: bool("isStarting"), loading: bool("isStarting") },
          secondary: (val<number>("credit", 0) ?? 0) > 0
            ? [{ label: t("withdrawAction"), onClick: () => void dispatch("withdrawWinnings") }]
            : undefined,
        }}
        drawerToggleLabel={t("leaderboardTitle")}
        drawer={{ children: <p>{t("rulesTitle")}</p> }}
      />
    </div>
  );
}
