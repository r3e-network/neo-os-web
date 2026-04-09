/**
 * PlayArea.tsx — React version of the Daily Check-in PlayArea.
 */

import { useState, useEffect, useMemo } from "react";
import { NeoButton, NeoCard } from "@shared/components-react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import CountdownTimer from "./components/CountdownTimer";
import CheckinCalendar from "./components/CheckinCalendar";
import StreakDisplay from "./components/StreakDisplay";
import RewardsSection from "./components/RewardsSection";
import { MS_PER_DAY } from "./composables/useCheckin";
import "./PlayArea.scss";

interface PlayAreaProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Observable>;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
}

export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { str, bool, num } = useStateBindings(state);
  const currentStreak = num("currentStreakRaw");
  const highestStreak = num("highestStreakRaw");
  const unclaimedRewards = num("unclaimedRewards");
  const totalClaimed = num("totalClaimed");
  const isLoading = bool("isLoading");
  const isClaiming = bool("isClaiming");
  const canCheckIn = bool("canCheckIn");
  const utcTimeDisplay = str("utcTimeDisplay", "00:00:00");
  const nextUtcMidnight = num("nextUtcMidnight");

  // Reward preview
  const nextRewardAmount = useMemo(() => {
    const streak = currentStreak + 1;
    if (streak >= 30) return 5;
    if (streak >= 14) return 3;
    if (streak >= 7) return 2;
    return 1;
  }, [currentStreak]);

  // Confetti state
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

  // Watch for check-in success
  const [prevCanCheckIn, setPrevCanCheckIn] = useState(canCheckIn);
  useEffect(() => {
    if (prevCanCheckIn === true && canCheckIn === false) {
      setShowConfetti(true);
      const timer = setTimeout(() => setShowConfetti(false), 3000);
      return () => clearTimeout(timer);
    }
    setPrevCanCheckIn(canCheckIn);
  }, [canCheckIn, prevCanCheckIn]);

  const handleCheckIn = async () => {
    await dispatch("doCheckIn");
  };

  return (
    <div className={`checkin-play-area${currentStreak > 0 ? " streak-active" : ""}`}>
      <div className="flame-bg-effects">
        <div className="ember ember-1" />
        <div className="ember ember-2" />
        <div className="ember ember-3" />
      </div>

      <CheckinCalendar t={t} currentStreak={currentStreak} canCheckIn={canCheckIn} />

      <StreakDisplay t={t} currentStreak={currentStreak} highestStreak={highestStreak} />

      {/* Countdown to Next UTC Midnight */}
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

      {/* Status Pill */}
      <div className={`status-pill${canCheckIn ? " ready" : ""}`}>
        <span>{canCheckIn ? t("statusReady") : t("statusDone")}</span>
      </div>

      {/* Reward Preview */}
      {canCheckIn && (
        <div className="reward-preview">
          <span className="reward-preview-label">{t("checkInNow")}</span>
          <div className="reward-preview-amount">
            <span>+{nextRewardAmount} {t("tokenGas")}</span>
          </div>
          <span className="reward-preview-hint">{t("dayStreak")} {currentStreak + 1}</span>
        </div>
      )}

      {/* Check-in Action */}
      <NeoCard variant="erobo" className="action-card">
        <NeoButton
          variant="primary"
          size="lg"
          block
          disabled={!canCheckIn || isLoading}
          loading={isLoading}
          className="checkin-btn"
          onClick={handleCheckIn}
        >
          <div className="btn-content">
            <span>{canCheckIn ? t("checkInNow") : t("waitForNext")}</span>
          </div>
        </NeoButton>
      </NeoCard>

      {/* Confetti burst on success */}
      {showConfetti && (
        <div className="confetti-container" aria-hidden="true">
          {Array.from({ length: 20 }, (_, i) => (
            <span key={i} className="confetti-piece" style={confettiStyle(i)} />
          ))}
        </div>
      )}

      <RewardsSection
        t={t}
        currentStreak={currentStreak}
        unclaimedRewards={unclaimedRewards}
        totalClaimed={totalClaimed}
        isClaiming={isClaiming}
        dispatch={dispatch}
      />
    </div>
  );
}
