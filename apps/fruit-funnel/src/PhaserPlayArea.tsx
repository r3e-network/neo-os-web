import { useCallback, useMemo } from "react";
import type * as Phaser from "phaser";

import { LazyPhaserGameComponent as PhaserGameComponent } from "@framework/phaser/LazyPhaserGameComponent";
import type { PlayAreaProps } from "@shared/react";
import { useStateBindings } from "@shared/react";

import type { FruitSnapshot } from "./logic/fruit-engine";
import { createFruitSceneCopy } from "./scene-copy";
import "./PlayArea.scss";

const GAME_CONFIG: Phaser.Types.Core.GameConfig = {
  width: 390,
  height: 844,
  backgroundColor: "#fff4c7",
  transparent: true,
};

const loadFruitFunnelScene = () =>
  import("./scenes/FruitFunnelScene").then((module) => module.FruitFunnelScene);

export default function PhaserPlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { val, bool } = useStateBindings(state);
  const game = val<FruitSnapshot>("game");
  const hintLanes = val<number[]>("hintLanes");
  const hintMessageKey = val<string | null>("hintMessageKey", null);
  const storageHealthy = bool("storageHealthy");

  const sceneText = useMemo(
    () => createFruitSceneCopy(t),
    [t],
  );

  const bridgeState = useMemo(
    () => ({ game, hintLanes: hintLanes ?? [], hintMessageKey, storageHealthy, sceneText }),
    [game, hintLanes, hintMessageKey, sceneText, storageHealthy],
  );

  const dispatchAction = useCallback((action: string, ...args: unknown[]) => {
    void dispatch(action, ...args);
  }, [dispatch]);

  const liveStatus = hintMessageKey
    ? t(hintMessageKey)
    : game
      ? t(game.messageKey)
      : t("statusReady");

  return (
    <section className="fruit-funnel" aria-label={t("gameAriaLabel")}>
      <div className="fruit-funnel__stage">
        <PhaserGameComponent
          className="fruit-funnel__canvas"
          config={GAME_CONFIG}
          loadScene={loadFruitFunnelScene}
          state={bridgeState}
          dispatch={dispatch}
          ariaLabel={t("gameAriaLabel")}
          loadingLabel={t("loadingGame")}
          errorLabel={t("gameError")}
          retryLabel={t("retryAction")}
          continueLabel={t("continueAction")}
          enableSoundLabel={t("enableSound")}
          muteSoundLabel={t("muteSound")}
        />
      </div>

      <div className="fruit-funnel__a11y-controls" aria-label={t("keyboardHelp")}>
        {Array.from({ length: 6 }, (_, lane) => (
          <button key={lane} type="button" onClick={() => dispatchAction("tapLane", lane)}>
            {lane + 1}
          </button>
        ))}
        <button type="button" onClick={() => dispatchAction("undoMove")}>{t("undoAction")}</button>
        <button type="button" onClick={() => dispatchAction("requestHint")}>{t("hintAction")}</button>
        <button type="button" onClick={() => dispatchAction("togglePause")}>
          {game?.phase === "paused" ? t("resumeAction") : t("pauseAction")}
        </button>
        <button type="button" onClick={() => dispatchAction("restartGame")}>{t("newOrchardAction")}</button>
      </div>

      <p className="fruit-funnel__live" aria-live="polite" aria-atomic="true">
        {liveStatus}. {!storageHealthy ? t("storageWarning") : ""}
      </p>
      <span className="fruit-funnel__heartbeat" aria-hidden="true" />
    </section>
  );
}
