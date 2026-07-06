import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useStateBindings } from "@shared/react";
import type { PlayAreaProps } from "@shared/react";
import { ParticleBurst } from "@shared/art";
import { PlayStage } from "@shared/components-react/v2";
import { Undo2, Zap } from "lucide-react";
import { generatePlatforms, hexToBytes, isPerfectLanding, landingOffset } from "./logic/jump-engine";
import type { Platform } from "./logic/jump-engine";
import {
  DIFFICULTY_RULES,
  MAX_UNDOS,
  formatClock,
  gasDisplay,
  rewardPctAfterUndos,
  ruleOf,
} from "./logic/game-rules";
import type { LeaderEntry, RunRow } from "./main";
import "./PlayArea.scss";

const SUBMIT_BUFFER_MS = 15_000;
const MIN_SOLVE_BUFFER_MS = 10_000;
const CHARGE_THROTTLE_MS = 16; // ~60fps
const JUMP_DURATION_MS = 500;
const JR_ASSETS = {
  bunnyHurt: "./art/bunny-hurt.webp",
  bunnyJump: "./art/bunny-jump.webp",
  bunnyReady: "./art/bunny-ready.webp",
  bunnyStand: "./art/bunny-stand.webp",
  carrotGold: "./art/carrot-gold.webp",
  cloud: "./art/cloud.webp",
  platform: "./art/platform-grass.webp",
  platformSmall: "./art/platform-grass-small.webp",
} as const;

function shortHash(value: string, head = 10, tail = 6): string {
  if (!value || value.length <= head + tail + 1) return value;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}

export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { str, bool, val } = useStateBindings(state);
  const creditGas = val<number>("credit", 0) ?? 0;
  const poolFree = val<number>("poolFree", 0) ?? 0;
  const activeGameId = str("activeGameId", "0");
  const gameStatus = str("gameStatus", "idle");
  const gameDifficulty = val<number>("gameDifficulty", 0) ?? 0;
  const commitmentHex = str("commitment", "");
  const dealtAt = val<number>("dealtAt", 0) ?? 0;
  const deadline = val<number>("deadline", 0) ?? 0;
  const undosUsed = val<number>("undosUsed", 0) ?? 0;
  const lastPayout = str("lastPayout", "");
  const leaderboard = val<LeaderEntry[]>("leaderboard", []) ?? [];
  const myRank = val<number>("myRank", 0) ?? 0;
  const myTotalWon = val<number>("myTotalWon", 0) ?? 0;
  const myHistory = val<RunRow[]>("myHistory", []) ?? [];
  const isStarting = bool("isStarting");
  const isDealing = bool("isDealing");
  const isSubmitting = bool("isSubmitting");
  const isUndoing = bool("isUndoing");
  const lastStatus = str("lastStatus", t("statusReady"));

  // Jump Rush specific observables (local mirrors)
  const [pickedDifficulty, setPickedDifficulty] = useState(0);
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [currentPlatformIdx, setCurrentPlatformIdx] = useState(0);
  const [jumpCount, setJumpCount] = useState(0);
  const [perfectCount, setPerfectCount] = useState(0);
  const [comboCount, setComboCount] = useState(0);
  const [chargeLevel, setChargeLevel] = useState(0);
  const [isCharging, setIsCharging] = useState(false);
  const [isJumping, setIsJumping] = useState(false);
  const [missed, setMissed] = useState(false);
  const [showPerfect, setShowPerfect] = useState(false);
  const [comboFlash, setComboFlash] = useState(0);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [scrollOffset, setScrollOffset] = useState(0);
  const [undoArmed, setUndoArmed] = useState(false);
  // Immediate local jump cue, released on a timer so the runner never sticks in
  // its action state while the jump streams to the TEE session.
  const [jumpPreview, setJumpPreview] = useState<number | null>(null);

  const chargeRef = useRef(0);
  const chargingRef = useRef(false);
  const chargeRAF = useRef<number | null>(null);
  const jumpTimer = useRef<number | null>(null);
  const jumpPreviewTimer = useRef<number | null>(null);
  const perfectTimer = useRef<number | null>(null);
  const comboFireTimer = useRef<number | null>(null);

  const startJumpPreview = useCallback((charge: number) => {
    if (jumpPreviewTimer.current !== null) {
      window.clearTimeout(jumpPreviewTimer.current);
    }
    setJumpPreview(charge);
    jumpPreviewTimer.current = window.setTimeout(() => {
      setJumpPreview(null);
      jumpPreviewTimer.current = null;
    }, 260);
  }, []);

  const seed = useMemo(() => {
    if (commitmentHex && commitmentHex.length >= 64) {
      try {
        return hexToBytes(commitmentHex);
      } catch {
        return null;
      }
    }
    return null;
  }, [commitmentHex]);

  // Generate platforms from seed + difficulty
  useEffect(() => {
    if (seed && gameStatus === "dealt") {
      const generated = generatePlatforms(seed, gameDifficulty);
      setPlatforms(generated);
      setCurrentPlatformIdx(0);
      setJumpCount(0);
      setPerfectCount(0);
      setComboCount(0);
      setChargeLevel(0);
      setIsCharging(false);
      setIsJumping(false);
      setMissed(false);
      setShowPerfect(false);
      setComboFlash(0);
      setScrollOffset(0);
    } else if (gameStatus !== "dealt" && gameStatus !== "committed") {
      setPlatforms([]);
    }
  }, [seed, gameStatus, gameDifficulty]);

  // 1s clock while a dealt game is live
  useEffect(() => {
    if (gameStatus !== "dealt") return undefined;
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [gameStatus]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (chargeRAF.current !== null) window.cancelAnimationFrame(chargeRAF.current);
      if (jumpTimer.current !== null) window.clearTimeout(jumpTimer.current);
      if (jumpPreviewTimer.current !== null) window.clearTimeout(jumpPreviewTimer.current);
      if (perfectTimer.current !== null) window.clearTimeout(perfectTimer.current);
      if (comboFireTimer.current !== null) window.clearTimeout(comboFireTimer.current);
    };
  }, []);

  const rule = ruleOf(gameStatus === "idle" ? pickedDifficulty : gameDifficulty);
  const targetJumps = rule.targetJumps;

  const remainingMs = deadline > 0 ? deadline - nowMs : 0;
  const elapsedMs = dealtAt > 0 ? nowMs - dealtAt : 0;
  const minSolveReached = dealtAt > 0 && elapsedMs >= rule.minSolveMs + MIN_SOLVE_BUFFER_MS;
  const timeUp = gameStatus === "dealt" && deadline > 0 && remainingMs <= 0;
  const submitWindowClosed =
    gameStatus === "dealt" && deadline > 0 && remainingMs <= SUBMIT_BUFFER_MS;
  const busy = isStarting || isDealing || isSubmitting || isUndoing;
  const selectedRewardGas = Number(gasDisplay(rule.rewardFixed8));
  const rewardPoolReady = poolFree >= selectedRewardGas;
  const undosLeft = MAX_UNDOS - undosUsed;
  const currentRewardPct = rewardPctAfterUndos(undosUsed);
  const projectedPayout =
    (Number(gasDisplay(rule.rewardFixed8)) * currentRewardPct) / 100;
  const reachedTarget = jumpCount >= targetJumps;

  const currentPlatform = platforms[currentPlatformIdx] ?? null;
  const nextPlatform = platforms[currentPlatformIdx + 1] ?? null;
  const runnerSprite = missed
    ? JR_ASSETS.bunnyHurt
    : jumpPreview !== null || isJumping
      ? JR_ASSETS.bunnyJump
      : isCharging
        ? JR_ASSETS.bunnyReady
        : JR_ASSETS.bunnyStand;

  // ---- Charge mechanics ----
  const startCharge = useCallback(() => {
    if (gameStatus !== "dealt" || missed || isJumping || busy) return;
    chargingRef.current = true;
    setIsCharging(true);
    chargeRef.current = 0;
    setChargeLevel(0);

    const tick = () => {
      if (!chargingRef.current) return;
      chargeRef.current = Math.min(1000, chargeRef.current + CHARGE_THROTTLE_MS);
      setChargeLevel(chargeRef.current);
      chargeRAF.current = window.requestAnimationFrame(tick);
    };
    chargeRAF.current = window.requestAnimationFrame(tick);
  }, [gameStatus, missed, isJumping, busy]);

  const releaseJump = useCallback(() => {
    if (!chargingRef.current) return;
    chargingRef.current = false;
    setIsCharging(false);
    if (chargeRAF.current !== null) {
      window.cancelAnimationFrame(chargeRAF.current);
      chargeRAF.current = null;
    }

    const charge = chargeRef.current;
    if (charge < 20) return; // too short, ignore

    if (!nextPlatform) return;
    const gap = nextPlatform.gap;
    const offset = landingOffset(charge, gap);

    setIsJumping(true);
    startJumpPreview(Math.round(charge));

    // Record the jump in TEE
    void dispatch("recordJump", { chargeMs: Math.round(charge) });

    // Animate jump, then check landing
    jumpTimer.current = window.setTimeout(() => {
      setIsJumping(false);

      // Check if landed on next platform
      if (offset >= 0 && offset <= nextPlatform.width) {
        // Landed!
        const perfect = isPerfectLanding(offset, nextPlatform.width);
        const newIdx = currentPlatformIdx + 1;
        setCurrentPlatformIdx(newIdx);
        setJumpCount((c) => c + 1);

        // Scroll to keep player in view
        const totalScroll = platforms.slice(0, newIdx + 1).reduce((acc, p) => acc + p.gap + p.width, 0);
        setScrollOffset(Math.max(0, totalScroll - 200));

        if (perfect) {
          setPerfectCount((c) => c + 1);
          setComboCount((c) => {
            const next = c + 1;
            setComboFlash(next);
            if (comboFireTimer.current !== null) window.clearTimeout(comboFireTimer.current);
            comboFireTimer.current = window.setTimeout(() => setComboFlash(0), 800);
            return next;
          });
          setShowPerfect(true);
          if (perfectTimer.current !== null) window.clearTimeout(perfectTimer.current);
          perfectTimer.current = window.setTimeout(() => setShowPerfect(false), 600);
        } else {
          setComboCount(0);
        }
      } else {
        // Missed!
        setMissed(true);
        setComboCount(0);
      }
    }, JUMP_DURATION_MS);
  }, [nextPlatform, currentPlatformIdx, platforms, dispatch, startJumpPreview]);

  // Global mouse/touch listeners for charge
  const handlePointerDown = useCallback(() => {
    startCharge();
  }, [startCharge]);

  const handlePointerUp = useCallback(() => {
    releaseJump();
  }, [releaseJump]);

  // ---- Undo ----
  const confirmUndo = async () => {
    if (jumpCount <= 0 || undosLeft <= 0 || busy || isJumping) return;
    if (!undoArmed) {
      setUndoArmed(true);
      return;
    }
    setUndoArmed(false);
    try {
      await dispatch("useUndo", {});
      // Revert to previous platform
      const newIdx = Math.max(0, currentPlatformIdx - 1);
      setCurrentPlatformIdx(newIdx);
      setJumpCount((c) => Math.max(0, c - 1));
      setMissed(false);
      // Recalculate scroll
      const totalScroll = platforms.slice(0, newIdx + 1).reduce((acc, p) => acc + p.gap + p.width, 0);
      setScrollOffset(Math.max(0, totalScroll - 200));
    } catch {
      /* store surfaced error toast */
    }
  };

  // ---- Submit / Start ----
  const handleSubmit = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    if (busy) return;
    if (gameStatus === "dealt") {
      if (!reachedTarget || !minSolveReached || submitWindowClosed) return;
      await dispatch("submitRun", {});
      return;
    }
    if (gameStatus === "idle" || gameStatus === "solved" || gameStatus === "expired") {
      if (!rewardPoolReady) return;
      await dispatch("startGame", { difficulty: pickedDifficulty });
    }
  };

  // ---- Lobby ----
  const difficultyPicker = (
    <div className="jr-lobby">
      {lastPayout && gameStatus === "solved" && (
        <div className="jr-lobby__result" data-state="won">
          <ParticleBurst coins count={12} />
          <strong>{t("solvedBanner", { payout: lastPayout })}</strong>
          <span>{t("solvedBannerHint")}</span>
        </div>
      )}
      {gameStatus === "expired" && (
        <div className="jr-lobby__result" data-state="expired">
          <strong>{t("expiredBanner")}</strong>
          <span>{t("expiredBannerHint")}</span>
        </div>
      )}
      <div className="jr-lobby__modes" role="radiogroup" aria-label={t("difficultyTitle")}>
        {DIFFICULTY_RULES.map((entry) => {
          const active = entry.difficulty === pickedDifficulty;
          return (
            <button
              key={entry.key}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={`${t(`difficulty_${entry.key}`)} · ${t("targetJumps", { count: entry.targetJumps })} · ${t("winAmount", { amount: gasDisplay(entry.rewardFixed8) })}`}
              className={["jr-mode", active ? "jr-mode--active" : null]
                .filter(Boolean)
                .join(" ")}
              onClick={() => setPickedDifficulty(entry.difficulty)}
              disabled={busy}
            >
              <span className="jr-mode__name">{t(`difficulty_${entry.key}`)}</span>
              <span className="jr-mode__reward">
                {t("winAmount", { amount: gasDisplay(entry.rewardFixed8) })}
              </span>
              <span className="jr-mode__meta">{t("targetJumps", { count: entry.targetJumps })}</span>
              <span className="jr-mode__track" aria-hidden="true">
                <span />
                <span />
                <span />
              </span>
            </button>
          );
        })}
      </div>
      <div className="jr-lobby__statusbar" data-ready={rewardPoolReady ? "true" : undefined}>
        <span className="jr-lobby__status">
          {rewardPoolReady ? t("lobbyReady") : t("statusPoolLow")}
        </span>
        <span>{t("poolLine", { pool: poolFree.toFixed(2) })}</span>
        {creditGas > 0 && <span>{t("creditLine", { credit: creditGas.toFixed(2) })}</span>}
      </div>
    </div>
  );

  const lobbyPreview = (
    <div className="jr-lobby-preview" aria-hidden="true">
      <span className="jr-lobby-preview__sun" />
      <img
        className="jr-lobby-preview__cloud jr-lobby-preview__cloud--back"
        src={JR_ASSETS.cloud}
        alt=""
        draggable={false}
      />
      <img
        className="jr-lobby-preview__cloud jr-lobby-preview__cloud--front"
        src={JR_ASSETS.cloud}
        alt=""
        draggable={false}
      />
      <div className="jr-lobby-preview__lane">
        <span className="jr-lobby-preview__speed-lines" />
        <img
          className="jr-lobby-preview__platform jr-lobby-preview__platform--home"
          src={JR_ASSETS.platform}
          alt=""
          draggable={false}
        />
        <img
          className="jr-lobby-preview__platform jr-lobby-preview__platform--mid"
          src={JR_ASSETS.platformSmall}
          alt=""
          draggable={false}
        />
        <img
          className="jr-lobby-preview__platform jr-lobby-preview__platform--goal"
          src={JR_ASSETS.platform}
          alt=""
          draggable={false}
        />
        <span className="jr-lobby-preview__arc" />
        <span className="jr-lobby-preview__landing-ring" />
        <img
          className="jr-lobby-preview__ghost jr-lobby-preview__ghost--one"
          src={JR_ASSETS.bunnyJump}
          alt=""
          draggable={false}
        />
        <img
          className="jr-lobby-preview__ghost jr-lobby-preview__ghost--two"
          src={JR_ASSETS.bunnyJump}
          alt=""
          draggable={false}
        />
        <span className="jr-lobby-preview__runner-shadow" />
        <img
          className="jr-lobby-preview__runner"
          src={JR_ASSETS.bunnyReady}
          alt=""
          draggable={false}
        />
        <img
          className="jr-lobby-preview__carrot"
          src={JR_ASSETS.carrotGold}
          alt=""
          draggable={false}
        />
      </div>
      <div className="jr-lobby-preview__command">
        <span />
        <strong>{t("chargeHint")}</strong>
      </div>
      <div className="jr-lobby-preview__goal">
        <span>{t("targetJumps", { count: rule.targetJumps })}</span>
        <strong>{t("winAmount", { amount: gasDisplay(rule.rewardFixed8) })}</strong>
      </div>
    </div>
  );

  // ---- Dealing stage ----
  const dealingStage = (
    <div className="jr-shuffle" role="status" aria-label={t("statusShuffling")}>
      <div className="jr-shuffle__grid" aria-hidden="true">
        {Array.from({ length: 12 }, (_, i) => (
          <span key={i} style={{ animationDelay: `${i * 120}ms` }} />
        ))}
      </div>
      <p>{t("shufflingCopy")}</p>
      {!isDealing && (
        <button
          type="button"
          className="mx2-btn mx2-btn--ghost"
          onClick={() => void dispatch("retryDeal", {})}
        >
          {t("checkDealAgain")}
        </button>
      )}
    </div>
  );

  // ---- Game board ----
  const progressPct = Math.min(100, Math.round((jumpCount / targetJumps) * 100));
  const liveHud = gameStatus === "dealt" && (
    <div className="jr-hud" aria-label={t("statusBarLabel")}>
      <div className="jr-hud__item" data-variant="progress">
        <span className="jr-hud__label">{t("platformsLabel")}</span>
        <span className="jr-hud__value">{jumpCount}/{targetJumps}</span>
        <span className="jr-hud__bar" aria-hidden="true">
          <span style={{ width: `${progressPct}%` }} />
        </span>
      </div>
      <div className="jr-hud__item" data-variant="perfect">
        <span className="jr-hud__label">{t("perfectLabel")}</span>
        <span className="jr-hud__value">{perfectCount}</span>
      </div>
      <div className="jr-hud__item" data-variant="combo">
        <span className="jr-hud__label">{t("comboLabel", { x: Math.max(1, comboCount) })}</span>
        <span className="jr-hud__value">x{Math.max(1, comboCount)}</span>
      </div>
      <div className="jr-hud__item" data-variant="timer">
        <span className="jr-hud__label">{t("scoreTime")}</span>
        <span className="jr-hud__value" data-low={remainingMs < 30_000 ? "true" : undefined}>
          {formatClock(remainingMs)}
        </span>
      </div>
    </div>
  );

  const gameBoard = platforms.length > 0 && !missed && (
    <div className="jr-board-container">
      {/* Sky background with clouds */}
      <div className="jr-sky" aria-hidden="true">
        <img className="jr-cloud jr-cloud--1" src={JR_ASSETS.cloud} alt="" draggable={false} />
        <img className="jr-cloud jr-cloud--2" src={JR_ASSETS.cloud} alt="" draggable={false} />
        <img className="jr-cloud jr-cloud--3" src={JR_ASSETS.cloud} alt="" draggable={false} />
      </div>
      {liveHud}

      {/* Side-scrolling world */}
      <div className="jr-world" style={{ transform: `translateX(${-scrollOffset}px)` }}>
        {/* Character */}
        <div
          className={[
            "jr-character",
            isCharging ? "jr-character--charging" : null,
            isJumping ? "jr-character--jumping" : null,
          ]
            .filter(Boolean)
            .join(" ")}
          style={{
            left: currentPlatform ? currentPlatform.x + currentPlatform.width / 2 - 20 : 60,
            bottom: isJumping ? 120 : 60,
          }}
        >
          <img className="jr-character__sprite" src={runnerSprite} alt="" draggable={false} />
        </div>

        {/* Platforms */}
        {platforms.slice(0, targetJumps + 1).map((platform, idx) => {
          const isCurrent = idx === currentPlatformIdx;
          const isNext = idx === currentPlatformIdx + 1;
          const isPast = idx < currentPlatformIdx;
          const isPerfectZone = isNext && !isPast;

          return (
            <div
              key={idx}
              className={[
                "jr-platform",
                isCurrent ? "jr-platform--current" : null,
                isPast ? "jr-platform--past" : null,
                isNext && !isPast ? "jr-platform--next" : null,
              ]
                .filter(Boolean)
                .join(" ")}
              style={{
                left: platform.x,
                width: platform.width,
                bottom: 0,
              }}
            >
              <img
                className="jr-platform__sprite"
                src={platform.width < 90 ? JR_ASSETS.platformSmall : JR_ASSETS.platform}
                alt=""
                draggable={false}
              />
              {/* Perfect landing zone indicator */}
              {isPerfectZone && (
                <div
                  className="jr-platform__perfect-zone"
                  style={{
                    left: platform.width * 0.35,
                    width: platform.width * 0.3,
                  }}
                />
              )}
              {/* Platform side shadow */}
              <div className="jr-platform__shadow" />
            </div>
          );
        })}
      </div>

      {/* Charge bar */}
      {isCharging && (
        <div className="jr-charge-bar">
          <div className="jr-charge-bar__track">
            <div
              className="jr-charge-bar__fill"
              style={{ width: `${(chargeLevel / 1000) * 100}%` }}
            />
          </div>
          <span className="jr-charge-bar__label">{t("chargeHint")}</span>
        </div>
      )}

      {/* Perfect landing popup */}
      {showPerfect && (
        <div className="jr-perfect-popup" role="status">
          <span>{t("perfectLanding")}</span>
        </div>
      )}

      {/* Combo fire */}
      {comboFlash > 1 && (
        <div className="jr-combo" role="status">
          <span className="jr-combo__fire" aria-hidden="true">🔥</span>
          <span>{t("comboLabel", { x: comboFlash })}</span>
        </div>
      )}
    </div>
  );

  // ---- Missed screen ----
  const missedScreen = missed && (
    <div className="jr-missed">
      <img className="jr-missed__sprite" src={JR_ASSETS.bunnyHurt} alt="" draggable={false} />
      <h3>{t("statusMissed")}</h3>
      <p>{t("jumpsCount", { count: jumpCount })}</p>
      <button
        type="button"
        className="mx2-btn mx2-btn--ghost"
        onClick={() => void dispatch("expireGame", {})}
      >
        {t("releaseAction")}
      </button>
    </div>
  );

  // ---- Scene ----
  const showingDealing = isStarting || isDealing || gameStatus === "committed";

  const scene = (
    <div
      className="jr-scene"
      data-jump={jumpPreview !== null ? "true" : undefined}
      data-state={
        isSubmitting
          ? "submitting"
          : showingDealing
            ? "dealing"
            : gameStatus === "dealt" && !missed
              ? isJumping
                ? "jumping"
                : isCharging
                  ? "charging"
                  : "playing"
              : gameStatus === "solved"
                ? "won"
                : "idle"
      }
    >
      <span className="jr-scene__sky" aria-hidden="true" />
      {showingDealing || (gameStatus === "dealt" && platforms.length === 0)
        ? dealingStage
        : gameStatus === "dealt" && !missed
          ? gameBoard
          : missed
            ? missedScreen
            : (
                <>
                  {lobbyPreview}
                  {difficultyPicker}
                </>
              )}
      <p className="jr-scene__status" aria-live="polite">
        {lastStatus}
      </p>
    </div>
  );

  // ---- Actions ----
  const primaryAction =
    gameStatus === "dealt"
      ? {
          label: timeUp
            ? t("timeUpAction")
            : reachedTarget
            ? t("submitAction")
            : missed
              ? t("timeUpAction")
              : t("jumpAction"),
          onClick: () => void handleSubmit(),
          disabled: reachedTarget
            ? busy || !minSolveReached || submitWindowClosed
            : busy || timeUp || isJumping,
          loading: isSubmitting,
          icon: <Zap size={18} aria-hidden="true" />,
          hint: reachedTarget
            ? t("submitHint")
            : missed
              ? t("releaseHint")
              : t("chargeHint"),
        }
      : gameStatus === "committed"
        ? {
            label: t("statusShuffling"),
            onClick: () => void dispatch("retryDeal", {}),
            disabled: isDealing,
            loading: isDealing,
            hint: t("shufflingCopy"),
          }
        : {
            label: t("startAction"),
            onClick: () => void handleSubmit(),
            disabled: busy || !rewardPoolReady,
            loading: isStarting,
            icon: <Zap size={18} aria-hidden="true" />,
            hint: rewardPoolReady
              ? t("startHint", { amount: gasDisplay(rule.entryFixed8) })
              : t("statusPoolLow"),
          };

  const secondaryActions = [
    ...(gameStatus === "dealt" && !submitWindowClosed && !missed
      ? [
          {
            label: undoArmed
              ? t("undoConfirm", { pct: rewardPctAfterUndos(undosUsed + 1) })
              : t("undoAction", { left: undosLeft }),
            onClick: () => void confirmUndo(),
            disabled: busy || undosLeft <= 0 || jumpCount <= 0 || isJumping,
            icon: <Undo2 size={16} aria-hidden="true" />,
            hint: t("undoHint"),
          },
        ]
      : []),
    ...(timeUp || missed || (gameStatus === "committed" && !isDealing)
      ? [
          {
            label: t("releaseAction"),
            onClick: () => void dispatch("expireGame", {}),
            hint: t("releaseHint"),
          },
        ]
      : []),
    ...(creditGas > 0 && gameStatus !== "dealt"
      ? [
          {
            label: t("withdrawAction", { amount: creditGas.toFixed(2) }),
            onClick: () => void dispatch("withdrawWinnings", {}),
            hint: t("withdrawHint"),
          },
        ]
      : []),
  ];

  return (
    <div
      className="jr-playarea mx2 mx2-cat-game"
      onMouseDown={handlePointerDown}
      onMouseUp={handlePointerUp}
      onTouchStart={handlePointerDown}
      onTouchEnd={handlePointerUp}
    >
      <PlayStage
        category="game"
        stage={{
          eyebrow: t("appEyebrow"),
          title:
            gameStatus === "dealt"
              ? t("playingTitle", { difficulty: t(`difficulty_${rule.key}`) })
              : showingDealing
                ? t("statusShuffling")
                : gameStatus === "solved"
                  ? t("statusWonTitle")
                  : t("lobbyTitle"),
          subtitle: t("appSubtitle"),
          badges: (
            <>
              <span className="mx2-badge" data-tone="accent">
                <span className="mx2-badge__dot" /> {t("networkBadge")}
              </span>
              {myRank > 0 && (
                <span className="mx2-badge">{t("rankBadge", { rank: myRank })}</span>
              )}
            </>
          ),
        }}
        scene={scene}
        score={gameStatus === "idle" ? undefined : [
          {
            label: t("scoreReward"),
            value: `${projectedPayout.toFixed(2)} GAS`,
            accent: true,
          },
          {
            label: t("scoreTime"),
            value: gameStatus === "dealt" ? formatClock(remainingMs) : formatClock(rule.limitMs),
          },
          { label: t("scoreUndos"), value: `${undosLeft}/${MAX_UNDOS}` },
          { label: t("scoreWon"), value: `${myTotalWon.toFixed(2)} GAS` },
        ]}
        actions={{
          primary: primaryAction,
          secondary: secondaryActions.length > 0 ? secondaryActions : undefined,
        }}
        drawerToggleLabel={t("drawerTitle")}
        drawer={{
          title: t("drawerTitle"),
          children: (
            <>
              <div className="jr-drawer__head">
                <img src="./logo.webp" alt="" width={40} height={40} draggable={false} />
                <p>{t("leaderboardIntro")}</p>
              </div>
              <h4>{t("leaderboardTitle")}</h4>
              {leaderboard.length > 0 ? (
                <ol className="jr-ranks">
                  {leaderboard.slice(0, 10).map((entry) => (
                    <li
                      key={entry.address}
                      className="jr-ranks__row"
                      data-me={entry.isUser ? "true" : undefined}
                    >
                      <span className="jr-ranks__rank">#{entry.rank}</span>
                      <span className="jr-ranks__addr">{shortHash(entry.address)}</span>
                      <span className="jr-ranks__runs">
                        {t("solvesCount", { count: entry.runs })}
                      </span>
                      <span className="jr-ranks__won">{entry.totalWon.toFixed(2)} GAS</span>
                      {entry.isUser && <span className="jr-ranks__me">{t("youTag")}</span>}
                    </li>
                  ))}
                </ol>
              ) : (
                <p>{t("leaderboardEmpty")}</p>
              )}
              <button
                type="button"
                className="mx2-btn mx2-btn--ghost"
                onClick={() => void dispatch("refreshLeaderboard", {})}
              >
                {t("refreshRanks")}
              </button>
              <h4>{t("historyTitle")}</h4>
              {myHistory.length > 0 ? (
                <ul className="mx2-history">
                  {myHistory.map((row) => (
                    <li key={row.gameId} className="mx2-history__item" data-outcome="won">
                      <span className="mx2-history__face">
                        {t(`difficulty_${ruleOf(row.difficulty).key}`)}
                      </span>
                      <span className="mx2-history__stake">{formatClock(row.elapsedMs)}</span>
                      <span className="mx2-history__result">
                        {t("historyUndos", { undos: row.undos })}
                      </span>
                      <span className="mx2-history__stake">{row.payout}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>{t("historyEmpty")}</p>
              )}
              <h4>{t("rulesTitle")}</h4>
              <p>{t("rulesCopy")}</p>
              <h4>{t("fairnessTitle")}</h4>
              <p>{t("fairnessCopy")}</p>
              {commitmentHex && (
                <p className="jr-drawer__seed">
                  {t("commitmentLine", {
                    commitment: shortHash(commitmentHex, 12, 8),
                    gameId: activeGameId,
                  })}
                </p>
              )}
            </>
          ),
        }}
      />
    </div>
  );
}
