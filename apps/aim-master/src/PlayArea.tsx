import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useStateBindings } from "@shared/react";
import type { PlayAreaProps } from "@shared/react";
import { ParticleBurst } from "@shared/art";
import { PlayStage } from "@shared/components-react/v2";
import type { LeaderEntry, SolveRow } from "@framework/game";
import { Crosshair, RefreshCw } from "lucide-react";
import {
  DIFFICULTY_RULES,
  formatClock,
  gasDisplay,
  ruleOf,
  payoutFixed8ForAccuracy,
} from "./logic/game-rules";
import {
  calculateHitResult,
  isAccuracyHit,
  isWin,
  totalPoints,
  DEFAULT_CONFIG,
} from "./logic/aim-engine";
import type { HitResult } from "./logic/aim-engine";
import "./PlayArea.scss";

const SUBMIT_BUFFER_MS = 15_000;
const MIN_SOLVE_BUFFER_MS = 10_000;

const AIM_ART = {
  range: "./art/range-backdrop.webp",
  target: "./art/target-board.webp",
  reticle: "./art/reticle.webp",
  difficultyBadges: [
    "./art/badge-easy.webp",
    "./art/badge-medium.webp",
    "./art/badge-hard.webp",
  ],
} as const;

const LOBBY_TARGET_MARKS = [-42, -24, 0, 24, 42] as const;

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
  const patternData = str("pattern", "");
  const commitmentHex = str("commitment", "");
  const dealtAt = val<number>("dealtAt", 0) ?? 0;
  const deadline = val<number>("deadline", 0) ?? 0;
  const targetAccuracy = val<number>("targetAccuracy", 3) ?? 0;
  const lastPayout = str("lastPayout", "");
  const leaderboard = val<LeaderEntry[]>("leaderboard", []) ?? [];
  const myRank = val<number>("myRank", 0) ?? 0;
  const myTotalWon = val<number>("myTotalWon", 0) ?? 0;
  const myHistory = val<SolveRow[]>("myHistory", []) ?? [];
  const isStarting = bool("isStarting");
  const isDealing = bool("isDealing");
  const isSubmitting = bool("isSubmitting");
  const lastStatus = str("lastStatus", t("statusReady"));

  const [pickedDifficulty, setPickedDifficulty] = useState<0 | 1 | 2>(0);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [gaugePos, setGaugePos] = useState(150);
  const [isAiming, setIsAiming] = useState(false);
  const [feedbackLabel, setFeedbackLabel] = useState<string | null>(null);
  const [feedbackClass, setFeedbackClass] = useState<string>("");
  const [localRings, setLocalRings] = useState<HitResult[]>([]);
  const [roundAccuracies, setRoundAccuracies] = useState<number[]>([]);
  const [pendingSubmission, setPendingSubmission] = useState(false);
  // Coral flash on the current progress dot when a tap misses the accuracy zone.
  const [missFlash, setMissFlash] = useState(false);
  const missFlashTimer = useRef<number | null>(null);
  // Immediate local shot cue, released on a timer so the gauge never sticks in
  // its action state while the aim streams to the TEE session.
  const [aimPreview, setAimPreview] = useState(false);
  const aimPreviewTimeout = useRef<number | null>(null);

  const patternRef = useRef<number[]>([]);
  const aimFrameRef = useRef<number | null>(null);
  const aimStartRef = useRef<number>(0);
  const feedbackTimer = useRef<number | null>(null);

  const startAimPreview = useCallback(() => {
    if (aimPreviewTimeout.current !== null) {
      window.clearTimeout(aimPreviewTimeout.current);
    }
    setAimPreview(true);
    aimPreviewTimeout.current = window.setTimeout(() => {
      setAimPreview(false);
      aimPreviewTimeout.current = null;
    }, 220);
  }, []);

  useEffect(
    () => () => {
      if (aimPreviewTimeout.current !== null) {
        window.clearTimeout(aimPreviewTimeout.current);
      }
      if (missFlashTimer.current !== null) {
        window.clearTimeout(missFlashTimer.current);
      }
    },
    [],
  );

  const rule = ruleOf(
    gameStatus === "dealt" || gameStatus === "committed" ? gameDifficulty : pickedDifficulty,
  );

  // Parse the TEE pattern into an array of positions
  const pattern: number[] = useMemo(() => {
    if (!patternData) return [];
    try {
      return patternData.split(",").map(Number).filter((n) => !isNaN(n));
    } catch {
      return [];
    }
  }, [patternData]);

  // Clock tick
  useEffect(() => {
    if (gameStatus !== "dealt") return undefined;
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [gameStatus]);

  // Reset local state when game status changes
  useEffect(() => {
    if (gameStatus === "dealt" && pattern.length > 0 && activeGameId !== "0") {
      setLocalRings([]);
      setRoundAccuracies([]);
      setPendingSubmission(false);
      setMissFlash(false);
      setFeedbackLabel(null);
      setIsAiming(true);
      // The TEE pattern starts immediately
      patternRef.current = pattern;
      aimStartRef.current = Date.now();
    } else if (gameStatus !== "dealt") {
      setIsAiming(false);
      if (aimFrameRef.current !== null) {
        cancelAnimationFrame(aimFrameRef.current);
        aimFrameRef.current = null;
      }
    }
  }, [gameStatus, pattern, activeGameId]);

  // Gauge animation loop
  useEffect(() => {
    if (!isAiming || pattern.length === 0) return;

    const tick = () => {
      const tickIndex = Math.floor((Date.now() - aimStartRef.current) / DEFAULT_CONFIG.tickMs);
      const wrapped = tickIndex < pattern.length ? tickIndex : tickIndex % pattern.length;
      setGaugePos(pattern[wrapped] ?? DEFAULT_CONFIG.centre);
      aimFrameRef.current = requestAnimationFrame(tick);
    };

    aimFrameRef.current = requestAnimationFrame(tick);

    return () => {
      if (aimFrameRef.current !== null) {
        cancelAnimationFrame(aimFrameRef.current);
        aimFrameRef.current = null;
      }
    };
  }, [isAiming, pattern]);

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
  const currentTotalPoints = totalPoints(localRings.map((r) => r.ring));
  const accuracies = localRings.filter((r) => isAccuracyHit(r.ring)).length;
  const won = isWin(localRings.map((r) => r.ring), targetAccuracy);
  // Reward accrued so far by the run (full reward once the win threshold lands).
  const accruedPayout = Number(gasDisplay(payoutFixed8ForAccuracy(gameDifficulty, accuracies)));
  const projectedPayout = won ? accruedPayout : 0;
  // The score cell shows the bounty still on the table while the run is live,
  // then the settled value once the win threshold is reached.
  const rewardAtStake =
    gameStatus === "dealt" && !won
      ? Number(gasDisplay(ruleOf(gameDifficulty).rewardFixed8))
      : projectedPayout;

  const showFeedback = useCallback((hit: HitResult) => {
    let label = "";
    let cls = "";
    if (hit.ring === 0) {
      label = t("statusBullseye");
      cls = "aim-feedback__label--bullseye";
    } else if (hit.ring <= 2) {
      label = t("statusHit", { pts: String(hit.points) });
      cls = "aim-feedback__label--hit";
    } else {
      label = t("statusMiss");
      cls = "aim-feedback__label--miss";
    }
    setFeedbackLabel(label);
    setFeedbackClass(cls);

    if (feedbackTimer.current !== null) window.clearTimeout(feedbackTimer.current);
    feedbackTimer.current = window.setTimeout(() => {
      setFeedbackLabel(null);
      feedbackTimer.current = null;
    }, 800);
  }, [t]);

  const handleTap = useCallback(() => {
    if (!isAiming || busy || timeUp) return;

    const hit = calculateHitResult(gaugePos);
    startAimPreview();
    showFeedback(hit);

    const updatedRings = [...localRings, hit];
    const updatedAccuracies = [...roundAccuracies, isAccuracyHit(hit.ring) ? 1 : 0];

    setLocalRings(updatedRings);
    setRoundAccuracies(updatedAccuracies);

    if (!isAccuracyHit(hit.ring)) {
      if (missFlashTimer.current !== null) window.clearTimeout(missFlashTimer.current);
      setMissFlash(true);
      missFlashTimer.current = window.setTimeout(() => {
        setMissFlash(false);
        missFlashTimer.current = null;
      }, 400);
    }

    // Check if player has enough accuracy hits to win
    if (isWin(updatedRings.map((r) => r.ring), targetAccuracy)) {
      setIsAiming(false);
      setPendingSubmission(true);
      // Notify main.tsx of final state
      void dispatch("aimHit", {
        ringsHit: updatedAccuracies.filter(Boolean).length,
        totalRings: updatedRings.length,
        roundResults: updatedRings,
        totalPoints: currentTotalPoints + hit.points,
      });
    }
    // Continue aiming for more rounds if not yet won
  }, [isAiming, gaugePos, busy, timeUp, localRings, roundAccuracies, targetAccuracy, currentTotalPoints, showFeedback, startAimPreview, dispatch]);

  const handleSubmit = async () => {
    if (busy) return;
    if (gameStatus === "dealt" && pendingSubmission) {
      if (!minSolveReached || submitWindowClosed) return;
      await dispatch("submitSolution", {});
      return;
    }
    if (gameStatus === "idle" || gameStatus === "solved" || gameStatus === "expired") {
      if (!rewardPoolReady) return;
      await dispatch("startGame", { difficulty: pickedDifficulty });
    }
  };

  // Render ring markers on the gauge
  const ringMarkers = useMemo(() => {
    const cfg = DEFAULT_CONFIG;
    const markers: { pos: number; label: string; type: string }[] = [];
    const ringCount = 5;
    for (let i = 0; i <= ringCount; i++) {
      const dist = cfg.bullseyeRadius + i * cfg.ringWidth;
      const left = cfg.centre - dist;
      const right = cfg.centre + dist;
      const type = i === 0 ? "centre" : "zone";
      const label = i === 0 ? "●" : String(i);
      markers.push({ pos: left, label, type });
      markers.push({ pos: right, label, type });
    }
    return markers;
  }, []);

  // Zone labels sit at the exact geometric boundaries the ring markers draw,
  // so the numbers under the gauge match the scoring zones they name.
  const gaugeLabels = useMemo(() => {
    const cfg = DEFAULT_CONFIG;
    const labels: { pos: number; label: string }[] = [{ pos: cfg.centre, label: "●" }];
    for (let i = 1; i <= 5; i += 1) {
      const dist = cfg.bullseyeRadius + i * cfg.ringWidth;
      labels.push({ pos: cfg.centre - dist, label: String(i) });
      labels.push({ pos: cfg.centre + dist, label: String(i) });
    }
    return labels.sort((a, b) => a.pos - b.pos);
  }, []);

  const difficultyPicker = (
    <div className="aim-lobby">
      {lastPayout && gameStatus === "solved" && (
        <div className="aim-lobby__result" data-state="won">
          <ParticleBurst coins count={12} />
          <strong>{t("solvedBanner", { payout: lastPayout })}</strong>
          <span>{t("solvedBannerHint")}</span>
        </div>
      )}
      {gameStatus === "expired" && (
        <div className="aim-lobby__result" data-state="expired">
          <strong>{t("expiredBanner")}</strong>
          <span>{t("expiredBannerHint")}</span>
        </div>
      )}
      <div
        className="aim-lobby__range-card"
        aria-label={t("lobbyPreviewLabel", {
          lane: t(`difficulty_${rule.key}`),
          count: rule.targetAccuracy,
        })}
      >
        <img
          className="aim-lobby__range-bg"
          src={AIM_ART.range}
          alt=""
          draggable={false}
        />
        <div className="aim-lobby__range-focus" aria-hidden="true">
          <img
            className="aim-lobby__target"
            src={AIM_ART.target}
            alt=""
            draggable={false}
          />
          <img
            className="aim-lobby__reticle"
            src={AIM_ART.reticle}
            alt=""
            draggable={false}
          />
        </div>
        <div className="aim-lobby__range-copy">
          <span>{t("rangeEyebrow")}</span>
          <strong>{t("laneGoal", { count: rule.targetAccuracy })}</strong>
          <p>{t(`laneObjective_${rule.key}`)}</p>
          <div className="aim-lobby__sweep" aria-hidden="true">
            {LOBBY_TARGET_MARKS.map((mark) => {
              const sweepMarkClass =
                mark === 0
                  ? "aim-lobby__sweep-mark aim-lobby__sweep-mark--center"
                  : "aim-lobby__sweep-mark";
              return (
                <span
                  key={mark}
                  className={sweepMarkClass}
                  style={{ left: `${50 + mark}%` }}
                />
              );
            })}
            <img
              className="aim-lobby__sweep-reticle"
              src={AIM_ART.reticle}
              alt=""
              draggable={false}
            />
          </div>
          <div className="aim-lobby__ribbon" aria-label={t("routeSummary")}>
            <span className="aim-lobby__ribbon-prize">
              {t("winAmount", { amount: gasDisplay(rule.rewardFixed8) })}
            </span>
            <span>{t("entryAmount", { amount: gasDisplay(rule.entryFixed8) })}</span>
            <span>{t("accuracyCount", { count: rule.targetAccuracy })}</span>
            <span>{t("timeAmount", { seconds: Math.round(rule.limitMs / 1000) })}</span>
          </div>
        </div>
      </div>
      <div className="aim-lobby__cards" role="radiogroup" aria-label={t("difficultyTitle")}>
        {DIFFICULTY_RULES.map((entry) => {
          const active = entry.difficulty === pickedDifficulty;
          return (
            <button
              key={entry.key}
              type="button"
              role="radio"
              aria-checked={active}
              className={["aim-diff-card", active ? "aim-diff-card--active" : null]
                .filter(Boolean)
                .join(" ")}
              onClick={() => setPickedDifficulty(entry.difficulty)}
              disabled={busy}
            >
              <img
                className="aim-diff-card__badge"
                src={AIM_ART.difficultyBadges[entry.difficulty]}
                alt=""
                draggable={false}
              />
              <span className="aim-diff-card__name">{t(`difficulty_${entry.key}`)}</span>
              <span className="aim-diff-card__meta">
                {t("timeAmount", { seconds: Math.round(entry.limitMs / 1000) })}
              </span>
              <span className="aim-diff-card__accuracy">
                {t("accuracyCount", { count: entry.targetAccuracy })}
              </span>
            </button>
          );
        })}
      </div>
      <p className="aim-lobby__pool">
        {t("poolLine", { pool: poolFree.toFixed(2) })}
        {creditGas > 0 ? ` · ${t("creditLine", { credit: creditGas.toFixed(2) })}` : ""}
      </p>
    </div>
  );

  const dealingStage = (
    <div className="aim-dealing" role="status" aria-label={t("statusShuffling")}>
      <div className="aim-dealing__dots" aria-hidden="true">
        {Array.from({ length: 5 }, (_, i) => (
          <span key={i} style={{ animationDelay: `${i * 120}ms` }} />
        ))}
      </div>
      <p>{t("shufflingCopy")}</p>
    </div>
  );

  const gaugeStage = (
    <div className="aim-table">
      <div className="aim-timer" data-low={remainingMs < 60_000 ? "true" : undefined}>
        <span className="aim-timer__clock">{formatClock(remainingMs)}</span>
        <span className="aim-timer__track" aria-hidden="true">
          <i style={{ width: `${timePct}%` }} />
        </span>
        <span className="aim-timer__reward">
          {t("rewardNow", { amount: accruedPayout.toFixed(2) })}
        </span>
      </div>

      {/* Round indicator dots — filled by cumulative accuracy hits, so extra
          taps and misses never consume a progress slot. Each dot is aria-hidden
          since progress is announced textually via a visually-hidden summary. */}
      <div className="aim-rounds" role="group" aria-label={t("roundProgress")}>
        {Array.from({ length: targetAccuracy }, (_, i) => {
          const classes = [
            "aim-rounds__dot",
            i < accuracies
              ? "aim-rounds__dot--hit"
              : i === accuracies
                ? missFlash
                  ? "aim-rounds__dot--current aim-rounds__dot--miss"
                  : "aim-rounds__dot--current"
                : "",
          ]
            .filter(Boolean)
            .join(" ");
          return <span key={i} className={classes} aria-hidden="true" />;
        })}
        <span className="mx2-sr-only">
          {t("roundProgressStatus", { hits: accuracies, total: targetAccuracy })}
        </span>
      </div>

      {/* The gauge */}
      <div
        className="aim-gauge-wrap"
        data-aim={aimPreview ? "true" : undefined}
        onClick={handleTap}
        role="button"
        tabIndex={0}
        aria-label={pendingSubmission ? t("submitRound") : t("aimReady")}
        onKeyDown={(e) => {
          if (e.key === " " || e.key === "Enter") {
            e.preventDefault();
            handleTap();
          }
        }}
      >
        <img
          className="aim-gauge__target-board"
          src={AIM_ART.target}
          alt=""
          draggable={false}
        />
        <div className="aim-gauge">
          {ringMarkers.map((m) => (
            <span
              key={`${m.pos}-${m.type}`}
              className={["aim-gauge__ring", `aim-gauge__ring--${m.type}`]
                .filter(Boolean)
                .join(" ")}
              style={{ left: `${(m.pos / DEFAULT_CONFIG.width) * 100}%` }}
            />
          ))}
          <div
            className="aim-gauge__indicator"
            style={{ left: `${(gaugePos / DEFAULT_CONFIG.width) * 100}%` }}
          >
            <img
              className="aim-gauge__reticle"
              src={AIM_ART.reticle}
              alt=""
              draggable={false}
            />
          </div>
        </div>
        <div className="aim-gauge__labels" aria-hidden="true">
          {gaugeLabels.map((entry) => (
            <span
              key={`${entry.pos}-${entry.label}`}
              style={{ left: `${(entry.pos / DEFAULT_CONFIG.width) * 100}%` }}
            >
              {entry.label}
            </span>
          ))}
        </div>

        {/* Feedback overlay — scoped to the target board so the timer row and
            round dots stay readable while it flashes. */}
        {feedbackLabel && (
          <div className="aim-feedback" aria-live="polite">
            <span className={["aim-feedback__label", feedbackClass].filter(Boolean).join(" ")}>
              {feedbackLabel}
            </span>
          </div>
        )}
      </div>

      {/* Score summary */}
      {pendingSubmission && (
        <div className="aim-submit-area">
          <p className="aim-submit-info">
            {t("hitCount", { accuracies: accuracies, total: targetAccuracy })}
          </p>
          <p className="aim-submit-info">
            {t("totalScore", { points: currentTotalPoints })}
          </p>
        </div>
      )}

      {!minSolveReached && pendingSubmission && (
        <p className="aim-submit-info" role="status">
          {t("minSolveHint", {
            clock: formatClock(rule.minSolveMs + MIN_SOLVE_BUFFER_MS - elapsedMs),
          })}
        </p>
      )}
      {submitWindowClosed && !timeUp && (
        <p className="aim-submit-info" role="alert">
          {t("deadlineBufferHint")}
        </p>
      )}
      {timeUp && (
        <p className="aim-submit-info" role="alert">
          {t("timeUpHint")}
        </p>
      )}
    </div>
  );

  const scene = (
    <div
      className="aim-scene"
      data-state={
        isSubmitting
          ? "submitting"
          : isDealing || gameStatus === "committed"
            ? "dealing"
            : gameStatus === "dealt"
              ? pendingSubmission
                ? "ready"
                : "playing"
              : gameStatus === "solved"
                ? "won"
                : "idle"
      }
    >
      <img className="aim-scene__range-bg" src={AIM_ART.range} alt="" draggable={false} />
      {gameStatus === "committed" || (gameStatus === "dealt" && pattern.length === 0)
        ? dealingStage
        : gameStatus === "dealt" && pattern.length > 0
          ? gaugeStage
          : difficultyPicker}
      <p className="aim-scene__status" aria-live="polite">
        {lastStatus}
      </p>
    </div>
  );

  const primaryAction =
    gameStatus === "dealt"
      ? {
          label: pendingSubmission
            ? timeUp
              ? t("timeUpAction")
              : t("submitRound")
            : t("aimReady"),
          onClick: () => (pendingSubmission ? void handleSubmit() : handleTap()),
          disabled:
            busy ||
            (pendingSubmission && (!minSolveReached || submitWindowClosed)),
          loading: isSubmitting,
          icon: <Crosshair size={18} aria-hidden="true" />,
          hint: pendingSubmission
            ? t("submitHint")
            : t("tapToStop"),
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
            icon: <Crosshair size={18} aria-hidden="true" />,
            hint: rewardPoolReady
              ? t("startHint", { amount: gasDisplay(rule.entryFixed8) })
              : t("statusPoolLow"),
          };

  const secondaryActions = [
    ...(gameStatus === "committed"
      ? [
          {
            label: t("checkDealAgain"),
            onClick: () => void dispatch("retryDeal", {}),
            disabled: isDealing,
            hint: t("shufflingCopy"),
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
      className="aim-playarea mx2 mx2-cat-game"
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
                ? t("lobbyTitle")
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
            value: `${rewardAtStake.toFixed(2)} GAS`,
            accent: true,
          },
          {
            label: t("scoreTime"),
            value: gameStatus === "dealt" ? formatClock(remainingMs) : formatClock(rule.limitMs),
          },
          { label: t("scoreRings"), value: `${accuracies}/${targetAccuracy}` },
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
              <div className="aim-drawer__head">
                <img src="./logo.webp" alt="" width={40} height={40} draggable={false} />
                <p>{t("leaderboardIntro")}</p>
              </div>
              <h4>{t("leaderboardTitle")}</h4>
              {leaderboard.length > 0 ? (
                <ol className="aim-ranks">
                  {leaderboard.slice(0, 10).map((entry) => (
                    <li
                      key={entry.address}
                      className="aim-ranks__row"
                      data-me={entry.isUser ? "true" : undefined}
                    >
                      <span className="aim-ranks__rank">#{entry.rank}</span>
                      <span className="aim-ranks__addr">{shortHash(entry.address)}</span>
                      <span className="aim-ranks__solves">
                        {t("solvesCount", { count: entry.solves })}
                      </span>
                      <span className="aim-ranks__won">{entry.totalWon.toFixed(2)} GAS</span>
                      {entry.isUser && <span className="aim-ranks__me">{t("youTag")}</span>}
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
                <RefreshCw size={16} aria-hidden="true" />
                {t("refreshRanks")}
              </button>
              <h4>{t("historyTitle")}</h4>
              {myHistory.length > 0 ? (
                <ul className="mx2-history">
                  {myHistory.map((row) => {
                    const ringsHit = Number(row.ringsHit ?? 0);
                    return (
                      <li
                        key={row.gameId}
                        className="mx2-history__item"
                        data-outcome={row.payout && Number.parseFloat(row.payout) > 0 ? "won" : "lost"}
                      >
                        <span className="mx2-history__face">
                          {t(`difficulty_${ruleOf(row.difficulty).key}`)}
                        </span>
                        <span className="mx2-history__stake">{formatClock(row.solveMs)}</span>
                        <span className="mx2-history__result">
                          {t("historyRings", { rings: Number.isFinite(ringsHit) ? ringsHit : 0 })}
                        </span>
                        <span className="mx2-history__stake">{row.payout}</span>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p>{t("historyEmpty")}</p>
              )}
              <h4>{t("rulesTitle")}</h4>
              <p>{t("rulesCopy")}</p>
              <h4>{t("fairnessTitle")}</h4>
              <p>{t("fairnessCopy")}</p>
              {commitmentHex && (
                <p className="aim-drawer__seed">
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
