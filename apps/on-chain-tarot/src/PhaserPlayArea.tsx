import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import { PlayStage } from "@shared/components-react/v2";
import { PhaserGameComponent } from "@shared/phaser/PhaserGameComponent";
import { TarotScene } from "./scenes/TarotScene";
import "./PlayArea.scss";

interface P {
  t: (k: string, p?: Record<string, string | number>) => string;
  state: Record<string, Observable>;
  dispatch: (n: string, ...a: unknown[]) => Promise<void>;
}

const GAME_CONFIG = { scene: [TarotScene], width: 420, height: 580 } as const;

export default function PhaserPlayArea({ t, state, dispatch }: P) {
  const { bool, val } = useStateBindings(state);
  const bridgeState = {
    hasDrawn:       bool("hasDrawn"),
    allFlipped:     bool("allFlipped"),
    readingMode:    val<string>("readingMode") ?? "idle",
    question:       val<string>("question") ?? "",
    drawn:          val("drawn") ?? [],
    isLoading:      bool("isLoading"),
    prepaidCredit:  val<number>("prepaidCredit") ?? 0,
  };
  const hasDrawn  = bool("hasDrawn");
  const allFlipped = bool("allFlipped");

  return (
    <div className="tarot-play-area mx2 mx2-cat-game">
      <PlayStage
        category="game"
        stage={{
          eyebrow:  t("appEyebrow"),
          title:    allFlipped ? t("oracleVerifiedShort") : hasDrawn ? t("oracleSealed") : t("awaitingDraw"),
          subtitle: t("appSubtitle"),
        }}
        scene={<PhaserGameComponent config={GAME_CONFIG} state={bridgeState} dispatch={dispatch} height={520} />}
        actions={allFlipped
          ? { primary: { label: t("newReading"), onClick: () => void dispatch("reset") } }
          : !hasDrawn
            ? { primary: { label: t("drawAction"), onClick: () => void dispatch("draw"), loading: bool("isLoading") } }
            : undefined
        }
        drawerToggleLabel={t("fairnessTitle")}
        drawer={{ children: <p>{t("fairnessCopy")}</p> }}
      />
    </div>
  );
}
