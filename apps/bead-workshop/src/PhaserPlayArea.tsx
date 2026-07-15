import { useCallback, useEffect, useMemo } from "react";
import type * as Phaser from "phaser";
import { useStateBindings } from "@shared/react";
import type { PlayAreaProps } from "@shared/react";
import { LazyPhaserGameComponent as PhaserGameComponent } from "@framework/phaser/LazyPhaserGameComponent";
import { BEAD_COLOR_KEYS, MAX_UNDOS } from "./logic/config";
import type { BeadSnapshot } from "./logic/types";
import "./PlayArea.scss";

const GAME_CONFIG: Phaser.Types.Core.GameConfig = {
  width: 390,
  height: 720,
  backgroundColor: "#fff5dc",
  transparent: true,
};

const loadBeadWorkshopScene = () =>
  import("./scenes/BeadWorkshopScene").then(
    (module) => module.BeadWorkshopScene,
  );

const COPY_KEYS = [
  "appTitle",
  "appEyebrow",
  "boardLabel",
  "trayLabel",
  "trayEmpty",
  "moveToTray",
  "selectPatch",
  "selectedPatch",
  "selectedTray",
  "timerLabel",
  "stepsLabel",
  "progressLabel",
  "undoAction",
  "pauseAction",
  "resumeAction",
  "restartAction",
  "newPatternAction",
  "cancelAction",
  "restartTitle",
  "restartCopy",
  "pauseTitle",
  "pauseCopy",
  "winTitle",
  "winCopy",
  "timeoutTitle",
  "timeoutCopy",
  "stuckTitle",
  "stuckCopy",
  "keyboardHelp",
  "statusReady",
  "statusRecoveredPaused",
  "statusPaused",
  "statusAutoPaused",
  "statusResumed",
  "statusBoardSelected",
  "statusHoldingSelected",
  "statusSelectionCleared",
  "statusMovedToHolding",
  "statusPlacedBatch",
  "statusPlacedPartialBatch",
  "statusWon",
  "statusTimeUp",
  "statusStuck",
  "statusUndone",
  "statusNothingToUndo",
  "statusUndoUnavailable",
  "statusOutsideBoard",
  "statusEmptySocket",
  "statusMatchedLocked",
  "statusNoMovableBatch",
  "statusSelectBatch",
  "statusSelectBoardFirst",
  "statusHoldingNeedsSpace",
  "statusWrongTarget",
  "statusTargetTooSmall",
  "statusHoldingColorMissing",
  "statusCannotResume",
  "storageWarning",
] as const;

function fill(
  template: string,
  values: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) =>
    String(values[key] ?? `{${key}}`),
  );
}

export default function PhaserPlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { val, bool } = useStateBindings(state);
  const game = val<BeadSnapshot>("game");
  const storageHealthy = bool("storageHealthy");

  // The play surface mounts only once the player has left the launch page —
  // via its CTA, or straight through it under directPlay/OneGate. That mount
  // is the one honest "the player is here" signal, so it is what deals the
  // round and starts the studio clock. `enterPlay` is idempotent.
  useEffect(() => {
    void dispatch("enterPlay");
  }, [dispatch]);

  const sceneText = useMemo(() => {
    const copy = Object.fromEntries(COPY_KEYS.map((key) => [key, t(key)]));
    const colorNames = BEAD_COLOR_KEYS.map((key) => t(key));
    return { ...copy, colorNames };
  }, [t]);

  const bridgeState = useMemo(
    () => ({
      game,
      storageHealthy,
      sceneText,
    }),
    [game, sceneText, storageHealthy],
  );

  const statusText = game ? t(game.messageKey) : t("statusReady");
  const selectionText =
    game?.selection?.source === "board"
      ? fill(t("selectedPatch"), {
          count: game.selection.cells.length,
          color: t(BEAD_COLOR_KEYS[game.selection.color] ?? "colorCoral"),
        })
      : game?.selection?.source === "holding"
        ? fill(t("selectedTray"), {
            color: t(BEAD_COLOR_KEYS[game.selection.color] ?? "colorCoral"),
          })
        : t("selectPatch");

  const onKeyboardAction = useCallback(
    (action: string) => {
      void dispatch(action);
    },
    [dispatch],
  );

  return (
    <section className="bead-workshop" aria-label={t("gameAriaLabel")}>
      <PhaserGameComponent
        className="bead-workshop__game"
        config={GAME_CONFIG}
        loadScene={loadBeadWorkshopScene}
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

      <div
        className="bead-workshop__a11y-controls"
        aria-label={t("keyboardHelp")}
      >
        <button
          type="button"
          onClick={() => onKeyboardAction("undoMove")}
          disabled={!game?.history.length}
        >
          {t("undoAction")}{" "}
          {game ? `(${game.history.length}/${MAX_UNDOS})` : ""}
        </button>
        <button type="button" onClick={() => onKeyboardAction("togglePause")}>
          {game?.phase === "paused" ? t("resumeAction") : t("pauseAction")}
        </button>
        <button type="button" onClick={() => onKeyboardAction("restartGame")}>
          {t("newPatternAction")}
        </button>
      </div>

      <p className="bead-workshop__live" aria-live="polite" aria-atomic="true">
        {statusText}. {selectionText}.{" "}
        {!storageHealthy ? t("storageWarning") : ""}
      </p>
      <span className="bead-workshop__heartbeat" aria-hidden="true" />
    </section>
  );
}
