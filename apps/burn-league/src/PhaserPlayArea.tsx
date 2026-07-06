import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import { PlayStage } from "@shared/components-react/v2";
import { PhaserGameComponent } from "@shared/phaser/PhaserGameComponent";
import { BurnLeagueScene } from "./scenes/BurnLeagueScene";
import "./PlayArea.scss";

interface P {
  t: (k: string, p?: Record<string, string | number>) => string;
  state: Record<string, Observable>;
  dispatch: (n: string, ...a: unknown[]) => Promise<void>;
}

const GAME_CONFIG = { scene: [BurnLeagueScene], width: 420, height: 600 } as const;

export default function PhaserPlayArea({ t, state, dispatch }: P) {
  const { str, bool, num, val } = useStateBindings(state);
  const bridgeState = {
    seasonPhase:      str("seasonPhase", "dormant"),
    prizePoolDisplay: str("prizePoolDisplay", "0"),
    userBurnedDisplay:str("userBurnedDisplay", "0"),
    formattedRank:    str("formattedRank", "--"),
    countdown:        str("countdown", "00:00:00"),
    burnAmount:       str("burnAmount", "1"),
    isBurning:        bool("isBurning"),
    isSettling:       bool("isSettling"),
    leaderboardPreview: val("leaderboardPreview") ?? [],
    serviceNotice:    str("serviceNotice", ""),
    seasonStatusLabel:str("seasonStatusLabel", ""),
    prepaidCredit:    num("prepaidCredit"),
  };
  return (
    <div className="burn-league-play-area mx2 mx2-cat-game">
      <PlayStage
        category="game"
        stage={{
          eyebrow:  str("seasonPhase", "dormant") === "active" ? t("liveLeague") : t("seasonStatus"),
          title:    bool("isBurning") ? t("burning") : t("readyToBurn"),
          subtitle: t("subtitle"),
        }}
        scene={<PhaserGameComponent config={GAME_CONFIG} state={bridgeState} dispatch={dispatch} height={560} />}
        actions={{
          secondary: [
            ...(bool("isSettling") ? [{ label: t("settleSeason"), onClick: () => void dispatch("settle"), loading: bool("isSettling") }] : []),
            ...(num("prepaidCredit") > 0 ? [{ label: t("withdrawCredit"), onClick: () => void dispatch("withdrawCredit") }] : []),
          ],
        }}
        drawerToggleLabel={t("leaderboard")}
        drawer={{ children: <p>{t("howItWorks")}</p> }}
      />
    </div>
  );
}
