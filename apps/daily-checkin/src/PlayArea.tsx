import { useEffect, useMemo, useState } from "react";
import { NeoButton, NeoCard } from "@shared/components-react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import { formatGas } from "@shared/utils/format";
import CountdownTimer from "./components/CountdownTimer";
import { MS_PER_DAY, MILESTONES } from "./composables/useCheckin";
import type { CheckinHistoryItem } from "./composables/useCheckin";
import "./PlayArea.scss";

interface PlayAreaProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Observable>;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
}

const evidenceText = (value: unknown, empty: string): string => {
  if (!value) return empty;
  return JSON.stringify(value, null, 2);
};

const formatHistoryTime = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toISOString().replace("T", " ").slice(0, 19);
};

export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { str, bool, num, val } = useStateBindings(state);

  const currentStreak = num("currentStreakRaw");
  const highestStreak = num("highestStreakRaw");
  const currentStreakFormatted = str("currentStreak", `0 ${t("days")}`);
  const highestStreakFormatted = str("highestStreak", `0 ${t("days")}`);
  const totalUserCheckins = num("totalUserCheckins");
  const unclaimedRewards = num("unclaimedRewards");
  const totalClaimed = num("totalClaimed");
  const checkInFee = num("checkInFee", 100000);

  const totalGlobalCheckins = num("totalGlobalCheckins");
  const totalGlobalUsers = num("totalGlobalUsers");
  const totalGlobalRewarded = num("totalGlobalRewarded");

  const canCheckIn = bool("canCheckIn");
  const isLoading = bool("isLoading");
  const isClaiming = bool("isClaiming");
  const workflowStatus = str("workflowStatus", t("workflowReady"));
  const lastError = str("lastError");

  const utcTimeDisplay = str("utcTimeDisplay", "00:00:00");
  const nextUtcMidnight = num("nextUtcMidnight");
  const checkinHistory = val<CheckinHistoryItem[]>("checkinHistory") ?? [];
  const latestRequest = val("latestRequest");
  const latestResult = val("latestResult");

  const nextMilestone = useMemo(
    () => MILESTONES.find((milestone) => currentStreak < milestone.day) ?? MILESTONES[0],
    [currentStreak],
  );
  const daysToReward = Math.max(nextMilestone.day - currentStreak, 0);
  const weekSlotFilled = currentStreak >= 7 && currentStreak % 7 === 0 ? 7 : currentStreak % 7;
  const weekSlotToday = weekSlotFilled === 7 && canCheckIn ? 1 : Math.min(weekSlotFilled + 1, 7);
  const nextStreak = canCheckIn ? currentStreak + 1 : currentStreak;
  const upcomingCheckinReward = canCheckIn
    ? MILESTONES.find((milestone) => milestone.day === nextStreak)?.reward ?? 0
    : 0;
  const securedMilestone = !canCheckIn
    ? MILESTONES.find((milestone) => milestone.day === currentStreak)
    : undefined;
  const milestoneTitle = canCheckIn
    ? upcomingCheckinReward > 0
      ? `+${upcomingCheckinReward} ${t("tokenGas")}`
      : t("noImmediateReward")
    : securedMilestone
      ? t("milestoneSecured", { day: securedMilestone.day })
      : t("noImmediateReward");
  const milestoneCopy = canCheckIn
    ? upcomingCheckinReward > 0
      ? t("milestoneImpactReady", { day: nextStreak })
      : t("milestoneImpactPending", { days: daysToReward })
    : securedMilestone
      ? t("milestoneSecuredCopy", { days: daysToReward })
      : t("milestoneDonePending", { days: daysToReward });
  const claimAmountLabel = `${formatGas(unclaimedRewards)} ${t("tokenGas")}`;
  const checkInFeeLabel = `${formatGas(checkInFee)} ${t("tokenGas")}`;
  const todayPlanTitle = canCheckIn ? t("todayPlanReady") : t("todayPlanDone");
  const todayPlanCopy = canCheckIn
    ? t("todayPlanReadyCopy", { streak: nextStreak })
    : t("todayPlanDoneCopy");
  const rewardPlanTitle = unclaimedRewards > 0 ? t("rewardPlanReady") : t("rewardPlanEmpty");
  const rewardPlanCopy = unclaimedRewards > 0
    ? t("rewardPlanReadyCopy", { amount: claimAmountLabel })
    : t("rewardPlanEmptyCopy");
  const windowCheck = {
    label: t("checkUtcWindow"),
    done: canCheckIn,
    value: canCheckIn ? t("checkReady") : t("checkComplete"),
  };
  const feeCheck = {
    label: t("checkFeeVisible"),
    done: checkInFee > 0,
    value: checkInFeeLabel,
  };
  const claimCheck = {
    label: t("checkClaimable"),
    done: unclaimedRewards > 0,
    value: claimAmountLabel,
  };

  const [showConfetti, setShowConfetti] = useState(false);
  const [prevCanCheckIn, setPrevCanCheckIn] = useState(canCheckIn);
  useEffect(() => {
    if (prevCanCheckIn === true && canCheckIn === false) {
      setShowConfetti(true);
      const timer = setTimeout(() => setShowConfetti(false), 2200);
      return () => clearTimeout(timer);
    }
    setPrevCanCheckIn(canCheckIn);
  }, [canCheckIn, prevCanCheckIn]);

  const streakTier = currentStreak >= 14 ? "blaze" : currentStreak >= 7 ? "spark" : "cold";
  const checkInDisabled = !canCheckIn || isLoading;
  const claimDisabled = unclaimedRewards <= 0 || isClaiming;

  return (
    <div className={`checkin-play-area streak-${streakTier}`}>
      <div className="checkin-streak-section">
        <div className={`checkin-fire-ring ${streakTier}`}>
          <span className="checkin-streak-number">{currentStreak}</span>
        </div>
        <div className="checkin-hero-body">
          <span className="checkin-hero-eyebrow">{t("title")}</span>
          <span className="checkin-streak-text">{currentStreak} {t("dayStreak")}</span>
          <span className="checkin-hero-subtitle">{t("docSubtitle")}</span>
        </div>
        <span className={`checkin-tier-badge ${streakTier}`}>
          {canCheckIn ? t("checkInReady") : t("checkedInToday")}
        </span>
        <span className="checkin-best-text">{t("bestStreak")}: {highestStreakFormatted}</span>
      </div>

      <div className="checkin-week-wrapper" aria-label={t("rewardProgress")}>
        <div className="checkin-week-progress-label">
          <span className="checkin-progress-text">{weekSlotFilled}/7 {t("days")}</span>
          <span className="checkin-week-complete-badge">
            {daysToReward === 0 ? t("milestoneReached") : t("daysToReward", { days: daysToReward })}
          </span>
        </div>
        <div className="checkin-week-row">
          {Array.from({ length: 7 }, (_, i) => {
            const day = i + 1;
            const checked = day <= weekSlotFilled;
            const today = day === weekSlotToday;
            return (
              <div
                key={day}
                className={[
                  "checkin-week-day-slot",
                  checked ? "checked" : "",
                  today ? "today" : "",
                  today && canCheckIn ? "today-ready" : "",
                ].filter(Boolean).join(" ")}
              >
                <span className="checkin-day-icon" aria-label={checked ? t("dayCompleted") : t("dayPending")}>
                  {checked ? "\u2713" : "\u25CB"}
                </span>
                <span className="checkin-day-label">{t("dayPrefix")}{day}</span>
              </div>
            );
          })}
        </div>
        <div className="checkin-week-connector">
          <div className="checkin-connector-fill" style={{ width: `${(weekSlotFilled / 7) * 100}%` }} />
        </div>
      </div>

      <div className="countdown-section">
        <div className="utc-clock" role="timer" aria-live="polite">
          <span className="clock-display">{utcTimeDisplay}</span>
          <span className="clock-utc-label">{t("utcLabel")}</span>
        </div>
        <CountdownTimer
          targetTime={nextUtcMidnight}
          totalDuration={MS_PER_DAY}
          label={t("nextCheckin")}
          t={t}
        />
      </div>

      <div className={`status-pill${lastError ? " error" : canCheckIn ? " ready" : ""}`}>
        <span>{lastError || workflowStatus}</span>
      </div>

      <div className="reward-preview">
        <div>
          <span className="reward-preview-label">{t("nextReward")}</span>
          <span className="reward-preview-hint">{t("day")} {nextMilestone.day}</span>
        </div>
        <div className="reward-preview-amount">+{nextMilestone.reward} {t("tokenGas")}</div>
        <div>
          <span className="reward-preview-label">{t("checkInFee")}</span>
          <span className="reward-preview-hint">{formatGas(checkInFee)} {t("tokenGas")}</span>
        </div>
      </div>

      <section className="checkin-decision-panel" aria-label={t("todayPlan")}>
        <div className="checkin-decision-header">
          <span>{t("todayPlan")}</span>
          <strong>{t("todayPlanSubtitle")}</strong>
        </div>
        <div className="checkin-decision-grid">
          <div className={`checkin-decision-tile${windowCheck.done ? " is-ready" : " is-done"}`}>
            <div className="checkin-decision-tile-top">
              <span>{t("dailyWindow")}</span>
              <em
                className={`checkin-decision-badge${windowCheck.done ? " is-ready" : ""}`}
                aria-label={`${windowCheck.label}: ${windowCheck.value}`}
              >
                {windowCheck.done ? "✓" : "○"} {windowCheck.value}
              </em>
            </div>
            <strong>{todayPlanTitle}</strong>
            <p>{todayPlanCopy}</p>
          </div>
          <div className={`checkin-decision-tile${upcomingCheckinReward > 0 ? " is-ready" : securedMilestone ? " is-done" : ""}`}>
            <div className="checkin-decision-tile-top">
              <span>{t("milestoneImpact")}</span>
              <em
                className={`checkin-decision-badge${feeCheck.done ? " is-ready" : ""}`}
                aria-label={`${feeCheck.label}: ${feeCheck.value}`}
              >
                {feeCheck.done ? "✓" : "○"} {feeCheck.value}
              </em>
            </div>
            <strong>{milestoneTitle}</strong>
            <p>{milestoneCopy}</p>
          </div>
          <div className={`checkin-decision-tile${unclaimedRewards > 0 ? " is-ready" : ""}`}>
            <div className="checkin-decision-tile-top">
              <span>{t("claimPlan")}</span>
              <em
                className={`checkin-decision-badge${claimCheck.done ? " is-ready" : ""}`}
                aria-label={`${claimCheck.label}: ${claimCheck.value}`}
              >
                {claimCheck.done ? "✓" : "○"} {claimCheck.value}
              </em>
            </div>
            <strong>{rewardPlanTitle}</strong>
            <p>{rewardPlanCopy}</p>
          </div>
        </div>
      </section>

      <NeoCard variant="erobo" className="checkin-action-card">
        <div className="checkin-actions-grid">
          <NeoButton
            variant={canCheckIn ? "success" : "secondary"}
            size="lg"
            disabled={checkInDisabled}
            loading={isLoading}
            className={`checkin-btn${canCheckIn ? " checkin-btn--ready" : ""}`}
            onClick={() => dispatch("doCheckIn")}
            aria-label={canCheckIn ? t("checkInNow") : t("waitForNext")}
          >
            {canCheckIn ? t("checkInNow") : t("waitForNext")}
          </NeoButton>
          <NeoButton
            variant="primary"
            size="lg"
            disabled={claimDisabled}
            loading={isClaiming}
            className="checkin-claim-btn"
            onClick={() => dispatch("claimRewards")}
            aria-label={t("claimRewards")}
          >
            {t("claimRewards")} ({formatGas(unclaimedRewards)} {t("tokenGas")})
          </NeoButton>
          <NeoButton
            variant="secondary"
            size="lg"
            disabled={isLoading}
            onClick={() => dispatch("refreshStatus")}
            aria-label={t("refreshStatus")}
          >
            {t("refreshStatus")}
          </NeoButton>
        </div>
      </NeoCard>

      {showConfetti && (
        <div className="confetti-container" aria-hidden="true">
          {Array.from({ length: 18 }, (_, i) => (
            <span key={i} className={`confetti-piece confetti-piece-${(i % 6) + 1}`} />
          ))}
        </div>
      )}

      <NeoCard variant="erobo" className="checkin-stats-card">
        <h3 className="checkin-section-title">{t("yourStats")}</h3>
        <div className="checkin-stats-grid">
          <div className="checkin-stat-item">
            <span className="checkin-stat-value">{totalUserCheckins}</span>
            <span className="checkin-stat-label">{t("totalCheckins")}</span>
          </div>
          <div className="checkin-stat-item">
            <span className="checkin-stat-value">{currentStreakFormatted}</span>
            <span className="checkin-stat-label">{t("currentStreak")}</span>
          </div>
          <div className="checkin-stat-item">
            <span className="checkin-stat-value">{highestStreakFormatted}</span>
            <span className="checkin-stat-label">{t("highestStreak")}</span>
          </div>
        </div>
      </NeoCard>

      <NeoCard variant="erobo" className="checkin-rewards-card">
        <h3 className="checkin-section-title">{t("yourRewards")}</h3>
        <div className="checkin-rewards-grid">
          <div className="checkin-reward-item">
            <span className="checkin-reward-value checkin-reward-value--unclaimed">{formatGas(unclaimedRewards)}</span>
            <span className="checkin-reward-label">{t("unclaimed")}</span>
          </div>
          <div className="checkin-reward-item">
            <span className="checkin-reward-value">{formatGas(totalClaimed)}</span>
            <span className="checkin-reward-label">{t("totalClaimed")}</span>
          </div>
        </div>
      </NeoCard>

      <NeoCard variant="erobo-neo" className="checkin-milestones-card">
        <h3 className="checkin-section-title">{t("milestones")}</h3>
        <div className="checkin-milestones-row">
          {MILESTONES.map((milestone) => {
            const reached = currentStreak >= milestone.day;
            const next = !reached && currentStreak < milestone.day;
            return (
              <div key={milestone.day} className={`checkin-milestone${reached ? " reached" : next ? " next" : ""}`}>
                <div className="checkin-milestone-icon">{reached ? "\u2713" : "\u25C9"}</div>
                <span className="checkin-milestone-day">{t("day")} {milestone.day}</span>
                <span className="checkin-milestone-reward">+{milestone.reward} {t("tokenGas")}</span>
                <span className="checkin-milestone-cumulative">({milestone.cumulative} {t("total")})</span>
              </div>
            );
          })}
        </div>
      </NeoCard>

      <NeoCard variant="erobo" className="checkin-global-card">
        <h3 className="checkin-section-title">{t("globalStats")}</h3>
        <div className="checkin-stats-grid">
          <div className="checkin-stat-item">
            <span className="checkin-stat-value">{totalGlobalCheckins.toLocaleString()}</span>
            <span className="checkin-stat-label">{t("totalCheckins")}</span>
          </div>
          <div className="checkin-stat-item">
            <span className="checkin-stat-value">{totalGlobalUsers.toLocaleString()}</span>
            <span className="checkin-stat-label">{t("totalUsers")}</span>
          </div>
          <div className="checkin-stat-item">
            <span className="checkin-stat-value">{formatGas(totalGlobalRewarded)}</span>
            <span className="checkin-stat-label">{t("totalRewarded")}</span>
          </div>
        </div>
      </NeoCard>

      <NeoCard variant="erobo" className="checkin-history-card">
        <h3 className="checkin-section-title">{t("recentCheckins")}</h3>
        {checkinHistory.length > 0 ? (
          <div className="checkin-history-list">
            {checkinHistory.slice(0, 10).map((entry, idx) => (
              <div key={`${entry.time}-${idx}`} className="checkin-history-row">
                <span className="checkin-history-date">{formatHistoryTime(entry.time)}</span>
                <span className="checkin-history-streak">{entry.action === "claim" ? t("claimRewards") : `${entry.streak} ${t("dayStreak")}`}</span>
                <span className="checkin-history-reward">{formatGas(entry.reward)} {t("tokenGas")}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="checkin-history-empty">{t("noCheckins")}</div>
        )}
      </NeoCard>

      <details className="checkin-evidence-card" aria-label={t("evidence")}>
        <summary className="checkin-evidence-summary">
          <span className="checkin-section-title">{t("evidence")}</span>
          <span className="checkin-evidence-chevron" aria-hidden="true">⌄</span>
        </summary>
        <div className="checkin-evidence-grid">
          <div className="checkin-evidence-box">
            <span>{t("latestRequest")}</span>
            <pre>{evidenceText(latestRequest, t("requestEmpty"))}</pre>
          </div>
          <div className="checkin-evidence-box">
            <span>{t("latestResult")}</span>
            <pre>{evidenceText(latestResult, t("resultEmpty"))}</pre>
          </div>
        </div>
      </details>
    </div>
  );
}
