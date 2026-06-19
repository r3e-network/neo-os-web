import { useState } from "react";
import { NeoButton, NeoCard } from "@shared/components-react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import { formatNumber } from "@shared/utils/format";
import type { Observable } from "@shared/react/context";
import type { HistoryEvent } from "./composables/useLastSurvivor";
import DangerRingHero from "./components/DangerRingHero";
import DangerMeter from "./components/DangerMeter";
import BuyKeysCard from "./pages/index/components/BuyKeysCard";
import HistoryList from "./pages/index/components/HistoryList";
import "./PlayArea.scss";

interface PlayAreaProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Observable>;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
}

export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { str, bool, num, val } = useStateBindings(state);

  // Round info
  const formattedRound = str("formattedRound", "#0");
  const roundStatusDisplay = str("roundStatusDisplay", "---");
  const isRoundActive = bool("isRoundActive");

  // Prize pool — rendered once inside the hero ring
  const totalPot = num("totalPot");

  // Timer / danger
  const countdown = str("countdown", "00:00:00");
  const dangerLevel = str("dangerLevel", "low");
  const dangerLevelText = str("dangerLevelText");
  const dangerProgress = num("dangerProgress");
  const shouldPulse = bool("shouldPulse");

  // Leader
  const lastBuyer = str("lastBuyer");
  const lastBuyerLabel = str("lastBuyerLabel", "---");

  // Connected wallet (when present) — used to celebrate the viewer's own win in
  // the settle/payout card. Absent in the standalone (no-wallet) capture.
  const viewerAddress = str("viewerAddress");

  // User participation
  const userKeys = num("userKeys");
  // Round total keys SOLD (chain state) and the user's share of them. These
  // are distinct from the buy-selector `keyCount` picker (used only for the
  // estimated-cost calculation inside BuyKeysCard).
  const totalKeys = num("totalKeysDisplay");
  const userSharePercent = num("userSharePercent");

  // Buy keys
  const estimatedCost = str("estimatedCost", "0.00");
  const keyValidationError = val<string>("keyValidationError");
  const isBuyingKeys = bool("isBuyingKeys");
  const roundDataAvailable = bool("roundDataAvailable");
  const serviceNotice = str("serviceNotice");

  // The round has ended on-chain and needs a permissionless settle() to pay the
  // last buyer and roll forward before a new round can be bought.
  const needsLifecycleSync = bool("needsLifecycleSync");
  const isSettling = bool("isSettling");

  // Unused prepaid buy-credit (a deposit that landed but whose buy didn't
  // complete) — withdrawable via the recovery row.
  const prepaidCredit = num("prepaidCredit");

  // Loading
  const isLoading = bool("isLoading");

  // History
  const history = val<HistoryEvent[]>("history") ?? [];

  const [localKeyCount, setLocalKeyCount] = useState("1");
  const formatNum = (n: number) => formatNumber(n, 2);
  // A fresh round is active on-chain but has no keys sold yet, so it reports
  // remainingTime 0 — the danger ring/meter must NOT render a pulsing red
  // CRITICAL 00:00:00 for it. Reserve the live danger styling for a round that
  // has at least one key (a real running clock); a fresh round shows the calm
  // accent + an "awaiting the first key" caption instead.
  const liveDanger = isRoundActive && roundDataAvailable && totalKeys > 0;
  const awaitingFirstKey = isRoundActive && roundDataAvailable && totalKeys <= 0;
  // Buys are only valid on a live round. An ended round (needsLifecycleSync) is
  // blocked by the contract ("round ended; settle first"), so the affordance is
  // Settle, not Buy.
  const canBuyKeys =
    roundDataAvailable && isRoundActive && !needsLifecycleSync;
  const showBuyKeysPanel =
    isRoundActive ||
    needsLifecycleSync ||
    roundDataAvailable ||
    Boolean(serviceNotice);
  const buyKeysHelper = !roundDataAvailable
    ? // When the service-notice card is already showing its own "Refresh Round"
      // entry point, the helper points back to it instead of repeating the
      // full "refresh before buying" instruction a second time.
      serviceNotice
      ? t("roundStateNoticeRef")
      : t("roundStateRequired")
    : needsLifecycleSync
      ? t("settleBeforeBuy")
      : t("keyPrice");
  const buyKeysLabel = t("buyKeys");

  const formatBuyerAddress = (addr: string) => {
    if (!addr || addr.length < 10) return addr || "---";
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  // The settling round pays the recorded last buyer the entire pot. When the
  // connected wallet IS that last buyer, the settle card becomes a personal
  // "You won the pot!" celebration instead of a neutral leader readout.
  const viewerIsWinner =
    Boolean(viewerAddress) &&
    Boolean(lastBuyer) &&
    viewerAddress.toLowerCase() === lastBuyer.toLowerCase();

  const handleKeyCountChange = (value: string) => {
    setLocalKeyCount(value);
    // Keep the composable's keyCount in sync so the Estimated Cost derive
    // reflects the count the user is actually editing (not the 1-key price).
    void dispatch("setKeyCount", value);
  };

  const handleBuyKeys = async () => {
    await dispatch("buyKeys", localKeyCount);
    setLocalKeyCount("1");
    void dispatch("setKeyCount", "1");
  };

  const handleRefreshRound = async () => {
    await dispatch("refreshRound");
  };

  const handleSettleRound = async () => {
    await dispatch("settleRound");
  };

  return (
    <div className="survivor-play-area">
      {serviceNotice && (
        <div className="survivor-service-notice" role="status">
          <div className="survivor-service-notice__copy">
            <span className="survivor-service-notice__title">
              {t("roundStateUnavailableTitle")}
            </span>
            <span>{serviceNotice}</span>
          </div>
          <NeoButton
            size="sm"
            variant="secondary"
            loading={isLoading}
            onClick={handleRefreshRound}
            aria-label={t("refreshRound")}
          >
            {t("refreshRound")}
          </NeoButton>
        </div>
      )}

      {/* Hero: round headline + countdown ring + pot + danger meter.
          Round # and live Status fold into the heading as inline facts. */}
      <div className="hero-container">
        <div className="hero-heading">
          <span className="hero-badge" aria-hidden="true">&#9201;</span>
          <div className="hero-heading-copy">
            <span className="hero-eyebrow">{t("roundStatus")}</span>
            <span className="hero-facts">
              <span className="hero-fact-round">{formattedRound}</span>
              <span className="hero-fact-sep" aria-hidden="true">&middot;</span>
              <span className={`hero-fact-status status-${isRoundActive ? "active" : "ended"}`}>
                <span className="status-dot" aria-hidden="true" />
                {roundStatusDisplay}
              </span>
            </span>
          </div>
        </div>
        <DangerRingHero
          t={t}
          countdown={countdown}
          dangerLevel={dangerLevel}
          shouldPulse={shouldPulse}
          formattedPot={formatNum(totalPot)}
          active={liveDanger}
          awaitingFirstKey={awaitingFirstKey}
        />
        <DangerMeter
          t={t}
          level={dangerLevel}
          levelText={dangerLevelText}
          progress={dangerProgress}
          active={liveDanger}
        />
      </div>

      {/* Last buyer / current leader badge */}
      {lastBuyer && isRoundActive && (
        <div className="last-buyer-badge">
          <span className="last-buyer-icon" aria-hidden="true">★</span>
          <div className="last-buyer-info">
            <span className="last-buyer-label">{t("currentLeader")}</span>
            <span className="last-buyer-address">{formatBuyerAddress(lastBuyer)}</span>
          </div>
          <span className="last-buyer-hint">{t("winsIfZero")}</span>
        </div>
      )}

      {/* Primary action — Buy Keys, surfaced right after the hero */}
      {showBuyKeysPanel && (
        <NeoCard variant="erobo" className="buy-keys-card">
          <BuyKeysCard
            keyCount={localKeyCount}
            estimatedCost={estimatedCost}
            isPaying={isBuyingKeys}
            disabled={!canBuyKeys}
            validationError={keyValidationError}
            helperText={buyKeysHelper}
            submitLabel={buyKeysLabel}
            t={t}
            onKeyCountChange={handleKeyCountChange}
            onBuy={handleBuyKeys}
          />
        </NeoCard>
      )}

      {/* Round-control prompt — suppressed when the service notice is already
          showing its own "Refresh Round" entry point, so the first paint
          surfaces a single refresh affordance instead of two duplicate ones. */}
      {!isRoundActive && !needsLifecycleSync && !serviceNotice && (
        <NeoCard variant="erobo" className="round-control-card">
          <div className="round-control-card__body">
            <div className="round-control-card__copy">
              <span className="round-control-card__title">
                {t("inactiveRound")}
              </span>
              <span className="round-control-card__text">
                {t("refreshRoundHint")}
              </span>
            </div>
            <NeoButton
              size="sm"
              variant="secondary"
              loading={isLoading}
              onClick={handleRefreshRound}
              aria-label={t("refreshRound")}
            >
              {t("refreshRound")}
            </NeoButton>
          </div>
        </NeoCard>
      )}

      {/* Round ended on-chain — the payout reveal is the hero moment. Show the
          winner + the exact GAS prize prominently, then anyone can settle() to
          pay the last buyer the entire pot atomically and open the next round
          (permissionless). */}
      {needsLifecycleSync && (
        <NeoCard variant="erobo" className="claim-card">
          <div className={`claim-card-inner${viewerIsWinner ? " is-winner" : ""}`}>
            <span className="claim-card-trophy" aria-hidden="true">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M6 4h12v3a6 6 0 0 1-12 0V4Z"
                  fill="currentColor"
                />
                <path
                  d="M6 5H3.5v1.5A3.5 3.5 0 0 0 7 10M18 5h2.5v1.5A3.5 3.5 0 0 1 17 10"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
                <path
                  d="M12 13v3m-3 4h6m-5 0a3 3 0 0 1 4 0"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <span className="claim-card-eyebrow">
              {viewerIsWinner ? t("youWon") : t("winnerDeclared")}
            </span>
            <div className="claim-payout">
              <span className="claim-payout-amount">{formatNum(totalPot)}</span>
              <span className="claim-payout-token">{t("tokenGas")}</span>
            </div>
            {lastBuyer && (
              <span className="claim-winner-address" title={lastBuyer}>
                {viewerIsWinner ? t("youWonPayout") : formatBuyerAddress(lastBuyer)}
              </span>
            )}
            <span className="claim-card-text">
              {viewerIsWinner ? t("settleToClaim") : t("settleRoundHint")}
            </span>
            <NeoButton
              variant="primary"
              size="lg"
              block
              loading={isSettling}
              disabled={isSettling}
              onClick={handleSettleRound}
              aria-label={t("settleRound")}
            >
              {isSettling ? t("settlingRound") : t("settleRound")}
            </NeoButton>
          </div>
        </NeoCard>
      )}

      {/* Recovery — unused prepaid buy-credit from a deposit whose buy didn't
          complete. The contract reuses it on the next buy, or the player can
          withdraw it back to the wallet here (money-in needs money-out). */}
      {prepaidCredit > 0 && (
        <NeoCard variant="erobo" className="survivor-recovery-card">
          <div className="survivor-recovery-card__body">
            <div className="survivor-recovery-card__copy">
              <span className="survivor-recovery-card__title">
                {t("prepaidCreditLabel")} · {formatNum(prepaidCredit)} {t("tokenGas")}
              </span>
              <span className="survivor-recovery-card__text">{t("prepaidCreditHint")}</span>
            </div>
            <NeoButton
              size="sm"
              variant="secondary"
              loading={isLoading}
              disabled={isLoading}
              onClick={() => dispatch("withdrawCredit")}
              aria-label={t("withdrawCredit")}
            >
              {t("withdrawCredit")}
            </NeoButton>
          </div>
        </NeoCard>
      )}

      {/* Your participation — single compact metrics strip */}
      <div className="participation-bar">
        <div className="participation-item">
          <span className="participation-icon" aria-hidden="true">⚷</span>
          <div className="participation-detail">
            <span className="participation-label">{t("yourKeys")}</span>
            <span className="participation-value">{userKeys}</span>
          </div>
        </div>
        <div className="participation-divider" />
        <div className="participation-item">
          <span className="participation-icon" aria-hidden="true">∑</span>
          <div className="participation-detail">
            <span className="participation-label">{t("totalKeys")}</span>
            <span className="participation-value">{totalKeys}</span>
          </div>
        </div>
        <div className="participation-divider" />
        <div className="participation-item" title={t("shareHint")}>
          <span className="participation-icon" aria-hidden="true">%</span>
          <div className="participation-detail">
            <span className="participation-label">{t("share")}</span>
            <span className="participation-value">
              {totalKeys > 0 ? `${userSharePercent.toFixed(1)}%` : "—"}
            </span>
          </div>
        </div>
      </div>
      <p className="participation-share-hint">{t("shareHint")}</p>

      {/* Game rules — collapsed tutorial, out of the primary flow */}
      <details className="rules-card">
        <summary className="rules-summary">
          <span className="rules-title">{t("howItWorks")}</span>
          <span className="rules-chevron" aria-hidden="true" />
        </summary>
        <div className="rules-grid">
          <div className="rule-item">
            <span className="rule-number">1</span>
            <div className="rule-text">
              <strong>{t("ruleDeposit")}</strong>
              <span>{t("ruleDepositDesc")}</span>
            </div>
          </div>
          <div className="rule-item">
            <span className="rule-number">2</span>
            <div className="rule-text">
              <strong>{t("ruleTimer")}</strong>
              <span>{t("ruleTimerDesc")}</span>
            </div>
          </div>
          <div className="rule-item">
            <span className="rule-number">3</span>
            <div className="rule-text">
              <strong>{t("ruleWin")}</strong>
              <span>{t("ruleWinDesc")}</span>
            </div>
          </div>
        </div>
      </details>

      {/* Recent winners / history section */}
      <div className="history-section">
        <div className="history-section-header">
          <span className="history-section-icon" aria-hidden="true">↺</span>
          <span className="history-section-title">{t("recentHistory")}</span>
        </div>
        <HistoryList history={history} t={t} />
      </div>
    </div>
  );
}
