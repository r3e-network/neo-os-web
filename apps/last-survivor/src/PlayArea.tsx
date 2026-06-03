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

  // User participation
  const userKeys = num("userKeys");
  const keyCount = num("keyCount");

  // Buy keys
  const estimatedCost = str("estimatedCost", "0.00");
  const keyValidationError = val<string>("keyValidationError");
  const isBuyingKeys = bool("isBuyingKeys");
  const roundDataAvailable = bool("roundDataAvailable");
  const serviceNotice = str("serviceNotice");

  const needsLifecycleSync = bool("needsLifecycleSync");

  // Loading
  const isLoading = bool("isLoading");

  // History
  const history = val<HistoryEvent[]>("history") ?? [];

  const [localKeyCount, setLocalKeyCount] = useState("1");
  const formatNum = (n: number) => formatNumber(n, 2);
  const canBuyKeys =
    roundDataAvailable && (isRoundActive || needsLifecycleSync);
  const showBuyKeysPanel =
    isRoundActive ||
    needsLifecycleSync ||
    roundDataAvailable ||
    Boolean(serviceNotice);
  const buyKeysHelper = !roundDataAvailable
    ? t("roundStateRequired")
    : needsLifecycleSync
      ? t("buyKeysRolloverHint")
      : t("keyPrice");
  const buyKeysLabel = needsLifecycleSync
    ? t("buyKeysAndRollover")
    : t("buyKeys");

  const formatBuyerAddress = (addr: string) => {
    if (!addr || addr.length < 10) return addr || "---";
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const handleBuyKeys = async () => {
    await dispatch("buyKeys", localKeyCount);
    setLocalKeyCount("1");
  };

  const handleRefreshRound = async () => {
    await dispatch("refreshRound");
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
            <span className="hero-eyebrow">{t("roundStatus") || "Round Status"}</span>
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
        />
        <DangerMeter
          t={t}
          level={dangerLevel}
          levelText={dangerLevelText}
          progress={dangerProgress}
        />
      </div>

      {/* Last buyer / current leader badge */}
      {lastBuyer && isRoundActive && (
        <div className="last-buyer-badge">
          <span className="last-buyer-icon" aria-hidden="true">★</span>
          <div className="last-buyer-info">
            <span className="last-buyer-label">{t("lastBuyer") || "CURRENT LEADER"}</span>
            <span className="last-buyer-address">{formatBuyerAddress(lastBuyer)}</span>
          </div>
          <span className="last-buyer-hint">{t("timeUntilEvent") || "Wins if timer hits zero"}</span>
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
            onKeyCountChange={setLocalKeyCount}
            onBuy={handleBuyKeys}
          />
        </NeoCard>
      )}

      {!isRoundActive && (
        <NeoCard variant="erobo" className="round-control-card">
          <div className="round-control-card__body">
            <div className="round-control-card__copy">
              <span className="round-control-card__title">
                {needsLifecycleSync
                  ? (t("roundEnded") || "Round needs settlement")
                  : (t("inactiveRound") || "Rollover ready")}
              </span>
              <span className="round-control-card__text">
                {needsLifecycleSync
                  ? (t("lifecycleManaged") || "The lifecycle keeper will settle the expired round.")
                  : (t("refreshRoundHint") || "Refresh the game state before buying keys.")}
              </span>
            </div>
            <NeoButton
              size="sm"
              variant="secondary"
              loading={isLoading}
              onClick={handleRefreshRound}
              aria-label={t("refreshRound") || "Refresh round"}
            >
              {t("refreshRound") || "Refresh Round"}
            </NeoButton>
          </div>
        </NeoCard>
      )}

      {/* Expired rounds are maintained by the lifecycle keeper. */}
      {needsLifecycleSync && (
        <NeoCard variant="erobo" className="claim-card">
          <div className="claim-card-inner">
            <span className="claim-card-trophy" aria-hidden="true">★</span>
            <span className="claim-card-text">{t("roundEnded") || "Timer expired. The lifecycle keeper will settle and open the next round automatically."}</span>
            <span className="claim-card-text">{t("lifecycleManaged")}</span>
          </div>
        </NeoCard>
      )}

      {/* Your participation — single compact metrics strip */}
      <div className="participation-bar">
        <div className="participation-item">
          <span className="participation-icon" aria-hidden="true">⚷</span>
          <div className="participation-detail">
            <span className="participation-label">{t("yourKeys") || "YOUR KEYS"}</span>
            <span className="participation-value">{userKeys}</span>
          </div>
        </div>
        <div className="participation-divider" />
        <div className="participation-item">
          <span className="participation-icon" aria-hidden="true">∑</span>
          <div className="participation-detail">
            <span className="participation-label">{t("totalKeys") || "TOTAL KEYS"}</span>
            <span className="participation-value">{keyCount}</span>
          </div>
        </div>
        <div className="participation-divider" />
        <div className="participation-item">
          <span className="participation-icon" aria-hidden="true">%</span>
          <div className="participation-detail">
            <span className="participation-label">{t("share") || "YOUR SHARE"}</span>
            <span className="participation-value">
              {keyCount > 0 ? `${((userKeys / keyCount) * 100).toFixed(1)}%` : "—"}
            </span>
          </div>
        </div>
      </div>

      {/* Game rules — collapsed tutorial, out of the primary flow */}
      <details className="rules-card">
        <summary className="rules-summary">
          <span className="rules-title">{t("howItWorks") || "How It Works"}</span>
          <span className="rules-chevron" aria-hidden="true" />
        </summary>
        <div className="rules-grid">
          <div className="rule-item">
            <span className="rule-number">1</span>
            <div className="rule-text">
              <strong>{t("ruleDeposit") || "Deposit 1 GAS"}</strong>
              <span>{t("ruleDepositDesc") || "Each deposit resets the countdown timer. Initial prize pool is 5 GAS."}</span>
            </div>
          </div>
          <div className="rule-item">
            <span className="rule-number">2</span>
            <div className="rule-text">
              <strong>{t("ruleTimer") || "Timer Decreases"}</strong>
              <span>{t("ruleTimerDesc") || "First bid adds 60 min. Each subsequent bid adds slightly less time (59 min, 58 min, ...) down to 1 min, then resets to 10 min."}</span>
            </div>
          </div>
          <div className="rule-item">
            <span className="rule-number">3</span>
            <div className="rule-text">
              <strong>{t("ruleWin") || "Last Bidder Wins"}</strong>
              <span>{t("ruleWinDesc") || "When the timer hits zero, the last person who deposited wins the entire prize pool minus a 20% platform fee."}</span>
            </div>
          </div>
        </div>
      </details>

      {/* Recent winners / history section */}
      <div className="history-section">
        <div className="history-section-header">
          <span className="history-section-icon" aria-hidden="true">↺</span>
          <span className="history-section-title">{t("recentHistory") || "Recent Rounds"}</span>
        </div>
        <HistoryList history={history} t={t} />
      </div>
    </div>
  );
}
