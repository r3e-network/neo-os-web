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
import { ITEM_DEFS, SHELF_SLOTS, TRAY_SLOTS, type ModelKind } from "./logic/engine-zhuada";
import { COMBO_WINDOW_MS, COMBO_BONUS_PER_STEP, TOTAL_LEVELS, tuneGravity } from "./logic/game-rules";
import type { PowerupCounts } from "./logic/guest-engine";
import { SCENES } from "./logic/scenes";
import { EMPTY_PROGRESS, bestOverall, clearedLevels, type GooseProgress } from "./logic/progress";
import { RefreshCw, Shuffle, Lightbulb, Clock, Volume2, VolumeX, Vibrate, VibrateOff, BookOpen, Lock, Archive, Undo2, Waves, Timer } from "lucide-react";
import { sound } from "./logic/sound";
import { haptics } from "./logic/haptics";
import { KindChip, colorToCss } from "./KindChip";
import { GooseChip } from "./GooseChip";
import "./PlayArea.scss";

/** messages.ts key for a kind's display name (e.g. "tomato" → "kindTomato"). */
function kindNameKey(model: ModelKind): string {
  return `kind${model.charAt(0).toUpperCase()}${model.slice(1)}`;
}

/** HUD time turns urgent (danger color + pulse) inside the last 10 seconds. */
const TIME_DANGER_MS = 10000;

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
  const shelf = val<(number | null)[]>("shelf", Array(SHELF_SLOTS).fill(null)) ?? [];
  const lastStatus = str("lastStatus", t("statusReady"));
  const powerups = val<PowerupCounts>(
    "powerups",
    { shuffle: 0, hint: 0, remove: 0, undo: 0, addTime: 0 },
  ) ?? { shuffle: 0, hint: 0, remove: 0, undo: 0, addTime: 0 };
  const undoable = bool("undoable");
  const timedMode = bool("timedMode");
  const shakeReadyAt = val<number>("shakeReadyAt", 0) ?? 0;

  const failReason = str("failReason", "");
  // Meta progression (G4): unlocked level / wins / per-level best / geese.
  const progress = val<GooseProgress>("progress", EMPTY_PROGRESS) ?? EMPTY_PROGRESS;
  // Scene id of a goose unlocked by the LAST win (-1 = none) — celebration.
  const unlockNotice = val<number>("unlockNotice", -1) ?? -1;
  const leaderboard = val<LeaderRow[]>("leaderboard", []) ?? [];
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [collectionOpen, setCollectionOpen] = useState(false);
  const [actionPreview, setActionPreview] = useState(false);
  const [muted, setMuted] = useState(sound.muted);
  const [hapticsOn, setHapticsOn] = useState(haptics.enabled);

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

  // Shake cooldown countdown — a light 500ms ticker while a cooldown runs so
  // the button label counts down without a per-frame render. `nowTick` must be
  // re-anchored the moment a cooldown starts: the mount-time value can be many
  // seconds stale, which would inflate the first rendered countdown.
  const [nowTick, setNowTick] = useState(() => Date.now());
  const shakeCdLeft = Math.max(0, shakeReadyAt - nowTick);
  useEffect(() => {
    if (!isPlaying || shakeReadyAt <= Date.now()) return;
    setNowTick(Date.now());
    const id = window.setInterval(() => {
      setNowTick(Date.now());
      if (Date.now() >= shakeReadyAt) window.clearInterval(id);
    }, 500);
    return () => window.clearInterval(id);
  }, [isPlaying, shakeReadyAt]);

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
    failReason,
    isStarting,
    powerups,
    shuffleNonce: val<number>("shuffleNonce", 0) ?? 0,
    hintNonce: val<number>("hintNonce", 0) ?? 0,
    shakeNonce: val<number>("shakeNonce", 0) ?? 0,
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
    : gameStatus === "solved"
      ? t("statusWonTitle")
      : gameStatus === "expired"
        ? t("statusFailedTitle")
        : t("lobbyTitle");

  // Last-10s urgency: HUD time flips to the danger treatment (color always;
  // the pulse animation is disabled under prefers-reduced-motion in SCSS).
  // Only meaningful in timed-challenge mode — the untimed default has no clock.
  const timeDanger = timedMode && isPlaying && timeLeftMs > 0 && timeLeftMs <= TIME_DANGER_MS;

  const hudItems = [
    { label: t("scoreLevel"), value: `${level}` },
    { label: t("scoreLabel"), value: `${score}`, accent: true },
    {
      label: t("scoreTime"),
      value: !isPlaying ? "–" : timedMode ? `${Math.max(0, secs)}s` : "∞",
      danger: timeDanger,
    },
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

  // Original-trio order (G2): remove / undo / shuffle, then hint, then the
  // timed-mode-only +15s, then the free (cooldown) shake.
  const shelfFree = shelf.every((s) => s === null);
  const trayCount = tray.filter((s) => s !== null).length;
  const shakeOnCd = shakeCdLeft > 0;
  const powerActions = isPlaying
    ? [
        {
          key: "remove",
          label: t("puRemove"),
          icon: <Archive size={16} aria-hidden="true" />,
          count: powerups.remove,
          disabled: powerups.remove <= 0 || !shelfFree || trayCount < 3,
          onClick: () => runGameAction("removeToShelf", {}),
        },
        {
          key: "undo",
          label: t("puUndo"),
          icon: <Undo2 size={16} aria-hidden="true" />,
          count: powerups.undo,
          disabled: powerups.undo <= 0 || !undoable,
          onClick: () => runGameAction("undo", {}),
        },
        {
          key: "shuffle",
          label: t("puShuffle"),
          icon: <Shuffle size={16} aria-hidden="true" />,
          count: powerups.shuffle,
          disabled: powerups.shuffle <= 0,
          onClick: () => runGameAction("shuffle", {}),
        },
        {
          key: "hint",
          label: t("puHint"),
          icon: <Lightbulb size={16} aria-hidden="true" />,
          count: powerups.hint,
          disabled: powerups.hint <= 0,
          onClick: () => runGameAction("hint", {}),
        },
        ...(timedMode
          ? [{
              key: "addTime",
              label: t("puAddTime"),
              icon: <Clock size={16} aria-hidden="true" />,
              count: powerups.addTime,
              disabled: powerups.addTime <= 0,
              onClick: () => runGameAction("addTime", { ms: 15000 }),
            }]
          : []),
        {
          key: "shake",
          label: shakeOnCd ? t("puShakeCd", { sec: Math.ceil(shakeCdLeft / 1000) }) : t("puShake"),
          icon: <Waves size={16} aria-hidden="true" />,
          count: -1, // cooldown-based, not a consumable — no ×N badge
          disabled: shakeOnCd,
          onClick: () => runGameAction("shake", {}),
        },
      ]
    : [];

  // ── Overlay (start map / win / all-clear / fail) ──
  const isAllClear = gameStatus === "solved" && level >= TOTAL_LEVELS;
  let overlayTitle = "";
  let overlayTone: "ready" | "win" | "fail" = "ready";
  let overlayBody = "";
  let primaryLabel = "";
  let onPrimary: () => void = () => {};

  if (gameStatus === "idle") {
    overlayTone = "ready";
    overlayTitle = collectionOpen ? t("collectionTitle") : t("levelSelectTitle");
    overlayBody = "";
    primaryLabel = t("startOpenRun");
    onPrimary = () => runGameAction("startLevel", { level: progress.level });
  } else if (isAllClear) {
    // Finishing the LAST level earns a proper ending screen, not a toast:
    // total stats + the collection recap, then back to the scene map.
    overlayTone = "win";
    overlayTitle = t("allClearTitle");
    overlayBody = t("allClearBody");
    primaryLabel = t("allClearBack");
    onPrimary = () => runGameAction("enter", {});
  } else if (gameStatus === "solved") {
    overlayTone = "win";
    overlayTitle = t("statusWonTitle");
    // lastStatus (shown above) already carries the real time-bonus copy.
    overlayBody = "";
    primaryLabel = t("statusNext");
    onPrimary = () => runGameAction("nextLevel", {});
  } else if (gameStatus === "expired") {
    overlayTone = "fail";
    overlayTitle = t("statusFailedTitle");
    // Failure is readable: the copy names WHAT went wrong (clock vs tray).
    overlayBody = failReason === "trayFull" ? t("statusFailedTrayFull") : t("statusFailedTimeout");
    primaryLabel = t("statusRetry");
    onPrimary = () => runGameAction("retry", {});
  }

  const geeseHave = progress.geese.length;
  const unlockedScene = unlockNotice >= 0 ? SCENES[unlockNotice] : undefined;

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
                  ariaLabel={t("boardLabel")}
                  loadingLabel={t("canvasLoading")}
                  errorLabel={t("canvasError")}
                  retryLabel={t("statusRetry")}
                  continueLabel={t("continueAction")}
                />
              ) : (
                <div className="goose-canvas-placeholder" aria-hidden="true" />
              )}

              {showOverlay && (
                <div className="goose-overlay" role="dialog" aria-label={overlayTitle}>
                  <div
                    className="goose-overlay__card"
                    data-wide={gameStatus === "idle" || isAllClear ? "true" : undefined}
                  >
                    <img
                      className="goose-overlay__mascot"
                      data-tone={overlayTone}
                      src="./logo.png"
                      alt=""
                      aria-hidden="true"
                      draggable={false}
                    />
                    <h2 className="goose-overlay__title">{overlayTitle}</h2>
                    {gameStatus === "solved" && !isAllClear && (
                      <p className="goose-overlay__score">{t("scoreLabel")} {score}</p>
                    )}
                    {gameStatus !== "idle" && (
                      <p className="goose-overlay__status">{lastStatus}</p>
                    )}

                    {/* Limited-goose unlock celebration (scene final cleared, G4). */}
                    {gameStatus === "solved" && unlockedScene && (
                      <div className="goose-unlock">
                        <GooseChip variant={unlockedScene.goose} size={56} />
                        <p>{t("gooseUnlocked", { name: t(unlockedScene.gooseNameKey) })}</p>
                      </div>
                    )}

                    {/* All-clear ending: total stats + collection recap. */}
                    {isAllClear && (
                      <div className="goose-allclear">
                        <div className="goose-allclear__stats">
                          <div><span>{t("creditLabel")}</span><strong>{clearedLevels(progress)}/{TOTAL_LEVELS}</strong></div>
                          <div><span>{t("statWins")}</span><strong>{progress.wins}</strong></div>
                          <div><span>{t("statBest")}</span><strong>{bestOverall(progress)}</strong></div>
                          <div><span>{t("statGeese")}</span><strong>{geeseHave}/{SCENES.length}</strong></div>
                        </div>
                        <div className="goose-allclear__geese" aria-label={t("collectionTitle")}>
                          {SCENES.map((s) => (
                            <GooseChip
                              key={s.id}
                              variant={s.goose}
                              locked={!progress.geese.includes(s.id)}
                              size={34}
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Idle lobby: collection book OR the scene/level map. */}
                    {gameStatus === "idle" && (collectionOpen ? (
                      <div className="goose-collection">
                        <p className="goose-collection__count">
                          {t("collectionCount", { have: geeseHave, total: SCENES.length })}
                        </p>
                        <div className="goose-collection__grid">
                          {SCENES.map((scene) => {
                            const unlocked = progress.geese.includes(scene.id);
                            return (
                              <figure
                                key={scene.id}
                                className="goose-collection__card"
                                data-locked={unlocked ? undefined : "true"}
                              >
                                <GooseChip variant={scene.goose} locked={!unlocked} size={46} />
                                <figcaption>
                                  <strong>{unlocked ? t(scene.gooseNameKey) : t(scene.nameKey)}</strong>
                                  <span>
                                    {unlocked
                                      ? t(scene.nameKey)
                                      : t("collectionLockedHint", { level: scene.levels[1] })}
                                  </span>
                                </figcaption>
                              </figure>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="goose-map" aria-label={t("levelSelectTitle")}>
                        {SCENES.map((scene) => {
                          const gooseUnlockedHere = progress.geese.includes(scene.id);
                          const levels: number[] = [];
                          for (let l = scene.levels[0]; l <= scene.levels[1]; l += 1) levels.push(l);
                          return (
                            <section key={scene.id} className="goose-map__scene">
                              <header className="goose-map__head">
                                <span
                                  className="goose-map__dot"
                                  style={{ background: colorToCss(scene.palette.rim) }}
                                  aria-hidden="true"
                                />
                                <span className="goose-map__name">{t(scene.nameKey)}</span>
                                <span
                                  className="goose-map__goose"
                                  title={gooseUnlockedHere
                                    ? t(scene.gooseNameKey)
                                    : t("collectionLockedHint", { level: scene.levels[1] })}
                                >
                                  <GooseChip variant={scene.goose} locked={!gooseUnlockedHere} size={24} />
                                </span>
                              </header>
                              <div className="goose-map__levels">
                                {levels.map((lvl) => {
                                  const locked = lvl > progress.level;
                                  const best = progress.best[lvl];
                                  return (
                                    <button
                                      key={lvl}
                                      type="button"
                                      className="goose-map__level"
                                      data-locked={locked ? "true" : undefined}
                                      disabled={locked || isStarting}
                                      onClick={() => runGameAction("startLevel", { level: lvl })}
                                      aria-label={locked
                                        ? t("levelLockedLabel", { level: lvl })
                                        : t("playingTitle", { level: lvl })}
                                    >
                                      {locked
                                        ? <Lock size={12} aria-hidden="true" />
                                        : <strong>{lvl}</strong>}
                                      {!locked && best !== undefined && (
                                        <span className="goose-map__best">
                                          {t("levelBest", { score: best })}
                                        </span>
                                      )}
                                    </button>
                                  );
                                })}
                              </div>
                            </section>
                          );
                        })}
                      </div>
                    ))}

                    {overlayBody !== "" && <p className="goose-overlay__body">{overlayBody}</p>}

                    {/* Untimed by default (G1) — the clock is an opt-in challenge. */}
                    {gameStatus === "idle" && !collectionOpen && (
                      <label className="goose-timed-toggle" title={t("timedModeHint")}>
                        <input
                          type="checkbox"
                          checked={timedMode}
                          onChange={(e) => runGameAction("setTimedMode", { on: e.target.checked })}
                        />
                        <Timer size={14} aria-hidden="true" />
                        <span>{t("timedModeLabel")}</span>
                      </label>
                    )}

                    <button
                      type="button"
                      className="goose-overlay__btn"
                      onClick={onPrimary}
                      disabled={isStarting}
                    >
                      {isStarting ? t("startOpening") : primaryLabel}
                    </button>
                    {gameStatus === "idle" && (
                      <button
                        type="button"
                        className="goose-overlay__ghost"
                        onClick={() => setCollectionOpen((open) => !open)}
                        aria-pressed={collectionOpen}
                      >
                        <BookOpen size={14} aria-hidden="true" />
                        <span>{collectionOpen ? t("collectionBack") : t("collectionTitle")}</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Tray strip under the pen — original SVG chips, never emoji.
                The side shelf (G2 移出 target) sits next to it: parked items
                still count toward 3-matches. */}
            <div className="goose-tray-row">
              <div className="goose-tray" role="group" aria-label={t("scoreTray")}>
                {Array.from({ length: TRAY_SLOTS }).map((_, i) => {
                  const kind = tray[i] ?? null;
                  const def = kind !== null ? ITEM_DEFS[kind] : null;
                  const name = def ? t(kindNameKey(def.model)) : t("trayEmptySlot");
                  return (
                    <div
                      key={i}
                      className="goose-tray__slot"
                      data-filled={def ? "true" : undefined}
                      title={name}
                      aria-label={name}
                    >
                      {def ? <KindChip model={def.model} color={def.color} /> : null}
                    </div>
                  );
                })}
              </div>
              {isPlaying && (
                <div className="goose-shelf" role="group" aria-label={t("shelfTitle")}>
                  <span className="goose-shelf__label">{t("shelfTitle")}</span>
                  {Array.from({ length: SHELF_SLOTS }).map((_, i) => {
                    const kind = shelf[i] ?? null;
                    const def = kind !== null ? ITEM_DEFS[kind] : null;
                    const name = def ? t(kindNameKey(def.model)) : t("shelfEmptySlot");
                    return (
                      <div
                        key={i}
                        className="goose-tray__slot goose-shelf__slot"
                        data-filled={def ? "true" : undefined}
                        title={name}
                        aria-label={name}
                      >
                        {def ? <KindChip model={def.model} color={def.color} /> : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Power-up bar — original trio (remove/undo/shuffle) + hint,
                +15s in timed mode only, and the cooldown-based shake. */}
            {powerActions.length > 0 && (
              <div className="goose-powerbar" role="toolbar" aria-label={t("puTitle")}>
                {powerActions.map((action) => (
                  <button
                    key={action.key}
                    type="button"
                    className="goose-powerbar__btn"
                    data-empty={action.disabled ? "true" : undefined}
                    disabled={action.disabled}
                    onClick={action.onClick}
                    title={action.label}
                  >
                    {action.icon}
                    <span className="goose-powerbar__label">{action.label}</span>
                    {action.count >= 0 && (
                      <span className="goose-powerbar__count">×{action.count}</span>
                    )}
                  </button>
                ))}
              </div>
            )}

            <div className="goose-stage-hud" aria-label={t("scoreLabel")}>
              {hudItems.map((item) => (
                <div
                  className="goose-stage-hud__metric"
                  data-accent={item.accent ? "true" : undefined}
                  data-danger={item.danger ? "true" : undefined}
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
              {haptics.supported && (
                <button
                  type="button"
                  className="goose-stage-hud__sound"
                  onClick={() => setHapticsOn(haptics.toggleEnabled())}
                  aria-pressed={!hapticsOn}
                  aria-label={hapticsOn ? t("hapticsOn") : t("hapticsOff")}
                  title={hapticsOn ? t("hapticsOn") : t("hapticsOff")}
                >
                  {hapticsOn ? <Vibrate size={18} aria-hidden="true" /> : <VibrateOff size={18} aria-hidden="true" />}
                </button>
              )}
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
                    src="./logo.png"
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
                <h4>{t("leaderboardTitle")}</h4>
                {leaderboard.length === 0 ? (
                  <p className="goose-drawer__empty">{t("leaderboardEmpty")}</p>
                ) : (
                  <ol className="goose-drawer__ranks">
                    {leaderboard.slice(0, 10).map((row) => (
                      <li key={`${row.rank}-${row.address}`}>
                        <span className="goose-rank__pos">#{row.rank}</span>
                        <span className="goose-rank__addr">{shortAddress(row.address)}</span>
                        <span className="goose-rank__score">{row.totalWon}</span>
                      </li>
                    ))}
                  </ol>
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
            <button type="button" onClick={() => runGameAction("debugLose", { reason: "timeout" })}>败·超时</button>
            <button type="button" onClick={() => runGameAction("debugLose", { reason: "trayFull" })}>败·卡满</button>
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

/** Guest leaderboard row (subset of the framework LeaderEntry the UI shows). */
interface LeaderRow {
  rank: number;
  address: string;
  totalWon: number;
}

/** Compact display form for a leaderboard identity (address or nickname). */
function shortAddress(value: string): string {
  const v = String(value ?? "");
  return v.length > 14 ? `${v.slice(0, 6)}…${v.slice(-4)}` : v;
}
