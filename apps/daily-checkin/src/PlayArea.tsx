import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Circle, Gift, Lock } from "lucide-react";
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
  const rewardPoolBalance = num("rewardPoolBalance");
  const isPaused = bool("isPaused");
  const rewardsUnderfunded = bool("rewardsUnderfunded");
  const claimableButUnfunded = bool("claimableButUnfunded");

  const canCheckIn = bool("canCheckIn");
  const hasLoadedStatus = bool("hasLoadedStatus");
  const isLoading = bool("isLoading");
  const isClaiming = bool("isClaiming");
  const isCheckingIn = bool("isCheckingIn");
  const isRefreshing = bool("isRefreshing");
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

  // Milestone payout reveal — when a check-in lands the streak ON a milestone
  // day (the streak counter crosses 7 or 14 upward), surface the +GAS reward the
  // daily flow just unlocked. Gated on a real upward edge of currentStreak so it
  // only fires once per milestone, not on every status refresh.
  const [reachedMilestone, setReachedMilestone] = useState<(typeof MILESTONES)[number] | null>(null);
  const prevStreakRef = useRef(currentStreak);
  useEffect(() => {
    const prev = prevStreakRef.current;
    prevStreakRef.current = currentStreak;
    if (currentStreak <= prev) return;
    const crossed = MILESTONES.find((m) => prev < m.day && currentStreak >= m.day);
    if (!crossed) return;
    setReachedMilestone(crossed);
    const timer = setTimeout(() => setReachedMilestone(null), 4200);
    return () => clearTimeout(timer);
  }, [currentStreak]);

  const streakTier = currentStreak >= 14 ? "blaze" : currentStreak >= 7 ? "spark" : "cold";
  // A chain read is genuinely in flight only while the global coordinator is
  // running before the first successful load. Once it settles with no wallet
  // (the standalone resting state) isLoading is false again — that is NOT a
  // loading state and must not show a "Loading…" pill.
  const statusReadInFlight = !hasLoadedStatus && (isLoading || isRefreshing);
  // The settled first-open / disconnected resting state: the initial read has
  // resolved with no wallet/data (isLoading back to false) and nothing else is
  // running. This is the empty archetype state — not a loading state.
  const awaitingConnect = !hasLoadedStatus && !isLoading && !isRefreshing && !isCheckingIn;
  const checkInDisabled = !hasLoadedStatus || !canCheckIn || isLoading || isPaused;
  // Only collapse the primary verb to "Loading…" while a read is actually in
  // flight. In the settled disconnected state keep the real "Check In Now"
  // label (disabled) so the game's core action is always visible and named,
  // never hidden behind a perpetual loading pill.
  const checkInLabel = isPaused
    ? t("contractPaused")
    : statusReadInFlight
      ? t("loading")
      : !hasLoadedStatus
        ? t("checkInNow")
        : canCheckIn
          ? t("checkInNow")
          : t("waitForNext");
  const hasClaimable = unclaimedRewards > 0;
  // Block claiming when the contract is paused or the reward pool cannot cover
  // the accrued amount, so the CTA never invites a transaction that will fault.
  const claimBlocked = isPaused || claimableButUnfunded;
  const claimDisabled = !hasClaimable || isClaiming || claimBlocked;
  // When there is genuinely nothing accrued, the claim CTA reads as an explicit
  // "Nothing to claim yet" dead-state rather than an active-looking
  // "Claim Rewards (0 GAS)" — so the disabled button is not a confusing
  // dead-end tap. Copy-only; the disabled logic above is unchanged.
  const claimLabel = isPaused
    ? t("contractPaused")
    : claimableButUnfunded
      ? t("claimUnfunded")
      : hasClaimable
        ? `${t("claimRewards")} (${formatGas(unclaimedRewards)} ${t("tokenGas")})`
        : t("claimNothingYet");

  // "Today plan" facts — derived from the same state the actions use, so the
  // panel narrates exactly what the buttons will do this UTC cycle. In the
  // settled disconnected state lead with the actionable invite to start the
  // streak rather than three idle "nothing happening" rows.
  const planTitle = awaitingConnect
    ? t("todayPlanInvite")
    : canCheckIn
      ? t("todayPlanReady")
      : t("todayPlanDone");
  const planCopy = awaitingConnect
    ? t("todayPlanInviteCopy")
    : canCheckIn
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

  // The hero pill reads as an invite to connect in the resting state rather
  // than a perpetual "Loading…": "Loading…" is reserved for an in-flight read.
  const ringReady = hasLoadedStatus && canCheckIn;

  return (
    <div
      className={`checkin-play-area streak-${streakTier}${ringReady ? " streak-can-checkin" : ""}`}
    >
      {/* Upper region — hero + week (left) and the primary action card (right)
          share a two-column grid on desktop so the core Check In action sits
          above the fold and the page uses its width instead of stacking thin. */}
      <div className="checkin-top-grid">
      <div className="checkin-top-left">
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
        <span
          className={`checkin-tier-badge ${streakTier}${awaitingConnect ? " connect" : ""}${ringReady ? " ready" : ""}`}
        >
          {awaitingConnect
            ? t("connectToStart")
            : !hasLoadedStatus
              ? t("loading")
              : canCheckIn
                ? t("checkInReady")
                : t("checkedInToday")}
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
                <span className="checkin-day-icon" role="img" aria-label={checked ? t("dayCompleted") : t("dayPending")}>
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
      </div>

      <div className="checkin-top-right">
      {/* Honesty banners — surface a paused contract or a reward pool that is
          temporarily too low to cover the next milestone, so the user knows
          whether milestone GAS rewards can be paid before they spend the daily
          check-in fee. The pool is owner-fundable, so this only shows when the
          pool is actually short, not as a permanent state. */}
      {isPaused ? (
        <div className="checkin-notice checkin-notice--paused" role="status">
          {t("contractPausedStatus")}
        </div>
      ) : rewardsUnderfunded ? (
        <div className="checkin-notice checkin-notice--unfunded" role="status">
          {t("rewardsUnfundedBanner")}
        </div>
      ) : null}

      {/* Primary action — surfaced right after the hero, with inline status */}
      <NeoCard variant="erobo" className="checkin-action-card">
        {showStatusPill && (
          <div className={`status-pill${lastError ? " error" : ""}`}>
            <span>{lastError || workflowStatus}</span>
          </div>
        )}
        {awaitingConnect && (
          <p className="checkin-connect-hint">{t("connectHint")}</p>
        )}
        <div className="checkin-actions-grid">
          <NeoButton
            variant={canCheckIn ? "success" : "secondary"}
            size="lg"
            disabled={checkInDisabled}
            loading={isCheckingIn}
            className={`checkin-btn${canCheckIn ? " checkin-btn--ready" : ""}`}
            onClick={() => dispatch("doCheckIn")}
            aria-label={checkInLabel}
          >
            {checkInLabel}
          </NeoButton>
        </div>
        <div className="checkin-actions-secondary">
          <NeoButton
            variant="primary"
            size="lg"
            disabled={claimDisabled}
            loading={isClaiming}
            className={`checkin-claim-btn${!hasClaimable && !claimBlocked ? " checkin-claim-btn--empty" : ""}`}
            onClick={() => dispatch("claimRewards")}
            aria-label={hasClaimable ? t("claimRewards") : t("claimNothingYet")}
          >
            {claimLabel}
          </NeoButton>
          <NeoButton
            variant="secondary"
            size="lg"
            disabled={isLoading || isClaiming}
            loading={isRefreshing}
            onClick={() => dispatch("refreshStatus")}
            aria-label={t("refreshStatus")}
          >
            {t("refreshStatus")}
          </NeoButton>
        </div>
      </NeoCard>
      </div>
      </div>

      {/* Milestone payout reveal — the reward feedback moment. Appears briefly
          when a check-in lands the streak on a milestone day, announcing the
          +GAS the daily flow just unlocked. */}
      {reachedMilestone && (
        <div className="checkin-reward-reveal" role="status">
          <span className="checkin-reward-reveal__icon" aria-hidden="true">
            <Gift size={22} />
          </span>
          <div className="checkin-reward-reveal__body">
            <span className="checkin-reward-reveal__eyebrow">
              {t("milestoneReached")}
            </span>
            <span className="checkin-reward-reveal__title">
              +{reachedMilestone.reward} {t("tokenGas")}
            </span>
            <span className="checkin-reward-reveal__copy">
              {t("milestoneRewardUnlocked", { day: reachedMilestone.day })}
            </span>
          </div>
        </div>
      )}

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
      {/* Genuinely-empty zero metrics render in a muted style (className flag only,
          the value/number itself is untouched) so the green streak hero + Check In
          CTA carry the visual focus on first run instead of a wall of bold zeros. */}
      <div className="checkin-meta-strip">
        <div className="checkin-meta-item">
          <span className={`checkin-meta-value${totalUserCheckins === 0 ? " is-zero" : ""}`}>{totalUserCheckins}</span>
          <span className="checkin-meta-label">{t("totalCheckins")}</span>
        </div>
        <div className="checkin-meta-item">
          <span className={`checkin-meta-value${unclaimedRewards === 0 ? " is-zero" : ""}`}>{formatGas(unclaimedRewards)}</span>
          <span className="checkin-meta-label">{t("unclaimed")}</span>
        </div>
        <div className="checkin-meta-item">
          <span className={`checkin-meta-value${totalClaimed === 0 ? " is-zero" : ""}`}>{formatGas(totalClaimed)}</span>
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
            <span className={`checkin-stat-value${totalGlobalCheckins === 0 ? " is-zero" : ""}`}>{totalGlobalCheckins.toLocaleString()}</span>
            <span className="checkin-stat-label">{t("totalCheckins")}</span>
          </div>
          <div className="checkin-stat-item">
            <span className={`checkin-stat-value${totalGlobalUsers === 0 ? " is-zero" : ""}`}>{totalGlobalUsers.toLocaleString()}</span>
            <span className="checkin-stat-label">{t("totalUsers")}</span>
          </div>
          <div className="checkin-stat-item">
            <span className={`checkin-stat-value${totalGlobalRewarded === 0 ? " is-zero" : ""}`}>{formatGas(totalGlobalRewarded)}</span>
            <span className="checkin-stat-label">{t("totalRewarded")}</span>
          </div>
          <div className={`checkin-stat-item${rewardsUnderfunded ? " checkin-stat-item--warn" : ""}`}>
            <span className={`checkin-stat-value${rewardPoolBalance === 0 && !rewardsUnderfunded ? " is-zero" : ""}`}>{formatGas(rewardPoolBalance)}</span>
            <span className="checkin-stat-label">{t("rewardPool")}</span>
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
