import React, { useCallback, useEffect, useRef, useState } from "react";
import { useT } from "@shared/react";
import { PlayStage } from "@shared/components-react/v2";
import {
  ruleOf,
  payoutFixed8,
  gasDisplay,
  formatClock,
  COLOR_NAMES,
  COLOR_HEX,
  COLOR_GLOW,
} from "./logic/game-rules";
import "./PlayArea.scss";

interface AppState {
  credit: number;
  poolFree: number;
  activeGameId: string | null;
  gameStatus: string;
  gameDifficulty: number;
  sequence: string;
  playerSequence: string;
  commitment: string;
  dealtAt: number;
  deadline: number;
  undosUsed: number;
  lastPayout: number;
  lastElapsedMs: number;
  seqAchieved: number;
  leaderboard: Array<{ player: string; totalWon: number; solved: number }>;
  myRank: number;
  myTotalWon: number;
  mySolves: number;
  myHistory: Array<{ gameId: string; difficulty: number; payout: number; solveMs: number; undos: number; seqAchieved: number }>;
  isStarting: boolean;
  isDealing: boolean;
  isSubmitting: boolean;
  lastStatus: string;
}

interface Actions {
  startGame: (difficulty: number) => Promise<void>;
  retryDeal: () => Promise<void>;
  recordPress: (color: number) => Promise<void>;
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
const COLOR_CLASH_ART = {
  table: "./art/arcade-table.webp",
  console: "./art/memory-console.webp",
  pads: [
    "./art/pad-red.webp",
    "./art/pad-blue.webp",
    "./art/pad-green.webp",
    "./art/pad-yellow.webp",
  ],
  badges: [
    "./art/badge-easy.webp",
    "./art/badge-medium.webp",
    "./art/badge-hard.webp",
  ],
} as const;

type PracticeGame = {
  difficulty: number;
  sequence: string;
  playerSequence: string;
  deadline: number;
  status: "playing" | "won" | "lost" | "expired";
};

function shortAddr(addr: string): string {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 8)}…${addr.slice(-4)}`;
}

function gasAmountDisplay(amount: number): string {
  if (!Number.isFinite(amount)) return "0.00";
  if (Math.abs(amount) >= 10) {
    return amount.toLocaleString("en-US", { maximumFractionDigits: 2 });
  }
  return amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function randomColorSequence(length: number): string {
  const bytes = new Uint8Array(length);
  const webCrypto = globalThis.crypto;
  if (webCrypto?.getRandomValues) {
    webCrypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes, (byte) => String(byte % 4)).join("");
}

function previewSequence(length: number): number[] {
  const seed = [0, 2, 1, 3, 2, 0, 3, 1];
  return Array.from({ length }, (_, index) => seed[index % seed.length]);
}

export function PlayArea({ state, actions }: Props) {
  const { t } = useT();
  const [selectedDiff, setSelectedDiff] = useState<number>(0);
  const [practice, setPractice] = useState<PracticeGame | null>(null);
  // Which colour is currently lit during the watch flash (-1 = none).
  const [flashIndex, setFlashIndex] = useState<number>(-1);
  const [phase, setPhase] = useState<"watch" | "repeat">("watch");
  // Immediate local press cue, released on a timer so a button never sticks in
  // its action state while the press streams to the TEE session.
  const [pressPreview, setPressPreview] = useState<number>(-1);
  const pressPreviewTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const flashRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isPractice = practice !== null;
  const isPlaying = state.gameStatus === "playing" || practice?.status === "playing";
  const rule =
    practice?.status === "playing"
      ? ruleOf(practice.difficulty)
      : state.gameStatus !== "idle" && state.gameStatus !== "solved"
        ? ruleOf(state.gameDifficulty)
      : null;
  const startDifficulty =
    state.gameStatus === "idle" && !state.activeGameId ? selectedDiff : state.gameDifficulty;
  const startRule = ruleOf(startDifficulty);
  const rewardPoolReady = state.poolFree >= startRule.reward / 1e8;
  const activeSequence = practice?.sequence ?? state.sequence;
  const activePlayerSequence = practice?.playerSequence ?? state.playerSequence;
  const activeDeadline = practice?.deadline ?? state.deadline;
  const lobbySequence = previewSequence(startRule.targetSeq);

  const startPractice = useCallback((difficulty: number) => {
    const r = ruleOf(difficulty);
    setPractice({
      difficulty,
      sequence: randomColorSequence(r.targetSeq),
      playerSequence: "",
      deadline: Date.now() + r.limitMs,
      status: "playing",
    });
    setPhase("watch");
    setFlashIndex(-1);
  }, []);

  useEffect(() => {
    if (state.gameStatus !== "idle" || state.activeGameId) {
      setPractice(null);
    }
  }, [state.activeGameId, state.gameStatus]);

  const startPressPreview = useCallback((color: number) => {
    if (pressPreviewTimeout.current) clearTimeout(pressPreviewTimeout.current);
    setPressPreview(color);
    pressPreviewTimeout.current = setTimeout(() => {
      setPressPreview(-1);
      pressPreviewTimeout.current = null;
    }, 260);
  }, []);

  useEffect(
    () => () => {
      if (pressPreviewTimeout.current) clearTimeout(pressPreviewTimeout.current);
    },
    [],
  );

  // 1s countdown clock while playing.
  useEffect(() => {
    if (!isPlaying || activeDeadline <= 0) {
      if (timerRef.current) clearInterval(timerRef.current);
      return undefined;
    }
    timerRef.current = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, activeDeadline]);

  // Flash the revealed prefix, then hand control to the player. Bounded and
  // interval-driven (cleared on unmount / sequence change) so it never runs away.
  useEffect(() => {
    if (!isPlaying || !activeSequence) {
      setPhase("repeat");
      setFlashIndex(-1);
      return undefined;
    }
    setPhase("watch");
    let step = 0;
    const seq = activeSequence;
    const tick = () => {
      if (step >= seq.length) {
        setFlashIndex(-1);
        setPhase("repeat");
        if (flashRef.current) clearInterval(flashRef.current);
        flashRef.current = null;
        return;
      }
      const on = step % 2 === 0;
      setFlashIndex(on ? Number(seq[Math.floor(step / 2)]) : -1);
      step += 1;
    };
    tick();
    flashRef.current = setInterval(tick, 320);
    return () => {
      if (flashRef.current) clearInterval(flashRef.current);
      flashRef.current = null;
    };
  }, [isPlaying, activeSequence]);

  const timeLeft = activeDeadline > 0 ? Math.max(0, activeDeadline - now) : 0;
  const isLow = timeLeft > 0 && timeLeft < 30_000;

  const handlePress = useCallback(
    (color: number) => {
      if (phase !== "repeat" || !isPlaying) return;
      startPressPreview(color);
      if (practice?.status === "playing") {
        setPractice((current) => {
          if (!current || current.status !== "playing") return current;
          const expected = Number(current.sequence[current.playerSequence.length]);
          const nextPlayer = current.playerSequence + String(color);
          if (color !== expected) {
            return { ...current, playerSequence: nextPlayer, status: "lost" };
          }
          if (nextPlayer.length >= current.sequence.length) {
            return { ...current, playerSequence: nextPlayer, status: "won" };
          }
          return { ...current, playerSequence: nextPlayer };
        });
        return;
      }
      void actions.recordPress(color);
    },
    [phase, isPlaying, practice?.status, startPressPreview, actions],
  );

  useEffect(() => {
    if (!practice || practice.status !== "playing" || practice.deadline <= 0) return undefined;
    if (timeLeft > 0) return undefined;
    setPractice((current) => current?.status === "playing" ? { ...current, status: "expired" } : current);
    return undefined;
  }, [practice, timeLeft]);

  // ─── Scene ──────────────────────────────────────────────────────────────
  const sceneContent = (() => {
    if (practice?.status === "won" || practice?.status === "lost" || practice?.status === "expired") {
      return (
        <div className="cclash-result" data-state={practice.status === "won" ? "won" : "expired"}>
          <strong>
            {practice.status === "won"
              ? t("practiceWon")
              : practice.status === "lost"
                ? t("practiceLost")
                : t("practiceExpired")}
          </strong>
          <span>{t("practiceResultHint")}</span>
          <div className="cclash-progress" aria-hidden="true">
            {Array.from(practice.sequence).map((_, i) => (
              <span
                key={i}
                className={`cclash-dot${i < practice.playerSequence.length ? " cclash-dot--filled" : ""}`}
              />
            ))}
          </div>
        </div>
      );
    }

    if (state.gameStatus === "idle" && !state.activeGameId && practice === null) {
      return (
        <div className="cclash-lobby">
          <section className="cclash-lobby__console" aria-label={t("repeatPhase")}>
            <img
              className="cclash-lobby__table-art"
              src={COLOR_CLASH_ART.table}
              alt=""
              draggable={false}
            />
            <img
              className="cclash-lobby__console-art"
              src={COLOR_CLASH_ART.console}
              alt=""
              draggable={false}
            />
            <div className="cclash-lobby__pads" aria-hidden="true">
              {[0, 1, 2, 3].map((color) => (
                <img
                  key={color}
                  className={`cclash-lobby__pad cclash-lobby__pad--${COLOR_NAMES[color]}`}
                  src={COLOR_CLASH_ART.pads[color]}
                  alt=""
                  draggable={false}
                  style={{
                    "--pad-color": COLOR_HEX[color],
                    "--pad-glow": COLOR_GLOW[color],
                  } as React.CSSProperties}
                />
              ))}
            </div>
            <div className="cclash-lobby__mission">
              <span>{rewardPoolReady ? t("rewardMode") : t("practiceMode")}</span>
              <strong>{t("sequenceCueCount", { count: startRule.targetSeq })}</strong>
              <em>
                {rewardPoolReady
                  ? t("winAmount", { amount: gasDisplay(startRule.reward) })
                  : t("practiceBadge")}
              </em>
              <p>{t(`modeObjective_${DIFF_KEYS[startDifficulty]}`)}</p>
              <div className="cclash-lobby__mission-ribbon" aria-label={t("modeSummary")}>
                <b>{t("entryAmount", { amount: gasDisplay(startRule.entry) })}</b>
                <b>{formatClock(startRule.limitMs)}</b>
              </div>
            </div>
            <div className="cclash-lobby__sequence" aria-hidden="true">
              {lobbySequence.map((color, index) => (
                <span
                  key={`${color}-${index}`}
                  style={{ "--seq-color": COLOR_HEX[color] } as React.CSSProperties}
                />
              ))}
            </div>
          </section>
          <div className="cclash-lobby__modes" role="radiogroup" aria-label={t("lobbyTitle")}>
            {[0, 1, 2].map((d) => {
              const r = ruleOf(d);
              const active = selectedDiff === d;
              return (
                <button
                  key={d}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  aria-label={`${t(`difficulty_${DIFF_KEYS[d]}`)} · ${r.targetSeq} · ${t("winAmount", { amount: gasDisplay(r.reward) })}`}
                  className={`cclash-mode${active ? " cclash-mode--active" : ""}`}
                  onClick={() => setSelectedDiff(d)}
                  disabled={state.isStarting}
                >
                  <img
                    className="cclash-mode__badge"
                    src={COLOR_CLASH_ART.badges[d]}
                    alt=""
                    draggable={false}
                  />
                  <span className="cclash-mode__name">{t(`difficulty_${DIFF_KEYS[d]}`)}</span>
                  <span className="cclash-mode__seq">{t("targetSeqLabel", { count: r.targetSeq })}</span>
                  <span className="cclash-mode__meta">{formatClock(r.limitMs)} · {t("winAmount", { amount: gasDisplay(r.reward) })}</span>
                  <span className="cclash-mode__lights" aria-hidden="true">
                    {previewSequence(Math.min(6, r.targetSeq)).map((color, index) => (
                      <i key={`${d}-${color}-${index}`} style={{ "--seq-color": COLOR_HEX[color] } as React.CSSProperties} />
                    ))}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="cclash-lobby__pool" data-ready={rewardPoolReady ? "true" : "false"}>
            {rewardPoolReady
              ? t("poolLine", { pool: gasAmountDisplay(state.poolFree) })
              : t("practiceHint")}
          </p>
          {state.isStarting && <p className="cclash-lobby__starting">{t("statusStarting")}</p>}
        </div>
      );
    }

    if (state.gameStatus === "awaiting-bind" || state.isDealing) {
      return (
        <div className="cclash-shuffle" role="status" aria-label={t("statusShuffling")}>
          <div className="cclash-shuffle__grid" aria-hidden="true">
            {[0, 1, 2, 3].map((i) => (
              <span key={i} style={{ background: COLOR_HEX[i], animationDelay: `${i * 120}ms` }} />
            ))}
          </div>
          <p>{t("statusShuffling")}</p>
          {state.lastStatus === "deal-pending" && (
            <button type="button" className="cclash-shuffle__retry" onClick={() => void actions.retryDeal()}>
              {t("checkDealAgain")}
            </button>
          )}
        </div>
      );
    }

    if (isPlaying) {
      return (
        <div className="cclash-table">
          <img
            className="cclash-table__table-art"
            src={COLOR_CLASH_ART.table}
            alt=""
            draggable={false}
          />
          <div className="cclash-timer" data-low={isLow ? "true" : undefined}>
            <span className="cclash-timer__clock">{formatClock(timeLeft)}</span>
            <div className="cclash-timer__track">
              <i style={{ width: rule ? `${(timeLeft / rule.limitMs) * 100}%` : "100%" }} />
            </div>
              <span className="cclash-timer__reward">
                {rule ? (isPractice ? t("practiceBadge") : gasDisplay(payoutFixed8(rule.reward, 0))) : ""}
              </span>
          </div>

          <div className="cclash-phase" aria-live="polite">
            {phase === "watch" ? (
              <span className="cclash-phase__watch">{t("watchPhase")}</span>
            ) : state.lastStatus === "wrong" ? (
              <span className="cclash-phase__lost">{t("wrongPress")}</span>
            ) : state.lastStatus === "all-correct" ? (
              <span className="cclash-phase__won">{t("allCorrect", { n: activeSequence.length })}</span>
            ) : (
              <span className="cclash-phase__repeat">{t("repeatPhase")}</span>
            )}
          </div>

          <div className="cclash-machine">
            <img
              className="cclash-machine__console"
              src={COLOR_CLASH_ART.console}
              alt=""
              draggable={false}
            />
            <div className="cclash-buttons">
              {[0, 1, 2, 3].map((color) => {
                const lit = flashIndex === color;
                const pressed = pressPreview === color;
                return (
                  <button
                    key={color}
                    type="button"
                    className={[
                      "cclash-btn",
                      `cclash-btn--${COLOR_NAMES[color]}`,
                      lit ? "cclash-btn--lit" : "",
                      pressed ? "cclash-btn--pressed" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    style={{
                      "--btn-color": COLOR_HEX[color],
                      "--btn-glow": COLOR_GLOW[color],
                    } as React.CSSProperties}
                    onClick={() => handlePress(color)}
                    disabled={phase !== "repeat"}
                    aria-label={t(`color_${COLOR_NAMES[color]}`)}
                  >
                    <img src={COLOR_CLASH_ART.pads[color]} alt="" draggable={false} />
                  </button>
                );
              })}
            </div>
          </div>

          <div className="cclash-progress" aria-hidden="true">
            {Array.from(activeSequence).map((_, i) => (
              <span
                key={i}
                className={`cclash-dot${i < activePlayerSequence.length ? " cclash-dot--filled" : ""}`}
              />
            ))}
          </div>

          <div className="cclash-actions">
            {isPractice && <span>{t("practiceModeLine")}</span>}
            {!isPractice && state.lastStatus === "wrong" && (
              <button type="button" className="cclash-actions__expire" onClick={() => void actions.expireGame()}>
                {t("releaseAction")}
              </button>
            )}
            {!isPractice && state.lastStatus === "all-correct" && !state.isSubmitting && (
              <button type="button" className="cclash-actions__submit" onClick={() => void actions.submitSolution()}>
                {t("submitAction")}
              </button>
            )}
            {state.isSubmitting && <span>{t("statusSubmitting")}</span>}
            {!isPractice && timeLeft <= 0 && state.lastStatus !== "all-correct" && state.lastStatus !== "wrong" && (
              <button type="button" className="cclash-actions__expire" onClick={() => void actions.expireGame()}>
                {t("timeUpAction")}
              </button>
            )}
          </div>
        </div>
      );
    }

    if (state.gameStatus === "solved") {
      return (
        <div className="cclash-result" data-state="won">
          <strong>{t("solvedBanner", { payout: gasDisplay(state.lastPayout) })}</strong>
          <span>{t("solvedBannerHint")}</span>
          <div className="cclash-result__stats">
            <span>{t("scoreTime")}: {formatClock(state.lastElapsedMs)}</span>
            <span>{t("scoreSeqLen")}: {state.seqAchieved}/{state.sequence.length}</span>
          </div>
        </div>
      );
    }

    if (state.gameStatus === "expired" || state.gameStatus === "refunded") {
      return (
        <div className="cclash-result" data-state="expired">
          <strong>{t("expiredBanner")}</strong>
          <span>{t("expiredBannerHint")}</span>
        </div>
      );
    }

    return null;
  })();

  // ─── Score ──────────────────────────────────────────────────────────────
  const scoreItems = [];
  if (rule) {
    scoreItems.push({
      label: t("scoreReward"),
      value: isPractice ? t("practiceBadge") : `${gasDisplay(payoutFixed8(rule.reward, state.undosUsed))} GAS`,
      accent: true,
    });
  }
  if (isPlaying && activeDeadline > 0) {
    scoreItems.push({ label: t("scoreTime"), value: formatClock(timeLeft) });
  }
  if (state.lastPayout > 0 || state.gameStatus === "solved") {
    scoreItems.push({ label: t("scoreWon"), value: `${gasAmountDisplay(state.myTotalWon)} GAS` });
  }

  // ─── Drawer ─────────────────────────────────────────────────────────────
  const drawerContent = (
    <div className="cclash-drawer">
      <div className="cclash-drawer__head">
        <img src="./logo.webp" alt="" width={40} height={40} draggable={false} />
        <p>{t("leaderboardIntro")}</p>
      </div>
      <h4>{t("leaderboardTitle")}</h4>
      {state.leaderboard.length === 0 ? (
        <p className="cclash-drawer__empty">{t("leaderboardEmpty")}</p>
      ) : (
        <ol className="cclash-ranks">
          {state.leaderboard.map((entry, i) => (
            <li key={entry.player} className="cclash-ranks__row" data-me={i + 1 === state.myRank ? "true" : undefined}>
              <span className="cclash-ranks__rank">#{i + 1}</span>
              <span className="cclash-ranks__addr">{shortAddr(entry.player)}</span>
              <span className="cclash-ranks__solves">{t("solvesCount", { count: entry.solved })}</span>
              <span className="cclash-ranks__won">{gasAmountDisplay(entry.totalWon)} GAS</span>
              {i + 1 === state.myRank && <span className="cclash-ranks__me">{t("youTag")}</span>}
            </li>
          ))}
        </ol>
      )}
      <button type="button" className="cclash-ranks__refresh" onClick={() => void actions.refreshLeaderboard()}>
        {t("refreshRanks")}
      </button>
      <h4>{t("historyTitle")}</h4>
      {state.myHistory.length === 0 ? (
        <p className="cclash-drawer__empty">{t("historyEmpty")}</p>
      ) : (
        <ul className="cclash-history">
          {state.myHistory.map((h) => (
            <li key={h.gameId} className="cclash-history__row">
              <span>#{h.gameId}</span>
              <span>{t(`difficulty_${DIFF_KEYS[h.difficulty]}`)}</span>
              <span>{t("scoreSeqLen")}: {h.seqAchieved}</span>
              <span className="cclash-history__won">+{gasDisplay(h.payout)} GAS</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  const lobbyLike =
    (state.gameStatus === "idle" && !state.activeGameId) ||
    (practice !== null && practice.status !== "playing") ||
    state.gameStatus === "solved" ||
    state.gameStatus === "expired" ||
    state.gameStatus === "refunded";

  const sceneState = isPlaying
    ? "playing"
    : state.gameStatus === "idle" && !state.activeGameId
      ? "idle"
      : state.gameStatus || "idle";

  const secondary = state.credit > 0 && state.gameStatus !== "playing"
    ? [{ label: t("withdrawAction", { amount: gasAmountDisplay(state.credit) }), onClick: () => void actions.withdrawWinnings() }]
    : undefined;

  return (
    <div className="cclash-playarea mx2 mx2-cat-game" aria-busy={state.isStarting || state.isSubmitting || undefined}>
      <PlayStage
        category="game"
        className="cclash-stage"
        stage={{
          eyebrow: t("appEyebrow"),
          title: isPlaying ? t("repeatPhase") : state.gameStatus === "solved" ? t("statusWonTitle") : t("lobbyTitle"),
          subtitle: t("appSubtitle"),
          badges: (
            <span className="mx2-badge" data-tone="accent">
              <span className="mx2-badge__dot" /> {t("networkBadge")}
            </span>
          ),
        }}
        scene={
          <div className="cclash-scene" data-state={sceneState}>
            {sceneContent}
          </div>
        }
        score={scoreItems}
        actions={{
          primary: lobbyLike
            ? {
                label: rewardPoolReady ? t("startAction") : t("practiceAction"),
                onClick: () => {
                  if (rewardPoolReady) {
                    setPractice(null);
                    void actions.startGame(startDifficulty);
                    return;
                  }
                  startPractice(startDifficulty);
                },
                disabled: state.isStarting,
                loading: state.isStarting,
                hint: rewardPoolReady
                  ? t("startHint", { amount: gasDisplay(startRule.entry) })
                  : t("practiceHint"),
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
