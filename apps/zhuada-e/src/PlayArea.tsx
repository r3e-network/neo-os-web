/**
 * PlayArea.tsx — React shell for Catch the Goose (B-class physics edition).
 *
 * Hosts the Three.js canvas via `ThreeGameComponent`, renders the HUD (score /
 * level / time / combo), the 7-slot tray strip, the power-up bar, and the
 * start / next / retry overlay. The canvas owns the physics + picking; React
 * owns the HUD + actions. The overlay sits only over the canvas so the tray +
 * HUD stay live.
 *
 * Code-split: the heavy Three.js + cannon-es scene is loaded on demand (only
 * once the player starts a level) so the lobby + HUD render instantly from the
 * small entry chunk. While the scene chunk is loading we show a lightweight
 * placeholder so layout + overlay stay correct.
 */
import { useEffect, useRef, useState } from "react";
import { useStateBindings } from "@shared/react";
import type { PlayAreaProps } from "@shared/react";
import { PlayStage } from "@shared/components-react/v2";
import { ThreeGameComponent } from "./ThreeGameComponent";
import type { ThreeSceneController } from "./ThreeGameComponent";
import { ITEM_DEFS, TRAY_SLOTS } from "./logic/engine-zhuada";
import { COMBO_WINDOW_MS, COMBO_BONUS_PER_STEP, tuneGravity } from "./logic/game-rules";
import { RefreshCw, Shuffle, Lightbulb, Clock, Volume2, VolumeX } from "lucide-react";
import { sound } from "./logic/sound";
import "./PlayArea.scss";

export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { str, bool, val } = useStateBindings(state);

  // ── Code-split: the 3D scene (three + cannon-es) loads only on first play.
  const [scene, setScene] = useState<ThreeSceneController | null>(null);
  const sceneLoadingRef = useRef(false);

  const gameStatus = str("gameStatus", "idle");
  const score = val<number>("score", 0) ?? 0;
  const level = val<number>("level", 1) ?? 1;
  const timeLeftMs = val<number>("timeLeftMs", 0) ?? 0;
  const combo = val<number>("comboCount", 0) ?? 0;
  const isStarting = bool("isStarting");
  const tray = val<(number | null)[]>("tray", Array(TRAY_SLOTS).fill(null)) ?? [];
  const lastStatus = str("lastStatus", t("statusReady"));
  const powerups = val<{ shuffle: number; hint: number; addTime: number }>(
    "powerups",
    { shuffle: 0, hint: 0, addTime: 0 },
  ) ?? { shuffle: 0, hint: 0, addTime: 0 };

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [actionPreview, setActionPreview] = useState(false);
  const [muted, setMuted] = useState(sound.muted);

  // Playtest debug panel — enabled only with ?debug=1 so it never ships in
  // normal play. Shows live FPS + state + current tuned values, plus quick
  // navigation so a human can calibrate "feel" without grinding every level.
  const debug =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("debug") === "1";
  const [fps, setFps] = useState(0);
  useEffect(() => {
    if (!debug) return;
    let raf = 0;
    let frames = 0;
    let last = performance.now();
    const loop = (now: number): void => {
      frames += 1;
      if (now - last >= 1000) {
        setFps(frames);
        frames = 0;
        last = now;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [debug]);

  const secs = Math.ceil(timeLeftMs / 1000);
  const isPlaying = gameStatus === "dealt";
  const isOver = gameStatus === "solved" || gameStatus === "expired";
  const showOverlay = gameStatus === "idle" || isOver;

  // Lazy-load the physics scene the first time we enter play.
  useEffect(() => {
    if (gameStatus === "dealt" && !scene && !sceneLoadingRef.current) {
      sceneLoadingRef.current = true;
      import("./scenes/ZhuaDaScene")
        .then((m) => setScene(new m.ZhuaDaScene()))
        .catch(() => {
          sceneLoadingRef.current = false;
        });
    }
  }, [gameStatus, scene]);

  const bridgeState = {
    gameStatus,
    items: val<ItemInstanceLike[]>("items", []) ?? [],
    tray,
    score,
    comboCount: combo,
    timeLeftMs,
    level,
    clearedFx: val<number[]>("clearedFx", []) ?? [],
    isStarting,
    powerups,
    shuffleNonce: val<number>("shuffleNonce", 0) ?? 0,
    hintNonce: val<number>("hintNonce", 0) ?? 0,
    // In-canvas localized labels.
    startOpenRun: t("startOpenRun"),
    statusWonTitle: t("statusWonTitle"),
    statusFailedTitle: t("statusFailedTitle"),
    statusNext: t("statusNext"),
    statusRetry: t("statusRetry"),
    statusReady: t("statusReady"),
  };

  const stageTitle = isPlaying
    ? t("playingTitle", { level })
    : isOver
      ? t("statusWonTitle")
      : t("lobbyTitle");

  const hudItems = [
    { label: t("scoreLevel"), value: `${level}` },
    { label: t("scoreLabel"), value: `${score}`, accent: true },
    { label: t("scoreTime"), value: isPlaying ? `${Math.max(0, secs)}s` : "–" },
    { label: t("scoreCombo"), value: combo > 1 ? `x${combo}` : "–" },
  ];

  function startActionPreview() {
    setActionPreview(true);
    window.setTimeout(() => setActionPreview(false), 420);
  }

  function runGameAction(action: string, args: Record<string, unknown>) {
    // Every in-game control is a user gesture → unlock audio here (covers the
    // Start button, which is the first gesture in a session / on mobile).
    sound.unlock();
    startActionPreview();
    void dispatch(action, args);
  }

  const drawerActions = isPlaying
    ? [
        {
          label: t("statusRetry"),
          onClick: () => runGameAction("retry", {}),
          icon: <RefreshCw size={16} aria-hidden="true" />,
          hint: t("statusRetry"),
        },
      ]
    : [];

  const powerActions = isPlaying
    ? [
        {
          key: "shuffle",
          label: t("puShuffle"),
          icon: <Shuffle size={16} aria-hidden="true" />,
          count: powerups.shuffle,
          onClick: () => runGameAction("shuffle", {}),
        },
        {
          key: "hint",
          label: t("puHint"),
          icon: <Lightbulb size={16} aria-hidden="true" />,
          count: powerups.hint,
          onClick: () => runGameAction("hint", {}),
        },
        {
          key: "addTime",
          label: t("puAddTime"),
          icon: <Clock size={16} aria-hidden="true" />,
          count: powerups.addTime,
          onClick: () => runGameAction("addTime", { ms: 15000 }),
        },
      ]
    : [];

  // ── Overlay (start / win / fail) ──
  let overlayTitle = "";
  let overlayTone: "ready" | "win" | "fail" = "ready";
  let overlayBody = "";
  let primaryLabel = "";
  let onPrimary: () => void = () => {};

  if (gameStatus === "idle") {
    overlayTone = "ready";
    overlayTitle = t("lobbyTitle");
    overlayBody = t("startDescription");
    primaryLabel = t("startOpenRun");
    onPrimary = () => runGameAction("startLevel", { level });
  } else if (gameStatus === "solved") {
    overlayTone = "win";
    overlayTitle = t("statusWonTitle");
    overlayBody = t("statusCaught", { bonus: 0 });
    primaryLabel = t("statusNext");
    onPrimary = () => runGameAction("nextLevel", {});
  } else if (gameStatus === "expired") {
    overlayTone = "fail";
    overlayTitle = t("statusFailedTitle");
    overlayBody = t("statusFailed");
    primaryLabel = t("statusRetry");
    onPrimary = () => runGameAction("retry", {});
  }

  return (
    <div
      className="goose-playarea mx2 mx2-cat-game goose-three-playarea"
      aria-busy={isStarting || actionPreview || undefined}
      data-action-preview={actionPreview ? "true" : undefined}
    >
      <PlayStage
        category="game"
        className="goose-playstage"
        stage={{
          eyebrow: t("appEyebrow"),
          title: stageTitle,
          subtitle: t("appSubtitle"),
          badges: (
            <>
              <span className="mx2-badge" data-tone="accent">
                <span className="mx2-badge__dot" /> {t("guestRunValue")}
              </span>
              <span className="mx2-badge">{t("playingTitle", { level })}</span>
            </>
          ),
        }}
        scene={
          <div className="goose-stage-shell">
            <div className="goose-canvas-wrap">
              {scene ? (
                <ThreeGameComponent
                  scene={scene}
                  state={bridgeState}
                  dispatch={dispatch}
                  className="goose-three-canvas"
                  ariaLabel="Catch the Goose physics game"
                  loadingLabel="Loading the pen"
                />
              ) : (
                <div className="goose-canvas-placeholder" aria-hidden="true" />
              )}

              {showOverlay && (
                <div className="goose-overlay" role="dialog" aria-label={overlayTitle}>
                  <div className="goose-overlay__card">
                    <img
                      className="goose-overlay__mascot"
                      data-tone={overlayTone}
                      src="/logo.png"
                      alt=""
                      aria-hidden="true"
                      draggable={false}
                    />
                    <h2 className="goose-overlay__title">{overlayTitle}</h2>
                    {gameStatus === "solved" && (
                      <p className="goose-overlay__score">{t("scoreLabel")} {score}</p>
                    )}
                    {gameStatus !== "idle" && (
                      <p className="goose-overlay__status">{lastStatus}</p>
                    )}
                    <p className="goose-overlay__body">{overlayBody}</p>
                    <button
                      type="button"
                      className="goose-overlay__btn"
                      onClick={onPrimary}
                      disabled={isStarting}
                    >
                      {isStarting ? t("startOpening") : primaryLabel}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Tray strip under the pen */}
            <div className="goose-tray" aria-label={t("scoreTray")}>
              {Array.from({ length: TRAY_SLOTS }).map((_, i) => {
                const kind = tray[i] ?? null;
                const def = kind !== null ? ITEM_DEFS[kind] : null;
                return (
                  <div
                    key={i}
                    className="goose-tray__slot"
                    data-filled={def ? "true" : undefined}
                    title={def?.nameZh}
                  >
                    {def ? <span className="goose-tray__emoji">{def.emoji}</span> : null}
                  </div>
                );
              })}
            </div>

            {/* Power-up bar */}
            {powerActions.length > 0 && (
              <div className="goose-powerbar" role="toolbar" aria-label={t("puTitle")}>
                {powerActions.map((action) => (
                  <button
                    key={action.key}
                    type="button"
                    className="goose-powerbar__btn"
                    data-empty={action.count <= 0 ? "true" : undefined}
                    disabled={action.count <= 0}
                    onClick={action.onClick}
                    title={action.label}
                  >
                    {action.icon}
                    <span className="goose-powerbar__label">{action.label}</span>
                    <span className="goose-powerbar__count">×{action.count}</span>
                  </button>
                ))}
              </div>
            )}

            <div className="goose-stage-hud" aria-label={t("scoreLabel")}>
              {hudItems.map((item) => (
                <div
                  className="goose-stage-hud__metric"
                  data-accent={item.accent ? "true" : undefined}
                  key={`${item.label}-${item.value}`}
                >
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
              ))}
              <button
                type="button"
                className="goose-stage-hud__sound"
                onClick={() => setMuted(sound.toggleMuted())}
                aria-pressed={muted}
                aria-label={muted ? t("soundOff") : t("soundOn")}
                title={muted ? t("soundOff") : t("soundOn")}
              >
                {muted ? <VolumeX size={18} aria-hidden="true" /> : <Volume2 size={18} aria-hidden="true" />}
              </button>
              <button
                type="button"
                className="goose-stage-hud__drawer"
                onClick={() => setDrawerOpen((open) => !open)}
                aria-expanded={drawerOpen}
              >
                <span>{t("moreActions")}</span>
              </button>
            </div>

            {drawerOpen && (
              <section className="goose-ingame-drawer" aria-label={t("moreActions")}>
                <div className="goose-drawer__head">
                  <img
                    className="goose-drawer__mascot"
                    src="/logo.png"
                    alt=""
                    aria-hidden="true"
                    draggable={false}
                  />
                  <p>{t("appSubtitle")}</p>
                </div>
                {drawerActions.length > 0 && (
                  <div className="goose-drawer__actions">
                    {drawerActions.map((action) => (
                      <button type="button" key={action.label} onClick={action.onClick} title={action.hint}>
                        {action.icon}
                        <span>{action.label}</span>
                      </button>
                    ))}
                  </div>
                )}
                <h4>{t("rulesTitle")}</h4>
                <p>{t("rulesCopy")}</p>
                <p className="goose-drawer__status">{lastStatus}</p>
              </section>
            )}
          </div>
        }
        actions={{}}
      />
      {debug && (
        <div className="goose-debug" aria-hidden="true">
          <div className="goose-debug__title">DEBUG · ?debug=1</div>
          <div className="goose-debug__row"><span>FPS</span><b>{fps}</b></div>
          <div className="goose-debug__row"><span>关卡</span><b>{level}</b></div>
          <div className="goose-debug__row"><span>盒剩余</span><b>{bridgeState.items.length}</b></div>
          <div className="goose-debug__row"><span>托盘</span><b>{tray.filter((s) => s !== null).length}/{TRAY_SLOTS}</b></div>
          <div className="goose-debug__row"><span>分数</span><b>{score}</b></div>
          <div className="goose-debug__row"><span>连击</span><b>x{combo}</b></div>
          <div className="goose-debug__row"><span>时间</span><b>{Math.max(0, secs)}s</b></div>
          <div className="goose-debug__row goose-debug__tune"><span>comboWin</span><b>{COMBO_WINDOW_MS}ms</b></div>
          <div className="goose-debug__row goose-debug__tune"><span>bonus/step</span><b>+{COMBO_BONUS_PER_STEP}</b></div>
          <div className="goose-debug__row goose-debug__tune"><span>gravity</span><b>{tuneGravity()}</b></div>
          <div className="goose-debug__hint">调参：?combo=2200&amp;bonus=8&amp;gravity=-16</div>
          <div className="goose-debug__btns">
            <button type="button" onClick={() => runGameAction("nextLevel", {})}>跳过→下关</button>
            <button type="button" onClick={() => runGameAction("debugWin", {})}>强制胜利</button>
            <button type="button" onClick={() => runGameAction("debugLose", {})}>强制失败</button>
            <button type="button" onClick={() => runGameAction("retry", {})}>重开本关</button>
          </div>
        </div>
      )}
    </div>
  );
}

interface ItemInstanceLike {
  id: number;
  kind: number;
  px: number;
  py: number;
  pz: number;
}
