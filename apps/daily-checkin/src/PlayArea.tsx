import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Circle, Lock } from "lucide-react";
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
  const highestStreakFormatted = str("highestStreak", `0 ${t("days")}`);
  const totalUserCheckins = num("totalUserCheckins");
  const unclaimedRewards = num("unclaimedRewards");
  const totalClaimed = num("totalClaimed");
  const checkInFee = num("checkInFee", 100000);

  const totalGlobalCheckins = num("totalGlobalCheckins");
  const totalGlobalUsers = num("totalGlobalUsers");
  const totalGlobalRewarded = num("totalGlobalRewarded");

  const canCheckIn = bool("canCheckIn");
  const hasLoadedStatus = bool("hasLoadedStatus");
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

  const [showConfetti, setShowConfetti] = useState(false);
  // Track the previously observed value via a ref so it faithfully mirrors the
  // last render's canCheckIn on every edge — avoids the prior bug where prev
  // stuck at `true` because it was only updated in the non-firing branch.
  const prevCanCheckInRef = useRef(canCheckIn);
  useEffect(() => {
    const fired = prevCanCheckInRef.current === true && canCheckIn === false;
    prevCanCheckInRef.current = canCheckIn;
    if (!fired) return;
    setShowConfetti(true);
    const timer = setTimeout(() => setShowConfetti(false), 2200);
    return () => clearTimeout(timer);
  }, [canCheckIn]);

  const streakTier = currentStreak >= 14 ? "blaze" : currentStreak >= 7 ? "spark" : "cold";
  // Before the first chain read, eligibility is unknown — keep the CTA disabled
  // and labelled "Loading…" rather than the misleading "Wait for next" so a
  // pre-load click can't fire a check-in the contract would fault.
  const checkInDisabled = !hasLoadedStatus || !canCheckIn || isLoading;
  const checkInLabel = !hasLoadedStatus
    ? t("loading")
    : canCheckIn
      ? t("checkInNow")
      : t("waitForNext");
  const hasClaimable = unclaimedRewards > 0;
  const claimDisabled = !hasClaimable || isClaiming;

  // "Today plan" facts — derived from the same state the actions use, so the
  // panel narrates exactly what the buttons will do this UTC cycle.
  const planTitle = canCheckIn ? t("todayPlanReady") : t("todayPlanDone");
  const planCopy = canCheckIn
    ? t("todayPlanReadyCopy", { streak: currentStreak + 1 })
    : t("todayPlanDoneCopy");
  const milestoneReachable = canCheckIn && currentStreak + 1 >= nextMilestone.day;
  const milestoneCopy = milestoneReachable
    ? t("milestoneImpactReady", { day: nextMilestone.day })
    : t("milestoneImpactPending", { days: daysToReward });
  const claimTitle = hasClaimable ? t("rewardPlanReady") : t("rewardPlanEmpty");
  const claimCopy = hasClaimable
    ? t("rewardPlanReadyCopy", { amount: `${formatGas(unclaimedRewards)} ${t("tokenGas")}` })
    : t("rewardPlanEmptyCopy");

  // The hero badge already conveys the idle "Ready" state, so only surface the
  // inline status pill when it carries new information (an error or an active
  // workflow message) — avoids duplicating the hero "Ready" pill.
  const showStatusPill = Boolean(lastError) || (workflowStatus !== t("workflowReady") && workflowStatus.trim().length > 0);

  return (
    <div className={`checkin-play-area streak-${streakTier}`}>
      {/* Hero — streak, status, and the only timing/fee facts that matter, in one block */}
      <div className="checkin-streak-section">
        <div className={`checkin-fire-ring ${streakTier}`}>
          <span className="checkin-streak-number">{currentStreak}</span>
        </div>
        <div className="checkin-hero-body">
          <span className="checkin-hero-eyebrow">{t("title")}</span>
          <span className="checkin-streak-text">{currentStreak} {t("dayStreak")}</span>
          <span className="checkin-hero-subtitle">{t("docSubtitle")}</span>
          <div className="checkin-hero-facts">
            <span>{t("nextReward")}: {t("day")} {nextMilestone.day} · +{nextMilestone.reward} {t("tokenGas")}</span>
            <span>{t("checkInFee")}: {formatGas(checkInFee)} {t("tokenGas")}</span>
          </div>
        </div>
        <span className={`checkin-tier-badge ${streakTier}`}>
          {!hasLoadedStatus ? t("loading") : canCheckIn ? t("checkInReady") : t("checkedInToday")}
        </span>
        <span className="checkin-best-text">{t("bestStreak")}: {highestStreakFormatted}</span>
      </div>

      {/* Week progress + next check-in countdown together (one timing context) */}
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
                  {checked ? <Check size={14} aria-hidden="true" /> : <Circle size={14} aria-hidden="true" />}
                </span>
                <span className="checkin-day-label">{t("dayPrefix")}{day}</span>
              </div>
            );
          })}
        </div>
        <div className="checkin-week-connector">
          <div className="checkin-connector-fill" style={{ width: `${(weekSlotFilled / 7) * 100}%` }} />
        </div>
        <div className="checkin-week-timing">
          <span className="checkin-week-utc">{utcTimeDisplay} {t("utcLabel")}</span>
          <CountdownTimer
            targetTime={nextUtcMidnight}
            totalDuration={MS_PER_DAY}
            label={t("nextCheckin")}
            t={t}
          />
        </div>
      </div>

      {/* Primary action — surfaced right after the hero, with inline status */}
      <NeoCard variant="erobo" className="checkin-action-card">
        {showStatusPill && (
          <div className={`status-pill${lastError ? " error" : ""}`}>
            <span>{lastError || workflowStatus}</span>
          </div>
        )}
        <div className="checkin-actions-grid">
          <NeoButton
            variant={canCheckIn ? "success" : "secondary"}
            size="lg"
            disabled={checkInDisabled}
            loading={isLoading}
            className={`checkin-btn${canCheckIn ? " checkin-btn--ready" : ""}`}
            onClick={() => dispatch("doCheckIn")}
            aria-label={checkInLabel}
          >
            {checkInLabel}
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
            disabled={isLoading || isClaiming}
            loading={isLoading}
            onClick={() => dispatch("refreshStatus")}
            aria-label={t("refreshStatus")}
          >
            {t("refreshStatus")}
          </NeoButton>
        </div>
      </NeoCard>

      {/* Today plan — narrates what the actions above will do this UTC cycle:
          the window status, milestone impact, claim plan, and service route. */}
      <NeoCard
        variant="erobo-neo"
        className="checkin-plan-card"
        aria-label={t("todayPlan")}
      >
        <div className="checkin-plan-head">
          <h3 className="checkin-section-title">{t("todayPlan")}</h3>
          <p className="checkin-plan-subtitle">{t("todayPlanSubtitle")}</p>
        </div>
        <div className="checkin-plan-grid">
          <div className="checkin-plan-item">
            <span className="checkin-plan-eyebrow">{t("dailyWindow")}</span>
            <span className="checkin-plan-title">{planTitle}</span>
            <span className="checkin-plan-copy">{planCopy}</span>
          </div>
          <div className="checkin-plan-item">
            <span className="checkin-plan-eyebrow">{t("milestoneImpact")}</span>
            <span className="checkin-plan-title">
              {milestoneReachable
                ? `+${nextMilestone.reward} ${t("tokenGas")}`
                : t("noImmediateReward")}
            </span>
            <span className="checkin-plan-copy">{milestoneCopy}</span>
          </div>
          <div className="checkin-plan-item checkin-plan-rewards">
            <span className="checkin-plan-eyebrow">{t("yourRewards")}</span>
            <span className="checkin-plan-title">{claimTitle}</span>
            <span className="checkin-plan-copy">{claimCopy}</span>
          </div>
        </div>
        <p className="checkin-plan-route">{t("serviceRouteCopy")}</p>
      </NeoCard>

      {showConfetti && (
        <div className="confetti-container" aria-hidden="true">
          {Array.from({ length: 18 }, (_, i) => (
            <span key={i} className={`confetti-piece confetti-piece-${(i % 6) + 1}`} />
          ))}
        </div>
      )}

      {/* One compact personal-metrics strip (replaces the separate Your Stats + Your Rewards cards) */}
      <div className="checkin-meta-strip">
        <div className="checkin-meta-item">
          <span className="checkin-meta-value">{totalUserCheckins}</span>
          <span className="checkin-meta-label">{t("totalCheckins")}</span>
        </div>
        <div className="checkin-meta-item">
          <span className="checkin-meta-value">{formatGas(unclaimedRewards)}</span>
          <span className="checkin-meta-label">{t("unclaimed")}</span>
        </div>
        <div className="checkin-meta-item">
          <span className="checkin-meta-value">{formatGas(totalClaimed)}</span>
          <span className="checkin-meta-label">{t("totalClaimed")}</span>
        </div>
      </div>

      {/* Reference + activity, paired into two columns on desktop to use width
          and shorten the page. Collapses to a single column on narrow screens. */}
      <div className="checkin-two-col">
        {/* Milestone ladder — the reward schedule, kept as useful reference */}
        <NeoCard variant="erobo-neo" className="checkin-milestones-card">
          <h3 className="checkin-section-title">{t("milestones")}</h3>
          <div className="checkin-milestones-row">
            {MILESTONES.map((milestone) => {
              const reached = currentStreak >= milestone.day;
              const next = !reached && currentStreak < milestone.day;
              return (
                <div key={milestone.day} className={`checkin-milestone${reached ? " reached" : next ? " next" : ""}`}>
                  <div className="checkin-milestone-icon" aria-hidden="true">
                    {reached ? <Check size={16} /> : <Lock size={16} />}
                  </div>
                  <span className="checkin-milestone-day">{t("day")} {milestone.day}</span>
                  <span className="checkin-milestone-reward">+{milestone.reward} {t("tokenGas")}</span>
                  <span className="checkin-milestone-cumulative">({milestone.cumulative} {t("total")})</span>
                </div>
              );
            })}
          </div>
        </NeoCard>

        {/* Your recent activity */}
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
      </div>

      {/* Secondary: network-wide stats + raw evidence, de-emphasised at the bottom */}
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

      <details className="checkin-evidence-card" role="region" aria-label={t("evidence")}>
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
