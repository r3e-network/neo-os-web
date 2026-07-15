import { useEffect, useRef, useState } from "react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import { PlayStage } from "@shared/components-react/v2/PlayStage";
import { LazyPhaserGameComponent as PhaserGameComponent } from "@framework/phaser/LazyPhaserGameComponent";
import { Activity, ChevronDown, Coins, History, RefreshCw, RotateCcw, ShieldCheck, WalletCards, X } from "lucide-react";
import type { HistoryEvent } from "./composables/useLastSurvivor";
import { getLastSurvivorTransactionGate } from "./logic/transaction-gate";
import "./PlayArea.scss";

interface P {
  t: (k: string, p?: Record<string, string | number>) => string;
  state: Record<string, Observable>;
  dispatch: (n: string, ...a: unknown[]) => Promise<void>;
}

const GAME_CONFIG = { width: 420, height: 600 } as const;
const loadLastSurvivorScene = () =>
  import("./scenes/LastSurvivorScene").then((module) => module.LastSurvivorScene);

function shortValue(value: string): string {
  if (!value || value === "--") return "--";
  return value.length > 16 ? `${value.slice(0, 8)}...${value.slice(-6)}` : value;
}

function gasLabel(value: number): string {
  const safe = Number.isFinite(value) ? Math.max(0, value) : 0;
  if (safe === 0) return "0.00 GAS";
  const decimals = safe >= 10 ? 1 : safe >= 0.01 ? 2 : safe >= 0.0001 ? 4 : 8;
  const fixed = safe.toFixed(decimals);
  return `${decimals <= 2 ? fixed : fixed.replace(/\.?0+$/, "")} GAS`;
}

export default function PhaserPlayArea({ t, state, dispatch }: P) {
  const { str, bool, num, val } = useStateBindings(state);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerToggleRef = useRef<HTMLButtonElement>(null);
  const drawerCloseRef = useRef<HTMLButtonElement>(null);
  const isRoundActive = bool("isRoundActive");
  const needsLifecycleSync = bool("needsLifecycleSync");
  const prepaidCreditValue = num("prepaidCredit");
  const prepaidCredit = Number.isFinite(prepaidCreditValue) ? Math.max(0, prepaidCreditValue) : 0;
  const creditAvailable = bool("creditAvailable");
  const userKeysAvailable = bool("userKeysAvailable");
  const historyAvailable = bool("historyAvailable");
  const quoteAvailable = bool("quoteAvailable");
  const storageHealthy = state.storageHealthy ? bool("storageHealthy") : true;
  const totalKeys = num("totalKeysDisplay");
  const userKeys = num("userKeys");
  const isBuyingKeys = bool("isBuyingKeys");
  const purchasePending = bool("purchasePending");
  const isSettling = bool("isSettling");
  const isLoading = bool("isLoading");
  const isConnectingWallet = bool("isConnectingWallet");
  const totalPotDisplay = str("totalPotDisplay", "0.00 GAS");
  const countdown = str("countdown", "00:00:00");
  const keyCount = str("keyCount", "1");
  const estimatedCost = str("estimatedCost", "0.00");
  const estimatedCostGas = num("estimatedCostGas", Number(estimatedCost) || 0);
  const dangerLevelText = str("dangerLevelText", "");
  const lastBuyerLabel = str("lastBuyerLabel", "--");
  const rawLastBuyer = str("lastBuyer", "");
  const roundStatusDisplay = str("roundStatusDisplay", "");
  const keyValidationError = str("keyValidationError", "");
  const serviceNotice = str("serviceNotice", "");
  const viewerAddress = str("viewerAddress", "");
  const walletBalanceValue = Number(val<string | number>("walletGasBalance", 0) ?? 0);
  const walletGasBalance = Number.isFinite(walletBalanceValue) ? Math.max(0, walletBalanceValue) : 0;
  const walletBalanceAvailable = bool("walletBalanceAvailable");
  const walletConnected = Boolean(viewerAddress);
  const formattedRound = str("formattedRound", "#0");
  const userSharePercent = num("userSharePercent");
  const history = val<HistoryEvent[]>("history", []) ?? [];
  const pendingOperationKind = str("pendingOperationKind", "");
  const pendingTransactionId = str("pendingTransactionId", "");
  const recoveryNotice = str("recoveryNotice", "");
  const roundReady = bool("roundDataAvailable");
  const busy = isBuyingKeys || purchasePending || isSettling || isLoading || isConnectingWallet;
  const withdrawalBusy = isBuyingKeys || isSettling || isLoading || isConnectingWallet;
  const noAddressLabel = t("notAvailable");
  const hasBuyer =
    !!lastBuyerLabel &&
    lastBuyerLabel !== "--" &&
    lastBuyerLabel !== noAddressLabel &&
    lastBuyerLabel !== "N/A";

  // ── Mode-aware copy ────────────────────────────────────────────────────────
  // In guest the game is a purely local doomsday drill: no token, no pot, no GAS
  // at stake. Reframe every GAS-centric label as a local survival streak; keep
  // the GameFi copy exactly as-is. The Phaser scene reads the SAME bridge keys —
  // we just feed guest-appropriate values into them.
  const appMode = str("appMode", "guest");
  const isGuest = appMode === "guest";
  const guestScore = Math.max(0, Math.floor(num("guestScore")));
  const guestLeaderLabel = str("guestLeaderLabel", t("guestNoBuyerYet"));
  const guestOutcome = str("guestOutcome", "ready");
  const guestRivalCue = str("guestRivalCue", t("guestOpeningCue"));
  const guestMoveReady = bool("guestMoveReady");
  const timeRemainingSeconds = Math.max(0, num("timeRemainingSeconds"));
  const guestDangerProgress = guestOutcome === "running" && timeRemainingSeconds > 0
    ? Math.max(0, Math.min(100, (1 - timeRemainingSeconds / 26) * 100))
    : 0;
  const guestDangerLevel = guestOutcome !== "running"
    ? "low"
    : timeRemainingSeconds <= 3
      ? "critical"
      : timeRemainingSeconds <= 6
        ? "high"
        : timeRemainingSeconds <= 12
          ? "medium"
          : "low";
  /**
   * The guest round is ARMED, not running, until the first key starts the local
   * clock: guest-engine `resetRound` leaves `clockRunning` false and
   * `endTime` 0, but sets `isRoundActive` true so the arena renders. The HUD
   * read that flag literally and opened on a contradiction — "Active" beside a
   * 00:00:00 clock and "Watch the leader — rivals can steal the final seat"
   * with no leader, no rivals and no keys loaded. `guestOutcome` already
   * carries the honest distinction ("ready" until the first key), so status and
   * timer caption follow it instead of `isRoundActive`.
   */
  const guestRoundPending = isGuest && guestOutcome === "ready";
  /**
   * `roundStatusDisplay` from the composable is GameFi vocabulary derived from
   * `isRoundActive` ("Active" / "Rollover ready"). A pending guest round is
   * neither: it is armed and waiting on the player's first key.
   */
  const roundStatusLabel = guestRoundPending ? t("guestRoundPending") : roundStatusDisplay;
  const guestWon = guestOutcome === "won";
  const guestLost = guestOutcome === "lost";
  const guestFinishAction = guestLost ? t("guestRestartWord") : t("guestBankWord");
  const guestFinishHint = guestWon
    ? t("guestWonStatus", { score: guestScore })
    : guestLost
      ? t("guestLostStatus", { rival: guestLeaderLabel })
      : guestRivalCue;
  const newPaidRoundsEnabled = isGuest || bool("paidActionsAvailable");
  const selectedCount = Math.max(0, Math.floor(Number(keyCount) || 0));
  const hasHistoricalPosition =
    purchasePending || needsLifecycleSync ||
    (creditAvailable && prepaidCredit > 0) ||
    (userKeysAvailable && userKeys > 0);
  const writeDataAvailable = isGuest || (creditAvailable && userKeysAvailable && quoteAvailable && walletBalanceAvailable);
  const availableGas = prepaidCredit + walletGasBalance;
  const shortfallGas = Math.max(0, estimatedCostGas - availableGas);
  const transactionGate = getLastSurvivorTransactionGate({
    appMode,
    walletConnected,
    selectedCount,
    estimatedCostGas,
    prepaidCredit,
    walletGasBalance,
    roundDataAvailable: roundReady,
    writeDataAvailable,
    storageHealthy,
    isRoundActive,
    needsLifecycleSync,
    newPaidRoundsEnabled,
    hasHistoricalPosition,
    isBuyingKeys,
    purchasePending,
    isSettling,
    isLoading,
    isConnectingWallet,
    hasValidationError: Boolean(keyValidationError),
    guestMoveReady,
  });
  const keysWord = totalKeys === 1 ? t("keyUnitOne") : t("keyUnitMany");
  const selectedKeysWord = selectedCount === 1 ? t("keyUnitOne") : t("keyUnitMany");
  const streakDisplay = isGuest
    ? t("guestScoreValue", { count: guestScore })
    : `${totalKeys} ${keysWord}`;
  const potDisplay = isGuest ? streakDisplay : totalPotDisplay;
  const leaderDisplay = isGuest ? guestLeaderLabel : lastBuyerLabel;

  const bridgeState = {
    // Surface the play mode so the scene can drop the hardcoded " GAS" cost.
    appMode,
    guestOutcome,
    guestScore,
    guestLeaderLabel,
    guestLeaderIsPlayer:
      isGuest && (rawLastBuyer === "guest-local" || (!!viewerAddress && rawLastBuyer === viewerAddress)),
    guestMoveReady,
    countdown,
    dangerProgress:   isGuest ? guestDangerProgress : num("dangerProgress"),
    dangerLevel:      isGuest ? guestDangerLevel : str("dangerLevel", "low"),
    // Guest never wants an alarmist "CRITICAL" tier on a compressed local clock —
    // show a friendly local prompt instead; GameFi keeps its danger tier text.
    // Feeds the scene's timer caption. Before the first key there is no leader
    // to watch and no rival to lose the seat to, so the pending round says how
    // to start the clock instead of narrating a contest that has not begun.
    dangerLevelText:  isGuest
      ? (guestRoundPending ? t("guestStatusStart") : t("guestClockHint"))
      : dangerLevelText,
    // Pot → survival streak (key count) in guest; GAS pot in GameFi.
    totalPotDisplay:  potDisplay,
    keyCount,
    keyValidationError,
    estimatedCost,
    estimatedCostGas,
    userKeys,
    totalKeys,
    totalKeysDisplay: totalKeys,
    lastBuyerLabel:   leaderDisplay,
    isRoundActive,
    isBuyingKeys,
    purchasePending,
    isSettling,
    isLoading,
    isConnectingWallet,
    paidActionsAvailable: bool("paidActionsAvailable"),
    needsLifecycleSync,
    roundDataAvailable: roundReady,
    roundStatusDisplay: roundStatusLabel,
    shouldPulse:      isGuest
      ? guestOutcome === "running" && timeRemainingSeconds > 0 && timeRemainingSeconds <= 3
      : bool("shouldPulse"),
    serviceNotice,
    prepaidCredit,
    viewerAddress,
    walletConnected,
    walletGasBalance,
    writeDataAvailable,
    storageHealthy,
    // Localized in-canvas copy so the Phaser scene never hardcodes English.
    sceneLiveRound:         t("liveRound"),
    sceneWaitingRound:      t("waitingForRound"),
    sceneRolloverReady:     t("inactiveRound"),
    sceneSettleWord:        isGuest ? guestFinishAction : t("sceneSettleWord"),
    sceneReadyToPay:        isGuest ? guestFinishHint : t("readyToPay"),
    scenePressToStay:       isGuest ? t("guestPressToStay") : t("pressToStay"),
    sceneRoundAfterSync:    t("roundAfterSync"),
    sceneLeaderLine:        isGuest
      ? t("guestLeaderLine", { leader: guestLeaderLabel })
      : (hasBuyer ? `${t("lastBuyerPrefix")} ${lastBuyerLabel}` : t("noBuyerYet")),
    sceneKeysSoldLine:      isGuest
      ? t("guestArenaMoves", { count: totalKeys })
      : t("keysSoldLine", { count: totalKeys }),
    sceneYoursLine:         isGuest || userKeysAvailable
      ? t("yoursLine", { count: userKeys })
      : t("yourKeysUnavailable"),
    sceneChoosePack:        t("choosePackLabel"),
    scenePrizePool:         isGuest ? t("guestScoreLabel") : t("prizePoolLabel"),
    sceneGuestCost:         t("guestNoCostLine"),
    sceneBuyVerb:           isGuest ? t("guestBuyVerb") : t("buyVerb"),
    sceneKeyUnitOne:        t("keyUnitOne"),
    sceneKeyUnitMany:       t("keyUnitMany"),
    sceneBuying:            isGuest ? t("guestLoading") : t("buyingLabel"),
    sceneConfirming:        t("confirmingPurchase"),
    sceneSettling:          isGuest ? t("guestFinishing") : t("settlingRound"),
    sceneConnecting:        t("connectingWallet"),
    sceneSyncing:           t("syncingArena"),
    sceneConnectWallet:     t("connectWallet"),
    sceneConnectFirst:      t("connectBeforeSettle"),
    sceneServiceShort:      t("serviceUnavailableShort"),
    sceneFinancialStateShort: t("financialStateUnavailableShort"),
    sceneRecoveryStorageShort: t("recoveryStorageUnavailableShort"),
    sceneSettleFirst:       isGuest ? guestFinishAction : t("settleFirstShort"),
    sceneWaitingShort:      isGuest ? t("guestWaitingShort") : t("roundWaitingShort"),
    sceneInvalidSelection:  t("invalidKeyCount"),
    sceneInsufficientGas:   t("insufficientGasShort", { amount: gasLabel(shortfallGas) }),
    scenePaidUnavailable:   t("gameFiValidationShort"),
    sceneAwaitRival:        t("guestHoldSeatWord"),
    sceneBuyQuote:          isGuest
      ? t("guestBuyQuote", { count: selectedCount, unit: selectedKeysWord })
      : t("buyQuote", {
          count: selectedCount,
          unit: selectedKeysWord,
          amount: gasLabel(estimatedCostGas),
        }),
    sceneStatusServiceDown: t("statusServiceDown"),
    sceneStatusFinancialStateDown: t("financialStateUnavailable"),
    sceneStatusRecoveryStorageDown: t("recoveryStorageUnavailable"),
    sceneStatusSettle:      isGuest ? guestFinishHint : t("statusSettle"),
    sceneStatusBuy:         isGuest
      ? guestRivalCue
      : t("statusFundsReady", {
          wallet: walletBalanceAvailable ? gasLabel(walletGasBalance) : t("notAvailable"),
          credit: gasLabel(prepaidCredit),
        }),
    sceneStatusInsufficient: t("statusInsufficientGas", { amount: gasLabel(shortfallGas) }),
    sceneStatusLoading:     t("statusSyncing"),
    sceneStatusConfirming:  t("statusConfirmingPurchase"),
    sceneStatusConnecting:  t("statusConnecting"),
    sceneStatusWaiting:     isGuest ? t("guestStatusWaiting") : t("statusWaiting"),
    sceneStatusConnect:     isGuest ? t("guestStatusStart") : t("statusConnect"),
    sceneStatusPaidUnavailable: t("gameFiValidationPending"),
    sceneNoticeBuying:      isGuest ? t("guestNoticeBuying") : t("noticeBuying"),
    sceneNoticeSettling:    isGuest ? t("guestFinishing") : t("noticeSettling"),
    sceneActionError:       t("sceneActionError"),
  };

  const primaryControlLabel = (() => {
    switch (transactionGate.reason) {
      case "connecting": return t("connectingWallet");
      case "buying": return isGuest ? t("guestLoading") : t("buyingLabel");
      case "confirming": return t("confirmingPurchase");
      case "settling": return isGuest ? t("guestFinishing") : t("settlingRound");
      case "loading": return t("syncingArena");
      case "connect-wallet": return t("connectWallet");
      case "service-unavailable": return t("serviceUnavailableShort");
      case "financial-state-unavailable": return t("financialStateUnavailableShort");
      case "recovery-storage-unavailable": return t("recoveryStorageUnavailableShort");
      case "settle-required": return isGuest ? guestFinishAction : t("settleFirstShort");
      case "round-waiting": return isGuest ? t("guestWaitingShort") : t("roundWaitingShort");
      case "paid-disabled": return t("gameFiValidationShort");
      case "await-rival": return t("guestHoldSeatWord");
      case "invalid-selection": return t("invalidKeyCount");
      case "insufficient-gas": return t("insufficientGasShort", { amount: gasLabel(shortfallGas) });
      case "ready":
      default: return bridgeState.sceneBuyQuote;
    }
  })();

  const controlStatus = keyValidationError || serviceNotice || (() => {
    switch (transactionGate.reason) {
      case "confirming": return t("statusConfirmingPurchase");
      case "connecting": return t("statusConnecting");
      case "loading": return t("statusSyncing");
      case "service-unavailable": return t("statusServiceDown");
      case "financial-state-unavailable": return t("financialStateUnavailable");
      case "recovery-storage-unavailable": return t("recoveryStorageUnavailable");
      case "settle-required": return isGuest ? guestFinishHint : t("statusSettle");
      case "round-waiting": return isGuest ? t("guestStatusWaiting") : t("statusWaiting");
      case "paid-disabled": return t("gameFiValidationPending");
      case "await-rival": return guestRivalCue;
      case "insufficient-gas": return t("statusInsufficientGas", { amount: gasLabel(shortfallGas) });
      case "connect-wallet": return isGuest ? t("guestStatusStart") : t("statusConnect");
      default: return isGuest ? guestRivalCue : t("statusFundsReady", {
        wallet: walletBalanceAvailable ? gasLabel(walletGasBalance) : t("notAvailable"),
        credit: gasLabel(prepaidCredit),
      });
    }
  })();

  useEffect(() => {
    if (!drawerOpen) return;
    const frame = window.requestAnimationFrame(() => drawerCloseRef.current?.focus());
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setDrawerOpen(false);
      window.requestAnimationFrame(() => drawerToggleRef.current?.focus());
    };
    document.addEventListener("keydown", handleEscape);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [drawerOpen]);

  const closeDrawer = () => {
    setDrawerOpen(false);
    window.requestAnimationFrame(() => drawerToggleRef.current?.focus());
  };

  const scoreItems = isGuest
    ? [
        { label: t("guestStreakLabel"), value: streakDisplay, accent: true },
        { label: t("sidebarTimeLeft"), value: needsLifecycleSync ? guestFinishAction : countdown },
        { label: t("yourKeys"), value: String(userKeys) },
      ]
    : [
        { label: t("totalPot"), value: totalPotDisplay, accent: true },
        { label: t("sidebarTimeLeft"), value: needsLifecycleSync ? t("inactiveRound") : countdown },
        { label: t("yourKeys"), value: userKeysAvailable ? String(userKeys) : t("notAvailable") },
      ];
  const drawerTitle = isGuest ? t("guestBoardTitle") : t("historyTitle");
  const drawerId = "last-survivor-ingame-drawer";
  const drawerContent = (
    <div className="survivor-drawer">
      <div className="survivor-drawer__inner">
        <div className="survivor-drawer__summary" aria-label={t("drawerSummaryLabel")}>
          <div>
            <span>{t("round")}</span>
            <strong>{formattedRound}</strong>
          </div>
          <div>
            <span>{isGuest ? t("guestArenaMovesLabel") : t("totalKeys")}</span>
            <strong>{totalKeys}</strong>
          </div>
          <div>
            <span>{isGuest ? t("guestOutcomeLabel") : t("share")}</span>
            <strong>{isGuest
              ? t(`guestOutcome${guestOutcome[0]?.toUpperCase() ?? "R"}${guestOutcome.slice(1)}`)
              : userKeysAvailable ? `${userSharePercent.toFixed(1)}%` : t("notAvailable")}</strong>
          </div>
          <div>
            <span>{isGuest ? t("guestStreakLabel") : t("prepaidCreditLabel")}</span>
            <strong>{isGuest
              ? streakDisplay
              : creditAvailable ? gasLabel(prepaidCredit) : t("notAvailable")}</strong>
          </div>
        </div>

        <section className="survivor-drawer__panel survivor-drawer__panel--state">
          <div className="survivor-drawer__panel-head">
            <Activity size={16} aria-hidden="true" />
            <h4>{needsLifecycleSync
              ? t("inactiveRound")
              : roundStatusLabel || (isRoundActive ? t("activeRound") : t("inactiveRound"))}</h4>
          </div>
          <div className="survivor-state-card">
            <span>{t("currentLeader")}</span>
            <strong>{isGuest ? leaderDisplay : shortValue(lastBuyerLabel)}</strong>
            <small>
              {isGuest
                ? guestRivalCue
                : dangerLevelText || (roundReady ? t("safe") : t("roundStateRequired"))}
            </small>
          </div>
          {keyValidationError && (
            <p className="survivor-drawer__notice" data-tone="danger">{keyValidationError}</p>
          )}
          {serviceNotice && (
            <p className="survivor-drawer__notice">{serviceNotice}</p>
          )}
          {needsLifecycleSync && (
            <p className="survivor-drawer__notice" data-tone={guestLost ? "danger" : "success"}>
              {isGuest ? guestFinishHint : t("settleRoundHint")}
            </p>
          )}
          {purchasePending && (
            <div className="survivor-recovery" role="status" aria-live="polite">
              <div>
                <strong>{t("transactionRecoveryTitle")}</strong>
                <span>{recoveryNotice || t("transactionRecoveryPending")}</span>
                {pendingTransactionId && (
                  <small>{t("transactionIdLabel")}: {shortValue(pendingTransactionId)}</small>
                )}
              </div>
              <button
                type="button"
                className="mx2-btn mx2-btn--ghost"
                onClick={() => void dispatch("recoverTransaction")}
                disabled={isLoading || isConnectingWallet}
              >
                <RotateCcw size={15} aria-hidden="true" />
                {t("recoverTransaction")}
              </button>
              {pendingOperationKind && <small>{t(`pendingOperation${pendingOperationKind[0]?.toUpperCase()}${pendingOperationKind.slice(1)}`)}</small>}
            </div>
          )}
        </section>

        <section className="survivor-drawer__actions" aria-label={t("moreActions")}>
          <button
            type="button"
            className="mx2-btn mx2-btn--ghost"
            onClick={() => void dispatch("refreshRound")}
            disabled={isLoading || isConnectingWallet}
          >
            <RefreshCw size={16} aria-hidden="true" />
            {t("refreshRound")}
          </button>
          {!isGuest && prepaidCredit > 0 && creditAvailable && !purchasePending && (
            <button
              type="button"
              className="mx2-btn mx2-btn--ghost"
              onClick={() => void dispatch("withdrawCredit")}
              disabled={withdrawalBusy}
            >
              <WalletCards size={16} aria-hidden="true" />
              {t("withdrawCredit")}
            </button>
          )}
        </section>

        <section className="survivor-drawer__panel">
          <div className="survivor-drawer__panel-head">
            <Coins size={16} aria-hidden="true" />
            <h4>{t("keyChamber")}</h4>
          </div>
          <div className="survivor-economy">
            <span>{t("keyCapsules")}</span>
            <strong>{keyCount}</strong>
            <small>{isGuest ? t("guestNextCost") : t("nextCost", { amount: estimatedCost })}</small>
            {!isGuest && (
              <small>{t("fundingBreakdown", {
                wallet: walletBalanceAvailable ? gasLabel(walletGasBalance) : t("notAvailable"),
                credit: creditAvailable ? gasLabel(prepaidCredit) : t("notAvailable"),
              })}</small>
            )}
          </div>
          <p>{isGuest ? t("guestNonRefundable") : t("nonRefundableNote")}</p>
          <p>{isGuest ? t("guestShareHint") : t("shareHint")}</p>
        </section>

        <section className="survivor-drawer__panel">
          <div className="survivor-drawer__panel-head">
            <History size={16} aria-hidden="true" />
            <h4>{t("recentHistory")}</h4>
          </div>
          <div className="survivor-history" role="list">
            {!historyAvailable && !isGuest ? (
              <p className="survivor-drawer__empty">{t("historyUnavailable")}</p>
            ) : history.length > 0 ? (
              history.slice(0, 6).map((item) => (
                <div key={item.id} role="listitem">
                  <strong>{item.title}</strong>
                  <span>{item.details}</span>
                </div>
              ))
            ) : (
              <p className="survivor-drawer__empty">{t("noHistory")}</p>
            )}
          </div>
        </section>

        <section className="survivor-drawer__panel survivor-drawer__panel--guide">
          <div className="survivor-drawer__panel-head">
            <ShieldCheck size={16} aria-hidden="true" />
            <h4>{t("rulesTitle")}</h4>
          </div>
          <ul className="survivor-rules">
            <li>
              <strong>{isGuest ? t("guestRuleDeposit") : t("ruleDeposit")}</strong>
              <span>{isGuest ? t("guestRuleDepositDesc") : t("ruleDepositDesc")}</span>
            </li>
            <li>
              <strong>{t("ruleTimer")}</strong>
              <span>{isGuest ? t("guestRuleTimerDesc") : t("ruleTimerDesc")}</span>
            </li>
            <li>
              <strong>{isGuest ? t("guestRuleWinTitle") : t("ruleWin")}</strong>
              <span>{isGuest ? t("guestRuleWinDesc") : t("ruleWinDesc")}</span>
            </li>
          </ul>
          {viewerAddress && (
            <p className="survivor-drawer__wallet">{t("playerMarker")}: {shortValue(viewerAddress)}</p>
          )}
        </section>
      </div>
    </div>
  );

  return (
    <div className="survivor-play-area mx2 mx2-cat-game" aria-busy={busy}>
      <PlayStage
        category="game"
        className="survivor-playstage"
        stage={{
          eyebrow:  t("appEyebrow"),
          title:    isGuest
            ? t("guestStageTitle")
            : needsLifecycleSync
              ? t("inactiveRound")
              : isRoundActive ? t("roundActive") : t("waitingForRound"),
          subtitle: isGuest ? t("guestStageSubtitle") : t("appSubtitle"),
          badges: (
            <span className="mx2-badge" data-tone="accent">
              <span className="mx2-badge__dot" /> {isGuest ? t("guestBadge") : "Neo"}
            </span>
          ),
        }}
        scene={
          <div className="survivor-stage-shell">
            <PhaserGameComponent
              config={GAME_CONFIG}
              loadScene={loadLastSurvivorScene}
              state={bridgeState}
              dispatch={dispatch}
              className="survivor-phaser-canvas"
              ariaLabel={t("arenaCanvasAria")}
              loadingLabel={t("arenaCanvasLoading")}
            />

            <div className="survivor-a11y-controls" aria-label={t("a11yArenaControls")}>
              <span id="last-survivor-pack-label">{t("choosePackLabel")}</span>
              <div role="radiogroup" aria-labelledby="last-survivor-pack-label">
                {[1, 3, 5, 10].map((count) => (
                  <button
                    key={count}
                    type="button"
                    role="radio"
                    aria-checked={selectedCount === count}
                    disabled={!transactionGate.presetsEnabled}
                    onClick={() => void dispatch("setKeyCount", String(count))}
                  >
                    {count} {count === 1 ? t("keyUnitOne") : t("keyUnitMany")}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="survivor-a11y-controls__primary"
                disabled={!transactionGate.primaryEnabled}
                aria-describedby="last-survivor-control-status"
                onClick={() => {
                  if (transactionGate.primaryAction === "connect") void dispatch("connectWallet");
                  if (transactionGate.primaryAction === "buy") void dispatch("buyKeys", String(selectedCount));
                }}
              >
                {primaryControlLabel}
              </button>
              {needsLifecycleSync && (
                <button
                  type="button"
                  disabled={!transactionGate.settleEnabled}
                  onClick={() => void dispatch("settleRound")}
                >
                  {isGuest ? guestFinishAction : t("settleRound")}
                </button>
              )}
              <button
                type="button"
                disabled={isLoading || isConnectingWallet}
                onClick={() => void dispatch("refreshRound")}
              >
                {t("refreshRound")}
              </button>
              <p id="last-survivor-control-status" role="status" aria-live="polite">
                {controlStatus}
              </p>
            </div>

            <div className="survivor-stage-hud" aria-label={drawerTitle}>
              {scoreItems.map((item) => (
                <div
                  className="survivor-stage-hud__metric"
                  data-accent={item.accent ? "true" : undefined}
                  key={`${item.label}-${item.value}`}
                >
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
              ))}
              <button
                ref={drawerToggleRef}
                type="button"
                className="survivor-stage-hud__drawer"
                onClick={() => drawerOpen ? closeDrawer() : setDrawerOpen(true)}
                aria-expanded={drawerOpen}
                aria-controls={drawerId}
              >
                <span>{drawerTitle}</span>
                <ChevronDown size={15} data-open={drawerOpen ? "true" : undefined} aria-hidden="true" />
              </button>
            </div>

            {drawerOpen && (
              <section
                id={drawerId}
                className="survivor-ingame-drawer"
                role="dialog"
                aria-modal="false"
                aria-labelledby={`${drawerId}-title`}
              >
                <div className="survivor-ingame-drawer__head">
                  <h3 id={`${drawerId}-title`}>{drawerTitle}</h3>
                  <button
                    ref={drawerCloseRef}
                    type="button"
                    onClick={closeDrawer}
                    aria-label={t("closeDrawer")}
                  >
                    <X size={18} aria-hidden="true" />
                  </button>
                </div>
                {drawerContent}
              </section>
            )}
          </div>
        }
        actions={{}}
      />
    </div>
  );
}
