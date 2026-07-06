import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import { PlayStage } from "@shared/components-react/v2";
import { PhaserGameComponent } from "@framework/phaser";
import { LastSurvivorScene } from "./scenes/LastSurvivorScene";
import "./PlayArea.scss";

interface P {
  t: (k: string, p?: Record<string, string | number>) => string;
  state: Record<string, Observable>;
  dispatch: (n: string, ...a: unknown[]) => Promise<void>;
}

const GAME_CONFIG = { scene: [LastSurvivorScene], width: 420, height: 600 } as const;

export default function PhaserPlayArea({ t, state, dispatch }: P) {
  const { str, bool, num } = useStateBindings(state);
  const bridgeState = {
    countdown:        str("countdown", "00:00:00"),
    dangerProgress:   num("dangerProgress"),
    dangerLevel:      str("dangerLevel", "low"),
    dangerLevelText:  str("dangerLevelText", ""),
    totalPotDisplay:  str("totalPotDisplay", "0.00 GAS"),
    userKeys:         num("userKeys"),
    totalKeys:        num("totalKeysDisplay"),
    lastBuyerLabel:   str("lastBuyerLabel", "--"),
    isRoundActive:    bool("isRoundActive"),
    isBuyingKeys:     bool("isBuyingKeys"),
    isSettling:       bool("isSettling"),
    roundDataAvailable: bool("roundDataAvailable"),
    serviceNotice:    str("serviceNotice", ""),
    prepaidCredit:    num("prepaidCredit"),
  };
  return (
    <div className="survivor-play-area mx2 mx2-cat-game">
      <PlayStage
        category="game"
        stage={{
          eyebrow:  t("appEyebrow"),
          title:    bool("isRoundActive") ? t("roundActive") : t("waitingForRound"),
          subtitle: t("appSubtitle"),
          badges: <span className="mx2-badge" data-tone="accent"><span className="mx2-badge__dot" /> Neo</span>,
        }}
        scene={<PhaserGameComponent config={GAME_CONFIG} state={bridgeState} dispatch={dispatch} height={560} />}
        actions={{
          secondary: bool("isSettling")
            ? [{ label: t("settleSeason"), onClick: () => void dispatch("settle"), loading: bool("isSettling") }]
            : (num("prepaidCredit") > 0
              ? [{ label: t("withdrawCredit"), onClick: () => void dispatch("withdrawCredit") }]
              : undefined),
        }}
        drawerToggleLabel={t("historyTitle")}
        drawer={{ children: <p>{t("rulesTitle")}</p> }}
      />
    </div>
  );
}
