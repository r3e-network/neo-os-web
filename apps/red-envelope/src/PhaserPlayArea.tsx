import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import type { MiniAppLaunchContext } from "@shared/utils/launch-params";
import { PlayStage } from "@shared/components-react/v2";
import { PhaserGameComponent } from "@framework/phaser";
import { RedEnvelopeScene } from "./scenes/RedEnvelopeScene";
import "./PlayArea.scss";

interface PlayAreaProps {
  t: (k: string, p?: Record<string, string | number>) => string;
  state: Record<string, Observable>;
  dispatch: (n: string, ...a: unknown[]) => Promise<void>;
  launchContext: MiniAppLaunchContext;
}

const GAME_CONFIG = { scene: [RedEnvelopeScene], width: 420, height: 580 } as const;

export default function PhaserPlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { bool, val } = useStateBindings(state);
  const bridgeState = {
    openingId:     val<string | null>("openingId") ?? null,
    luckyMessage:  val<{ amount?: number; from?: string } | null>("luckyMessage") ?? null,
    envelopes:     val("envelopes") ?? [],
    isLoading:     bool("isLoading"),
    prepaidCredit: val<number>("prepaidCredit") ?? 0,
  };
  return (
    <div className="redenv-play-area mx2 mx2-cat-game">
      <PlayStage
        category="game"
        stage={{
          eyebrow:  t("appEyebrow"),
          title:    t("appTitle"),
          subtitle: t("appSubtitle"),
        }}
        scene={
          <PhaserGameComponent
            config={GAME_CONFIG}
            state={bridgeState}
            dispatch={dispatch}
            height={540}
          />
        }
        actions={{}}
        drawerToggleLabel={t("historyTitle")}
        drawer={{ children: <p>{t("howItWorks")}</p> }}
      />
    </div>
  );
}
