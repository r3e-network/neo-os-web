import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import { PlayStage } from "@shared/components-react/v2";
import { PhaserGameComponent } from "@framework/phaser";
import { FogplayScene } from "./scenes/FogplayScene";
import "./PlayArea.scss";

interface P {
  t: (k: string, p?: Record<string, string | number>) => string;
  state: Record<string, Observable>;
  dispatch: (n: string, ...a: unknown[]) => Promise<void>;
}

const GAME_CONFIG = {
  scene: [FogplayScene],
  width: 400,
  height: 580,
} as const;

export default function PhaserPlayArea({ t, state, dispatch }: P) {
  const { str, bool } = useStateBindings(state);
  const coinAnimating = bool("isFlipping") || bool("revealing");
  const result = str("result", "");

  const bridgeState = {
    choice:          str("choice", "heads"),
    betAmount:       str("betAmount", "0.5"),
    isFlipping:      bool("isFlipping"),
    revealing:       bool("revealing"),
    result,
    displayOutcome:  str("displayOutcome", ""),
    winAmount:       str("winAmount", ""),
    canBet:          bool("canBet"),
    validationError: str("validationError", ""),
    formattedMaxPayable: str("formattedMaxPayable", "0"),
    formattedCredit: str("formattedCredit", "0"),
    hasCredit:       bool("hasCredit"),
  };

  const stageTitle = coinAnimating
    ? t("committing")
    : result === "won" ? t("youWon")
    : result === "lost" ? t("youLost")
    : t("title");

  return (
    <div className="fogplay-playarea mx2 mx2-cat-game">
      <PlayStage
        category="game"
        stage={{
          eyebrow:  t("appEyebrow"),
          title:    stageTitle,
          subtitle: t("appSubtitle"),
          badges: <span className="mx2-badge" data-tone="accent"><span className="mx2-badge__dot" /> Neo</span>,
        }}
        scene={
          <PhaserGameComponent
            config={GAME_CONFIG}
            state={bridgeState}
            dispatch={dispatch}
          />
        }
        actions={{
          primary: result
            ? { label: t("playAgain"), onClick: () => void dispatch("resetGame") }
            : undefined,
        }}
        drawerToggleLabel={t("history")}
        drawer={{ children: <p>{t("fairnessNote")}</p> }}
      />
    </div>
  );
}
