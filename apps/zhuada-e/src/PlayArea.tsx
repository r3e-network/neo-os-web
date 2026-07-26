/**
 * PlayArea.tsx — React shell for Goose Basket Shuffle (physics edition).
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
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type CSSProperties,
} from "react";
import { useStateBindings } from "@shared/react";
import type { PlayAreaProps } from "@shared/react";
import { PlayStage } from "@shared/components-react/v2";
import type { ThreeSceneController } from "./ThreeGameComponent";
import { AnimatedTray } from "./AnimatedTray";
import { SHELF_SLOTS, TRAY_SLOTS, type ExtractReceipt } from "./logic/engine-zhuada";
import { COMBO_WINDOW_MS, COMBO_BONUS_PER_STEP, TOTAL_LEVELS, specOf, tuneGravity } from "./logic/game-rules";
import type { PowerupCounts } from "./logic/guest-engine";
import { SCENES } from "./logic/scenes";
import { EMPTY_PROGRESS, bestOverall, clearedLevels, type GooseProgress } from "./logic/progress";
import { EMPTY_DAILY, type DailyState } from "./logic/daily-reward";
import { goosePerkKey } from "./logic/goose-passive";
import { RefreshCw, Shuffle, Lightbulb, Clock, Volume2, VolumeX, Vibrate, VibrateOff, BookOpen, Lock, Archive, Undo2, Waves, Timer, Smartphone, ShieldCheck, CircleAlert, Play, Trash2, Share2, Flame, Gift, CalendarDays, Layers3, MousePointerClick } from "lucide-react";
import { sound } from "./logic/sound";
import { haptics } from "./logic/haptics";
import { GooseChip } from "./GooseChip";
import { GoosePerkIcon } from "./GoosePerkIcon";
import { ThemeItemChip } from "./ThemeItemChip";
import {
  GAME_THEMES,
  THEME_ITEM_ASSET_COUNT,
  colorToCss,
  isGameThemeId,
  themeOf,
  type GameThemeId,
} from "./logic/themes";
import { useDeviceShake } from "./logic/use-device-shake";
import type { ShakeSignal } from "./logic/device-motion";
import type { DeviceQaPanelProps } from "./DeviceQaPanel";
import "./PlayArea.scss";

/** HUD time turns urgent (danger color + pulse) inside the last 10 seconds. */
const TIME_DANGER_MS = 10000;

/**
 * Self-contained shake cooldown badge. Owns its own 500ms ticker so the
 * parent PlayArea (1450 lines) does NOT re-render during the countdown.
 * Renders just the remaining-seconds text or the ready label.
 */
function ShakeCooldownLabel({
  shakeReadyAt,
  isPlaying,
  readyLabel,
  cdLabelFn,
}: {
  shakeReadyAt: number;
  isPlaying: boolean;
  readyLabel: string;
  cdLabelFn: (sec: number) => string;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const current = Date.now();
    setNow(current);
    if (!isPlaying || shakeReadyAt <= current) return;
    const id = window.setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= shakeReadyAt) window.clearInterval(id);
    }, 500);
    return () => window.clearInterval(id);
  }, [isPlaying, shakeReadyAt]);
  const left = Math.max(0, shakeReadyAt - now);
  return <>{left > 0 ? cdLabelFn(Math.ceil(left / 1000)) : readyLabel}</>;
}

// The bridge/canvas host is only needed after the async Three scene is ready.
// Keeping it out of the shell entry preserves the cold-start budget as the
// item catalog grows, without delaying the lobby or changing the live scene.
const ThreeGameComponent = lazy(async () => {
  const module = await import("./ThreeGameComponent");
  return { default: module.ThreeGameComponent };
});

export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { str, bool, val } = useStateBindings(state);

  // ── Code-split: the 3D scene (three + cannon-es) loads only on first play.
  const [scene, setScene] = useState<ThreeSceneController | null>(null);
  const [sceneLoadError, setSceneLoadError] = useState(false);
  const [sceneLoadAttempt, setSceneLoadAttempt] = useState(0);
  const sceneLoadingRef = useRef(false);

  const gameStatus = str("gameStatus", "idle");
  const score = val<number>("score", 0) ?? 0;
  const level = val<number>("level", 1) ?? 1;
  const timeLeftMs = val<number>("timeLeftMs", 0) ?? 0;
  const combo = val<number>("comboCount", 0) ?? 0;
  // R6 Frenzy: free-pull charges (armed after a combo climax) + a monotonic
  // nonce bumped on each frenzy pulse so we can flash a one-shot burst.
  const frenzyCharges = val<number>("frenzyCharges", 0) ?? 0;
  const frenzyFx = val<number>("frenzyFx", 0) ?? 0;
  const [frenzyBurst, setFrenzyBurst] = useState(false);
  const frenzyFxRef = useRef(frenzyFx);
  useEffect(() => {
    if (frenzyFx === frenzyFxRef.current) return;
    frenzyFxRef.current = frenzyFx;
    setFrenzyBurst(true);
    const id = window.setTimeout(() => setFrenzyBurst(false), 720);
    return () => window.clearTimeout(id);
  }, [frenzyFx]);
  const isStarting = bool("isStarting");
  const tray = val<(number | null)[]>("tray", Array(TRAY_SLOTS).fill(null)) ?? [];
  const shelf = val<(number | null)[]>("shelf", Array(SHELF_SLOTS).fill(null)) ?? [];
  const extractReceipt = val<ExtractReceipt | null>("extractReceipt", null);
  const shelfClearedFx = val<number[]>("shelfClearedFx", []) ?? [];
  const lastStatus = str("lastStatus", t("statusReady"));
  const powerups = val<PowerupCounts>(
    "powerups",
    { shuffle: 0, hint: 0, remove: 0, undo: 0, addTime: 0 },
  ) ?? { shuffle: 0, hint: 0, remove: 0, undo: 0, addTime: 0 };
  const undoable = bool("undoable");
  const timedMode = bool("timedMode");
  const shakeReadyAt = val<number>("shakeReadyAt", 0) ?? 0;
  const shakeNonce = val<number>("shakeNonce", 0) ?? 0;
  const hintNonce = val<number>("hintNonce", 0) ?? 0;
  const themeId = val<GameThemeId>("themeId", "fresh-market") ?? "fresh-market";
  const resumeAvailable = bool("resumeAvailable");
  const resumeLevel = val<number>("resumeLevel", 0) ?? 0;
  const continueAvailable = bool("continueAvailable");
  const gameTheme = themeOf(themeId);
  const retryLabel = t("statusRetry");
  const itemName = (kind: number, emptyKey: string) => {
    const item = gameTheme.items[kind];
    if (!item) return t(emptyKey);
    return t("itemColorway", {
      name: t(item.nameKey),
      variant: Math.floor(kind / THEME_ITEM_ASSET_COUNT) + 1,
    });
  };

  const failReason = str("failReason", "");
  // Meta progression (G4): unlocked level / wins / per-level best / geese.
  const progress = val<GooseProgress>("progress", EMPTY_PROGRESS) ?? EMPTY_PROGRESS;
  // R4 — daily sign-in / streak state (lobby reward + retention hook).
  const dailyState = val<DailyState>("dailyState", EMPTY_DAILY) ?? EMPTY_DAILY;
  const dailyClaimable = bool("dailyClaimable");
  const dailyGrants = val<PowerupCounts>(
    "dailyGrants",
    { shuffle: 0, hint: 0, remove: 0, undo: 0, addTime: 0 },
  ) ?? { shuffle: 0, hint: 0, remove: 0, undo: 0, addTime: 0 };
  const dailyMilestoneFx = val<number>("dailyMilestoneFx", 0) ?? 0;
  const [dailyMilestoneBurst, setDailyMilestoneBurst] = useState(false);
  const dailyMilestoneRef = useRef(dailyMilestoneFx);
  useEffect(() => {
    if (dailyMilestoneFx === dailyMilestoneRef.current) return;
    dailyMilestoneRef.current = dailyMilestoneFx;
    setDailyMilestoneBurst(true);
    const id = window.setTimeout(() => setDailyMilestoneBurst(false), 1200);
    return () => window.clearTimeout(id);
  }, [dailyMilestoneFx]);
  const [hintFeedback, setHintFeedback] = useState(false);
  const hintFeedbackRef = useRef(0);
  useEffect(() => {
    if (hintNonce <= 0 || hintNonce === hintFeedbackRef.current) return;
    hintFeedbackRef.current = hintNonce;
    setHintFeedback(true);
    const id = window.setTimeout(() => setHintFeedback(false), 2200);
    return () => window.clearTimeout(id);
  }, [hintNonce]);
  const currentLevelRecord = progress.levels[level];
  const currentBest = timedMode
    ? currentLevelRecord?.best.timed
    : currentLevelRecord?.best.relaxed;
  // Scene id of a goose unlocked by the LAST win (-1 = none) — celebration.
  const unlockNotice = val<number>("unlockNotice", -1) ?? -1;
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [collectionOpen, setCollectionOpen] = useState(false);
  const [actionPreview, setActionPreview] = useState(false);
  const [muted, setMuted] = useState(sound.muted);
  const [hapticsOn, setHapticsOn] = useState(haptics.enabled);
  const [motionMessage, setMotionMessage] = useState("");
  const [shareMessage, setShareMessage] = useState("");
  const primaryRef = useRef<HTMLButtonElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const drawerToggleRef = useRef<HTMLButtonElement>(null);
  const actionPreviewTimerRef = useRef<number | null>(null);
  const simulatorQaAutoStartRef = useRef(false);

  // Playtest debug panel — enabled only with ?debug=1 so it never ships in
  // normal play. Shows live FPS + state + current tuned values, plus quick
  // navigation so a human can calibrate "feel" without grinding every level.
  const debug = import.meta.env.DEV &&
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("debug") === "1";
  const [debugOpen, setDebugOpen] = useState(false);
  const [fps, setFps] = useState(0);
  const deviceQaEnabled = import.meta.env.VITE_DEVICE_QA === "1"
    && typeof window !== "undefined"
    && new URLSearchParams(window.location.search).get("deviceQa") === "1";
  const [DeviceQaPanelComponent, setDeviceQaPanelComponent] = useState<ComponentType<DeviceQaPanelProps> | null>(null);
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

  useEffect(() => {
    if (!deviceQaEnabled) return;
    let cancelled = false;
    void import("./DeviceQaPanel").then((module) => {
      if (!cancelled) setDeviceQaPanelComponent(() => module.default);
    });
    return () => {
      cancelled = true;
    };
  }, [deviceQaEnabled]);

  const secs = Math.ceil(timeLeftMs / 1000);
  const isPlaying = gameStatus === "dealt";
  const isOver = gameStatus === "solved" || gameStatus === "expired";
  const showOverlay = gameStatus === "idle" || isOver;

  const onDeviceShake = useCallback((signal: ShakeSignal): void => {
    void dispatch("shake", {
      intensity: signal.intensity,
      magnitude: signal.magnitude,
      strength: signal.strength,
      source: "device-motion",
    });
  }, [dispatch]);
  const deviceShake = useDeviceShake({ active: isPlaying, onShake: onDeviceShake });
  const motionUnavailable = deviceShake.permission === "unsupported"
    || deviceShake.permission === "insecure"
    || deviceShake.permission === "blocked";

  useEffect(() => {
    if (!showOverlay) return;
    previousFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const dialog = overlayRef.current;
    const frame = window.requestAnimationFrame(() => {
      if (!dialog) return;
      dialog.scrollTop = 0;
      // Focus the top of the modal without scrolling the short-screen lobby to
      // its bottom action. Theme choice remains the first visible decision.
      dialog.focus({ preventScroll: true });
    });
    const trapFocus = (event: KeyboardEvent): void => {
      if (event.key !== "Tab" || !dialog) return;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      )).filter((node) => !node.hidden && node.getAttribute("aria-hidden") !== "true");
      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus({ preventScroll: true });
        return;
      }
      const active = document.activeElement;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (active === dialog || !dialog.contains(active)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };
    dialog?.addEventListener("keydown", trapFocus);
    return () => {
      window.cancelAnimationFrame(frame);
      dialog?.removeEventListener("keydown", trapFocus);
      previousFocusRef.current?.focus?.();
    };
  }, [showOverlay, gameStatus]);

  // The level/theme lobby is intentionally scrollable on a short phone. Once
  // play starts, return the miniapp document to the top so the full pan + tray
  // composition—not the lower half left over from the lobby—owns the viewport.
  useEffect(() => {
    if (gameStatus !== "dealt") return;
    const frame = window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      document.scrollingElement?.scrollTo({ top: 0, left: 0, behavior: "auto" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [gameStatus]);

  useEffect(() => () => {
    if (actionPreviewTimerRef.current !== null) {
      window.clearTimeout(actionPreviewTimerRef.current);
    }
  }, []);

  // Shake cooldown — the ShakeCooldownLabel sub-component owns the 500ms
  // ticker for the countdown display, so PlayArea no longer re-renders
  // during the cooldown. We only need a coarse "on cooldown" flag here
  // for the disabled state (re-evaluated on other state changes).
  const shakeOnCd = shakeReadyAt > Date.now();

  // Lazy-load the physics scene the first time we enter play.
  useEffect(() => {
    if (gameStatus === "dealt" && !scene && !sceneLoadingRef.current) {
      sceneLoadingRef.current = true;
      setSceneLoadError(false);
      import("./scenes/ZhuaDaScene")
        .then((m) => setScene(new m.ZhuaDaScene()))
        .catch(() => {
          sceneLoadingRef.current = false;
          setSceneLoadError(true);
        });
    }
  }, [gameStatus, scene, sceneLoadAttempt]);

  const bridgeState = {
    gameStatus,
    items: val<ItemInstanceLike[]>("items", []) ?? [],
    reserveCount: val<number>("reserveCount", 0) ?? 0,
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
    dealNonce: val<number>("dealNonce", 0) ?? 0,
    shakeNonce,
    shakeStrength: val<number>("shakeStrength", 1) ?? 1,
    extractReceipt,
    shelf,
    shelfClearedFx,
    themeId,
    // In-canvas localized labels.
    startOpenRun: t("startOpenRun"),
    statusWonTitle: t("statusWonTitle"),
    statusFailedTitle: t("statusFailedTitle"),
    statusNext: t("statusNext"),
    statusRetry: retryLabel,
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

  type HudItem = {
    kind: string;
    label: string;
    value: string;
    accent?: boolean;
    danger?: boolean;
    frenzy?: boolean;
  };
  const hudItems: HudItem[] = [
    { kind: "level", label: t("scoreLevel"), value: `${level}` },
    { kind: "score", label: t("scoreLabel"), value: `${score}`, accent: true },
    timedMode
      ? {
          kind: "time",
          label: t("scoreTime"),
          value: !isPlaying ? "–" : `${Math.max(0, secs)}s`,
          danger: timeDanger,
        }
      : {
          kind: "untimed",
          label: t("scoreTime"),
          value: t("untimedHud"),
        },
    { kind: "combo", label: t("scoreCombo"), value: combo > 1 ? `x${combo}` : "–" },
    // R6 Frenzy: while charges remain, surface a live "free pull" counter so
    // the player knows the next eliminations are auto-assisted.
    ...(frenzyCharges > 0
      ? [{ kind: "frenzy", label: t("frenzyLabel"), value: `x${frenzyCharges}`, frenzy: true } as HudItem]
      : []),
  ];

  function startActionPreview() {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setActionPreview(false);
      return;
    }
    if (actionPreviewTimerRef.current !== null) {
      window.clearTimeout(actionPreviewTimerRef.current);
    }
    setActionPreview(true);
    actionPreviewTimerRef.current = window.setTimeout(() => {
      actionPreviewTimerRef.current = null;
      setActionPreview(false);
    }, 420);
  }

  function runGameAction(action: string, args: Record<string, unknown>) {
    // Every in-game control is a user gesture → unlock audio here (covers the
    // Start button, which is the first gesture in a session / on mobile).
    sound.unlock();
    startActionPreview();
    void dispatch(action, args);
  }

  useEffect(() => {
    if (!import.meta.env.DEV || typeof window === "undefined") return;
    if (simulatorQaAutoStartRef.current || gameStatus !== "idle") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("simQa") !== "1") return;
    const requestedTheme = params.get("simTheme");
    if (isGameThemeId(requestedTheme) && requestedTheme !== themeId) {
      // Keep simulator captures reproducible without changing production
      // routing or reaching into browser storage. Theme selection must settle
      // before the auto-start so the Three scene, catalog and backdrop all
      // initialize from the same presentation contract.
      void dispatch("setTheme", { id: requestedTheme });
      return;
    }
    simulatorQaAutoStartRef.current = true;
    void dispatch("startLevel", { level: progress.lastPlayedLevel || 1 });
  }, [dispatch, gameStatus, progress.lastPlayedLevel, themeId]);

  async function shareResult(): Promise<void> {
    sound.unlock();
    sound.play("click");
    const url = new URL(window.location.href);
    url.search = "";
    url.hash = "";
    const text = t("shareResultText", { level, score });
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title: t("appEyebrow"), text, url: url.toString() });
        setShareMessage(t("shareResultDone"));
        return;
      }
      await navigator.clipboard.writeText(`${text} ${url.toString()}`);
      setShareMessage(t("shareResultCopied"));
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setShareMessage(t("shareResultUnavailable"));
    }
  }

  function closeDrawerAndRestoreFocus() {
    setDrawerOpen(false);
    window.requestAnimationFrame(() => drawerToggleRef.current?.focus({ preventScroll: true }));
  }

  const drawerActions = isPlaying
    ? [
        {
          label: retryLabel,
          onClick: () => {
            closeDrawerAndRestoreFocus();
            runGameAction("retry", {});
          },
          icon: <RefreshCw size={16} aria-hidden="true" />,
          hint: retryLabel,
        },
        {
          label: t("collectionBack"),
          onClick: () => {
            closeDrawerAndRestoreFocus();
            runGameAction("enter", {});
          },
          icon: <BookOpen size={16} aria-hidden="true" />,
          hint: t("collectionBack"),
        },
      ]
    : [];

  // Original-trio order (G2): remove / undo / shuffle, then hint, then the
  // timed-mode-only +15s, then the free (cooldown) shake.
  const shelfFree = shelf.every((s) => s === null);
  const trayCount = tray.filter((s) => s !== null).length;
  const shelfCount = shelf.filter((s) => s !== null).length;
  // A seven-item tray is intentionally recoverable while Remove or Undo is
  // available. Without a dedicated state it looks exactly like broken input:
  // every board tap is rejected, yet the player sees no modal. Surface this
  // last-stand state beside the tray and point directly at the rescue tools.
  const isTrayJammed = isPlaying && trayCount >= TRAY_SLOTS;
  const accessibleStatus = `${lastStatus}. ${t("scoreLabel")}: ${score}. ${t("scoreTray")}: ${trayCount}/${TRAY_SLOTS}.`;
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
          label: <ShakeCooldownLabel
            shakeReadyAt={shakeReadyAt}
            isPlaying={isPlaying}
            readyLabel={t("puShake")}
            cdLabelFn={(sec) => t("puShakeCd", { sec })}
          />,
          icon: <Waves size={16} aria-hidden="true" />,
          count: -1, // cooldown-based, not a consumable — no ×N badge
          disabled: shakeOnCd,
          onClick: () => runGameAction("shake", {}),
        },
      ]
    : [];
  const levelSpec = specOf(level);
  const levelItemTotal = levelSpec.kinds * levelSpec.perKind * 3;
  const remainingLogical = bridgeState.items.length + bridgeState.reserveCount + trayCount + shelfCount;
  const clearedLogical = Math.max(0, levelItemTotal - remainingLogical);
  const clearedPercent = levelItemTotal > 0
    ? Math.min(100, Math.round((clearedLogical / levelItemTotal) * 100))
    : 0;
  // L1 is intentionally the friendly tutorial level, but the previous build
  // taught its core gestures only inside the optional More drawer. Keep the
  // lesson in the playfield and let real state advance/dismiss it: first pull,
  // first triple, then the optional pile toss. No modal or input lock is added.
  const tutorialStep = isPlaying && level === 1 && bridgeState.items.length > 0
    ? score === 0
      ? trayCount === 0
        ? "pick"
        : "match"
      : score < 20 && shakeNonce === 0
        ? "shake"
        : null
    : null;

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
    onPrimary = () => runGameAction("startLevel", { level: progress.lastPlayedLevel });
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
    overlayTitle = failReason === "trayFull"
      ? t("statusFailedTrayFullTitle")
      : t("statusFailedTitle");
    // Failure is readable: the copy names WHAT went wrong (clock vs tray).
    const failureCopy = failReason === "trayFull" ? t("statusFailedTrayFull") : t("statusFailedTimeout");
    overlayBody = continueAvailable
      ? `${failureCopy} ${t("continueAvailableHint")}`
      : failureCopy;
    primaryLabel = continueAvailable
      ? t(failReason === "trayFull" ? "continueTrayAction" : "continueRunAction")
      : retryLabel;
    onPrimary = () => runGameAction(continueAvailable ? "continueRun" : "retry", {});
  }

  const geeseHave = progress.geese.length;
  const unlockedScene = unlockNotice >= 0 ? SCENES[unlockNotice] : undefined;
  const themeStyle = {
    "--goose-page": gameTheme.css.page,
    "--goose-surface": gameTheme.css.surface,
    "--goose-surface-strong": gameTheme.css.surfaceStrong,
    "--goose-text": gameTheme.css.text,
    "--goose-muted": gameTheme.css.muted,
    "--goose-accent": gameTheme.css.accent,
    "--goose-accent-strong": gameTheme.css.accentStrong,
    "--goose-accent-soft": gameTheme.css.accentSoft,
    "--goose-border": gameTheme.css.border,
    "--goose-shadow": gameTheme.css.shadow,
    "--goose-backdrop": `url(${gameTheme.backdrop})`,
  } as CSSProperties;

  return (
    <div
      className="goose-playarea mx2 mx2-cat-game goose-three-playarea"
      aria-busy={isStarting || undefined}
      data-action-preview={actionPreview ? "true" : undefined}
      data-game-theme={themeId}
      data-game-status={gameStatus}
      data-tray-jammed={isTrayJammed ? "true" : undefined}
      style={themeStyle}
    >
      <p
        className="goose-sr-status"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        aria-relevant="text"
      >
        {accessibleStatus}
      </p>
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
          <div className="goose-stage-shell" data-playing={isPlaying ? "true" : undefined}>
            <div className="goose-canvas-wrap">
              {scene ? (
                <Suspense
                  fallback={(
                    <div className="goose-canvas-placeholder" role="status" aria-live="polite">
                      <span className="goose-canvas-placeholder__label">
                        <span className="goose-canvas-placeholder__spinner" aria-hidden="true" />
                        {t("canvasLoading")}
                      </span>
                    </div>
                  )}
                >
                  <ThreeGameComponent
                    scene={scene}
                    state={bridgeState}
                    dispatch={dispatch}
                    className="goose-three-canvas"
                    ariaLabel={t("boardLabel")}
                    loadingLabel={t("canvasLoading")}
                    errorLabel={t("canvasError")}
                    contextLostLabel={t("canvasContextLost")}
                    retryLabel={retryLabel}
                    continueLabel={t("continueAction")}
                  />
                </Suspense>
              ) : sceneLoadError ? (
                <div
                  className="goose-canvas-load-error"
                  role="alert"
                  aria-live="assertive"
                  aria-atomic="true"
                >
                  <strong>{t("canvasError")}</strong>
                  <button
                    type="button"
                    onClick={() => {
                      sceneLoadingRef.current = false;
                      setSceneLoadError(false);
                      setSceneLoadAttempt((attempt) => attempt + 1);
                    }}
                  >
                    <RefreshCw size={15} aria-hidden="true" />
                    {retryLabel}
                  </button>
                </div>
              ) : (
                <div
                  className="goose-canvas-placeholder"
                  role={isPlaying ? "status" : undefined}
                  aria-live={isPlaying ? "polite" : undefined}
                  aria-hidden={isPlaying ? undefined : "true"}
                >
                  {isPlaying && (
                    <span className="goose-canvas-placeholder__label">
                      <span className="goose-canvas-placeholder__spinner" aria-hidden="true" />
                      {t("canvasLoading")}
                    </span>
                  )}
                </div>
              )}

              {/* R6 Frenzy burst — one-shot flash on each combo-climax pulse. */}
              {frenzyBurst && (
                <div className="goose-frenzy-burst" aria-hidden="true">
                  <span>{t("frenzyBurst")}</span>
                </div>
              )}

              {dailyMilestoneBurst && (
                <div className="goose-daily-milestone" aria-hidden="true">
                  <span>{t("dailyMilestone")}</span>
                </div>
              )}

              {hintFeedback && (
                <div
                  className="goose-hint-feedback"
                  role="status"
                  aria-live="polite"
                  aria-atomic="true"
                >
                  <Lightbulb size={16} strokeWidth={2.4} aria-hidden="true" />
                  <span>{t("puUsedHint")}</span>
                </div>
              )}

              {tutorialStep && (
                <div
                  className="goose-first-run-coach"
                  data-step={tutorialStep}
                  key={tutorialStep}
                  role="note"
                  aria-live="polite"
                  aria-atomic="true"
                >
                  <span className="goose-first-run-coach__step" aria-hidden="true">
                    {tutorialStep === "pick" ? "1/3" : tutorialStep === "match" ? "2/3" : "3/3"}
                  </span>
                  {tutorialStep === "pick"
                    ? <MousePointerClick size={17} strokeWidth={2.4} aria-hidden="true" />
                    : tutorialStep === "match"
                      ? <Layers3 size={17} strokeWidth={2.4} aria-hidden="true" />
                      : <Waves size={17} strokeWidth={2.4} aria-hidden="true" />}
                  <span>{t(
                    tutorialStep === "pick"
                      ? "tutorialPick"
                      : tutorialStep === "match"
                        ? "tutorialMatch"
                        : "tutorialShake",
                  )}</span>
                </div>
              )}

              {showOverlay && (
                <div
                  className="goose-overlay"
                  role="dialog"
                  aria-modal="true"
                  aria-label={overlayTitle}
                  ref={overlayRef}
                  tabIndex={-1}
                >
                  <div
                    className="goose-overlay__card"
                    data-wide={gameStatus === "idle" || isAllClear ? "true" : undefined}
                    data-tone={overlayTone}
                  >
                    <img
                      className="goose-overlay__mascot"
                      data-tone={overlayTone}
                      src={gameTheme.mascot}
                      alt=""
                      aria-hidden="true"
                      draggable={false}
                    />
                    <h2 className="goose-overlay__title">{overlayTitle}</h2>
                    {gameStatus === "solved" && !isAllClear && (
                      <p className="goose-overlay__score">{t("scoreLabel")} {score}</p>
                    )}
                    {gameStatus === "solved" && (
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
                                {/* R3 — collected geese surface their passive bonus in the book.
                                    R8b — the bonus now leads with a glyph for at-a-glance reading. */}
                                {unlocked && (() => {
                                  const perk = goosePerkKey(scene.id);
                                  return perk ? (
                                    <em className="goose-collection__perk">
                                      <GoosePerkIcon perkKey={perk} />
                                      {t(perk)}
                                    </em>
                                  ) : null;
                                })()}
                              </figcaption>
                              </figure>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="goose-lobby-flow">
                        {resumeAvailable && resumeLevel > 0 && (
                          <section className="goose-resume-card" aria-label={t("resumeRunTitle", { level: resumeLevel })}>
                            <div>
                              <strong>{t("resumeRunTitle", { level: resumeLevel })}</strong>
                              <span>{t("resumeRunHint")}</span>
                            </div>
                            <div className="goose-resume-card__actions">
                              <button type="button" onClick={() => runGameAction("resumeRun", {})}>
                                <Play size={13} aria-hidden="true" />
                                {t("resumeRunAction")}
                              </button>
                              <button type="button" data-quiet="true" onClick={() => runGameAction("discardRun", {})}>
                                <Trash2 size={13} aria-hidden="true" />
                                {t("discardRunAction")}
                              </button>
                            </div>
                          </section>
                        )}
                        <section className="goose-theme-picker" aria-labelledby="goose-theme-title">
                          <div className="goose-theme-picker__head">
                            <div>
                              <h3 id="goose-theme-title">{t("themePickerTitle")}</h3>
                              <p>{t("themePickerHint")}</p>
                            </div>
                          </div>
                          <div className="goose-theme-picker__grid">
                            {GAME_THEMES.map((option) => (
                              <button
                                key={option.id}
                                type="button"
                                className="goose-theme-card"
                                data-selected={option.id === themeId ? "true" : undefined}
                                aria-pressed={option.id === themeId}
                                onClick={() => runGameAction("setTheme", { id: option.id })}
                              >
                                <span className="goose-theme-card__media" aria-hidden="true">
                                  <img src={option.backdrop} alt="" draggable={false} />
                                  <img src={option.mascot} alt="" draggable={false} />
                                </span>
                                <span>
                                  <strong>{t(option.nameKey)}</strong>
                                  <small>{t(option.descriptionKey)}</small>
                                </span>
                              </button>
                            ))}
                          </div>
                        </section>

                        {/* R4 — daily sign-in / streak: the retention hook. Sits after the
                            theme picker so the lobby tab order still lands on a theme card
                            first; the claimable card shows the day's bonus preview. */}
                        <section className="goose-daily" aria-label={t("dailyTitle")}>
                          <div className="goose-daily__head">
                            <Flame
                              size={16}
                              aria-hidden="true"
                              data-lit={dailyState.streak > 0 ? "true" : undefined}
                            />
                            <strong>{t("dailyStreak", { streak: dailyState.streak })}</strong>
                            <span className="goose-daily__best">
                              {t("dailyBest", { best: dailyState.bestStreak })}
                            </span>
                          </div>
                          {dailyClaimable ? (
                            <button
                              type="button"
                              className="goose-daily__claim"
                              onClick={() => runGameAction("claimDaily", {})}
                            >
                              <Gift size={15} aria-hidden="true" />
                              <span>{t("dailyClaim", { streak: dailyState.streak + 1 })}</span>
                              <span className="goose-daily__preview">
                                {dailyGrants.hint > 0 && <em>+{dailyGrants.hint} {t("puHint")}</em>}
                                {dailyGrants.remove > 0 && <em>+{dailyGrants.remove} {t("puRemove")}</em>}
                                {dailyGrants.undo > 0 && <em>+{dailyGrants.undo} {t("puUndo")}</em>}
                                {dailyGrants.shuffle > 0 && <em>+{dailyGrants.shuffle} {t("puShuffle")}</em>}
                                {dailyGrants.addTime > 0 && <em>+{dailyGrants.addTime} {t("puAddTime")}</em>}
                              </span>
                            </button>
                          ) : (
                            <p className="goose-daily__done">{t("dailyClaimed")}</p>
                          )}
                          <button
                            type="button"
                            className="goose-daily__challenge"
                            onClick={() => runGameAction("startDaily", {})}
                            disabled={isStarting}
                          >
                            <CalendarDays size={14} aria-hidden="true" />
                            {t("dailyChallenge")}
                          </button>
                        </section>

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
                      </div>
                    ))}

                    {/* On phones the level rail is the last required choice.
                        Keep the idle CTA immediately after it, before optional
                        timed / device-motion controls. */}
                    {gameStatus === "idle" && (
                      <button
                        type="button"
                        className="goose-overlay__btn"
                        ref={primaryRef}
                        onClick={onPrimary}
                        disabled={isStarting}
                      >
                        {isStarting ? t("startOpening") : primaryLabel}
                      </button>
                    )}

                    {overlayBody !== "" && <p className="goose-overlay__body">{overlayBody}</p>}

                    {/* Untimed by default (G1) — the clock is an opt-in challenge. */}
                    {gameStatus === "idle" && !collectionOpen && (
                      <div className="goose-lobby-options">
                        <label className="goose-timed-toggle" title={t("timedModeHint")}>
                          <input
                            type="checkbox"
                            checked={timedMode}
                            aria-describedby="goose-timed-mode-hint"
                            onChange={(e) => runGameAction("setTimedMode", { on: e.target.checked })}
                          />
                          <Timer size={14} aria-hidden="true" />
                          <span>{t("timedModeLabel")}</span>
                        </label>
                        <span className="goose-sr-only" id="goose-timed-mode-hint">
                          {t("timedModeHint")}
                        </span>
                        <div className="goose-motion-option" data-state={deviceShake.permission}>
                          {deviceShake.permission === "granted"
                            ? <ShieldCheck size={16} aria-hidden="true" />
                            : motionUnavailable
                              ? <CircleAlert size={16} aria-hidden="true" />
                              : <Smartphone size={16} aria-hidden="true" />}
                          <span>{deviceShake.enabled ? t("motionEnabled") : t("motionEnable")}</span>
                          {deviceShake.permission !== "unsupported" && deviceShake.permission !== "insecure" && (
                            <button
                              type="button"
                              aria-pressed={deviceShake.enabled}
                              aria-describedby="goose-motion-status"
                              onClick={async () => {
                                sound.unlock();
                                if (deviceShake.enabled) {
                                  deviceShake.disable();
                                  setMotionMessage(t("motionDisabledStatus"));
                                  return;
                                }
                                const result = await deviceShake.requestEnable();
                                setMotionMessage(result === "granted" ? t("motionGrantedStatus") : t("motionDeniedStatus"));
                              }}
                            >
                              {deviceShake.enabled ? t("motionDisableAction") : t("motionEnableAction")}
                            </button>
                          )}
                        </div>
                        <p
                          className="goose-motion-status"
                          id="goose-motion-status"
                          role="status"
                          aria-live="polite"
                          aria-atomic="true"
                        >
                          {deviceShake.permission === "blocked"
                            ? t("motionBlockedStatus")
                            : motionMessage || (motionUnavailable
                              ? t("motionFallbackStatus")
                              : t("motionPrivacyHint"))}
                        </p>
                      </div>
                    )}

                    {gameStatus !== "idle" && (
                      <button
                        type="button"
                        className="goose-overlay__btn"
                        ref={primaryRef}
                        onClick={onPrimary}
                        disabled={isStarting}
                      >
                        {isStarting ? t("startOpening") : primaryLabel}
                      </button>
                    )}
                    {gameStatus === "expired" && (
                      <div className="goose-overlay__fail-actions">
                        {continueAvailable && (
                          <button type="button" className="goose-overlay__ghost" onClick={() => runGameAction("retry", {})}>
                            <RefreshCw size={15} aria-hidden="true" />
                            {retryLabel}
                          </button>
                        )}
                        <button type="button" className="goose-overlay__ghost" onClick={() => void shareResult()}>
                          <Share2 size={15} aria-hidden="true" />
                          {t("shareResultAction")}
                        </button>
                        <button type="button" className="goose-overlay__ghost" onClick={() => runGameAction("enter", {})}>
                          <BookOpen size={15} aria-hidden="true" />
                          {t("allClearBack")}
                        </button>
                      </div>
                    )}
                    {gameStatus === "expired" && shareMessage && (
                      <p className="goose-overlay__share-status" role="status">{shareMessage}</p>
                    )}
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

            {isPlaying && (
              <div
                className="goose-level-progress"
                role="progressbar"
                aria-label={t("levelProgressLabel")}
                aria-valuemin={0}
                aria-valuemax={levelItemTotal}
                aria-valuenow={clearedLogical}
              >
                <div className="goose-level-progress__copy">
                  <span>{t("levelProgressValue", { percent: clearedPercent })}</span>
                  <strong className="goose-level-progress__scope">
                    {t("levelScopeValue", { kinds: levelSpec.kinds, total: levelItemTotal })}
                  </strong>
                  {bridgeState.reserveCount > 0 && (
                    <span>{t("levelReserveValue", { count: bridgeState.reserveCount })}</span>
                  )}
                </div>
                <span className="goose-level-progress__track" aria-hidden="true">
                  <span style={{ width: `${clearedPercent}%` }} />
                </span>
              </div>
            )}

            {/* One persistent tray under the pen. The rescue shelf stays hidden
                while empty so normal play never presents a duplicate tray row;
                it appears only after the player explicitly uses 移出. */}
            <div
              className="goose-tray-row"
              data-jammed={isTrayJammed ? "true" : undefined}
              data-tray-warning={!isTrayJammed && trayCount >= 5 ? (trayCount >= 6 ? "2" : "1") : undefined}
            >
              {isTrayJammed && (
                <div
                  className="goose-tray-jam-alert"
                  id="goose-tray-jam-alert"
                  role="alert"
                  aria-live="assertive"
                  aria-atomic="true"
                >
                  <CircleAlert size={22} strokeWidth={2.6} aria-hidden="true" />
                  <span>
                    <strong>{t("statusTrayJammedTitle")}</strong>
                    <small>{t("statusTrayJammedHint")}</small>
                  </span>
                </div>
              )}
              <AnimatedTray
                tray={tray}
                receipt={extractReceipt}
                themeId={themeId}
                label={t("scoreTray")}
                emptyLabel={t("trayEmptySlot")}
                itemName={(kind) => itemName(kind, "trayEmptySlot")}
              />
              {isPlaying && !shelfFree && (
                <div className="goose-shelf" role="list" aria-label={t("shelfTitle")}>
                  <span className="goose-shelf__label" aria-hidden="true">{t("shelfTitle")}</span>
                  {Array.from({ length: SHELF_SLOTS }).map((_, i) => {
                    const kind = shelf[i] ?? null;
                    const item = kind !== null ? gameTheme.items[kind] : null;
                    const name = kind !== null
                      ? itemName(kind, "shelfEmptySlot")
                      : t("shelfEmptySlot");
                    return (
                      <div
                        key={i}
                        className="goose-tray__slot goose-shelf__slot"
                        data-filled={item ? "true" : undefined}
                        data-cleared={shelfClearedFx.includes(i) ? "true" : undefined}
                        title={name}
                        role="listitem"
                        aria-label={name}
                      >
                        {kind !== null ? <ThemeItemChip themeId={themeId} kind={kind} /> : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Power-up bar — original trio (remove/undo/shuffle) + hint,
                +15s in timed mode only, and the cooldown-based shake. */}
            {powerActions.length > 0 && (
              <div
                className="goose-powerbar"
                role="group"
                aria-label={t("puTitle")}
                data-jammed={isTrayJammed ? "true" : undefined}
              >
                {powerActions.map((action) => (
                  <button
                    key={action.key}
                    type="button"
                    className="goose-powerbar__btn"
                    data-empty={action.disabled ? "true" : undefined}
                    data-rescue={isTrayJammed && !action.disabled && (action.key === "remove" || action.key === "undo") ? "true" : undefined}
                    aria-describedby={isTrayJammed && !action.disabled && (action.key === "remove" || action.key === "undo") ? "goose-tray-jam-alert" : undefined}
                    disabled={action.disabled}
                    onClick={action.onClick}
                    title={typeof action.label === "string" ? action.label : undefined}
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

            <div
              className="goose-stage-hud"
              data-haptics={haptics.supported ? "true" : undefined}
              role="group"
              aria-label={t("scoreLabel")}
              aria-live="off"
            >
              {hudItems.map((item) => (
                <div
                  className="goose-stage-hud__metric"
                  data-kind={item.kind}
                  data-empty={item.value === "–" ? "true" : undefined}
                  data-accent={item.accent ? "true" : undefined}
                  data-danger={item.danger ? "true" : undefined}
                  data-frenzy={item.frenzy ? "true" : undefined}
                  role={item.kind === "time" ? "timer" : "group"}
                  aria-label={`${item.label}: ${item.value}`}
                  key={item.kind}
                >
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
              ))}
              <button
                type="button"
                className="goose-stage-hud__sound goose-stage-hud__sound--audio"
                onClick={() => setMuted(sound.toggleMuted())}
                aria-pressed={!muted}
                aria-label={muted ? t("soundEnableAction") : t("soundDisableAction")}
                title={muted ? t("soundEnableAction") : t("soundDisableAction")}
              >
                {muted ? <VolumeX size={18} aria-hidden="true" /> : <Volume2 size={18} aria-hidden="true" />}
              </button>
              {haptics.supported && (
                <button
                  type="button"
                  className="goose-stage-hud__sound goose-stage-hud__sound--haptics"
                  onClick={() => setHapticsOn(haptics.toggleEnabled())}
                  aria-pressed={hapticsOn}
                  aria-label={hapticsOn ? t("hapticsDisableAction") : t("hapticsEnableAction")}
                  title={hapticsOn ? t("hapticsDisableAction") : t("hapticsEnableAction")}
                >
                  {hapticsOn ? <Vibrate size={18} aria-hidden="true" /> : <VibrateOff size={18} aria-hidden="true" />}
                </button>
              )}
              <button
                type="button"
                className="goose-stage-hud__drawer goose-stage-hud__drawer--more"
                ref={drawerToggleRef}
                onClick={() => setDrawerOpen((open) => !open)}
                aria-expanded={drawerOpen}
                aria-controls="goose-ingame-drawer"
                aria-label={t("moreActions")}
              >
                <span>{t("moreActions")}</span>
              </button>
            </div>

            {drawerOpen && (
              <section id="goose-ingame-drawer" className="goose-ingame-drawer" aria-label={t("moreActions")}>
                <div className="goose-drawer__head">
                  <img
                    className="goose-drawer__mascot"
                    src={gameTheme.mascot}
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
                <h4>{t("personalRecordTitle")}</h4>
                <div className="goose-personal-record">
                  <p><span>{t("personalBestLabel")}</span><strong>{currentBest ?? "–"}</strong></p>
                  <p><span>{t("personalAttemptsLabel")}</span><strong>{currentLevelRecord?.attempts ?? 0}</strong></p>
                  <p><span>{t("personalClearsLabel")}</span><strong>{currentLevelRecord?.clears ?? 0}</strong></p>
                </div>
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
        <aside className="goose-debug" aria-label="Playtest diagnostics" data-open={debugOpen ? "true" : undefined}>
          <button
            type="button"
            className="goose-debug__title"
            aria-expanded={debugOpen}
            onPointerDown={(event) => {
              event.preventDefault();
              setDebugOpen((open) => !open);
            }}
            onKeyDown={(event) => {
              if (event.key !== "Enter" && event.key !== " ") return;
              event.preventDefault();
              setDebugOpen((open) => !open);
            }}
          >
            DEBUG · ?debug=1
          </button>
          {debugOpen && <>
          <div className="goose-debug__row"><span>FPS</span><b>{fps}</b></div>
          <div className="goose-debug__row"><span>关卡</span><b>{level}</b></div>
          <div className="goose-debug__row"><span>场上</span><b>{bridgeState.items.length}</b></div>
          <div className="goose-debug__row"><span>底藏</span><b>{bridgeState.reserveCount}</b></div>
          <div className="goose-debug__row"><span>总剩</span><b>{bridgeState.items.length + bridgeState.reserveCount}</b></div>
          <div className="goose-debug__row"><span>托盘</span><b>{tray.filter((s) => s !== null).length}/{TRAY_SLOTS}</b></div>
          <div className="goose-debug__row"><span>分数</span><b>{score}</b></div>
          <div className="goose-debug__row"><span>连击</span><b>x{combo}</b></div>
          <div className="goose-debug__row"><span>时间</span><b>{Math.max(0, secs)}s</b></div>
          <div className="goose-debug__row"><span>新局</span><b>#{bridgeState.dealNonce}</b></div>
          <div className="goose-debug__row"><span>颠锅</span><b>{bridgeState.shakeStrength.toFixed(2)}</b></div>
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
            <button type="button" onClick={() => runGameAction("debugShake", { intensity: 0.7 })}>轻甩</button>
            <button type="button" onClick={() => runGameAction("debugShake", { intensity: 1.35 })}>重甩</button>
          </div>
          </>}
        </aside>
      )}
      {deviceQaEnabled && DeviceQaPanelComponent && (
        <DeviceQaPanelComponent
          motionPermission={deviceShake.permission}
          motionEnabled={deviceShake.enabled}
          requestMotion={deviceShake.requestEnable}
          disableMotion={deviceShake.disable}
          game={{
            gameStatus,
            level,
            themeId,
            activeCount: bridgeState.items.length,
            reserveCount: bridgeState.reserveCount,
            trayCount,
            shakeNonce: bridgeState.shakeNonce,
            lastStatus,
          }}
        />
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
