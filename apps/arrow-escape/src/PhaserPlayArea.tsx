import { useCallback, useEffect, useMemo } from "react";
import { Clock3, Minus, Pause, Play, Plus, RotateCcw, Shield, Sparkles } from "lucide-react";
import { useStateBindings } from "@shared/react";
import type { PlayAreaProps } from "@shared/react";
import { LazyPhaserGameComponent as PhaserGameComponent } from "@framework/phaser/LazyPhaserGameComponent";
import type { ArrowLevel, ArrowRunSnapshot } from "./logic/arrow-engine";
import { MAX_STRIKES, ROUND_DURATION_MS, shortSeed } from "./logic/arrow-engine";
import "./PlayArea.scss";

const GAME_CONFIG = {
  width: 390,
  height: 844,
  backgroundColor: "transparent",
  transparent: true,
} as const;

const loadArrowEscapeScene = () =>
  import("./scenes/ArrowEscapeScene").then((module) => module.ArrowEscapeScene);

function formatClock(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1_000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export default function PhaserPlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { str, num, val } = useStateBindings(state);
  const level = val<ArrowLevel | null>("level", null);
  const run = val<ArrowRunSnapshot | null>("run", null);
  const remainingMs = Math.max(0, val<number>("remainingMs", ROUND_DURATION_MS) ?? ROUND_DURATION_MS);
  const remainingCount = Math.max(0, num("remainingCount"));
  const bestScore = Math.max(0, num("bestScore"));
  const zoom = Math.max(0.85, Math.min(1.55, num("zoom") || 1));
  const moveEvent = val("moveEvent", null);
  const lastStatus = str("lastStatus", t("statusReady"));
  const restoredNotice = str("restoredNotice", "");
  const status = run?.status ?? "playing";
  const strikes = Math.max(0, Math.min(MAX_STRIKES, run?.strikes ?? 0));
  const score = Math.max(0, run?.score ?? 0);
  const seed = run?.seed ?? level?.seed ?? "";
  const waitingToStart = status === "paused" && run?.resumedAt === 0 && run?.elapsedMs === 0;

  useEffect(() => {
    void dispatch("enterGame");
  }, [dispatch]);

  const bridgeState = useMemo(() => ({
    level,
    run,
    zoom,
    moveEvent,
  }), [level, moveEvent, run, zoom]);

  const setZoom = useCallback((next: number) => {
    void dispatch("setZoom", Math.max(0.85, Math.min(1.55, next)));
  }, [dispatch]);

  const onShellKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.target instanceof HTMLButtonElement || event.target instanceof HTMLInputElement) return;
    if (event.key === " " || event.key.toLowerCase() === "p") {
      event.preventDefault();
      void dispatch("togglePause");
    } else if (event.key.toLowerCase() === "r") {
      event.preventDefault();
      void dispatch("restartGame");
    } else if (event.key === "+" || event.key === "=") {
      event.preventDefault();
      setZoom(zoom + 0.1);
    } else if (event.key === "-") {
      event.preventDefault();
      setZoom(zoom - 0.1);
    }
  }, [dispatch, setZoom, zoom]);

  const modal = (status === "paused" && !waitingToStart) || status === "won" || status === "lost";
  const modalTitle = status === "paused"
    ? t("pauseTitle")
    : status === "won"
      ? t("winTitle")
      : t("lostTitle");
  const modalCopy = status === "paused"
    ? t("pauseCopy")
    : status === "won"
      ? t("winCopy", { score })
      : t("lostCopy");

  return (
    <div className="arrow-escape-root">
      <div
        className="arrow-escape-shell"
        tabIndex={0}
        onKeyDown={onShellKeyDown}
        aria-label={t("gameAriaLabel")}
      >
        <PhaserGameComponent
          config={GAME_CONFIG}
          loadScene={loadArrowEscapeScene}
          state={bridgeState}
          dispatch={dispatch}
          className="arrow-escape-canvas"
          preserveLogicalSize
          ariaLabel={t("gameAriaLabel")}
          loadingLabel={t("loadingGame")}
          errorLabel={t("gameLoadError")}
          retryLabel={t("retry")}
          continueLabel={t("continue")}
          enableSoundLabel={t("enableSound")}
          muteSoundLabel={t("muteSound")}
        />

        <header className="arrow-hud" aria-label={t("hudAriaLabel")}>
          <div className="arrow-hud__lives" aria-label={t("livesLabel", { count: MAX_STRIKES - strikes })}>
            {Array.from({ length: MAX_STRIKES }, (_, index) => (
              <Shield
                key={index}
                size={20}
                strokeWidth={2.1}
                aria-hidden="true"
                data-active={index < MAX_STRIKES - strikes ? "true" : "false"}
              />
            ))}
          </div>
          <div className="arrow-hud__remaining">
            <span>{t("remainingLabel")}</span>
            <strong>{remainingCount}</strong>
          </div>
          <div className="arrow-hud__timer" data-low={remainingMs <= 15_000 ? "true" : "false"}>
            <Clock3 size={15} aria-hidden="true" />
            <strong>{formatClock(remainingMs)}</strong>
          </div>
          <button
            type="button"
            className="arrow-icon-button arrow-hud__pause"
            onClick={() => void dispatch("togglePause")}
            disabled={status === "won" || status === "lost"}
            aria-label={status === "paused" ? t("resume") : t("pause")}
          >
            {status === "paused" ? <Play size={18} aria-hidden="true" /> : <Pause size={18} aria-hidden="true" />}
          </button>
        </header>

        <div className="arrow-score-strip" aria-label={t("scoreLabel", { score })}>
          <span>{t("scoreShort")}</span>
          <strong>{score.toLocaleString()}</strong>
          <i aria-hidden="true" />
          <span>{t("bestShort")}</span>
          <strong>{bestScore.toLocaleString()}</strong>
        </div>

        {restoredNotice ? (
          <div className="arrow-restore-notice" role="status">
            <RotateCcw size={13} aria-hidden="true" />
            <span>{restoredNotice}</span>
          </div>
        ) : null}

        <footer className="arrow-controls">
          <button
            type="button"
            className="arrow-seed"
            onClick={() => void dispatch("restartGame")}
            aria-label={t("replaySeedLabel", { seed: shortSeed(seed) })}
          >
            <span>{t("seedLabel")}</span>
            <strong>{shortSeed(seed)}</strong>
            <RotateCcw size={14} aria-hidden="true" />
          </button>
          <div className="arrow-zoom" aria-label={t("zoomLabel")}>
            <button type="button" onClick={() => setZoom(zoom - 0.1)} aria-label={t("zoomOut")}>
              <Minus size={18} aria-hidden="true" />
            </button>
            <input
              type="range"
              min="0.85"
              max="1.55"
              step="0.05"
              value={zoom}
              onChange={(event) => setZoom(Number(event.currentTarget.value))}
              aria-label={t("zoomLabel")}
            />
            <button type="button" onClick={() => setZoom(zoom + 0.1)} aria-label={t("zoomIn")}>
              <Plus size={18} aria-hidden="true" />
            </button>
          </div>
        </footer>

        {modal ? (
          <section className="arrow-modal" role="dialog" aria-modal="true" aria-labelledby="arrow-modal-title">
            <div className="arrow-modal__panel">
              <Sparkles size={29} aria-hidden="true" />
              <h2 id="arrow-modal-title">{modalTitle}</h2>
              <p>{modalCopy}</p>
              <div className="arrow-modal__actions">
                {status === "paused" ? (
                  <button type="button" className="arrow-primary" onClick={() => void dispatch("togglePause")}>
                    <Play size={17} aria-hidden="true" />
                    {t("resume")}
                  </button>
                ) : null}
                <button type="button" className={status === "paused" ? "arrow-secondary" : "arrow-primary"} onClick={() => void dispatch("restartGame")}>
                  <RotateCcw size={17} aria-hidden="true" />
                  {t("replay")}
                </button>
                {status !== "paused" ? (
                  <button type="button" className="arrow-secondary" onClick={() => void dispatch("newGame")}>
                    {t("newGarden")}
                  </button>
                ) : null}
              </div>
              <small>{t("localOnlyNotice")}</small>
            </div>
          </section>
        ) : null}

        <span className="arrow-sr-status" role="status" aria-live="polite">{lastStatus}</span>
      </div>
    </div>
  );
}
