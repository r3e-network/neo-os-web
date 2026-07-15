import { useCallback, useEffect, useMemo } from "react";
import type * as Phaser from "phaser";

import { LazyPhaserGameComponent as PhaserGameComponent } from "@framework/phaser/LazyPhaserGameComponent";
import type { PlayAreaProps } from "@shared/react";
import { useStateBindings } from "@shared/react";

import type { SuikaSnapshot } from "./logic/suika-engine";
import { GRAVITY_Y } from "./logic/suika-engine";
import { createSuikaSceneCopy } from "./suika-copy";
import "./PlayArea.scss";

const GAME_CONFIG: Phaser.Types.Core.GameConfig = {
  width: 390,
  height: 844,
  transparent: true,
  physics: {
    default: "matter",
    matter: {
      gravity: { x: 0, y: GRAVITY_Y },
      debug: false,
    },
  },
};

const loadSuikaScene = () =>
  import("./scenes/SuikaScene").then((module) => module.SuikaScene);

export default function PhaserPlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { val, bool } = useStateBindings(state);
  const game = val<SuikaSnapshot>("game");
  const aimX = val<number>("aimX", 195);
  const storageHealthy = bool("storageHealthy");

  // The play surface mounts only once the player has left the launch page —
  // via its CTA, or straight through it under directPlay/OneGate. That mount
  // is the one honest "the player is here" signal, so it is what deals the
  // run. `enterPlay` is idempotent.
  useEffect(() => {
    void dispatch("enterPlay");
  }, [dispatch]);

  const sceneText = useMemo(
    () => createSuikaSceneCopy(t),
    [t],
  );

  // `storageHealthy` must ride the bridge: SuikaScene renders the "progress
  // cannot be saved" tail off `bool("storageHealthy") === false`, and
  // BaseScene.bool() coerces an ABSENT key to false — so leaving it out of
  // this object made a healthy orchard permanently claim it could not save.
  const bridgeState = useMemo(
    () => ({ game, aimX, sceneText, storageHealthy }),
    [game, aimX, sceneText, storageHealthy],
  );

  const dispatchAction = useCallback((action: string, ...args: unknown[]) => {
    void dispatch(action, ...args);
  }, [dispatch]);

  const liveStatus = game
    ? t(game.messageKey)
    : t("statusReady");

  return (
    <section className="fruit-funnel" aria-label={t("gameAriaLabel")}>
      <div className="fruit-funnel__stage">
        <PhaserGameComponent
          className="fruit-funnel__canvas"
          config={GAME_CONFIG}
          loadScene={loadSuikaScene}
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
        <button type="button" onClick={() => dispatchAction("nudgeAim", -1)} aria-label="◀">{t("aimLeftAction")}</button>
        <button type="button" onClick={() => dispatchAction("dropCurrent")} aria-label={t("dropAction")}>{t("dropAction")}</button>
        <button type="button" onClick={() => dispatchAction("nudgeAim", 1)} aria-label="▶">{t("aimRightAction")}</button>
        <button type="button" onClick={() => dispatchAction("togglePause")}>
          {game?.phase === "paused" ? t("resumeAction") : t("pauseAction")}
        </button>
        <button type="button" onClick={() => dispatchAction("restartGame")}>{t("newGameAction")}</button>
      </div>

      <p className="fruit-funnel__live" aria-live="polite" aria-atomic="true">
        {liveStatus}. {!storageHealthy ? t("storageWarning") : ""}
      </p>
    </section>
  );
}
