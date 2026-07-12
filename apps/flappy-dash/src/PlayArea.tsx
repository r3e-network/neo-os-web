import { useCallback, useEffect, useRef, useState } from "react";
import { useStateBindings } from "@shared/react";
import type { PlayAreaProps } from "@shared/react";
import { ParticleBurst } from "@shared/art";
import { PlayStage } from "@shared/components-react/v2";
import { Cloud } from "lucide-react";
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  GROUND_HEIGHT,
  BIRD_WIDTH,
  BIRD_HEIGHT,
  BIRD_X,
  PIPE_WIDTH,
  PIPE_GAP,
  createGameState,
  updateFrame,
  flap,
} from "./logic/flappy-engine";
import type { GameState } from "./logic/flappy-engine";
import {
  DIFFICULTY_RULES,
  formatClock,
  gasDisplay,
  ruleOf,
} from "./logic/game-rules";
import type { LeaderEntry, SolveRow } from "./main";
import "./PlayArea.scss";

const FLAPPY_SPRITES = {
  background: "./flappy-sprites/background-day.webp",
  base: "./flappy-sprites/base.webp",
  pipeTop: "./flappy-sprites/pipe-top.webp",
  pipeBottom: "./flappy-sprites/pipe-bottom.webp",
  birdUp: "./flappy-sprites/bird-up.webp",
  birdMid: "./flappy-sprites/bird-mid.webp",
  birdDown: "./flappy-sprites/bird-down.webp",
} as const;

type FlappySpriteKey = keyof typeof FLAPPY_SPRITES;
type FlappySprites = Record<FlappySpriteKey, HTMLImageElement>;

function canUseCanvas2d(): boolean {
  return typeof CanvasRenderingContext2D !== "undefined";
}

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
  const seed = str("seed", "");
  const commitmentHex = str("commitment", "");
  const deadline = val<number>("deadline", 0) ?? 0;
  const lastPayout = str("lastPayout", "");
  const leaderboard = val<LeaderEntry[]>("leaderboard", []) ?? [];
  const myRank = val<number>("myRank", 0) ?? 0;
  const myTotalWon = val<number>("myTotalWon", 0) ?? 0;
  const myHistory = val<SolveRow[]>("myHistory", []) ?? [];
  const isStarting = bool("isStarting");
  const isDealing = bool("isDealing");
  const isSubmitting = bool("isSubmitting");
  const lastStatus = str("lastStatus", t("statusReady"));

  const [pickedDifficulty, setPickedDifficulty] = useState<number>(0);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [localPhase, setLocalPhase] = useState<"idle" | "ready" | "playing" | "crashed" | "won">("idle");
  const [retryKey, setRetryKey] = useState(0);
  // Immediate local flap motion cue, released on a timer so the surface never
  // sticks in its action state while the flap streams to the TEE session.
  const [flapPreview, setFlapPreview] = useState(false);
  const flapPreviewTimeout = useRef<number | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const gameStateRef = useRef<GameState | null>(null);
  const spritesRef = useRef<Partial<FlappySprites>>({});
  const [spritesReady, setSpritesReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const entries = Object.entries(FLAPPY_SPRITES) as [FlappySpriteKey, string][];
    void Promise.all(
      entries.map(
        ([key, src]) =>
          new Promise<[FlappySpriteKey, HTMLImageElement]>((resolve, reject) => {
            const image = new Image();
            image.onload = () => resolve([key, image]);
            image.onerror = reject;
            image.src = src;
          }),
      ),
    )
      .then((loaded) => {
        if (cancelled) return;
        spritesRef.current = Object.fromEntries(loaded) as FlappySprites;
        setSpritesReady(true);
      })
      .catch(() => {
        if (!cancelled) setSpritesReady(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const startFlapPreview = useCallback(() => {
    if (flapPreviewTimeout.current !== null) {
      window.clearTimeout(flapPreviewTimeout.current);
    }
    setFlapPreview(true);
    flapPreviewTimeout.current = window.setTimeout(() => {
      setFlapPreview(false);
      flapPreviewTimeout.current = null;
    }, 220);
  }, []);

  useEffect(
    () => () => {
      if (flapPreviewTimeout.current !== null) {
        window.clearTimeout(flapPreviewTimeout.current);
      }
    },
    [],
  );

  // 1s clock while a dealt game is live
  useEffect(() => {
    if (gameStatus !== "dealt") return undefined;
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [gameStatus]);

  const rule = ruleOf(
    gameStatus === "dealt" || gameStatus === "committed" ? gameDifficulty : pickedDifficulty,
  );

  // (Re)hydrate game state when seed arrives
  useEffect(() => {
    if (gameStatus === "dealt" && seed && activeGameId !== "0") {
      const gs = createGameState(seed, gameDifficulty);
      gs.phase = "ready";
      setGameState(gs);
      gameStateRef.current = gs;
      setLocalPhase("ready");
    } else if (gameStatus !== "dealt") {
      setGameState(null);
      gameStateRef.current = null;
      setLocalPhase("idle");
    }
  }, [gameStatus, seed, activeGameId, gameDifficulty, retryKey]);

  const remainingMs = deadline > 0 ? deadline - nowMs : 0;
  const timeUp = gameStatus === "dealt" && deadline > 0 && remainingMs <= 0;

  const busy = isStarting || isDealing || isSubmitting;
  const selectedRewardGas = Number(gasDisplay(rule.rewardFixed8));
  const rewardPoolReady = poolFree >= selectedRewardGas;

  // ─── Canvas rendering ────────────────────────────────────────────────────

  const drawGame = useCallback(
    (ctx: CanvasRenderingContext2D, gs: GameState) => {
      const w = CANVAS_WIDTH;
      const h = CANVAS_HEIGHT;
      const sprites = spritesReady ? (spritesRef.current as FlappySprites) : null;

      if (sprites) {
        ctx.drawImage(sprites.background, 0, 0, w, h - GROUND_HEIGHT);
      } else {
        const sky = ctx.createLinearGradient(0, 0, 0, h - GROUND_HEIGHT);
        sky.addColorStop(0, "#4dc9f6");
        sky.addColorStop(0.4, "#87ceeb");
        sky.addColorStop(1, "#b8e6ff");
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, w, h - GROUND_HEIGHT);

        ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
        const cloudOffset = (gs.frame * 0.3) % 500;
        for (let i = 0; i < 4; i++) {
          const cx = (i * 170 - cloudOffset + 600) % 600 - 100;
          const cy = 40 + i * 25;
          ctx.beginPath();
          ctx.ellipse(cx, cy, 45, 20, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.ellipse(cx + 25, cy - 10, 35, 18, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.ellipse(cx + 50, cy, 40, 16, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Pipes
      for (const p of gs.pipes) {
        drawPipe(ctx, p.x, p.gapY, PIPE_WIDTH, sprites?.pipeTop, sprites?.pipeBottom);
      }

      // Bird
      const bx = BIRD_X;
      const by = gs.bird.y;
      ctx.save();
      ctx.translate(bx + BIRD_WIDTH / 2, by + BIRD_HEIGHT / 2);
      ctx.rotate((gs.bird.rotation * Math.PI) / 180);
      ctx.translate(-(bx + BIRD_WIDTH / 2), -(by + BIRD_HEIGHT / 2));

      if (sprites) {
        const frame = gs.frame % 18;
        const bird =
          frame < 6 ? sprites.birdUp : frame < 12 ? sprites.birdMid : sprites.birdDown;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(bird, bx, by, BIRD_WIDTH, BIRD_HEIGHT);
        ctx.imageSmoothingEnabled = true;
      } else {
        ctx.fillStyle = "#f5c842";
        ctx.beginPath();
        ctx.ellipse(bx + BIRD_WIDTH / 2, by + BIRD_HEIGHT / 2, BIRD_WIDTH / 2, BIRD_HEIGHT / 2, 0, 0, Math.PI * 2);
        ctx.fill();

        const wingFlap = Math.sin(gs.frame * 0.3) * 5;
        ctx.fillStyle = "#e8a800";
        ctx.beginPath();
        ctx.ellipse(
          bx + BIRD_WIDTH / 2 - 4,
          by + BIRD_HEIGHT / 2 + wingFlap,
          BIRD_WIDTH / 3,
          BIRD_HEIGHT / 4,
          -0.3,
          0,
          Math.PI * 2,
        );
        ctx.fill();

        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(bx + BIRD_WIDTH - 8, by + 7, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#333";
        ctx.beginPath();
        ctx.arc(bx + BIRD_WIDTH - 7, by + 7, 2.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#e74c3c";
        ctx.beginPath();
        ctx.moveTo(bx + BIRD_WIDTH - 2, by + 11);
        ctx.lineTo(bx + BIRD_WIDTH + 8, by + 13);
        ctx.lineTo(bx + BIRD_WIDTH - 2, by + 17);
        ctx.closePath();
        ctx.fill();
      }

      ctx.restore();

      if (sprites) {
        const baseScale = GROUND_HEIGHT / sprites.base.naturalHeight;
        const baseWidth = sprites.base.naturalWidth * baseScale;
        const groundOffset = (gs.frame * 2) % baseWidth;
        ctx.imageSmoothingEnabled = false;
        for (let x = -groundOffset; x < w; x += baseWidth) {
          ctx.drawImage(sprites.base, x, h - GROUND_HEIGHT, baseWidth, GROUND_HEIGHT);
        }
        ctx.imageSmoothingEnabled = true;
      } else {
        ctx.fillStyle = "#8B4513";
        ctx.fillRect(0, h - GROUND_HEIGHT, w, GROUND_HEIGHT);
        ctx.fillStyle = "#228B22";
        ctx.fillRect(0, h - GROUND_HEIGHT, w, 8);

        ctx.strokeStyle = "#2d8a2d";
        ctx.lineWidth = 2;
        const groundScroll = (gs.frame * 2) % 40;
        for (let x = -groundScroll; x < w; x += 40) {
          ctx.beginPath();
          ctx.moveTo(x, h - GROUND_HEIGHT + 2);
          ctx.lineTo(x + 15, h - GROUND_HEIGHT + 10);
          ctx.stroke();
        }
      }

      // Score — premium HUD pill
      const scoreText = `${gs.score}`;
      ctx.font = "bold 28px 'Segoe UI', system-ui, sans-serif";
      ctx.textAlign = "center";
      const scoreWidth = ctx.measureText(scoreText).width;
      const pillW = Math.max(scoreWidth + 28, 52);
      const pillH = 36;
      const pillX = w / 2 - pillW / 2;
      const pillY = 16;
      const pillR = pillH / 2;

      // Backdrop pill
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(pillX + pillR, pillY);
      ctx.arcTo(pillX + pillW, pillY, pillX + pillW, pillY + pillH, pillR);
      ctx.arcTo(pillX + pillW, pillY + pillH, pillX, pillY + pillH, pillR);
      ctx.arcTo(pillX, pillY + pillH, pillX, pillY, pillR);
      ctx.arcTo(pillX, pillY, pillX + pillW, pillY, pillR);
      ctx.closePath();
      ctx.fillStyle = "rgba(0, 0, 0, 0.28)";
      ctx.fill();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.18)";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();

      // Score number
      ctx.fillStyle = "#fff";
      ctx.font = "bold 28px 'Segoe UI', system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.shadowColor = "rgba(0, 0, 0, 0.45)";
      ctx.shadowBlur = 4;
      ctx.shadowOffsetY = 1;
      ctx.fillText(scoreText, w / 2, pillY + pillH - 8);
      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
    },
    [spritesReady],
  );

  function drawPipe(
    ctx: CanvasRenderingContext2D,
    x: number,
    gapY: number,
    pipeW: number,
    pipeTopSprite?: HTMLImageElement,
    pipeBottomSprite?: HTMLImageElement,
  ) {
    const topHeight = gapY;
    const bottomY = gapY + PIPE_GAP;
    const bottomHeight = CANVAS_HEIGHT - GROUND_HEIGHT - bottomY;

    if (pipeTopSprite && pipeBottomSprite) {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(pipeTopSprite, x, 0, pipeW, topHeight);
      ctx.drawImage(pipeBottomSprite, x, bottomY, pipeW, bottomHeight);
      ctx.imageSmoothingEnabled = true;
      return;
    }

    // Top pipe body
    ctx.fillStyle = "#2ecc71";
    ctx.fillRect(x, 0, pipeW, topHeight);
    // Top pipe cap
    ctx.fillStyle = "#27ae60";
    ctx.fillRect(x - 4, topHeight - 20, pipeW + 8, 20);
    // Highlight
    ctx.fillStyle = "#58d68d";
    ctx.fillRect(x + 4, 0, 6, topHeight - 20);

    // Bottom pipe body
    ctx.fillStyle = "#2ecc71";
    ctx.fillRect(x, bottomY, pipeW, bottomHeight);
    // Bottom pipe cap
    ctx.fillStyle = "#27ae60";
    ctx.fillRect(x - 4, bottomY, pipeW + 8, 20);
    // Highlight
    ctx.fillStyle = "#58d68d";
    ctx.fillRect(x + 4, bottomY, 6, bottomHeight - 20);
  }

  useEffect(() => {
    if (gameStatus !== "dealt" || !gameState || localPhase === "playing") return;
    if (!canUseCanvas2d()) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    drawGame(ctx, gameState);
  }, [drawGame, gameState, gameStatus, localPhase]);

  // ─── Game loop ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (localPhase !== "playing" || !gameState) return;
    if (!canUseCanvas2d()) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let running = true;

    const tick = () => {
      if (!running) return;
      const gs = gameStateRef.current;
      if (!gs || gs.phase !== "playing") {
        // If phase changed to crashed/won, still render one last frame
        if (gs) drawGame(ctx, gs);
        running = false;
        return;
      }

	      updateFrame(gs);

	      // Re-read phase after updateFrame — it may have changed inside the
	      // engine via collision detection, but TS doesn't track that.
	      const currentPhase: string = gs.phase;

	      // Check crash first
	      if (currentPhase === "crashed") {
	        setLocalPhase("crashed");
	        setGameState({ ...gs });
	        gameStateRef.current = gs;
	        drawGame(ctx, gs);
	        running = false;
	        return;
	      }

	      // Check win condition (reached target pipes)
	      if (currentPhase === "won" || gs.score >= rule.targetPipes) {
	        gs.phase = "won";
	        setLocalPhase("won");
	        setGameState({ ...gs });
	        gameStateRef.current = gs;
	        drawGame(ctx, gs);
	        running = false;
	        return;
	      }

      drawGame(ctx, gs);
      animFrameRef.current = requestAnimationFrame(tick);
    };

    animFrameRef.current = requestAnimationFrame(tick);

    return () => {
      running = false;
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [localPhase, gameState, rule.targetPipes, drawGame]);

  // ─── Input handling ──────────────────────────────────────────────────────

  const handleTap = useCallback(() => {
    const gs = gameStateRef.current;
    if (!gs) return;

    if (gs.phase === "ready") {
      gs.phase = "playing";
      setLocalPhase("playing");
      return;
    }

    if (gs.phase === "playing") {
      flap(gs);
      startFlapPreview();
      // Stream flap to TEE session
      void dispatch("recordFlap", {});
      return;
    }
  }, [dispatch, startFlapPreview]);

  // Keyboard flapping (Space/ArrowUp) while a run is live — the universal
  // flappy input on desktop. Detaches outside the ready/playing phases so it
  // never hijacks Space from overlay buttons or drawer content.
  useEffect(() => {
    if (gameStatus !== "dealt" || (localPhase !== "ready" && localPhase !== "playing")) {
      return undefined;
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== "Space" && e.code !== "ArrowUp") return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)
      ) {
        return;
      }
      e.preventDefault();
      handleTap();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [gameStatus, localPhase, handleTap]);

  const handlePlayAgain = useCallback(() => {
    if (gameStatus === "solved" || gameStatus === "expired") {
      if (!rewardPoolReady) return;
      void dispatch("startGame", { difficulty: pickedDifficulty });
    } else {
      setRetryKey((k) => k + 1);
      setLocalPhase("idle");
    }
  }, [gameStatus, pickedDifficulty, rewardPoolReady, dispatch]);

  // ─── Submit for settlement ───────────────────────────────────────────────

  const handleSubmit = useCallback(async () => {
    if (busy || gameStatus !== "dealt") return;
    const gs = gameStateRef.current;
    if (!gs) return;

    const pipesPassed = gs.score;
    await dispatch("submitSolution", { pipes: pipesPassed });
  }, [busy, gameStatus, dispatch]);

  // ─── Lobby / idle state ──────────────────────────────────────────────────

  const difficultyPicker = (
    <div className="flappy-lobby">
      {lastPayout && gameStatus === "solved" && (
        <div className="flappy-lobby__result" data-state="won">
          <ParticleBurst coins count={12} />
          <strong>{t("solvedBanner", { payout: lastPayout })}</strong>
          <span>{t("solvedBannerHint")}</span>
        </div>
      )}
      {gameStatus === "expired" && (
        <div className="flappy-lobby__result" data-state="expired">
          <strong>{t("expiredBanner")}</strong>
          <span>{t("expiredBannerHint")}</span>
        </div>
      )}
      <section
        className="flappy-lobby__flight-card"
        aria-label={t("lobbyPreviewLabel", {
          difficulty: t(`difficulty_${rule.key}`),
          count: rule.targetPipes,
        })}
      >
        <div className="flappy-lobby__pixel-scene" aria-hidden="true">
          <div
            className="flappy-lobby__pixel-bg"
            style={{ backgroundImage: `url(${FLAPPY_SPRITES.background})` }}
          />
          <img
            className="flappy-lobby__pipe flappy-lobby__pipe--top"
            src={FLAPPY_SPRITES.pipeTop}
            alt=""
            decoding="async"
            draggable={false}
          />
          <img
            className="flappy-lobby__pipe flappy-lobby__pipe--bottom"
            src={FLAPPY_SPRITES.pipeBottom}
            alt=""
            decoding="async"
            draggable={false}
          />
          <span className="flappy-lobby__speed-line flappy-lobby__speed-line--one" />
          <span className="flappy-lobby__speed-line flappy-lobby__speed-line--two" />
          <span className="flappy-lobby__tap-ring" />
          <img
            className="flappy-lobby__bird-sprite"
            src={FLAPPY_SPRITES.birdMid}
            alt=""
            decoding="async"
            draggable={false}
          />
          <div
            className="flappy-lobby__base"
            style={{ backgroundImage: `url(${FLAPPY_SPRITES.base})` }}
          />
        </div>
        <div className="flappy-lobby__flight-scrim" aria-hidden="true" />
        <div className="flappy-lobby__flight-copy">
          <span className="flappy-lobby__route-label">
            {t("routeEyebrow")}
          </span>
          <strong>
            {t("lobbyFlightGoal", { count: rule.targetPipes })}
          </strong>
          <p>{t(`routeObjective_${rule.key}`)}</p>
          <div className="flappy-lobby__ribbon" aria-label={t("routeSummary")}>
            <span className="flappy-lobby__ribbon-prize">
              {t("winAmount", { amount: gasDisplay(rule.rewardFixed8) })}
            </span>
            <span>{t("entryAmount", { amount: gasDisplay(rule.entryFixed8) })}</span>
            <span>{t("targetPipesLabel", { count: rule.targetPipes })}</span>
            <span>{t("timeAmount", { minutes: Math.round(rule.limitMs / 60000) })}</span>
          </div>
        </div>
      </section>
      <div className="flappy-lobby__routes" role="radiogroup" aria-label={t("difficultyTitle")}>
        {DIFFICULTY_RULES.map((entry) => {
          const active = entry.difficulty === pickedDifficulty;
          return (
            <button
              key={entry.key}
              type="button"
              role="radio"
              aria-checked={active}
              className={["flappy-route", active ? "flappy-route--active" : null]
                .filter(Boolean)
                .join(" ")}
              onClick={() => setPickedDifficulty(entry.difficulty)}
              disabled={busy}
            >
              <span className="flappy-route__name">{t(`difficulty_${entry.key}`)}</span>
              <span className="flappy-route__target">
                {t("targetPipesLabel", { count: entry.targetPipes })}
              </span>
              <span className="flappy-route__time">
                {t("timeAmount", { minutes: Math.round(entry.limitMs / 60000) })}
              </span>
            </button>
          );
        })}
      </div>
      <div className="flappy-lobby__statusbar" data-ready={rewardPoolReady ? "true" : undefined}>
        <span className="flappy-lobby__status">
          {rewardPoolReady ? t("lobbyReady") : t("statusPoolLow")}
        </span>
        <span>{t("poolLine", { pool: poolFree.toFixed(2) })}</span>
        {creditGas > 0 && <span>{t("creditLine", { credit: creditGas.toFixed(2) })}</span>}
      </div>
    </div>
  );

  // ─── Dealing stage ───────────────────────────────────────────────────────

  const dealingStage = (
    <div className="flappy-shuffle" role="status" aria-label={t("statusShuffling")}>
      <div className="flappy-shuffle__anim" aria-hidden="true">
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

  // ─── Canvas game stage ───────────────────────────────────────────────────

  const canvasStage = (
    <div className="flappy-canvas-wrapper">
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className="flappy-canvas"
        tabIndex={0}
        onClick={handleTap}
        onTouchEnd={(e) => {
          e.preventDefault();
          handleTap();
        }}
        role="img"
        aria-label={t("tapToFly")}
      />
      {localPhase === "ready" && (
        <div className="flappy-overlay flappy-overlay--ready">
          <span className="flappy-ready-text">{t("tapToFly")}</span>
          <span className="flappy-ready-hint">{t("tapHint")}</span>
        </div>
      )}
      {(localPhase === "crashed" || localPhase === "won") && (
        <div
          className={`flappy-overlay flappy-overlay--${localPhase}`}
          data-win={localPhase === "won" ? "true" : undefined}
        >
          <h2 className="flappy-overlay__title">
            {localPhase === "won" ? t("statusWonTitle") : t("gameOverTitle")}
          </h2>
          <p className="flappy-overlay__pipes">
            {t("gameOverPipes", { count: gameState?.score ?? 0 })}
          </p>
          {localPhase === "won" ? (
            <p className="flappy-overlay__result">
              {t("gameOverWin", { payout: gasDisplay(rule.rewardFixed8) })}
            </p>
          ) : (
            <p className="flappy-overlay__target">
              {t("gameOverTarget", { count: rule.targetPipes })}
            </p>
          )}
          <div className="flappy-overlay__actions">
            {localPhase === "won" ? (
              <>
                <button
                  type="button"
                  className="mx2-btn mx2-btn--primary"
                  onClick={handleSubmit}
                  disabled={busy || isSubmitting}
                >
                  {t("submitAction")}
                </button>
                <button
                  type="button"
                  className="mx2-btn mx2-btn--ghost"
                  onClick={handlePlayAgain}
                >
                  {t("retryAction")}
                </button>
              </>
            ) : (
              <button
                type="button"
                className="mx2-btn mx2-btn--primary"
                onClick={handlePlayAgain}
              >
                {t("retryAction")}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );

  // ─── Scene ───────────────────────────────────────────────────────────────

  const scene = (
    <div
      className="flappy-scene"
      data-flap={flapPreview ? "true" : undefined}
      data-state={
        isSubmitting
          ? "submitting"
          : isDealing || gameStatus === "committed"
            ? "dealing"
            : gameStatus === "dealt"
              ? localPhase === "playing" || localPhase === "ready"
                ? "playing"
                : "over"
              : gameStatus === "solved"
                ? "won"
                : "idle"
      }
    >
      <span className="flappy-scene__sky" aria-hidden="true" />
      {gameStatus === "committed" || (gameStatus === "dealt" && !seed)
        ? dealingStage
        : gameStatus === "dealt" && gameState
          ? canvasStage
          : difficultyPicker}
      {/* Reserved for live operation feedback (sealing, submitting, errors) —
          the idle "ready" line would triple up with the stage title and the
          statusbar chip, so it stays blank while keeping the live region. */}
      <p className="flappy-scene__status" aria-live="polite">
        {lastStatus === t("statusReady") ? "" : lastStatus}
      </p>
    </div>
  );

  // ─── Actions ─────────────────────────────────────────────────────────────

  const primaryAction =
    gameStatus === "dealt"
      ? {
          label: t("tapHint"),
          onClick: () => handleTap(),
          disabled: localPhase !== "ready",
          hint: t("tapHint"),
          icon: <Cloud size={18} aria-hidden="true" />,
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
            onClick: () => {
              if (!rewardPoolReady) return;
              void dispatch("startGame", { difficulty: pickedDifficulty });
            },
            disabled: busy || !rewardPoolReady,
            loading: isStarting,
            icon: <Cloud size={18} aria-hidden="true" />,
            hint: rewardPoolReady
              ? t("startHint", { amount: gasDisplay(rule.entryFixed8) })
              : t("statusPoolLow"),
          };

  const secondaryActions = [
    ...(timeUp || (gameStatus === "committed" && !isDealing)
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

  // ─── Render ───────────────────────────────────────────────────────────

  return (
    <div
      className="flappy-playarea mx2 mx2-cat-game"
      aria-busy={busy || undefined}
    >
      <PlayStage
        category="game"
        stage={{
          eyebrow: t("appEyebrow"),
          title:
            gameStatus === "dealt"
              ? t("playingTitle", { difficulty: t(`difficulty_${rule.key}`) })
              : gameStatus === "committed"
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
            value: `${gasDisplay(rule.rewardFixed8)} GAS`,
            accent: true,
          },
          {
            label: t("scoreTime"),
            value: gameStatus === "dealt" ? formatClock(remainingMs) : formatClock(rule.limitMs),
          },
          {
            label: t("scorePipes"),
            value: gameStatus === "dealt"
              ? `${gameState?.score ?? 0}/${rule.targetPipes}`
              : `0/${rule.targetPipes}`,
          },
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
              <div className="flappy-drawer__head">
                <p>{t("leaderboardIntro")}</p>
              </div>
              <h4>{t("leaderboardTitle")}</h4>
              {leaderboard.length > 0 ? (
                <ol className="flappy-ranks">
                  {leaderboard.slice(0, 10).map((entry) => (
                    <li
                      key={entry.address}
                      className="flappy-ranks__row"
                      data-me={entry.isUser ? "true" : undefined}
                    >
                      <span className="flappy-ranks__rank">#{entry.rank}</span>
                      <span className="flappy-ranks__addr">{shortHash(entry.address)}</span>
                      <span className="flappy-ranks__solves">
                        {t("solvesCount", { count: entry.solves })}
                      </span>
                      <span className="flappy-ranks__won">{entry.totalWon.toFixed(2)} GAS</span>
                      {entry.isUser && <span className="flappy-ranks__me">{t("youTag")}</span>}
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
                      <span className="mx2-history__stake">{formatClock(row.solveMs)}</span>
                      <span className="mx2-history__result">
                        {t("historyPipes", { pipes: row.pipes })}
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
                <p className="flappy-drawer__seed">
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
