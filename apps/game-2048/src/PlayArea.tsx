import { useCallback, useEffect, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent as ReactPointerEvent } from "react";
import { useStateBindings } from "@shared/react";
import type { PlayAreaProps } from "@shared/react";
import { ParticleBurst } from "@shared/art";
import { PlayStage } from "@shared/components-react/v2";
import { Rocket, Undo2 } from "lucide-react";
import {
  MOVE_DOWN,
  MOVE_LEFT,
  MOVE_RIGHT,
  MOVE_UP,
  hasAnyMove,
  tileValue,
} from "./logic/engine-2048";
import {
  DIFFICULTY_RULES,
  MAX_MOVES,
  MAX_UNDOS,
  formatClock,
  gasDisplay,
  rewardPctAfterUndos,
  ruleOf,
} from "./logic/game-rules";
import type { LeaderEntry, SolveRow } from "./main";
import "./PlayArea.scss";

// The contract judges deadlines/min-solve by BLOCK time while this UI ticks on
// the client clock. A submission broadcast in the last moments would land in a
// block past the deadline anyway (~15s cadence), so close the submit window a
// block early — and hold the min-solve gate a beat longer — to absorb both the
// clock skew and the landing delay instead of surfacing an on-chain revert.
const SUBMIT_BUFFER_MS = 15_000;
const MIN_SOLVE_BUFFER_MS = 10_000;
const SWIPE_THRESHOLD_PX = 24;
const MAX_TILE_ART_EXP = 12;

const KEY_MOVES: Record<string, number> = {
  ArrowUp: MOVE_UP,
  ArrowRight: MOVE_RIGHT,
  ArrowDown: MOVE_DOWN,
  ArrowLeft: MOVE_LEFT,
  w: MOVE_UP,
  d: MOVE_RIGHT,
  s: MOVE_DOWN,
  a: MOVE_LEFT,
};

function shortHash(value: string, head = 10, tail = 6): string {
  if (!value || value.length <= head + tail + 1) return value;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}

function lobbyPreviewExps(targetExp: number): number[] {
  const target = Math.min(targetExp, 12);
  const nearTarget = Math.max(1, target - 1);
  return [
    1, 2, 0, 3,
    2, 3, 4, 0,
    0, 4, 5, 6,
    3, 5, nearTarget, target,
  ];
}

function tileArtUrl(exp: number): string {
  return `./art/tile-e${Math.max(1, Math.min(MAX_TILE_ART_EXP, exp))}.webp`;
}

export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { str, bool, val } = useStateBindings(state);
  const creditGas = val<number>("credit", 0) ?? 0;
  const poolFree = val<number>("poolFree", 0) ?? 0;
  const activeGameId = str("activeGameId", "0");
  const gameStatus = str("gameStatus", "idle");
  const gameDifficulty = val<number>("gameDifficulty", 0) ?? 0;
  const commitmentHex = str("commitment", "");
  const runBoard = val<number[]>("runBoard", []) ?? [];
  const runMoveCount = val<number>("runMoveCount", 0) ?? 0;
  const runMaxExp = val<number>("runMaxExp", 0) ?? 0;
  const isMoving = bool("isMoving");
  const dealtAt = val<number>("dealtAt", 0) ?? 0;
  const deadline = val<number>("deadline", 0) ?? 0;
  const undosUsed = val<number>("undosUsed", 0) ?? 0;
  const lastPayout = str("lastPayout", "");
  const leaderboard = val<LeaderEntry[]>("leaderboard", []) ?? [];
  const myRank = val<number>("myRank", 0) ?? 0;
  const myTotalWon = val<number>("myTotalWon", 0) ?? 0;
  const myHistory = val<SolveRow[]>("myHistory", []) ?? [];
  const isStarting = bool("isStarting");
  const isDealing = bool("isDealing");
  const isSubmitting = bool("isSubmitting");
  const isUndoing = bool("isUndoing");
  const lastStatus = str("lastStatus", t("statusReady"));

  const [pickedDifficulty, setPickedDifficulty] = useState(0);
  const [undoArmed, setUndoArmed] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  // Immediate local motion when a swipe lands, released on a timer so the
  // surface never sticks in its action state.
  const [slidePreview, setSlidePreview] = useState(-1);
  const slidePreviewTimeout = useRef<number | null>(null);
  const swipeOrigin = useRef<{ x: number; y: number } | null>(null);

  const startSlidePreview = useCallback((dir: number) => {
    if (slidePreviewTimeout.current !== null) {
      window.clearTimeout(slidePreviewTimeout.current);
    }
    setSlidePreview(dir);
    slidePreviewTimeout.current = window.setTimeout(() => {
      setSlidePreview(-1);
      slidePreviewTimeout.current = null;
    }, 260);
  }, []);

  useEffect(
    () => () => {
      if (slidePreviewTimeout.current !== null) {
        window.clearTimeout(slidePreviewTimeout.current);
      }
    },
    [],
  );

  // 1s clock while a dealt run is live (drives the countdown + gates).
  useEffect(() => {
    if (gameStatus !== "dealt") return undefined;
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [gameStatus]);

  const rule = ruleOf(gameStatus === "idle" ? pickedDifficulty : gameDifficulty);

  // The live board is folded in the store from TEE-confirmed (move, spawn)
  // pairs — the enclave owns the spawn stream, so there is nothing to derive
  // locally. Reset the undo confirmation whenever the game changes.
  useEffect(() => {
    setUndoArmed(false);
  }, [gameStatus, activeGameId]);

  const boardReady = runBoard.length === 16;

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

  const maxExp = runMaxExp;
  const targetReached = boardReady && maxExp >= rule.targetExp;
  const boardDead = boardReady && !targetReached && !hasAnyMove(runBoard);
  const busy = isStarting || isDealing || isSubmitting || isUndoing || isMoving;
  const selectedRewardGas = Number(gasDisplay(rule.rewardFixed8));
  const rewardPoolReady = poolFree >= selectedRewardGas;
  const undosLeft = MAX_UNDOS - undosUsed;
  const currentRewardPct = rewardPctAfterUndos(undosUsed);
  const projectedPayout = (Number(gasDisplay(rule.rewardFixed8)) * currentRewardPct) / 100;

  const handleMove = useCallback(
    (dir: number) => {
      if (!boardReady || gameStatus !== "dealt" || timeUp || busy || isMoving) return;
      startSlidePreview(dir);
      void dispatch("playMove", { dir });
    },
    [boardReady, gameStatus, timeUp, busy, isMoving, startSlidePreview, dispatch],
  );

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (gameStatus !== "dealt") return;
    const dir = KEY_MOVES[event.key];
    if (dir !== undefined) {
      event.preventDefault();
      handleMove(dir);
    }
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    swipeOrigin.current = { x: event.clientX, y: event.clientY };
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const origin = swipeOrigin.current;
    swipeOrigin.current = null;
    if (!origin) return;
    const dx = event.clientX - origin.x;
    const dy = event.clientY - origin.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_THRESHOLD_PX) return;
    if (Math.abs(dx) > Math.abs(dy)) handleMove(dx > 0 ? MOVE_RIGHT : MOVE_LEFT);
    else handleMove(dy > 0 ? MOVE_DOWN : MOVE_UP);
  };

  const confirmUndo = async () => {
    if (!boardReady || runMoveCount === 0 || undosLeft <= 0 || busy) return;
    if (!undoArmed) {
      setUndoArmed(true);
      return;
    }
    setUndoArmed(false);
    try {
      await dispatch("useUndo", {});
      startSlidePreview(4); // rewind pulse
    } catch {
      /* the store surfaced the error toast; the run stays untouched */
    }
  };

  const handleSubmit = async () => {
    if (busy) return;
    if (gameStatus === "dealt") {
      if (!boardReady || !targetReached || !minSolveReached || submitWindowClosed) return;
      startSlidePreview(-1);
      await dispatch("submitRun", {});
      return;
    }
    if (gameStatus === "idle" || gameStatus === "solved" || gameStatus === "expired") {
      if (!rewardPoolReady) return;
      await dispatch("startGame", { difficulty: pickedDifficulty });
    }
  };

  const previewBoard = lobbyPreviewExps(rule.targetExp);

  const difficultyPicker = (
    <div className="rush-lobby">
      {lastPayout && gameStatus === "solved" && (
        <div className="rush-lobby__result" data-state="won">
          <ParticleBurst coins count={12} />
          <strong>{t("solvedBanner", { payout: lastPayout })}</strong>
          <span>{t("solvedBannerHint")}</span>
        </div>
      )}
      {gameStatus === "expired" && (
        <div className="rush-lobby__result" data-state="expired">
          <strong>{t("expiredBanner")}</strong>
          <span>{t("expiredBannerHint")}</span>
        </div>
      )}
      <section className="rush-lobby__board-card" aria-label={t("chaseHint", { tile: rule.targetTile })}>
        <div className="rush-lobby__board" aria-hidden="true">
          {previewBoard.map((exp, index) => (
            <span
              key={`${exp}-${index}`}
              className={[
                "rush-lobby__tile",
                exp > 0 ? `rush-lobby__tile--e${Math.min(exp, 12)}` : null,
                exp === Math.min(rule.targetExp, 12) ? "rush-lobby__tile--target" : null,
              ]
                .filter(Boolean)
                .join(" ")}
            >
              {exp > 0 && (
                <>
                  <img src={tileArtUrl(exp)} alt="" draggable={false} />
                  <span>{exp === Math.min(rule.targetExp, 12) ? rule.targetTile : tileValue(exp)}</span>
                </>
              )}
            </span>
          ))}
        </div>
        <div className="rush-lobby__goal-copy">
          <span>{t("targetKicker")}</span>
          <strong>{rule.targetTile}</strong>
          <small>
            {t("winAmount", { amount: gasDisplay(rule.rewardFixed8) })} ·{" "}
            {t("timeAmount", { minutes: Math.round(rule.limitMs / 60000) })}
          </small>
          <small>{t("entryAmount", { amount: gasDisplay(rule.entryFixed8) })}</small>
        </div>
      </section>
      <div className="rush-lobby__targets-shell">
        <span className="rush-lobby__targets-label">{t("difficultyTitle")}</span>
        <div className="rush-lobby__targets" role="radiogroup" aria-label={t("difficultyTitle")}>
          {DIFFICULTY_RULES.map((entry) => {
            const active = entry.difficulty === pickedDifficulty;
            return (
              <button
                key={entry.key}
                type="button"
                role="radio"
                aria-checked={active}
                aria-label={`${t("targetTile", { tile: entry.targetTile })} · ${t("winAmount", { amount: gasDisplay(entry.rewardFixed8) })}`}
                className={["rush-target", active ? "rush-target--active" : null]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => setPickedDifficulty(entry.difficulty)}
                disabled={busy}
              >
                <span className="rush-target__tile">
                  <img src={tileArtUrl(entry.targetExp)} alt="" draggable={false} />
                  <span>{entry.targetTile}</span>
                </span>
                <span className="rush-target__copy">
                  <strong>{entry.targetTile}</strong>
                  <small>{t("winAmount", { amount: gasDisplay(entry.rewardFixed8) })}</small>
                </span>
                <span className="rush-target__meta">
                  {t("entryAmount", { amount: gasDisplay(entry.entryFixed8) })} ·{" "}
                  {t("timeAmount", { minutes: Math.round(entry.limitMs / 60000) })}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="rush-lobby__statusbar" data-ready={rewardPoolReady ? "true" : undefined}>
        <span className="rush-lobby__status">
          {rewardPoolReady ? t("lobbyReady") : t("statusPoolLow")}
        </span>
        <span>{t("poolLine", { pool: poolFree.toFixed(2) })}</span>
        {creditGas > 0 && <span>{t("creditLine", { credit: creditGas.toFixed(2) })}</span>}
      </div>
    </div>
  );

  const dealingStage = (
    <div className="rush-shuffle" role="status" aria-label={t("statusShuffling")}>
      <div className="rush-shuffle__tiles" aria-hidden="true">
        {[1, 2, 4, 6, 8, 9, 10, 12].map((exp, i) => (
          <img
            key={exp}
            src={tileArtUrl(exp)}
            alt=""
            draggable={false}
            style={{ animationDelay: `${i * 90}ms` }}
          />
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

  const boardStage = boardReady && (
    <div className="rush-table">
      <div className="rush-timer" data-low={remainingMs < 60_000 ? "true" : undefined}>
        <span className="rush-timer__clock">{formatClock(remainingMs)}</span>
        <span className="rush-timer__track" aria-hidden="true">
          <i style={{ width: `${timePct}%` }} />
        </span>
        <span className="rush-timer__reward">
          {t("rewardNow", { amount: projectedPayout.toFixed(2), pct: currentRewardPct })}
        </span>
      </div>
      <div
        className="rush-board"
        role="grid"
        aria-label={t("boardLabel")}
        aria-rowcount={4}
        aria-colcount={4}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        data-slide={slidePreview >= 0 ? slidePreview : undefined}
      >
        {runBoard.map((exp, index) => (
          <span
            key={index}
            className={["rush-tile", exp > 0 ? `rush-tile--e${Math.min(exp, 12)}` : null]
              .filter(Boolean)
              .join(" ")}
            data-target={exp >= rule.targetExp ? "true" : undefined}
          >
            {exp > 0 && (
              <>
                <img
                  className="rush-tile__art"
                  src={tileArtUrl(exp)}
                  alt=""
                  draggable={false}
                />
                <span className="rush-tile__value">{tileValue(exp)}</span>
              </>
            )}
          </span>
        ))}
      </div>
      <p className="rush-controls-hint" aria-label={t("padLabel")}>
        {t("controlsHint")}
      </p>
      <p className="rush-meter">
        {t("bestTile", { tile: tileValue(maxExp) })} · {t("targetTile", { tile: rule.targetTile })} ·{" "}
        {t("moveCount", { used: runMoveCount, cap: MAX_MOVES })}
      </p>
      {targetReached && !minSolveReached && (
        <p className="rush-hint" role="status">
          {t("minSolveHint", { clock: formatClock(rule.minSolveMs + MIN_SOLVE_BUFFER_MS - elapsedMs) })}
        </p>
      )}
      {boardDead && (
        <p className="rush-hint rush-hint--expired" role="alert">
          {t("deadBoardHint")}
        </p>
      )}
      {submitWindowClosed && !timeUp && (
        <p className="rush-hint rush-hint--expired" role="alert">
          {t("deadlineBufferHint")}
        </p>
      )}
      {timeUp && (
        <p className="rush-hint rush-hint--expired" role="alert">
          {t("timeUpHint")}
        </p>
      )}
    </div>
  );

  const scene = (
    <div
      className="rush-scene"
      data-state={
        isSubmitting
          ? "submitting"
          : isDealing || gameStatus === "committed"
            ? "dealing"
            : gameStatus === "dealt"
              ? slidePreview >= 0
                ? "sliding"
                : targetReached
                  ? "charged"
                  : "playing"
              : gameStatus === "solved"
                ? "won"
                : "idle"
      }
    >
      <span className="rush-scene__felt" aria-hidden="true" />
      {gameStatus === "committed" || (gameStatus === "dealt" && !boardReady)
        ? dealingStage
        : gameStatus === "dealt" && boardReady
          ? boardStage
          : difficultyPicker}
      <p className="rush-scene__status" aria-live="polite">
        {lastStatus}
      </p>
    </div>
  );

  const primaryAction =
    gameStatus === "dealt"
      ? {
          label: timeUp ? t("timeUpAction") : t("submitAction"),
          onClick: () => void handleSubmit(),
          disabled: busy || !targetReached || !minSolveReached || submitWindowClosed,
          loading: isSubmitting,
          icon: <Rocket size={18} aria-hidden="true" />,
          hint: targetReached
            ? t("submitHint")
            : t("chaseHint", { tile: rule.targetTile }),
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
            icon: <Rocket size={18} aria-hidden="true" />,
            hint: rewardPoolReady
              ? t("startHint", { amount: gasDisplay(rule.entryFixed8) })
              : t("statusPoolLow"),
          };

  const secondaryActions = [
    ...(gameStatus === "dealt" && !submitWindowClosed
      ? [
          {
            label: undoArmed
              ? t("undoConfirm", { pct: rewardPctAfterUndos(undosUsed + 1) })
              : t("undoAction", { left: undosLeft }),
            onClick: () => void confirmUndo(),
            disabled: busy || undosLeft <= 0 || !boardReady || runMoveCount === 0,
            icon: <Undo2 size={16} aria-hidden="true" />,
            hint: t("undoHint"),
          },
        ]
      : []),
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

  return (
    <div
      className="rush-playarea mx2 mx2-cat-game"
      aria-busy={busy || undefined}
    >
      <PlayStage
        category="game"
        stage={{
          eyebrow: t("appEyebrow"),
          title:
            gameStatus === "dealt"
              ? t("playingTitle", { tile: rule.targetTile })
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
              <div className="rush-drawer__head">
                <img src="./logo.webp" alt="" width={40} height={40} draggable={false} />
                <p>{t("leaderboardIntro")}</p>
              </div>
              <h4>{t("leaderboardTitle")}</h4>
              {leaderboard.length > 0 ? (
                <ol className="rush-ranks">
                  {leaderboard.slice(0, 10).map((entry) => (
                    <li
                      key={entry.address}
                      className="rush-ranks__row"
                      data-me={entry.isUser ? "true" : undefined}
                    >
                      <span className="rush-ranks__rank">#{entry.rank}</span>
                      <span className="rush-ranks__addr">{shortHash(entry.address)}</span>
                      <span className="rush-ranks__solves">
                        {t("solvesCount", { count: entry.solves })}
                      </span>
                      <span className="rush-ranks__won">{entry.totalWon.toFixed(2)} GAS</span>
                      {entry.isUser && <span className="rush-ranks__me">{t("youTag")}</span>}
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
                        {ruleOf(row.difficulty).targetTile}
                      </span>
                      <span className="mx2-history__stake">{formatClock(row.solveMs)}</span>
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
                <p className="rush-drawer__seed">
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
