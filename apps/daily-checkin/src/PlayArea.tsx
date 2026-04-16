/**
 * PlayArea.tsx -- Daily Check-in
 *
 * Fully interactive PlayArea consuming ALL available state:
 *   currentStreak/currentStreakRaw, highestStreak/highestStreakRaw,
 *   totalUserCheckins, unclaimedRewards, totalClaimed,
 *   totalGlobalCheckins, totalGlobalUsers, totalGlobalRewarded,
 *   canCheckIn, isLoading, isClaiming,
 *   utcTimeDisplay, nextUtcMidnight, checkinHistory
 *
 * Actions: doCheckIn(), claimRewards()
 */

import { useState, useEffect, useMemo } from "react";
import { NeoButton, NeoCard } from "@shared/components-react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import CountdownTimer from "./components/CountdownTimer";
import { MS_PER_DAY, MILESTONES } from "./composables/useCheckin";
import type { CheckinHistoryItem } from "./composables/useCheckin";
import { formatGas } from "@shared/utils/format";
import "./PlayArea.scss";

interface PlayAreaProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Observable>;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
}

export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { str, bool, num, val } = useStateBindings(state);

  // -- User state --
  const currentStreak = num("currentStreakRaw");
  const highestStreak = num("highestStreakRaw");
  const currentStreakFormatted = str("currentStreak", "0 days");
  const highestStreakFormatted = str("highestStreak", "0 days");
  const totalUserCheckins = num("totalUserCheckins");
  const unclaimedRewards = num("unclaimedRewards");
  const totalClaimed = num("totalClaimed");

  // -- Global stats --
  const totalGlobalCheckins = num("totalGlobalCheckins");
  const totalGlobalUsers = num("totalGlobalUsers");
  const totalGlobalRewarded = num("totalGlobalRewarded");

  // -- Flags --
  const canCheckIn = bool("canCheckIn");
  const isLoading = bool("isLoading");
  const isClaiming = bool("isClaiming");

  // -- Time --
  const utcTimeDisplay = str("utcTimeDisplay", "00:00:00");
  const nextUtcMidnight = num("nextUtcMidnight");

  // -- History --
  const checkinHistory = val<CheckinHistoryItem[]>("checkinHistory") ?? [];

  // -- Streak tier --
  const streakTier = useMemo(() => {
    if (currentStreak >= 30) return "inferno";
    if (currentStreak >= 7) return "blaze";
    if (currentStreak > 0) return "spark";
    return "cold";
  }, [currentStreak]);

  const streakTierLabel = useMemo(() => {
    if (currentStreak >= 30) return "INFERNO";
    if (currentStreak >= 7) return "BLAZE";
    if (currentStreak > 0) return "SPARK";
    return "";
  }, [currentStreak]);

  // -- Reward preview --
  const nextRewardAmount = useMemo(() => {
    const streak = currentStreak + 1;
    if (streak >= 30) return 5;
    if (streak >= 14) return 3;
    if (streak >= 7) return 2;
    return 1;
  }, [currentStreak]);

  // -- Week calendar --
  const weekSlotFilled = useMemo(() => {
    const mod = currentStreak % 7;
    return currentStreak >= 7 && mod === 0 ? 7 : mod;
  }, [currentStreak]);

  const weekSlotToday = useMemo(() => {
    return weekSlotFilled === 7 && canCheckIn ? 1 : weekSlotFilled + 1;
  }, [weekSlotFilled, canCheckIn]);

  // -- Confetti --
  const [showConfetti, setShowConfetti] = useState(false);
  const confettiColors = ["#ff6b35", "#fbbf24", "#34d399", "#ff8a5c", "#c41e3a", "#ffd700"];

  const confettiStyle = (i: number) => ({
    left: `${5 + Math.random() * 90}%`,
    animationDelay: `${Math.random() * 0.5}s`,
    animationDuration: `${1.5 + Math.random() * 1.5}s`,
    backgroundColor: confettiColors[i % confettiColors.length],
    width: `${6 + Math.random() * 6}px`,
    height: `${6 + Math.random() * 6}px`,
    borderRadius: Math.random() > 0.5 ? "50%" : "2px",
    transform: `rotate(${Math.random() * 360}deg)`,
  });

  // -- Watch for check-in success to fire confetti --
  const [prevCanCheckIn, setPrevCanCheckIn] = useState(canCheckIn);
  useEffect(() => {
    if (prevCanCheckIn === true && canCheckIn === false) {
      setShowConfetti(true);
      const timer = setTimeout(() => setShowConfetti(false), 3000);
      return () => clearTimeout(timer);
    }
    setPrevCanCheckIn(canCheckIn);
  }, [canCheckIn, prevCanCheckIn]);

  // -- Handlers --
  const handleCheckIn = async () => {
    await dispatch("doCheckIn");
  };

  const handleClaim = async () => {
    await dispatch("claimRewards");
  };

  return (
    <div className={`checkin-play-area${currentStreak > 0 ? " streak-active" : ""}`}>
      {/* Floating embers background */}
      <div className="flame-bg-effects">
        <div className="ember ember-1" />
        <div className="ember ember-2" />
        <div className="ember ember-3" />
      </div>

      {/* ── 1. Streak Fire Ring ── */}
      <div className="checkin-streak-section">
        <div className={`checkin-fire-ring ${streakTier}${currentStreak > 0 ? " active" : ""}`}>
          <div className="checkin-flame-stack" aria-hidden="true">
            <span className="checkin-flame checkin-flame-core">*</span>
            {currentStreak >= 7 && <span className="checkin-flame checkin-flame-outer">**</span>}
            {currentStreak >= 30 && <span className="checkin-flame checkin-flame-inferno">***</span>}
          </div>
          <span key={currentStreak} className="checkin-streak-number">{currentStreak}</span>
        </div>
        <span className="checkin-streak-text">{t("dayStreak") || "Day Streak"}</span>
        {streakTierLabel && (
          <span className={`checkin-tier-badge ${streakTier}`}>{streakTierLabel}</span>
        )}
        <span className="checkin-best-text">
          {t("bestStreak") || "Best"}: {highestStreakFormatted}
        </span>
      </div>

      {/* ── 2. Week Progress Calendar ── */}
      <div className="checkin-week-wrapper">
        <div className="checkin-week-progress-label">
          <span className="checkin-progress-text">{weekSlotFilled}/7 {t("dayPrefix") || "Day"}s</span>
          {weekSlotFilled === 7 && <span className="checkin-week-complete-badge">{t("complete") || "COMPLETE"}</span>}
        </div>
        <div className="checkin-week-row">
          {Array.from({ length: 7 }, (_, i) => {
            const day = i + 1;
            const classes = [
              "checkin-week-day-slot",
              day <= weekSlotFilled ? "checked" : "",
              day === weekSlotToday ? "today" : "",
              !canCheckIn && day === weekSlotFilled ? "today-done" : "",
              canCheckIn && day === weekSlotToday ? "today-ready" : "",
            ].filter(Boolean).join(" ");

            return (
              <div key={day} className={classes}>
                <span
                  className="checkin-day-icon"
                  aria-label={day <= weekSlotFilled ? (t("dayCompleted") || "Completed") : (t("dayPending") || "Pending")}
                >
                  {day <= weekSlotFilled ? "\u2714" : "\u25CB"}
                </span>
                <span className="checkin-day-label">{t("dayPrefix") || "D"}{day}</span>
                {day === 7 && weekSlotFilled >= 7 && (
                  <span className="checkin-bonus-star" aria-hidden="true">*</span>
                )}
              </div>
            );
          })}
        </div>
        <div className="checkin-week-connector">
          <div className="checkin-connector-fill" style={{ width: `${(weekSlotFilled / 7) * 100}%` }} />
        </div>
      </div>

      {/* ── 3. UTC Clock + Countdown ── */}
      <div className="countdown-section">
        <div className="utc-clock" role="timer" aria-live="polite">
          <span className="clock-display">{utcTimeDisplay}</span>
          <span className="clock-utc-label">{t("utcLabel") || "UTC"}</span>
        </div>
        <CountdownTimer
          targetTime={nextUtcMidnight}
          totalDuration={MS_PER_DAY}
          label={t("nextCheckin") || "Next Check-in"}
          t={t}
        />
      </div>

      {/* ── 4. Status Pill ── */}
      <div className={`status-pill${canCheckIn ? " ready" : ""}`}>
        <span>{canCheckIn ? (t("statusReady") || "Ready to Check In") : (t("statusDone") || "Checked In Today")}</span>
      </div>

      {/* ── 5. Reward Preview (visible when can check in) ── */}
      {canCheckIn && (
        <div className="reward-preview">
          <span className="reward-preview-label">{t("checkInNow") || "CHECK IN NOW"}</span>
          <div className="reward-preview-amount">
            <span>+{nextRewardAmount} {t("tokenGas") || "GAS"}</span>
          </div>
          <span className="reward-preview-hint">{t("dayStreak") || "Day Streak"} {currentStreak + 1}</span>
        </div>
      )}

      {/* ── 6. Check-In Button ── */}
      <NeoCard variant="erobo" className="action-card">
        <NeoButton
          variant={canCheckIn ? "success" : "secondary"}
          size="lg"
          block
          disabled={!canCheckIn || isLoading}
          loading={isLoading}
          className={`checkin-btn${canCheckIn ? " checkin-btn--ready" : ""}`}
          onClick={handleCheckIn}
        >
          <div className="btn-content">
            <span>{canCheckIn ? (t("checkInNow") || "CHECK IN") : (t("waitForNext") || "COME BACK TOMORROW")}</span>
          </div>
        </NeoButton>
      </NeoCard>

      {/* ── 7. Confetti burst on success ── */}
      {showConfetti && (
        <div className="confetti-container" aria-hidden="true">
          {Array.from({ length: 20 }, (_, i) => (
            <span key={i} className="confetti-piece" style={confettiStyle(i)} />
          ))}
        </div>
      )}

      {/* ── 8. User Stats ── */}
      <NeoCard variant="erobo" className="checkin-stats-card">
        <h3 className="checkin-section-title">{t("yourStats") || "Your Stats"}</h3>
        <div className="checkin-stats-grid">
          <div className="checkin-stat-item">
            <span className="checkin-stat-value">{totalUserCheckins}</span>
            <span className="checkin-stat-label">{t("totalCheckins") || "Total Check-ins"}</span>
          </div>
          <div className="checkin-stat-item">
            <span className="checkin-stat-value">{currentStreakFormatted}</span>
            <span className="checkin-stat-label">{t("currentStreak") || "Current Streak"}</span>
          </div>
          <div className="checkin-stat-item">
            <span className="checkin-stat-value">{highestStreakFormatted}</span>
            <span className="checkin-stat-label">{t("highestStreak") || "Best Streak"}</span>
          </div>
        </div>
      </NeoCard>

      {/* ── 9. Rewards Section ── */}
      <NeoCard variant="erobo" className="checkin-rewards-card">
        <h3 className="checkin-section-title">{t("rewards") || "Rewards"}</h3>
        <div className="checkin-rewards-grid">
          <div className="checkin-reward-item">
            <span className="checkin-reward-value checkin-reward-value--unclaimed">
              {formatGas(unclaimedRewards)}
            </span>
            <span className="checkin-reward-label">{t("unclaimed") || "Unclaimed GAS"}</span>
          </div>
          <div className="checkin-reward-item">
            <span className="checkin-reward-value">{formatGas(totalClaimed)}</span>
            <span className="checkin-reward-label">{t("totalClaimed") || "Total Claimed"}</span>
          </div>
        </div>
        {unclaimedRewards > 0 && (
          <NeoButton
            variant="success"
            size="md"
            block
            loading={isClaiming}
            disabled={isClaiming}
            className="checkin-claim-btn"
            onClick={handleClaim}
          >
            {t("claimRewards") || "Claim Rewards"} ({formatGas(unclaimedRewards)} {t("tokenGas") || "GAS"})
          </NeoButton>
        )}
      </NeoCard>

      {/* ── 10. Milestones ── */}
      <NeoCard variant="erobo-neo" className="checkin-milestones-card">
        <h3 className="checkin-section-title">{t("milestones") || "Milestones"}</h3>
        <div className="checkin-milestones-row">
          {MILESTONES.map((milestone) => {
            const reached = currentStreak >= milestone.day;
            const next = currentStreak < milestone.day && currentStreak >= milestone.day - 7;
            const classes = [
              "checkin-milestone",
              reached ? "reached" : "",
              next ? "next" : "",
            ].filter(Boolean).join(" ");
            return (
              <div key={milestone.day} className={classes}>
                <div className="checkin-milestone-icon">
                  {reached ? "\u2714" : "\u25C9"}
                </div>
                <span className="checkin-milestone-day">{t("day") || "Day"} {milestone.day}</span>
                <span className="checkin-milestone-reward">+{milestone.reward} {t("tokenGas") || "GAS"}</span>
                <span className="checkin-milestone-cumulative">({milestone.cumulative} {t("total") || "total"})</span>
              </div>
            );
          })}
        </div>
      </NeoCard>

      {/* ── 11. Platform Stats ── */}
      <NeoCard variant="erobo" className="checkin-global-card">
        <h3 className="checkin-section-title">{t("platformStats") || "Platform Stats"}</h3>
        <div className="checkin-stats-grid">
          <div className="checkin-stat-item">
            <span className="checkin-stat-value">{totalGlobalCheckins.toLocaleString()}</span>
            <span className="checkin-stat-label">{t("globalCheckins") || "Global Check-ins"}</span>
          </div>
          <div className="checkin-stat-item">
            <span className="checkin-stat-value">{totalGlobalUsers.toLocaleString()}</span>
            <span className="checkin-stat-label">{t("globalUsers") || "Active Users"}</span>
          </div>
          <div className="checkin-stat-item">
            <span className="checkin-stat-value">{formatGas(totalGlobalRewarded)}</span>
            <span className="checkin-stat-label">{t("globalRewarded") || "GAS Rewarded"}</span>
          </div>
        </div>
      </NeoCard>

      {/* ── 12. Check-in History ── */}
      {checkinHistory.length > 0 && (
        <NeoCard variant="erobo" className="checkin-history-card">
          <h3 className="checkin-section-title">{t("history") || "Check-in History"}</h3>
          <div className="checkin-history-list">
            {checkinHistory.slice(0, 10).map((entry, idx) => (
              <div key={idx} className="checkin-history-row">
                <span className="checkin-history-date">{entry.time}</span>
                <span className="checkin-history-streak">
                  {entry.streak} {t("dayStreak") || "day streak"}
                </span>
                <span className="checkin-history-reward">
                  +{entry.reward} {t("tokenGas") || "GAS"}
                </span>
              </div>
            ))}
          </div>
        </NeoCard>
      )}
    </div>
  );
}
