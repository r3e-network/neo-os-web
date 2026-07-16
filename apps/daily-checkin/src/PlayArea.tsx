import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  CalendarCheck,
  CheckCircle2,
  Clock3,
  Gift,
  History,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Trophy,
  Wallet,
} from "lucide-react";
import { CoinArt, ParticleBurst } from "@shared/art";
import { PlayStage } from "@shared/components-react/v2";
import { PhaseValue, resolvePhase, type DataPhase } from "@shared/components-react/v2/DataPhase";
import {
  OpenUiLiteNotice as OpenUiNotice,
  OpenUiLitePanel as OpenUiPanel,
  OpenUiLiteProvider as OpenUiProvider,
} from "@shared/components-react/v2/OpenUiLite";
import type { ObservableState } from "@shared/react/context";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import { formatGas, formatHash } from "@shared/utils/format";
import "./PlayArea.scss";

interface Props {
  t: (key: string, params?: Record<string, string | number>) => string;
  state: ObservableState;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
}

interface CheckinHistoryItem {
  streak?: number;
  time?: string;
  rewardRaw?: string;
  reward?: number | string;
  action?: "checkin" | "claim";
  txid?: string;
}

interface PendingOperation {
  kind?: "checkin" | "claim";
  txid?: string;
  createdAt?: number;
}

const STREAK_IMAGE = "./streak-plaza.webp";

function countdown(milliseconds: number): string {
  const total = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return [hours, minutes, seconds]
    .map((entry) => String(entry).padStart(2, "0"))
    .join(":");
}

function historyDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toISOString().slice(0, 10);
}

function historyReward(item: CheckinHistoryItem): string {
  const raw = item.rewardRaw ?? item.reward;
  return raw === undefined || raw === null ? "—" : `${formatGas(raw)} GAS`;
}

export default function PlayArea({ t, state, dispatch }: Props) {
  const { str, bool, num, val } = useStateBindings(state);
  // Both resolve together, out of the one canonical-context read, and both were
  // left on `|| "—"` when the rest of this surface moved to DataPhase — so the
  // header opened as "Neo N3 —" and the footer as a dashed contract, directly
  // contradicting the comment below. They are phased through `contextPhase`.
  const network = str("network");
  const contractHash = str("contractHash");
  const dataSource = str("dataSource") || "idle";
  const walletAddress = str("walletAddress");
  // First-run values are rendered through the shared DataPhase vocabulary, not
  // through `|| "—"`.
  //
  // Every value below is empty on a cold, pre-wallet first paint — the NORMAL
  // state — and each one used to collapse to an em-dash, so the entry surface
  // opened as a grid of six dashes before the visitor had done anything. The
  // composable already tracks the two flags needed to tell the honest states
  // apart (`isLoading` = a read is in flight, `hasLoadedStatus` = at least one
  // read has settled), so a value in flight renders as a skeleton and a value
  // that settled without a wallet renders as inviting zero-state copy.
  const currentStreakRaw = str("currentStreak");
  const highestStreakRaw = str("highestStreak");
  const streakRaw = num("currentStreakRaw", 0);
  const totalUserCheckins = num("totalUserCheckins", 0);
  const unclaimedRewardsRaw = str("unclaimedRewards");
  const totalClaimed = str("totalClaimed") || "0";
  const checkInFeeRaw = str("checkInFee");
  const rewardPoolBalance = str("rewardPoolBalance") || "0";
  const weekRewardLabelRaw = str("weekRewardLabel");
  const twoWeekRewardLabelRaw = str("twoWeekRewardLabel");
  const utcTime = str("utcTimeDisplay") || "—";
  const nextMidnight = num("nextUtcMidnight", 0);
  const canCheckIn = bool("canCheckIn");
  const hasClaimableRewards = bool("hasClaimableRewards");
  const claimableButUnfunded = bool("claimableButUnfunded");
  const rewardsUnderfunded = bool("rewardsUnderfunded");
  const streakWillReset = bool("streakWillReset");
  const isPaused = bool("isPaused");
  const hasLoadedStatus = bool("hasLoadedStatus");
  const hasLoadedPlatform = bool("hasLoadedPlatform");
  const hasLoadedContext = bool("hasLoadedContext");
  const isLoading = bool("isLoading");
  const isSubmitting = bool("isSubmitting");
  const isRecovering = bool("isRecovering");
  const isWalletConnecting = bool("isWalletConnecting");
  const activeAction = str("activeAction");
  const lastError = str("lastError");
  const lastSuccess = str("lastSuccess");
  const transactionNotice = str("transactionNotice");
  const lastConfirmedKind = str("lastConfirmedKind");
  const workflowStatus = str("workflowStatus");
  const pendingOperation = val<PendingOperation | null>("pendingOperation", null);
  const history = val<CheckinHistoryItem[]>("checkinHistory", []) ?? [];
  const latestRequest = val<{ summary?: string; txid?: string } | null>("latestRequest", null);
  const latestResult = val<{ summary?: string; txid?: string } | null>("latestResult", null);

  const [showCelebration, setShowCelebration] = useState(false);
  const [actionPreview, setActionPreview] = useState(false);
  const actionPreviewTimeout = useRef<number | null>(null);
  const celebrated = useRef("");
  // Immediate local action preview: the ritual surface starts animating the
  // moment the player taps check-in/claim, before any chain confirmation.
  const startActionPreview = () => {
    if (actionPreviewTimeout.current !== null) window.clearTimeout(actionPreviewTimeout.current);
    setActionPreview(true);
    actionPreviewTimeout.current = window.setTimeout(() => {
      setActionPreview(false);
      actionPreviewTimeout.current = null;
    }, 1_100);
  };
  useEffect(
    () => () => {
      if (actionPreviewTimeout.current !== null) window.clearTimeout(actionPreviewTimeout.current);
    },
    [],
  );
  useEffect(() => {
    if (!lastSuccess || !lastConfirmedKind || celebrated.current === lastConfirmedKind + lastSuccess) return;
    celebrated.current = lastConfirmedKind + lastSuccess;
    setShowCelebration(true);
    const timer = setTimeout(() => setShowCelebration(false), 1_600);
    return () => clearTimeout(timer);
  }, [lastConfirmedKind, lastSuccess]);

  const effectiveStreak = streakWillReset && canCheckIn ? 0 : streakRaw;
  const journeyComplete = effectiveStreak >= 14;
  const chapterStart = effectiveStreak > 7 ? 8 : 1;
  const chapterEnd = chapterStart + 6;
  const chapterDays = useMemo(
    () => Array.from({ length: 7 }, (_, index) => chapterStart + index),
    [chapterStart],
  );
  const completedInChapter = journeyComplete
    ? 7
    : Math.max(0, Math.min(7, effectiveStreak - chapterStart + 1));
  const nextMilestoneDay = effectiveStreak < 7 ? 7 : effectiveStreak < 14 ? 14 : 14;
  const nextRewardRaw = effectiveStreak < 7 ? weekRewardLabelRaw : twoWeekRewardLabelRaw;

  // ── First-run value phases ────────────────────────────────────────────────
  // Two honest shapes, per the shared DataPhase vocabulary:
  //  - chain-scoped values (the fee, the milestone reward tiers) are readable
  //    with no wallet at all, so they are only ever "in flight" or "ready";
  //  - wallet-scoped values (this visitor's streak, their unclaimed rewards)
  //    cannot exist before a wallet is connected, which is a settled, expected
  //    absence — inviting copy, never an error and never a dash.
  const walletConnected = Boolean(walletAddress);
  // Chain-scoped values settle with the PLATFORM read (fee + reward tiers),
  // which is the flag the composable itself gates them on — using the status
  // flag here would call them settled before their read had happened.
  const chainPhase = (raw: string): DataPhase =>
    resolvePhase({ loading: isLoading, settled: hasLoadedPlatform, hasData: Boolean(raw) });
  const walletPhase = (raw: string): DataPhase =>
    walletConnected
      ? resolvePhase({ loading: isLoading, settled: hasLoadedStatus, hasData: Boolean(raw) })
      : "unavailable";
  // Context-scoped values (the network, the canonical contract) need no wallet
  // and settle before the platform read does, so they gate on their own flag —
  // `hasLoadedPlatform` never flips when the context read is what failed, and
  // would leave these shimmering forever on exactly that path.
  const contextPhase = (raw: string): DataPhase =>
    resolvePhase({ loading: isLoading, settled: hasLoadedContext, hasData: Boolean(raw) });
  const daysToReward = journeyComplete ? 0 : Math.max(0, nextMilestoneDay - effectiveStreak);
  const progressPercent = Math.round((completedInChapter / 7) * 100);
  const waitingForReset = hasLoadedStatus && !canCheckIn && !isPaused && nextMidnight > Date.now();
  const countdownText = waitingForReset ? countdown(nextMidnight - Date.now()) : "";
  const walletDisplay = walletAddress ? formatHash(walletAddress, 7) : t("notConnected");
  const contractDisplay = contractHash ? formatHash(contractHash, 7) : "";
  const busy = isLoading || isSubmitting || isRecovering || isWalletConnecting;

  const sourceLabel = dataSource === "chain"
    ? t("chainVerified")
    : dataSource === "partial"
      ? t("chainPartial")
      : dataSource === "failed"
        ? t("chainUnavailable")
        : dataSource === "loading"
          ? t("chainLoading")
          : t("chainWaiting");

  const ritualStatus = pendingOperation
    ? t("transactionPending")
    : isPaused
      ? t("contractPaused")
      : !walletAddress
        ? t("connectToStart")
        : !hasLoadedStatus
          ? t("statusNeedsRefresh")
          : canCheckIn
            ? streakWillReset
              ? t("streakRestartReady")
              : t("todayPlanReady")
            : t("todayPlanDone");

  const connect = () => void dispatch("connectWallet");
  const checkIn = () => {
    startActionPreview();
    void dispatch("doCheckIn");
  };
  const claim = () => {
    startActionPreview();
    void dispatch("claimRewards");
  };
  const refresh = () => void dispatch("refreshStatus");
  const recover = () => void dispatch("recoverPending");

  const primary = pendingOperation && !walletAddress
    ? {
        label: t("reconnectToRecover"),
        onClick: connect,
        loading: isWalletConnecting,
        disabled: isWalletConnecting,
        icon: <Wallet size={17} />,
      }
    : pendingOperation
      ? {
        label: isRecovering ? t("checkingConfirmation") : t("checkConfirmation"),
        onClick: recover,
        loading: isRecovering,
        disabled: isRecovering,
        icon: <RefreshCw size={17} />,
      }
    : !walletAddress
      ? {
          label: t("connectWallet"),
          onClick: connect,
          loading: isWalletConnecting,
          disabled: busy,
          icon: <Wallet size={17} />,
        }
      : !hasLoadedStatus || isPaused
        ? {
            label: isLoading ? t("workflowRefreshing") : t("refreshStatus"),
            onClick: refresh,
            loading: isLoading,
            disabled: busy,
            icon: <RefreshCw size={17} />,
          }
        : canCheckIn
          ? {
              label: activeAction === "checkin" ? t("workflowCheckingIn") : t("checkInNow"),
              onClick: checkIn,
              loading: activeAction === "checkin",
              disabled: busy,
              icon: <CalendarCheck size={17} />,
            }
          : hasClaimableRewards && !claimableButUnfunded
            ? {
                label: activeAction === "claim" ? t("workflowClaiming") : t("claimRewards"),
                onClick: claim,
                loading: activeAction === "claim",
                disabled: busy,
                icon: <Gift size={17} />,
              }
            : {
                label: isLoading ? t("workflowRefreshing") : t("refreshStatus"),
                onClick: refresh,
                loading: isLoading,
                disabled: busy,
                icon: <RefreshCw size={17} />,
              };

  const feedback = lastError || lastSuccess || transactionNotice;
  const scene = (
    <div
      className="dci-ritual"
      data-state={pendingOperation ? "pending" : canCheckIn ? "ready" : "waiting"}
      data-preview={actionPreview ? "true" : undefined}
      aria-busy={busy || actionPreview}
    >
      {showCelebration && (
        <div className="dci-ritual__celebration" aria-hidden="true">
          <ParticleBurst coins count={12} />
        </div>
      )}

      {feedback && (
        <div
          className={`dci-feedback ${lastError ? "is-error" : lastSuccess ? "is-success" : "is-pending"}`}
          role={lastError ? "alert" : "status"}
        >
          <span>
            {lastError ? <AlertTriangle size={17} /> : lastSuccess ? <BadgeCheck size={17} /> : <Clock3 size={17} />}
            <strong>{feedback}</strong>
            {pendingOperation?.txid && <small>{formatHash(pendingOperation.txid, 8)}</small>}
          </span>
          {pendingOperation && (
            <button type="button" onClick={walletAddress ? recover : connect} disabled={isRecovering || isWalletConnecting}>
              {walletAddress
                ? <RefreshCw size={14} className={isRecovering ? "is-spinning" : undefined} />
                : <Wallet size={14} />}
              {walletAddress
                ? isRecovering ? t("checkingConfirmation") : t("checkConfirmation")
                : t("reconnectToRecover")}
            </button>
          )}
        </div>
      )}

      <div className="dci-ritual__layout">
        <figure className="dci-plaza" aria-label={t("streakStageTitle")}>
          <img src={STREAK_IMAGE} alt={t("streakPlazaAlt")} loading="eager" decoding="async" />
          <div className="dci-plaza__legibility" />
          <figcaption className="dci-plaza__caption">
            <span><Sparkles size={15} /> {t("dailyRitual")}</span>
            <strong>{journeyComplete ? t("journeyCompleteTitle") : t("journeyTitle", { day: nextMilestoneDay })}</strong>
            <p>{journeyComplete ? t("journeyCompleteCopy") : t("journeyCopy", { days: daysToReward })}</p>
          </figcaption>
          <div className="dci-plaza__reward">
            <CoinArt size={38} variant="gas" />
            <span>
              <small>{journeyComplete ? t("earnedJourney") : t("nextReward")}</small>
              <strong>
                {journeyComplete ? t("milestonesComplete") : (
                  <PhaseValue
                    phase={chainPhase(nextRewardRaw)}
                    placeholder={t("valueAwaitingNetwork")}
                    skeletonWidth="4.5em"
                  >
                    {nextRewardRaw}
                  </PhaseValue>
                )}
              </strong>
            </span>
          </div>
        </figure>

        <section className="dci-console" aria-label={t("todayRitual")}>
          <header className="dci-console__head">
            <div>
              <span className={`dci-source dci-source--${dataSource}`}><i /> {sourceLabel}</span>
              <strong>{t("todayRitual")}</strong>
              <small>{ritualStatus}</small>
            </div>
            {/* "Neo N3" is true before any read — only the specific network is
                unknown, so the chip keeps its identity and phases the tail. */}
            <span className="dci-network">
              Neo N3{" "}
              <PhaseValue
                phase={contextPhase(network)}
                placeholder={t("valueAwaitingNetwork")}
                skeletonWidth="3.4em"
              >
                {network}
              </PhaseValue>
            </span>
          </header>

          <div className="dci-streak-focus">
            <span className="dci-streak-focus__icon"><CalendarCheck size={25} /></span>
            <div>
              <small>{t("currentStreak")}</small>
              <strong>
                <PhaseValue
                  phase={walletPhase(currentStreakRaw)}
                  placeholder={t("valueStreakNotStarted")}
                  skeletonWidth="2.4em"
                >
                  {currentStreakRaw}
                </PhaseValue>
              </strong>
              <span>
                {t("bestStreak")}:{" "}
                <PhaseValue
                  phase={walletPhase(highestStreakRaw)}
                  placeholder={t("valueStreakNotStarted")}
                  skeletonWidth="2em"
                >
                  {highestStreakRaw}
                </PhaseValue>
              </span>
            </div>
            <div className="dci-streak-focus__clock">
              <small>{canCheckIn ? t("dailyWindow") : t("nextCheckin")}</small>
              <strong>{canCheckIn ? t("windowOpen") : countdownText || utcTime}</strong>
              <span>{t("utcLabel")}</span>
            </div>
          </div>

          {streakWillReset && canCheckIn && (
            <OpenUiNotice
              className="dci-reset-note"
              icon={<AlertTriangle size={17} />}
              title={t("streakRestartTitle")}
            >
              {t("streakRestartCopy")}
            </OpenUiNotice>
          )}

          <div className="dci-chapter">
            <header>
              <span>{t("chapterLabel", { start: chapterStart, end: chapterEnd })}</span>
              <strong>{journeyComplete ? t("complete") : `${progressPercent}%`}</strong>
            </header>
            <div className="dci-path" aria-label={t("milestones")}>
              {chapterDays.map((day) => {
                const complete = journeyComplete || day <= effectiveStreak;
                const ready = canCheckIn && day === (streakWillReset ? 1 : effectiveStreak + 1);
                const reward = day === 7 || day === 14;
                return (
                  <span
                    key={day}
                    className={[
                      "dci-day",
                      complete ? "is-complete" : "",
                      ready ? "is-ready" : "",
                      reward ? "is-reward" : "",
                    ].filter(Boolean).join(" ")}
                  >
                    <i>{complete ? <CheckCircle2 size={18} /> : reward ? <Gift size={18} /> : <Sparkles size={16} />}</i>
                    <strong>{t("dayPrefix")}{day}</strong>
                    <small>{complete ? t("dayCompleted") : ready ? t("checkInReady") : reward ? t("rewardDay") : ""}</small>
                  </span>
                );
              })}
            </div>
          </div>

          <div className="dci-console__facts">
            <span>
              <CoinArt size={25} variant="gas" />
              <small>{t("checkInFee")}</small>
              <strong>
                <PhaseValue
                  phase={chainPhase(checkInFeeRaw)}
                  placeholder={t("valueAwaitingNetwork")}
                  skeletonWidth="4em"
                >
                  {checkInFeeRaw}
                </PhaseValue>
              </strong>
            </span>
            <span>
              <Gift size={21} />
              <small>{t("unclaimed")}</small>
              <strong>
                <PhaseValue
                  phase={walletPhase(unclaimedRewardsRaw)}
                  placeholder={t("valueConnectWallet")}
                  skeletonWidth="4em"
                >
                  {unclaimedRewardsRaw}
                </PhaseValue>
              </strong>
            </span>
            <span><ShieldCheck size={21} /><small>{t("confirmationModel")}</small><strong>{t("eventAndReadback")}</strong></span>
          </div>
        </section>
      </div>
    </div>
  );

  const drawer = (
    <div className="dci-drawer">
      <OpenUiPanel
        className="dci-drawer__panel"
        icon={<History size={16} />}
        title={t("activityTitle")}
        subtitle={hasLoadedStatus ? t("activityCount", { count: totalUserCheckins }) : t("connectPrompt")}
      >
        <div className="dci-drawer__stats">
          <span><small>{t("currentStreak")}</small><strong><PhaseValue phase={walletPhase(currentStreakRaw)} placeholder={t("valueStreakNotStarted")} skeletonWidth="2.4em">{currentStreakRaw}</PhaseValue></strong></span>
          <span><small>{t("bestStreak")}</small><strong><PhaseValue phase={walletPhase(highestStreakRaw)} placeholder={t("valueStreakNotStarted")} skeletonWidth="2em">{highestStreakRaw}</PhaseValue></strong></span>
        </div>
        {history.length ? (
          <ol className="dci-history">
            {history.slice(0, 8).map((item, index) => (
              <li key={item.txid || `${item.time}:${index}`}>
                <span>{item.action === "claim" ? <Gift size={15} /> : <CalendarCheck size={15} />}</span>
                <div><strong>{t(item.action === "claim" ? "historyClaim" : "historyCheckin")}</strong><small>{historyDate(item.time || "")}</small></div>
                <em>{item.action === "claim" ? historyReward(item) : `${item.streak ?? "—"} ${t("days")}`}</em>
              </li>
            ))}
          </ol>
        ) : (
          <OpenUiNotice icon={<CalendarCheck size={17} />} title={t("noCheckins")}>
            {walletAddress ? t("historyEmptyCopy") : t("connectHint")}
          </OpenUiNotice>
        )}
      </OpenUiPanel>

      <OpenUiPanel
        className="dci-drawer__panel"
        icon={<Trophy size={16} />}
        title={t("rewardLedger")}
        subtitle={hasLoadedPlatform ? t("liveContractTerms") : t("chainWaiting")}
      >
        <div className="dci-reward-ledger">
          <span><small>{t("day7Reward")}</small><strong><PhaseValue phase={chainPhase(weekRewardLabelRaw)} placeholder={t("valueAwaitingNetwork")} skeletonWidth="4.5em">{weekRewardLabelRaw}</PhaseValue></strong></span>
          <span><small>{t("day14Reward")}</small><strong><PhaseValue phase={chainPhase(twoWeekRewardLabelRaw)} placeholder={t("valueAwaitingNetwork")} skeletonWidth="4.5em">{twoWeekRewardLabelRaw}</PhaseValue></strong></span>
          <span><small>{t("unclaimed")}</small><strong><PhaseValue phase={walletPhase(unclaimedRewardsRaw)} placeholder={t("valueConnectWallet")} skeletonWidth="4em">{unclaimedRewardsRaw}</PhaseValue></strong></span>
          <span><small>{t("totalClaimed")}</small><strong>{totalClaimed}</strong></span>
          <span className="is-wide"><small>{t("rewardPool")}</small><strong>{rewardPoolBalance}</strong></span>
        </div>
        {(rewardsUnderfunded || claimableButUnfunded) && (
          <p className="dci-pool-note"><AlertTriangle size={14} /> {t("rewardsUnfundedBanner")}</p>
        )}
        <button
          type="button"
          className="dci-claim"
          onClick={claim}
          disabled={!hasClaimableRewards || claimableButUnfunded || isPaused || busy || Boolean(pendingOperation)}
        >
          <Gift size={15} /> {activeAction === "claim" ? t("workflowClaiming") : t("claimRewards")}
        </button>
      </OpenUiPanel>

      <OpenUiPanel
        className="dci-drawer__panel dci-drawer__panel--trust"
        icon={<ShieldCheck size={16} />}
        title={t("contractTrust")}
        subtitle={t("directWalletOnly")}
      >
        <div className="dci-trust-list">
          <span><BadgeCheck size={15} /><strong>{t("canonicalContract")}</strong><small>
            <PhaseValue
              phase={contextPhase(contractDisplay)}
              placeholder={t("valueAwaitingNetwork")}
              skeletonWidth="7em"
            >
              {contractDisplay}
            </PhaseValue>
          </small></span>
          <span><Wallet size={15} /><strong>{t("walletLabel")}</strong><small>{walletDisplay}</small></span>
          <span><ShieldCheck size={15} /><strong>{t("confirmationModel")}</strong><small>{t("eventAndReadback")}</small></span>
        </div>
        <div className="dci-trust-actions">
          <button type="button" onClick={refresh} disabled={busy}><RefreshCw size={14} /> {t("refreshStatus")}</button>
          {pendingOperation && <button type="button" onClick={recover} disabled={isRecovering}><Clock3 size={14} /> {t("checkConfirmation")}</button>}
        </div>
        {(latestRequest?.summary || latestResult?.summary || workflowStatus) && (
          <details className="dci-evidence">
            <summary>{t("evidence")}</summary>
            <p>{latestRequest?.summary || t("requestEmpty")}</p>
            <p>{latestResult?.summary || workflowStatus || t("resultEmpty")}</p>
          </details>
        )}
      </OpenUiPanel>
    </div>
  );

  return (
    <div className="daily-checkin-play-area mx2 mx2-cat-game">
      <OpenUiProvider>
        <PlayStage
          category="game"
          stage={{
            eyebrow: t("streakStageEyebrow"),
            title: t("streakStageTitle"),
            subtitle: t("streakStageCopy"),
            badges: <span className="mx2-badge" data-tone="accent"><span className="mx2-badge__dot" /> {sourceLabel}</span>,
          }}
          scene={scene}
          score={[
            {
              label: t("currentStreak"),
              // Same first-run phases as the console tiles: the platform stat strip
              // must not be the one surface that still prints a dash.
              value: (
                <PhaseValue phase={walletPhase(currentStreakRaw)} placeholder={t("valueStreakNotStarted")} skeletonWidth="2.4em">
                  {currentStreakRaw}
                </PhaseValue>
              ),
              accent: true,
            },
            { label: t("utcClock"), value: utcTime },
            { label: t("walletLabel"), value: walletDisplay },
          ]}
          actions={{ primary }}
          drawerToggleLabel={t("ritualDetails")}
          drawer={{ title: t("ritualDetails"), children: drawer }}
        />
      </OpenUiProvider>
    </div>
  );
}
