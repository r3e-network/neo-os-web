/**
 * PlayArea.tsx - Daily Check-in.
 *
 * Game identity: a clean seven-day streak board with a GAS reward chest. The
 * player advances a visible path; visual energy stays in the foreground
 * controls and reward feedback instead of a busy scenic backdrop.
 */
import { useEffect, useRef, useState } from "react";
import { CalendarCheck, Gift, RefreshCw, Sparkles } from "lucide-react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { ObservableState } from "@shared/react/context";
import { CoinArt, ParticleBurst } from "@shared/art";
import { formatGas } from "@shared/utils/format";
import { PlayStage } from "@shared/components-react/v2";
import "./PlayArea.scss";

interface P {
  t: (k: string, p?: Record<string, string | number>) => string;
  state: ObservableState;
  dispatch: (n: string, ...a: unknown[]) => Promise<void>;
}

interface CheckinItem {
  streak?: number;
  time?: string;
  reward?: number | string;
  action?: string;
  txid?: string;
  [k: string]: unknown;
}

const STREAK_IMAGE = "streak-plaza.webp";
const PATH_DAYS = [1, 2, 3, 4, 5, 6, 7];

function hasPositiveAmount(value: string): boolean {
  const text = String(value || "").replace(/,/g, "").trim();
  const amount = text.match(/[0-9]+(?:\.[0-9]+)?/);
  if (amount) return Number(amount[0]) > 0;
  return Boolean(text && text !== "—" && text.toLowerCase() !== "none");
}

function pathProgress(streak: number): number {
  if (streak <= 0) return 0;
  return ((streak - 1) % 7) + 1;
}

/** Format a remaining-ms window as a HH:MM:SS clock string. */
function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [h, m, s].map((part) => String(part).padStart(2, "0")).join(":");
}

export default function PlayArea({ t, state, dispatch }: P) {
  const { str, bool, num, val } = useStateBindings(state);

  const currentStreak = str("currentStreak");
  const highestStreak = str("highestStreak");
  const unclaimedRewards = str("unclaimedRewards");
  const totalClaimed = str("totalClaimed");
  const rewardPoolBalance = str("rewardPoolBalance");
  const streakRaw = num("currentStreakRaw");
  const isPaused = bool("isPaused");
  const canCheckIn = bool("canCheckIn");
  const hasLoadedStatus = bool("hasLoadedStatus");
  const isClaiming = bool("isClaiming");
  const isCheckingIn = bool("isCheckingIn");
  const rewardsUnderfunded = bool("rewardsUnderfunded");
  const nextEligibleTs = num("nextUtcMidnight");
  const weekRewardLabel = str("weekRewardLabel");
  const twoWeekRewardLabel = str("twoWeekRewardLabel");
  const history = (val<CheckinItem[]>("checkinHistory", []) ?? []);
  const hasClaimableRewards = hasPositiveAmount(unclaimedRewards);

  const [claimPreview, setClaimPreview] = useState(false);
  const [checkInPreview, setCheckInPreview] = useState(false);
  const claimPreviewTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const checkInPreviewTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (claimPreviewTimeout.current) clearTimeout(claimPreviewTimeout.current);
      if (checkInPreviewTimeout.current) clearTimeout(checkInPreviewTimeout.current);
    },
    [],
  );

  const startClaimPreview = () => {
    if (claimPreviewTimeout.current) clearTimeout(claimPreviewTimeout.current);
    setClaimPreview(true);
    claimPreviewTimeout.current = setTimeout(() => {
      setClaimPreview(false);
      claimPreviewTimeout.current = null;
    }, 1200);
  };

  const startCheckInPreview = () => {
    if (checkInPreviewTimeout.current) clearTimeout(checkInPreviewTimeout.current);
    setCheckInPreview(true);
    checkInPreviewTimeout.current = setTimeout(() => {
      setCheckInPreview(false);
      checkInPreviewTimeout.current = null;
    }, 1200);
  };

  const handleClaim = () => {
    startClaimPreview();
    void dispatch("claimRewards");
  };

  const handleCheckIn = () => {
    if (isPaused || !canCheckIn) return;
    startCheckInPreview();
    void dispatch("doCheckIn");
  };

  const handleRefresh = () => {
    void dispatch("refreshStatus");
  };

  const busy = isClaiming || isCheckingIn || claimPreview || checkInPreview;
  const completedPathDay = pathProgress(streakRaw);
  const nextPathDay = canCheckIn ? Math.min(7, completedPathDay + 1) : completedPathDay;
  const daysToChest = Math.max(0, 7 - completedPathDay);
  // Contract-reported milestone amounts (formatted upstream); the next payout
  // after a completed 7-day cycle is the two-week milestone.
  const rewardLabel = completedPathDay >= 7 ? twoWeekRewardLabel : weekRewardLabel;
  const progressPercent = Math.min(100, Math.max(0, (completedPathDay / 7) * 100));
  // Countdown to the next check-in window: only meaningful once the chain
  // status has loaded and today's check-in is locked. The composable's ticker
  // re-renders this component every second, so Date.now() stays live.
  const showCountdown = hasLoadedStatus && !canCheckIn && !isPaused && nextEligibleTs > 0;
  const countdownText = formatCountdown(nextEligibleTs - Date.now());
  const sceneState = isPaused
    ? "paused"
    : isCheckingIn || checkInPreview
      ? "checking-in"
      : isClaiming || claimPreview
        ? "claiming"
        : canCheckIn
          ? "ready"
          : hasClaimableRewards
            ? "claimable"
            : "waiting";

  const statusText = isPaused
    ? t("contractPaused")
    : isCheckingIn || checkInPreview
      ? t("workflowCheckingIn")
      : isClaiming || claimPreview
        ? t("workflowClaiming")
        : canCheckIn
          ? t("todayPlanReady")
          : hasClaimableRewards
            ? t("rewardPlanReady")
            : hasLoadedStatus
              ? t("notCheckedIn")
              : t("connectPrompt");

  const primary = (() => {
    if (isPaused) {
      return {
        label: t("refreshStatus"),
        onClick: handleRefresh,
        loading: false,
        disabled: busy,
      };
    }
    if (canCheckIn) {
      return {
        label: t("checkInNow"),
        onClick: handleCheckIn,
        loading: isCheckingIn || checkInPreview,
        disabled: busy,
      };
    }
    if (hasClaimableRewards) {
      return {
        label: t("claimRewards"),
        onClick: handleClaim,
        loading: isClaiming || claimPreview,
        disabled: busy,
      };
    }
    // First run (no wallet / no status yet): invite the connection — the
    // refresh action prompts the wallet, so it doubles as the connect flow.
    return {
      label: hasLoadedStatus ? t("refreshStatus") : t("connectWallet"),
      onClick: handleRefresh,
      loading: false,
      disabled: busy,
    };
  })();

  const scene = (
    <div className="dci-reward-board" data-state={sceneState}>
      {(isClaiming || claimPreview || isCheckingIn || checkInPreview) && (
        <div className="dci-reward-board__burst">
          <ParticleBurst coins count={10} />
        </div>
      )}

      <section className="dci-streak-card" aria-label={t("streakStageProgress")}>
        <header className="dci-streak-card__head">
          <span className="dci-streak-card__icon" aria-hidden="true">
            <CalendarCheck size={22} strokeWidth={2.35} />
          </span>
          <div>
            <span>{t("streakStageProgress")}</span>
            <strong>{currentStreak}</strong>
          </div>
          <div className="dci-streak-card__status">
            <span className="dci-streak-card__badge">
              <span className="dci-status-dot" />
              {statusText}
            </span>
            {showCountdown && (
              <span className="dci-streak-card__countdown">
                {t("nextCheckin")}
                <strong>{countdownText}</strong>
              </span>
            )}
          </div>
          <div className="dci-streak-card__summary" aria-label={t("yourRewards")}>
            <span>
              {t("unclaimed")}
              <strong>{unclaimedRewards}</strong>
            </span>
            <span>
              {t("rewardPool")}
              <strong>{rewardPoolBalance}</strong>
            </span>
            <span>
              {t("bestStreak")}
              <strong>{highestStreak}</strong>
            </span>
          </div>
        </header>

        <figure className="dci-plaza-art" aria-label={t("streakStageTitle")}>
          <img src={STREAK_IMAGE} alt="" loading="eager" decoding="async" />
          <figcaption>
            <span className="dci-plaza-art__coin" aria-hidden="true">
              <CoinArt size={34} variant="gas" decorative />
            </span>
            <div>
              <span>{t("nextReward")}</span>
              <strong>{rewardLabel}</strong>
              <small>{daysToChest === 0 ? t("milestoneReached") : t("daysToReward", { days: daysToChest })}</small>
            </div>
          </figcaption>
          {progressPercent > 0 && (
            <div className="dci-plaza-art__meter" aria-hidden="true">
              <span style={{ width: `${Math.max(4, progressPercent)}%` }} />
            </div>
          )}
        </figure>

        <div className="dci-path" aria-label={t("milestones")}>
          {PATH_DAYS.map((day) => {
            const complete = day <= completedPathDay;
            const active = day === nextPathDay && canCheckIn;
            const reward = day === 7;
            // Captions carry signal only: completed / ready states, and the
            // milestone payout on the reward node. Plain pending days stay
            // caption-free so the row reads calm.
            const caption = complete
              ? t("dayCompleted")
              : active
                ? t("checkInReady")
                : reward
                  ? rewardLabel
                  : null;
            return (
              <span
                key={day}
                className={[
                  "dci-day-node",
                  complete ? "dci-day-node--complete" : null,
                  active ? "dci-day-node--active" : null,
                  reward ? "dci-day-node--reward" : null,
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <span className="dci-day-node__mark">
                  {reward ? <Gift size={17} strokeWidth={2.4} /> : <Sparkles size={15} strokeWidth={2.4} />}
                </span>
                <strong>{t("dayPrefix")}{day}</strong>
                {caption ? <small>{caption}</small> : null}
              </span>
            );
          })}
        </div>

      </section>
    </div>
  );

  const drawer = (
    <div className="dci-drawer">
      <button
        type="button"
        className="dci-drawer__checkin"
        onClick={handleCheckIn}
        disabled={isPaused || !canCheckIn || isCheckingIn || checkInPreview}
      >
        {isCheckingIn || checkInPreview ? t("workflowCheckingIn") : canCheckIn ? t("checkInNow") : t("waitForNext")}
      </button>
      <button
        type="button"
        className="dci-drawer__claim"
        onClick={handleClaim}
        disabled={isPaused || !hasClaimableRewards || isClaiming || claimPreview}
      >
        {isClaiming || claimPreview ? t("workflowClaiming") : t("claimRewards")}
      </button>
      <button type="button" className="dci-drawer__refresh" onClick={handleRefresh}>
        <RefreshCw size={14} strokeWidth={2.3} aria-hidden="true" />
        {t("refreshStatus")}
      </button>
      {rewardsUnderfunded && <p className="dci-drawer__caution">{t("rewardsUnfundedBanner")}</p>}
      <div className="dci-drawer__stats">
        <div><span>{t("bestStreak")}</span><strong>{highestStreak}</strong></div>
        <div><span>{t("totalClaimed")}</span><strong>{totalClaimed}</strong></div>
        <div><span>{t("unclaimed")}</span><strong>{unclaimedRewards}</strong></div>
        <div><span>{t("rewardPool")}</span><strong>{rewardPoolBalance}</strong></div>
      </div>
      {history.length > 0 && (
        <div className="dci-drawer__history">
          <span className="dci-drawer__history-title">{t("recentCheckins")}</span>
          <ul className="mx2-history">
            {history.slice(0, 10).map((h, i) => (
              <li key={i} className="mx2-history__item">
                <span className="mx2-history__face">{h.streak ?? "—"} {t("days")}</span>
                <span className="mx2-history__result">
                  {h.reward != null ? `${formatGas(h.reward)} ${t("tokenGas")}` : "—"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );

  return (
    <div className="daily-checkin-play-area mx2 mx2-cat-game">
      <PlayStage
        category="game"
        stage={{
          eyebrow: t("streakStageEyebrow"),
          title: t("streakStageTitle"),
          subtitle: t("streakStageCopy"),
        }}
        scene={scene}
        actions={{
          primary,
        }}
        drawerToggleLabel={t("yourStats")}
        drawer={{ title: t("yourStats"), children: drawer }}
      />
    </div>
  );
}
