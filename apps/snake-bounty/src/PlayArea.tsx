import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent, PointerEvent } from "react";
import { useStateBindings } from "@shared/react";
import type { PlayAreaProps } from "@shared/react";
import { ParticleBurst } from "@shared/art";
import { PlayStage } from "@shared/components-react/v2";
import { Play, Check } from "lucide-react";
import {
  GRID_SIZE,
  parseInitialState,
  step,
  snakeLength,
  hasReachedTarget,
  stateToSolutionString,
} from "./logic/snake-engine";
import type { SnakeState, Direction } from "./logic/snake-engine";
import {
  DIFFICULTY_RULES,
  formatClock,
  gasDisplay,
  ruleOf,
} from "./logic/game-rules";
import type { Difficulty } from "./logic/game-rules";
import type { LeaderEntry, SolveRow } from "./main";
import "./PlayArea.scss";

const SUBMIT_BUFFER_MS = 15_000;
const MIN_SOLVE_BUFFER_MS = 10_000;
const GAME_TICK_MS = 200; // ms per game tick
const SNAKE_ART = {
  head: "./art/snake-head.webp",
  body: "./art/snake-body-straight.webp",
  tail: "./art/snake-tail.webp",
  food: "./art/food-bounty.webp",
  target: "./art/target-badge.webp",
  reward: "./art/reward-trophy.webp",
  badges: {
    0: "./art/badge-easy.webp",
    1: "./art/badge-medium.webp",
    2: "./art/badge-hard.webp",
  },
} as const satisfies {
  head: string;
  body: string;
  tail: string;
  food: string;
  target: string;
  reward: string;
  badges: Record<Difficulty, string>;
};

const DIRECTION_DEGREES: Record<Direction, number> = {
  0: -90,
  1: 0,
  2: 90,
  3: 180,
};

const LOBBY_PATH_SPRITES = [
  { src: SNAKE_ART.tail, className: "snake-lobby__path-sprite--tail", rotate: 180 },
  { src: SNAKE_ART.body, className: "snake-lobby__path-sprite--body", rotate: 180 },
  { src: SNAKE_ART.body, className: "snake-lobby__path-sprite--body", rotate: 0 },
  { src: SNAKE_ART.head, className: "snake-lobby__path-sprite--head", rotate: 0 },
  { src: SNAKE_ART.food, className: "snake-lobby__path-sprite--food", rotate: 0 },
  { src: SNAKE_ART.target, className: "snake-lobby__path-sprite--target", rotate: 0 },
] as const;

function directionBetween(
  from: SnakeState["body"][number],
  to: SnakeState["body"][number],
): Direction {
  if (to.x > from.x) return 1;
  if (to.x < from.x) return 3;
  if (to.y > from.y) return 2;
  return 0;
}

function bodyRotation(snake: SnakeState, index: number): number {
  const current = snake.body[index];
  const prev = snake.body[index - 1];
  const next = snake.body[index + 1];
  if (!current) return 0;
  if (prev && next) return prev.x === next.x ? 90 : 0;
  if (prev) return DIRECTION_DEGREES[directionBetween(prev, current)];
  return 0;
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
  const gameDifficulty = (val<number>("gameDifficulty", 0) ?? 0) as Difficulty;
  const clues = str("clues", "");
  const commitmentHex = str("commitment", "");
  const dealtAt = val<number>("dealtAt", 0) ?? 0;
  const deadline = val<number>("deadline", 0) ?? 0;
  const lastPayout = str("lastPayout", "");
  const leaderboard = val<LeaderEntry[]>("leaderboard", []) ?? [];
  const myRank = val<number>("myRank", 0) ?? 0;
  const myTotalWon = val<number>("myTotalWon", 0) ?? 0;
  const myHistory = val<SolveRow[]>("myHistory", []) ?? [];
  const isStarting = bool("isStarting");
  const isDealing = bool("isDealing");
  const isSubmitting = bool("isSubmitting");
  const walletConnected = bool("walletConnected");
  const lastStatus = str("lastStatus", t("statusReady"));

  const [pickedDifficulty, setPickedDifficulty] = useState<Difficulty>(0);
  const [snake, setSnake] = useState<SnakeState | null>(null);
  const [crashed, setCrashed] = useState(false);
  const [targetReached, setTargetReached] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [queueDirection, setQueueDirection] = useState<Direction | null>(null);
  // Immediate local turn cue, released on a timer so the grid never sticks in
  // its action state while the move streams to the TEE session.
  const [turnPreview, setTurnPreview] = useState(-1);
  const turnPreviewTimeout = useRef<number | null>(null);

  const tickIntervalRef = useRef<number | null>(null);
  const directionRef = useRef<Direction>(1); // current direction

  const startTurnPreview = useCallback((dir: number) => {
    if (turnPreviewTimeout.current !== null) {
      window.clearTimeout(turnPreviewTimeout.current);
    }
    setTurnPreview(dir);
    turnPreviewTimeout.current = window.setTimeout(() => {
      setTurnPreview(-1);
      turnPreviewTimeout.current = null;
    }, 220);
  }, []);

  useEffect(
    () => () => {
      if (turnPreviewTimeout.current !== null) {
        window.clearTimeout(turnPreviewTimeout.current);
      }
    },
    [],
  );

  // 1s clock while a dealt game is live (drives the countdown + min-solve gate).
  useEffect(() => {
    if (gameStatus !== "dealt") return undefined;
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [gameStatus]);

  const rule = ruleOf(
    gameStatus === "dealt" || gameStatus === "committed" ? gameDifficulty : pickedDifficulty,
  );

  // Parse snake state from clues
  useEffect(() => {
    if (gameStatus === "dealt" && clues && activeGameId !== "0") {
      try {
        const state = parseInitialState(clues);
        setSnake(state);
        directionRef.current = state.direction;
        setCrashed(false);
        setTargetReached(false);
        setQueueDirection(null);
      } catch {
        setSnake(null);
      }
    } else if (gameStatus !== "dealt") {
      setSnake(null);
      if (tickIntervalRef.current !== null) {
        window.clearInterval(tickIntervalRef.current);
        tickIntervalRef.current = null;
      }
    }
  }, [gameStatus, clues, activeGameId]);

  const snakeAlive = Boolean(snake && !snake.dead);

  // Game tick: advance the snake
  useEffect(() => {
    if (gameStatus !== "dealt" || !snakeAlive || targetReached || isSubmitting) {
      if (tickIntervalRef.current !== null) {
        window.clearInterval(tickIntervalRef.current);
        tickIntervalRef.current = null;
      }
      return undefined;
    }

    tickIntervalRef.current = window.setInterval(() => {
      setSnake((prev) => {
        if (!prev || prev.dead || targetReached) return prev;
        const dir = queueDirection ?? directionRef.current;
        const next = step(prev, dir);
        directionRef.current = dir;
        setQueueDirection(null);

        if (next.dead) {
          setCrashed(true);
        }

        return next;
      });
    }, GAME_TICK_MS);

    return () => {
      if (tickIntervalRef.current !== null) {
        window.clearInterval(tickIntervalRef.current);
        tickIntervalRef.current = null;
      }
    };
  }, [gameStatus, snakeAlive, targetReached, isSubmitting, queueDirection]);

  // Check if target reached
  useEffect(() => {
    if (snake && !snake.dead && !targetReached) {
      const t = rule.targetLength;
      if (hasReachedTarget(snake, t)) {
        setTargetReached(true);
      }
    }
  }, [snake, rule.targetLength, targetReached]);

  const remainingMs = deadline > 0 ? deadline - nowMs : 0;
  const elapsedMs = dealtAt > 0 ? nowMs - dealtAt : 0;
  const minSolveReached = dealtAt > 0 && elapsedMs >= rule.minSolveMs + MIN_SOLVE_BUFFER_MS;
  const timeUp = gameStatus === "dealt" && deadline > 0 && remainingMs <= 0;
  const submitWindowClosed =
    gameStatus === "dealt" && deadline > 0 && remainingMs <= SUBMIT_BUFFER_MS;
  const timePct =
    deadline > 0 && dealtAt > 0
      ? Math.max(0, Math.min(100, (remainingMs / (deadline - dealtAt)) * 100))
      : 0;

  const busy = isStarting || isDealing || isSubmitting;
  const selectedRewardGas = Number(gasDisplay(rule.rewardFixed8));
  const rewardPoolReady = poolFree >= selectedRewardGas;
  const currentLength = snake ? snakeLength(snake) : 0;
  const hasWon = targetReached && !crashed && !snake?.dead;

  const handleDirection = useCallback(
    (dir: Direction) => {
      if (!snake || snake.dead || targetReached || timeUp || busy) return;
      // Prevent reversing into self
      const currentDir = directionRef.current;
      const opposite: Record<Direction, Direction> = { 0: 2, 1: 3, 2: 0, 3: 1 };
      if (dir === opposite[currentDir] && currentLength <= 1) return;
      // Queue the direction for the next tick
      setQueueDirection(dir);
      startTurnPreview(dir);
      void dispatch("recordMove", { dir });
    },
    [snake, timeUp, busy, targetReached, currentLength, startTurnPreview, dispatch],
  );

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (gameStatus !== "dealt" || !snake || snake.dead || timeUp) return;
    const keyMap: Record<string, Direction> = {
      ArrowUp: 0,
      w: 0,
      W: 0,
      ArrowRight: 1,
      d: 1,
      D: 1,
      ArrowDown: 2,
      s: 2,
      S: 2,
      ArrowLeft: 3,
      a: 3,
      A: 3,
    };
    if (event.key in keyMap) {
      event.preventDefault();
      handleDirection(keyMap[event.key] ?? 1);
    }
  };

  // Pointer event handlers for swipe
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);

  const handlePointerDown = useCallback((event: PointerEvent) => {
    swipeStartRef.current = { x: event.clientX, y: event.clientY };
  }, []);

  const handlePointerUp = useCallback(
    (event: PointerEvent) => {
      if (!swipeStartRef.current) return;
      const dx = event.clientX - swipeStartRef.current.x;
      const dy = event.clientY - swipeStartRef.current.y;
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);
      const threshold = 20;
      if (Math.max(absDx, absDy) < threshold) {
        swipeStartRef.current = null;
        return;
      }
      if (absDx > absDy) {
        handleDirection(dx > 0 ? 1 : 3);
      } else {
        handleDirection(dy > 0 ? 2 : 0);
      }
      swipeStartRef.current = null;
    },
    [handleDirection],
  );

  const handleSubmit = async () => {
    if (busy) return;
    if (gameStatus === "dealt") {
      if (!snake || !hasWon || !minSolveReached || submitWindowClosed) return;
      await dispatch("submitSolution", {
        solution: stateToSolutionString(snake),
      });
      return;
    }
    if (gameStatus === "idle" || gameStatus === "solved" || gameStatus === "expired") {
      if (!rewardPoolReady) return;
      await dispatch("startGame", { difficulty: pickedDifficulty });
    }
  };

  const renderCell = (row: number, col: number) => {
    if (!snake) return null;

    const head = snake.body[0];
    if (!head) return null;
    const bodyIndex = snake.body.findIndex((seg) => seg.x === col && seg.y === row);
    const isHead = bodyIndex === 0;
    const isBody = bodyIndex > 0;
    const isTail = bodyIndex === snake.body.length - 1 && bodyIndex > 0;
    const isFood = snake.food.x === col && snake.food.y === row;

    const classes = ["snake-cell"];
    if (isHead) classes.push("snake-cell--head");
    if (isBody) classes.push("snake-cell--body");
    if (isTail) classes.push("snake-cell--tail");
    if (isFood) classes.push("snake-cell--food");
    // Crash feedback stays on the snake itself — flashing all 400 cells reads
    // as a full-board strobe rather than a crash site.
    if (crashed && bodyIndex >= 0) classes.push("snake-cell--crashed");

    return (
      <div
        key={`${row}-${col}`}
        className={classes.filter(Boolean).join(" ")}
        data-x={col}
        data-y={row}
      >
        {isHead && (
          <img
            className="snake-cell__sprite snake-cell__sprite--head"
            src={SNAKE_ART.head}
            alt=""
            draggable={false}
            style={{ "--snake-rotate": `${DIRECTION_DEGREES[directionRef.current]}deg` } as CSSProperties}
          />
        )}
        {isBody && (
          <img
            className={[
              "snake-cell__sprite",
              isTail ? "snake-cell__sprite--tail" : "snake-cell__sprite--body",
            ].join(" ")}
            src={isTail ? SNAKE_ART.tail : SNAKE_ART.body}
            alt=""
            draggable={false}
            style={{ "--snake-rotate": `${bodyRotation(snake, bodyIndex)}deg` } as CSSProperties}
          />
        )}
        {isFood && (
          <img
            className="snake-cell__sprite snake-cell__sprite--food"
            src={SNAKE_ART.food}
            alt=""
            draggable={false}
          />
        )}
      </div>
    );
  };

  const difficultyPicker = (
    <div className="snake-lobby">
      {lastPayout && gameStatus === "solved" && (
        <div className="snake-lobby__result" data-state="won">
          <ParticleBurst coins count={12} />
          <strong>{t("solvedBanner", { payout: lastPayout })}</strong>
          <span>{t("solvedBannerHint")}</span>
        </div>
      )}
      {crashed && gameStatus === "dealt" && (
        <div className="snake-lobby__result" data-state="expired">
          <strong>{t("gameOverBanner")}</strong>
          <span>{t("gameOverBannerHint")}</span>
        </div>
      )}
      {gameStatus === "expired" && (
        <div className="snake-lobby__result" data-state="expired">
          <strong>{t("expiredBanner")}</strong>
          <span>{t("expiredBannerHint")}</span>
        </div>
      )}
      <section
        className="snake-lobby__arena"
        aria-label={t("lobbyPreviewLabel", {
          difficulty: t(`difficulty_${rule.key}`),
          target: rule.targetLength,
        })}
      >
        <img
          className="snake-lobby__banner-art"
          src="./banner.webp"
          alt=""
          decoding="async"
          draggable={false}
        />
        <div className="snake-lobby__hud">
          <span className="snake-lobby__route-label">
            <img src={SNAKE_ART.target} alt="" draggable={false} />
            {t(`difficulty_${rule.key}`)}
          </span>
          <strong>{t("lobbyHuntGoal", { target: rule.targetLength })}</strong>
        </div>
        <div className="snake-lobby__path" aria-hidden="true">
          <span className="snake-lobby__path-line" />
          {LOBBY_PATH_SPRITES.map((sprite, index) => (
            <img
              key={`${sprite.src}-${index}`}
              className={["snake-lobby__path-sprite", sprite.className].join(" ")}
              src={sprite.src}
              alt=""
              draggable={false}
              style={
                {
                  "--snake-rotate": `${sprite.rotate}deg`,
                  "--snake-delay": `${index * 80}ms`,
                } as CSSProperties
              }
            />
          ))}
        </div>
        <div className="snake-lobby__ribbon" aria-label={t("routeSummary")}>
          <span className="snake-lobby__ribbon-prize">
            <img src={SNAKE_ART.reward} alt="" draggable={false} />
            {t("winAmount", { amount: gasDisplay(rule.rewardFixed8) })}
          </span>
          {/* Target length lives on the HUD headline + route cards already —
              three pills keep the ribbon on a single row at both breakpoints. */}
          <span>{t("entryAmount", { amount: gasDisplay(rule.entryFixed8) })}</span>
          <span>{t("timeAmount", { minutes: Math.round(rule.limitMs / 60000) })}</span>
        </div>
      </section>
      <div className="snake-lobby__routes" role="radiogroup" aria-label={t("difficultyTitle")}>
        {DIFFICULTY_RULES.map((entry) => {
          const active = entry.difficulty === pickedDifficulty;
          return (
            <button
              key={entry.key}
              type="button"
              role="radio"
              aria-checked={active}
              className={["snake-route", active ? "snake-route--active" : null]
                .filter(Boolean)
                .join(" ")}
              onClick={() => setPickedDifficulty(entry.difficulty)}
              disabled={busy}
            >
              <img
                className="snake-route__badge"
                src={SNAKE_ART.badges[entry.difficulty]}
                alt=""
                decoding="async"
                draggable={false}
              />
              <span className="snake-route__name">{t(`difficulty_${entry.key}`)}</span>
              <span className="snake-route__target">
                {t("targetRibbon", { target: entry.targetLength })}
              </span>
            </button>
          );
        })}
      </div>
      <p
        className="snake-lobby__pool"
        data-blocked={!walletConnected || !rewardPoolReady ? "true" : "false"}
      >
        {walletConnected
          ? t("poolLine", { pool: poolFree.toFixed(2) })
          : t("walletRequiredStatus")}
        {creditGas > 0 ? ` · ${t("creditLine", { credit: creditGas.toFixed(2) })}` : ""}
        {walletConnected && !rewardPoolReady ? ` · ${t("statusPoolLow")}` : ""}
      </p>
    </div>
  );

  const dealingStage = (
    <div className="snake-shuffle" role="status" aria-label={t("statusShuffling")}>
      <div className="snake-shuffle__track" aria-hidden="true">
        {[SNAKE_ART.tail, SNAKE_ART.body, SNAKE_ART.head, SNAKE_ART.food, SNAKE_ART.target].map(
          (src, i) => (
            <img
              key={src}
              src={src}
              alt=""
              draggable={false}
              style={{ animationDelay: `${i * 110}ms` }}
            />
          ),
        )}
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

  const boardStage = snake && (
    <div className="snake-table">
      <div className="snake-timer" data-low={remainingMs < 60_000 ? "true" : undefined}>
        <span className="snake-timer__clock">{formatClock(remainingMs)}</span>
        <span className="snake-timer__track" aria-hidden="true">
          <i style={{ width: `${timePct}%` }} />
        </span>
        <span className="snake-timer__reward">
          {t("rewardNow", { amount: gasDisplay(rule.rewardFixed8) })}
        </span>
      </div>
      <div
        className="snake-grid"
        role="grid"
        aria-label={t("boardLabel")}
        data-turn={turnPreview >= 0 ? turnPreview : undefined}
        tabIndex={0}
        ref={gridRef}
        onKeyDown={handleKeyDown}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        style={{ touchAction: "none" }}
      >
        {Array.from({ length: GRID_SIZE * GRID_SIZE }, (_, i) => {
          const row = Math.floor(i / GRID_SIZE);
          const col = i % GRID_SIZE;
          return renderCell(row, col);
        })}
      </div>
      <div className="snake-length-bar">
        <span className="snake-length-bar__label">
          {currentLength} / {rule.targetLength}
        </span>
        <span className="snake-length-bar__track" aria-hidden="true">
          <i
            style={{
              width: `${Math.min(100, (currentLength / rule.targetLength) * 100)}%`,
            }}
          />
        </span>
      </div>
      <p className="snake-controls-hint" role="note">{t("controlsHint")}</p>
      {!minSolveReached && hasWon && (
        <p className="snake-hint" role="status">
          {t("minSolveHint", {
            clock: formatClock(rule.minSolveMs + MIN_SOLVE_BUFFER_MS - elapsedMs),
          })}
        </p>
      )}
      {submitWindowClosed && !timeUp && (
        <p className="snake-hint snake-hint--expired" role="alert">
          {t("deadlineBufferHint")}
        </p>
      )}
      {timeUp && (
        <p className="snake-hint snake-hint--expired" role="alert">
          {t("timeUpHint")}
        </p>
      )}
    </div>
  );

  const scene = (
    <div
      className="snake-scene"
      style={{ borderRadius: "var(--mx2-r-lg)" }}
      data-state={
        isSubmitting
          ? "submitting"
          : isDealing || gameStatus === "committed"
            ? "dealing"
            : gameStatus === "dealt"
              ? hasWon
                ? "won"
                : crashed
                  ? "crashed"
                  : "playing"
              : gameStatus === "solved"
                ? "won"
                : "idle"
      }
    >
      <span className="snake-scene__paper" aria-hidden="true" />
      {gameStatus === "committed" || (gameStatus === "dealt" && !snake)
        ? dealingStage
        : gameStatus === "dealt" && snake
          ? boardStage
          : difficultyPicker}
      <p className="snake-scene__status" aria-live="polite">
        {lastStatus}
      </p>
    </div>
  );

  const primaryAction =
    gameStatus === "dealt"
      ? crashed
        ? {
            label: t("statusGameOver"),
            onClick: () => {},
            disabled: true,
            hint: t("gameOverBannerHint"),
          }
        : hasWon && !timeUp && !submitWindowClosed
          ? {
              label: t("submitAction"),
              onClick: () => void handleSubmit(),
              disabled: busy || !minSolveReached,
              loading: isSubmitting,
              icon: <Check size={18} aria-hidden="true" />,
              hint: t("submitHint"),
            }
          : {
              label: t("timeUpAction"),
              onClick: () => {},
              disabled: true,
              hint: t("timeUpHint"),
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
              disabled: busy || !walletConnected || !rewardPoolReady,
              loading: isStarting,
              icon: <Play size={18} aria-hidden="true" />,
              hint: !walletConnected
                ? t("walletRequiredStatus")
                : rewardPoolReady
                  ? t("startHint", { amount: gasDisplay(rule.entryFixed8) })
                  : t("statusPoolLow"),
          };

  const secondaryActions = [
    ...(timeUp || (gameStatus === "committed" && !isDealing) || (crashed && gameStatus === "dealt")
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
      className="snake-playarea mx2 mx2-cat-game"
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
                ? t("statusStarted")
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
        score={[
          {
            label: t("scoreReward"),
            value: `${gasDisplay(rule.rewardFixed8)} GAS`,
            accent: true,
          },
          {
            label: t("scoreTime"),
            value: gameStatus === "dealt" ? formatClock(remainingMs) : formatClock(rule.limitMs),
          },
          { label: t("scoreLength"), value: `${currentLength}/${rule.targetLength}` },
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
              <div className="snake-drawer__head">
                <img src="./logo.webp" alt="" width={40} height={40} draggable={false} />
                <p>{t("leaderboardIntro")}</p>
              </div>
              <h4>{t("leaderboardTitle")}</h4>
              {leaderboard.length > 0 ? (
                <ol className="snake-ranks">
                  {leaderboard.slice(0, 10).map((entry) => (
                    <li
                      key={entry.address}
                      className="snake-ranks__row"
                      data-me={entry.isUser ? "true" : undefined}
                    >
                      <span className="snake-ranks__rank">#{entry.rank}</span>
                      <span className="snake-ranks__addr">{shortHash(entry.address)}</span>
                      <span className="snake-ranks__solves">
                        {t("solvesCount", { count: entry.solves })}
                      </span>
                      <span className="snake-ranks__won">{entry.totalWon.toFixed(2)} GAS</span>
                      {entry.isUser && <span className="snake-ranks__me">{t("youTag")}</span>}
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
                    <li key={row.gameId} className="mx2-history__item" data-outcome={parseFloat(row.payout) > 0 ? "won" : "lost"}>
                      <span className="mx2-history__face">
                        {t(`difficulty_${ruleOf(row.difficulty).key}`)}
                      </span>
                      <span className="mx2-history__stake">{formatClock(row.solveMs)}</span>
                      <span className="mx2-history__result">{row.payout}</span>
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
                <p className="snake-drawer__seed">
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
