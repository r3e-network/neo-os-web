import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import type { MiniAppLaunchContext } from "@shared/utils/launch-params";
import { PlayStage } from "@shared/components-react/v2";
import { PhaserGameComponent } from "@framework/phaser";
import { GasLuckyPoolScene } from "./scenes/GasLuckyPoolScene";
import "./PlayArea.scss";

interface PlayAreaProps {
  t: (k: string, p?: Record<string, string | number>) => string;
  state: Record<string, Observable>;
  dispatch: (n: string, ...a: unknown[]) => Promise<void>;
  launchContext: MiniAppLaunchContext;
}

const GAME_CONFIG = { scene: [GasLuckyPoolScene], width: 420, height: 580 } as const;

export default function PhaserPlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { str, bool, val } = useStateBindings(state);
  const bridgeState = {
    currentClaimKey:       str("currentClaimKey", ""),
    currentPoolId:         str("currentPoolId", ""),
    currentRange:          str("currentRange", t("rewardRangeDefault")),
    claimProgress:         str("claimProgress", ""),
    claimStatus:           str("claimStatus", ""),
    lastClaimAmount:      val<bigint>("lastClaimAmount") ?? 0n,
    lastClaimLuckPercent: str("lastClaimLuckPercent", ""),
    lastTxid:             str("lastTxid", ""),
    lastStatus:           str("lastStatus", ""),
    lastSuccessType:      str("lastSuccessType", ""),
    lastError:            str("lastError", ""),
    isCreating:           bool("isCreating"),
    isClaiming:           bool("isClaiming"),
    isLoading:            bool("isLoading"),
  };
  return (
    <div className="gas-pool-playarea mx2 mx2-cat-game">
      <PlayStage
        category="game"
        stage={{
          eyebrow:  t("appEyebrow"),
          title:    t("appTitle"),
          subtitle: t("appSubtitle"),
        }}
        scene={<PhaserGameComponent config={GAME_CONFIG} state={bridgeState} dispatch={dispatch} />}
        actions={{}}
        drawerToggleLabel={t("drawerTitle")}
        drawer={{ children: <p>{t("howItWorks")}</p> }}
      />
    </div>
  );
}
