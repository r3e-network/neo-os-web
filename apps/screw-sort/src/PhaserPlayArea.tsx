import { useCallback, useEffect, useMemo, useState } from "react";
import { Pause, Play, RotateCcw, Sparkles, Undo2 } from "lucide-react";
import type * as Phaser from "phaser";
import { useStateBindings } from "@shared/react";
import type { PlayAreaProps } from "@shared/react";
import { LazyPhaserGameComponent as PhaserGameComponent } from "@framework/phaser/LazyPhaserGameComponent";
import { MAX_UNDOS } from "./logic/screw-engine";
import type { ScrewSession } from "./logic/screw-engine";
import type { ScrewSortStats } from "./logic/guest-engine";
import "./PlayArea.scss";

const GAME_CONFIG: Phaser.Types.Core.GameConfig = {
  width: 400,
  height: 680,
  backgroundColor: "#fff7e8",
  transparent: true,
};

const loadScrewSortScene = () =>
  import("./scenes/ScrewSortScene").then((module) => module.ScrewSortScene);

export default function PhaserPlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { val, str } = useStateBindings(state);
  const session = val<ScrewSession>("gameSession");
  const stats = val<ScrewSortStats>("stats", { wins: 0, bestMoves: 0, bestStars: 0, lastSeed: "" });
  const lastStatus = str("lastStatus", t("statusReady"));
  const [moveRequestRevision, setMoveRequestRevision] = useState<number | null>(null);

  const sceneText = useMemo(() => ({
    title: t("appEyebrow"),
    level: t("levelLabel"),
    remaining: t("remainingLabel"),
    overflow: t("overflowLabel"),
    fiveSafe: t("fiveSafeLabel"),
    moves: t("movesLabel"),
    caseComplete: t("caseCompleteLabel"),
    winTitle: t("winTitle"),
    winCopy: t("winCopy"),
    efficiencyCopy: t("efficiencyCopy"),
    bestStarsLabel: t("bestStarsLabel"),
    pausedTitle: t("pausedTitle"),
    pausedCopy: t("pausedCopy"),
    newPuzzle: t("newPuzzleAction"),
    restart: t("restartAction"),
    resume: t("resumeAction"),
  }), [t]);

  const bridgeState = useMemo(() => ({
    gameSession: session,
    stats,
    sceneText,
    moveRequestRevision,
  }), [moveRequestRevision, sceneText, session, stats]);

  const sceneDispatch = useCallback(async (action: string, ...args: unknown[]) => {
    if (action !== "selectScrew") {
      return dispatch(action, ...args);
    }
    if (!session || moveRequestRevision !== null) return;

    const requestedRevision = session.core.revision;
    setMoveRequestRevision(requestedRevision);
    try {
      // MiniAppRoot keeps Promise<void> as its public type, but registered
      // actions retain their boolean result at runtime. A rejected/no-op move
      // must release the request without pretending that a transition occurred.
      const accepted = await dispatch(action, ...args) as unknown;
      if (accepted !== true) setMoveRequestRevision(null);
    } catch (error) {
      setMoveRequestRevision(null);
      throw error;
    }
  }, [dispatch, moveRequestRevision, session]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, select, [contenteditable='true']")) return;
      const key = event.key.toLowerCase();
      if ((event.ctrlKey || event.metaKey) && key === "z") {
        event.preventDefault();
        void dispatch("useUndo");
      } else if (key === "p" || key === " ") {
        event.preventDefault();
        void dispatch("togglePause");
      } else if (key === "r") {
        event.preventDefault();
        void dispatch("restartGame");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [dispatch]);

  const core = session?.core;
  const bestStars = stats?.bestStars ?? 0;
  useEffect(() => {
    if (
      moveRequestRevision !== null
      && core
      && core.revision > moveRequestRevision
    ) {
      setMoveRequestRevision(null);
    }
  }, [core, moveRequestRevision]);

  const movePending = moveRequestRevision !== null;
  const canUndo = Boolean(core && session.history.length > 0 && core.undosUsed < MAX_UNDOS);
  const paused = core?.paused ?? false;
  const finished = core?.status === "won";

  return (
    <section
      className="screw-sort-playarea"
      data-state={movePending ? "committing-move" : paused ? "paused" : core?.status ?? "loading"}
      aria-label={t("gameAriaLabel")}
      aria-busy={movePending || undefined}
    >
      <p className="screw-sort-intro">{t("appSubtitle")}</p>
      <PhaserGameComponent
        className="screw-sort-game"
        config={GAME_CONFIG}
        loadScene={loadScrewSortScene}
        state={bridgeState}
        dispatch={sceneDispatch}
        ariaLabel={t("gameAriaLabel")}
        loadingLabel={t("loadingGame")}
        errorLabel={t("gameLoadFailed")}
        retryLabel={t("retryLoad")}
        continueLabel={t("closeAction")}
        enableSoundLabel={t("soundOn")}
        muteSoundLabel={t("soundOff")}
      />

      <div className="screw-sort-control-rail" aria-label={t("progressLabel")}>
        <button
          type="button"
          className="screw-sort-control"
          disabled={!canUndo || movePending}
          onClick={() => void dispatch("useUndo")}
          aria-label={`${t("undoAction")} ${MAX_UNDOS - (core?.undosUsed ?? 0)}`}
        >
          <Undo2 aria-hidden="true" />
          <span>{t("undoAction")}</span>
          <small>{Math.max(0, MAX_UNDOS - (core?.undosUsed ?? 0))}</small>
        </button>
        <button
          type="button"
          className="screw-sort-control screw-sort-control--primary"
          disabled={movePending}
          onClick={() => void dispatch(finished ? "newPuzzle" : "togglePause")}
        >
          {finished ? <Sparkles aria-hidden="true" /> : paused ? <Play aria-hidden="true" /> : <Pause aria-hidden="true" />}
          <span>{finished ? t("newPuzzleAction") : paused ? t("resumeAction") : t("pauseAction")}</span>
        </button>
        <button
          type="button"
          className="screw-sort-control"
          disabled={movePending}
          onClick={() => void dispatch("restartGame")}
        >
          <RotateCcw aria-hidden="true" />
          <span>{t("restartAction")}</span>
        </button>
      </div>

      <p className="screw-sort-live" aria-live="polite" aria-atomic="true">
        {lastStatus}
      </p>
      {bestStars > 0 && (
        <p className="screw-sort-best">
          {t("bestStarsLabel")} {"★".repeat(bestStars)}{"☆".repeat(3 - bestStars)}
        </p>
      )}
    </section>
  );
}
