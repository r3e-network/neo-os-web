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

  // Loading
  const isLoading = bool("isLoading");

  // History
  const history = val<HistoryEvent[]>("history") ?? [];

  const [localKeyCount, setLocalKeyCount] = useState("1");
  const formatNum = (n: number) => formatNumber(n, 2);
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
    ? t("roundStateRequired")
    : needsLifecycleSync
      ? t("settleBeforeBuy")
      : t("keyPrice");
  const buyKeysLabel = t("buyKeys");

  const formatBuyerAddress = (addr: string) => {
    if (!addr || addr.length < 10) return addr || "---";
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

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
          active={isRoundActive && roundDataAvailable}
        />
        <DangerMeter
          t={t}
          level={dangerLevel}
          levelText={dangerLevelText}
          progress={dangerProgress}
          active={isRoundActive && roundDataAvailable}
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
            onKeyCountChange={handleKeyCountChange}
            onBuy={handleBuyKeys}
          />
        </NeoCard>
      )}

      {!isRoundActive && !needsLifecycleSync && (
        <NeoCard variant="erobo" className="round-control-card">
          <div className="round-control-card__body">
            <div className="round-control-card__copy">
              <span className="round-control-card__title">
                {t("inactiveRound") || "Rollover ready"}
              </span>
              <span className="round-control-card__text">
                {t("refreshRoundHint") || "Refresh the game state before buying keys."}
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

      {/* Round ended on-chain — anyone can settle() to pay the last buyer the
          entire pot atomically and open the next round (permissionless). */}
      {needsLifecycleSync && (
        <NeoCard variant="erobo" className="claim-card">
          <div className="claim-card-inner">
            <span className="claim-card-trophy" aria-hidden="true">★</span>
            <span className="claim-card-text">{t("roundEnded")}</span>
            <span className="claim-card-text">{t("settleRoundHint")}</span>
            <NeoButton
              variant="primary"
              size="lg"
              block
              loading={isSettling}
              disabled={isSettling}
              onClick={handleSettleRound}
              aria-label={t("settleRound") || "Settle Round"}
            >
              {isSettling ? t("settlingRound") : (t("settleRound") || "Settle Round")}
            </NeoButton>
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
            <span className="participation-label">{t("totalKeys")}</span>
            <span className="participation-value">{totalKeys}</span>
          </div>
        </div>
        <div className="participation-divider" />
        <div className="participation-item">
          <span className="participation-icon" aria-hidden="true">%</span>
          <div className="participation-detail">
            <span className="participation-label">{t("share")}</span>
            <span className="participation-value">
              {totalKeys > 0 ? `${userSharePercent.toFixed(1)}%` : "—"}
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
          <span className="history-section-title">{t("recentHistory") || "Recent Rounds"}</span>
        </div>
        <HistoryList history={history} t={t} />
      </div>
    </div>
  );
}
