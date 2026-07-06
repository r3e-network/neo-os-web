import React, { useCallback, useEffect, useRef, useState } from "react";
import { PlayStage } from "@shared/components-react/v2";
import { useMessages } from "@shared/neo";
import {
  ruleOf,
  gasDisplay,
  formatClock,
  payoutFixed8,
  BOARD_SIZE,
} from "./logic/game-rules";
import "./PlayArea.scss";

interface AppState {
  credit: number;
  poolFree: number;
  activeGameId: string | null;
  gameStatus: string;
  gameDifficulty: number;
  board: number[][];
  commitment: string;
  dealtAt: number;
  deadline: number;
  undosUsed: number;
  lastPayout: number;
  lastElapsedMs: number;
  tileAchieved: number;
  moveCount: number;
  leaderboard: Array<{ player: string; totalWon: number; solved: number }>;
  myRank: number;
  myTotalWon: number;
  mySolves: number;
  myHistory: Array<{ gameId: string; difficulty: number; payout: number; solveMs: number; undos: number; tileAchieved: number }>;
  isStarting: boolean;
  isDealing: boolean;
  isSubmitting: boolean;
  walletConnected: boolean;
  lastStatus: string;
}

interface Actions {
  startGame: (difficulty: number) => Promise<void>;
  retryDeal: () => Promise<void>;
  recordMove: (fromRow: number, fromCol: number, toRow: number, toCol: number) => Promise<void>;
  submitSolution: () => Promise<void>;
  expireGame: () => Promise<void>;
  withdrawWinnings: () => Promise<void>;
  refreshLeaderboard: () => Promise<void>;
}

interface Props {
  state: AppState;
  actions: Actions;
}

const DIFF_KEYS = ["easy", "medium", "hard"] as const;
const TILE_ASSETS: Record<number, { label: string; src: string }> = {
  2: { label: "grass plot", src: "./art/tile-0002-grass-plot.webp" },
  4: { label: "wooden hut", src: "./art/tile-0004-wooden-hut.webp" },
  8: { label: "stone cottage", src: "./art/tile-0008-stone-cottage.webp" },
  16: { label: "village house", src: "./art/tile-0016-village-house.webp" },
  32: { label: "watchtower", src: "./art/tile-0032-watchtower.webp" },
  64: { label: "market stall", src: "./art/tile-0064-market-stall.webp" },
  128: { label: "forge", src: "./art/tile-0128-forge.webp" },
  256: { label: "castle gate", src: "./art/tile-0256-castle-gate.webp" },
  512: { label: "castle keep", src: "./art/tile-0512-castle-keep.webp" },
  1024: { label: "royal castle", src: "./art/tile-1024-royal-castle.webp" },
  2048: { label: "crystal citadel", src: "./art/tile-2048-crystal-citadel.webp" },
  4096: { label: "crown palace", src: "./art/tile-4096-crown-palace.webp" },
};

const LOBBY_PREVIEWS: number[][][] = [
  [
    [2, 0, 4, 0],
    [0, 8, 0, 0],
    [0, 0, 16, 0],
    [0, 0, 0, 64],
  ],
  [
    [2, 4, 8, 0],
    [0, 16, 0, 32],
    [64, 0, 128, 0],
    [0, 0, 0, 256],
  ],
  [
    [4, 8, 16, 32],
    [0, 64, 0, 128],
    [256, 0, 512, 0],
    [0, 0, 0, 1024],
  ],
];

function shortAddr(addr: string): string {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function tileAsset(value: number): { label: string; src: string } | null {
  return TILE_ASSETS[value] ?? null;
}

export function PlayArea({ state, actions }: Props) {
  const { t } = useMessages();
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>(null);
  const [selectedDiff, setSelectedDiff] = useState<number>(state.gameDifficulty || 0);
  const [now, setNow] = useState(() => Date.now());
  // Immediate local move cue, released on a timer so a tile never sticks in its
  // action state while the merge streams to the TEE session.
  const [movePreview, setMovePreview] = useState<string | null>(null);
  const movePreviewTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isPlaying = state.gameStatus === "playing";
  const boardReady = Array.isArray(state.board) && state.board.length === BOARD_SIZE;
  const rule = ruleOf(state.gameDifficulty);
  const startDifficulty =
    state.gameStatus === "idle" && !state.activeGameId ? selectedDiff : state.gameDifficulty;
  const startRule = ruleOf(startDifficulty);
  const rewardPoolReady = state.poolFree >= Number(gasDisplay(startRule.reward));
  const selectedDifficultyLabel = t(`difficulty_${DIFF_KEYS[startDifficulty]}`);
  const lobbyPreview = LOBBY_PREVIEWS[startDifficulty] ?? LOBBY_PREVIEWS[0]!;
  const lobbyTargetAsset = tileAsset(startRule.targetTile);

  const startMovePreview = useCallback((cell: string) => {
    if (movePreviewTimeout.current) clearTimeout(movePreviewTimeout.current);
    setMovePreview(cell);
    movePreviewTimeout.current = setTimeout(() => {
      setMovePreview(null);
      movePreviewTimeout.current = null;
    }, 280);
  }, []);

  useEffect(
    () => () => {
      if (movePreviewTimeout.current) clearTimeout(movePreviewTimeout.current);
    },
    [],
  );

  // 1s countdown clock while playing.
  useEffect(() => {
    if (!isPlaying || state.deadline <= 0) {
      if (timerRef.current) clearInterval(timerRef.current);
      return undefined;
    }
    timerRef.current = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, state.deadline]);

  // Reset selection when the game changes.
  useEffect(() => {
    setSelectedCell(null);
  }, [state.gameStatus, state.activeGameId]);

  const timeLeft = state.deadline > 0 ? Math.max(0, state.deadline - now) : 0;
  const isLow = timeLeft > 0 && timeLeft < 30_000;
  const targetReached = state.tileAchieved >= rule.targetTile;

  const handleCellClick = useCallback(
    (row: number, col: number) => {
      if (!isPlaying || !boardReady) return;
      const value = state.board[row]?.[col] ?? 0;
      if (!selectedCell) {
        if (value > 0) setSelectedCell({ row, col });
        return;
      }
      const { row: sr, col: sc } = selectedCell;
      const dr = Math.abs(row - sr);
      const dc = Math.abs(col - sc);
      if ((dr === 1 && dc === 0) || (dr === 0 && dc === 1)) {
        const src = state.board[sr]?.[sc] ?? 0;
        const dst = state.board[row]?.[col] ?? 0;
        if (dst === 0 || dst === src) {
          startMovePreview(`${row},${col}`);
          void actions.recordMove(sr, sc, row, col);
        }
      }
      setSelectedCell(null);
    },
    [isPlaying, boardReady, selectedCell, state.board, startMovePreview, actions],
  );

  // ─── Board ──────────────────────────────────────────────────────────────
  const renderTile = (value: number, row: number, col: number) => {
    const isSelected = selectedCell?.row === row && selectedCell?.col === col;
    const isMoved = movePreview === `${row},${col}`;
    const isEmpty = value === 0;
    const asset = tileAsset(value);
    return (
      <button
        key={`${row}-${col}`}
        type="button"
        className={[
          "mk-tile",
          `mk-tile--${value}`,
          isSelected ? "mk-tile--selected" : "",
          isMoved ? "mk-tile--moved" : "",
          isEmpty ? "mk-tile--empty" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        onClick={() => handleCellClick(row, col)}
        disabled={!isPlaying}
        aria-label={isEmpty ? `Empty plot at ${row},${col}` : `${asset?.label ?? `tile ${value}`} at ${row},${col}`}
      >
        {asset && (
          <>
            <img className="mk-tile__art" src={asset.src} alt="" draggable={false} decoding="async" />
            <span className="mk-tile__value">{value}</span>
          </>
        )}
      </button>
    );
  };

  // ─── Scene ──────────────────────────────────────────────────────────────
  const sceneContent = (() => {
    if (state.gameStatus === "idle" && !state.activeGameId) {
      return (
        <div className="mk-scene">
          <span className="mk-scene__felt" aria-hidden="true" />
          <div className="mk-lobby">
            <section className="mk-lobby__preview" aria-label={t("lobbyPreviewLabel", { difficulty: selectedDifficultyLabel })}>
              {lobbyTargetAsset && (
                <img
                  className="mk-lobby__target-art"
                  src={lobbyTargetAsset.src}
                  alt=""
                  draggable={false}
                  decoding="async"
                  aria-hidden="true"
                />
              )}
              <div className="mk-lobby__preview-head">
                <span className="mk-lobby__mode">{selectedDifficultyLabel}</span>
                <span className="mk-lobby__target">{t("tileTarget", { tile: startRule.targetTile })}</span>
              </div>
              <div className="mk-preview-board" aria-hidden="true">
                {lobbyPreview.map((row, rowIndex) =>
                  row.map((value, colIndex) => (
                    (() => {
                      const asset = tileAsset(value);
                      return (
                        <span
                          key={`${rowIndex}-${colIndex}`}
                          className="mk-preview-tile"
                          data-empty={value === 0 ? "true" : undefined}
                          style={{ animationDelay: `${(rowIndex * BOARD_SIZE + colIndex) * 18}ms` }}
                        >
                          {asset && (
                            <>
                              <img className="mk-preview-tile__art" src={asset.src} alt="" draggable={false} decoding="async" />
                              <span className="mk-preview-tile__value">{value}</span>
                            </>
                          )}
                        </span>
                      );
                    })()
                  )),
                )}
              </div>
              <p className="mk-lobby__quest">
                {t("lobbyQuest", { tile: startRule.targetTile, reward: gasDisplay(startRule.reward) })}
              </p>
            </section>

            <section className="mk-lobby__panel" aria-label={t("difficultyTitle")}>
              <div className="mk-route-strip" role="radiogroup" aria-label={t("difficultyTitle")}>
                {[0, 1, 2].map((d) => {
                  const r = ruleOf(d);
                  const targetAsset = tileAsset(r.targetTile);
                  return (
                    <button
                      key={d}
                      type="button"
                      role="radio"
                      aria-checked={d === selectedDiff}
                      className={`mk-route-card${d === selectedDiff ? " mk-route-card--active" : ""}`}
                      onClick={() => setSelectedDiff(d)}
                      disabled={state.isStarting}
                    >
                      <span className="mk-route-card__crest" aria-hidden="true">
                        {targetAsset && <img src={targetAsset.src} alt="" draggable={false} decoding="async" />}
                      </span>
                      <span className="mk-route-card__copy">
                        <strong>{t(`difficulty_${DIFF_KEYS[d]}`)}</strong>
                        <em>{t("routeGoal", { tile: r.targetTile })}</em>
                      </span>
                      <span className="mk-route-card__reward">{gasDisplay(r.reward)} GAS</span>
                    </button>
                  );
                })}
              </div>

              <div className="mk-lobby__summary">
                <span>
                  <small>{t("scoreReward")}</small>
                  <strong>{gasDisplay(startRule.reward)} GAS</strong>
                </span>
                <span>
                  <small>{t("entryLabel")}</small>
                  <strong>{gasDisplay(startRule.entry)} GAS</strong>
                </span>
                <span>
                  <small>{t("timeLimitLabel")}</small>
                  <strong>{t("timeAmount", { minutes: Math.round(startRule.limitMs / 60000) })}</strong>
                </span>
              </div>

              <p className="mk-lobby__pool">
                {state.walletConnected
                  ? t("poolLine", { pool: state.poolFree.toFixed(2) })
                  : t("walletRequiredStatus")}
                {state.walletConnected && !rewardPoolReady ? ` · ${t("statusPoolLow")}` : ""}
              </p>
              {state.credit > 0 && <p className="mk-lobby__credit">{t("creditLine", { credit: state.credit.toFixed(2) })}</p>}
            </section>
          </div>
        </div>
      );
    }

    if ((isPlaying && !boardReady) || state.isDealing || state.isStarting) {
      return (
        <div className="mk-scene">
          <span className="mk-scene__felt" aria-hidden="true" />
          <div className="mk-shuffle" role="status">
            <div className="mk-shuffle__grid" aria-hidden="true">
              {[0, 1, 2, 3].map((i) => (
                <span key={i} style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
            <p>{t("statusShuffling")}</p>
            {state.lastStatus === "deal-pending" && (
              <button type="button" className="mk-shuffle__retry" onClick={() => void actions.retryDeal()}>
                {t("checkDealAgain")}
              </button>
            )}
          </div>
        </div>
      );
    }

    if (isPlaying && boardReady) {
      const pct = Math.min(100, Math.max(0, (state.tileAchieved / rule.targetTile) * 100));
      return (
        <div className="mk-scene">
          <span className="mk-scene__felt" aria-hidden="true" />
          <div className="mk-target-banner">
            <span className="mk-target-banner__label">{t("tileTarget", { tile: rule.targetTile })}</span>
            <div className="mk-target-banner__bar">
              <i style={{ width: `${pct}%` }} />
            </div>
            <span className="mk-target-banner__value">{state.tileAchieved}</span>
          </div>
          <div className="mk-timer" data-low={isLow ? "true" : undefined}>
            <span className="mk-timer__clock">{formatClock(timeLeft)}</span>
            <div className="mk-timer__track">
              <i style={{ width: `${(timeLeft / rule.limitMs) * 100}%` }} />
            </div>
            <span className="mk-timer__reward">{gasDisplay(rule.reward)} GAS</span>
          </div>
          <div className="mk-board" data-move={movePreview ? "true" : undefined}>
            {state.board.map((rowArr, ri) => rowArr.map((value, ci) => renderTile(value, ri, ci)))}
          </div>
          <div className="mk-stats">
            <span className="mk-stats__moves">{t("movesCount", { n: state.moveCount })}</span>
            <span className="mk-stats__tile">{t("tileScore")}: {state.tileAchieved}</span>
          </div>
          <div className="mk-actions">
            {timeLeft <= 0 ? (
              <button type="button" className="mk-actions__expire" onClick={() => void actions.expireGame()}>
                {t("timeUpAction")}
              </button>
            ) : targetReached ? (
              // The rail primary is the single claim CTA; this chip only celebrates.
              <span className="mk-actions__won">{t("submitHint")}</span>
            ) : (
              <span className="mk-actions__hint">{selectedCell ? t("selectedTile") : t("selectTile")}</span>
            )}
          </div>
        </div>
      );
    }

    if (state.gameStatus === "solved") {
      return (
        <div className="mk-scene">
          <span className="mk-scene__felt" aria-hidden="true" />
          <div className="mk-result" data-state="won">
            <strong>{t("statusWonTitle")}</strong>
            <span>{t("statusSolved", { payout: gasDisplay(state.lastPayout) })}</span>
            <div className="mk-result__stats">
              <span>{t("scoreTile")}: {state.tileAchieved}</span>
              <span>{t("scoreTime")}: {formatClock(state.lastElapsedMs)}</span>
            </div>
          </div>
        </div>
      );
    }

    if (state.gameStatus === "expired" || state.gameStatus === "refunded") {
      return (
        <div className="mk-scene">
          <span className="mk-scene__felt" aria-hidden="true" />
          <div className="mk-result" data-state="expired">
            <strong>{t("statusExpired")}</strong>
            <span>{t("releaseHint")}</span>
          </div>
        </div>
      );
    }

    return <div className="mk-scene"><span className="mk-scene__felt" aria-hidden="true" /></div>;
  })();

  // ─── Score ──────────────────────────────────────────────────────────────
  const scoreItems = [];
  if (isPlaying || state.gameStatus === "solved") {
    scoreItems.push({ label: t("scoreReward"), value: `${gasDisplay(payoutFixed8(rule.reward, state.undosUsed))} GAS`, accent: true });
    scoreItems.push({ label: t("scoreTime"), value: isPlaying ? formatClock(timeLeft) : formatClock(state.lastElapsedMs) });
    scoreItems.push({ label: t("scoreTile"), value: String(state.tileAchieved) });
  }

  // ─── Drawer ─────────────────────────────────────────────────────────────
  const drawerContent = (
    <div className="mk-drawer">
      <div className="mk-drawer__head">
        <img src="./logo.webp" alt="" width={40} height={40} draggable={false} />
        <p>{t("leaderboardIntro")}</p>
        <button type="button" className="mk-ranks__refresh" onClick={() => void actions.refreshLeaderboard()}>
          {t("refreshRanks")}
        </button>
      </div>
      <h4 className="mk-drawer__subtitle">{t("leaderboardTitle")}</h4>
      {state.leaderboard.length === 0 ? (
        <p className="mk-drawer__empty">{t("leaderboardEmpty")}</p>
      ) : (
        <ol className="mk-ranks">
          {state.leaderboard.map((entry, i) => (
            <li key={entry.player} className="mk-ranks__row" data-me={i + 1 === state.myRank ? "true" : undefined}>
              <span className="mk-ranks__rank">#{i + 1}</span>
              <span className="mk-ranks__addr">{shortAddr(entry.player)}</span>
              <span className="mk-ranks__won">{gasDisplay(entry.totalWon)} GAS</span>
              <span className="mk-ranks__solves">{t("solvesCount", { count: entry.solved })}</span>
              {i + 1 === state.myRank && <span className="mk-ranks__me">{t("youTag")}</span>}
            </li>
          ))}
        </ol>
      )}
      <h4 className="mk-drawer__subtitle">{t("historyTitle")}</h4>
      {state.myHistory.length === 0 ? (
        <p className="mk-drawer__empty">{t("historyEmpty")}</p>
      ) : (
        <ul className="mk-history">
          {state.myHistory.map((h, i) => (
            <li key={h.gameId + i} className="mk-history__row">
              <span>#{h.gameId.slice(0, 8)}</span>
              <span>{t(`difficulty_${DIFF_KEYS[h.difficulty]}`)}</span>
              <span className="mk-history__won">{gasDisplay(h.payout)} GAS</span>
              <span>{t("scoreTile")}: {h.tileAchieved}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  // Only offer withdraw when there is actual credit — labelling with lastPayout
  // while credit is 0 produced a dead-end CTA with a wrong amount.
  // NOTE: state.credit is already a GAS decimal (creditGas from the reward SDK),
  // so it must NOT go through gasDisplay (which expects fixed8 raw units).
  const showWithdraw = state.credit > 0 && state.gameStatus !== "playing";

  const secondary = showWithdraw
    ? [{ label: t("withdrawAction", { amount: state.credit.toFixed(2) }), onClick: () => void actions.withdrawWinnings() }]
    : undefined;

  return (
    <div className="mk-playarea mx2 mx2-cat-game" aria-busy={state.isStarting || state.isSubmitting || undefined}>
      <PlayStage
        category="game"
        className="mk-stage"
        stage={{
          eyebrow: t("appEyebrow"),
          title: isPlaying ? t("tileTarget", { tile: rule.targetTile }) : state.gameStatus === "solved" ? t("statusWonTitle") : t("lobbyTitle"),
          subtitle: t("appSubtitle"),
          badges: (
            <span className="mx2-badge" data-tone="accent">
              <span className="mx2-badge__dot" /> {t("networkBadge")}
            </span>
          ),
        }}
        scene={sceneContent}
        score={scoreItems}
        actions={{
          primary:
            (state.gameStatus === "idle" && !state.activeGameId)
              ? {
                  label: t("startAction"),
                  onClick: () => {
                    if (!rewardPoolReady) return;
                    if (!state.walletConnected) return;
                    void actions.startGame(selectedDiff);
                  },
                  disabled: state.isStarting || !state.walletConnected || !rewardPoolReady,
                  loading: state.isStarting,
                  hint: !state.walletConnected
                    ? t("walletRequiredStatus")
                    : rewardPoolReady
                      ? t("startHint", { amount: gasDisplay(startRule.entry) })
                      : t("statusPoolLow"),
                }
              : isPlaying && targetReached && timeLeft > 0
                ? {
                    label: t("submitAction"),
                    onClick: () => void actions.submitSolution(),
                    disabled: state.isSubmitting,
                    loading: state.isSubmitting,
                  }
                : state.gameStatus === "solved" || state.gameStatus === "expired" || state.gameStatus === "refunded"
                  ? {
                      label: t("startAction"),
                      onClick: () => {
                        if (!rewardPoolReady) return;
                        if (!state.walletConnected) return;
                        void actions.startGame(state.gameDifficulty);
                      },
                      disabled: !state.walletConnected || !rewardPoolReady,
                      hint: !state.walletConnected
                        ? t("walletRequiredStatus")
                        : rewardPoolReady
                          ? t("startHint", { amount: gasDisplay(startRule.entry) })
                          : t("statusPoolLow"),
                    }
                  : undefined,
          secondary,
        }}
        drawerToggleLabel={t("leaderboardTitle")}
        drawer={{ children: drawerContent }}
      />
    </div>
  );
}
