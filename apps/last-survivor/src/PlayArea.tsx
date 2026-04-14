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

  // Prize pool
  const totalPot = num("totalPot");
  const totalPotDisplay = str("totalPotDisplay", "0.00 GAS");

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

  // Claim
  const canClaim = bool("canClaim");
  const isClaiming = bool("isClaiming");

  // Loading
  const isLoading = bool("isLoading");

  // History
  const history = val<HistoryEvent[]>("history") ?? [];

  const [localKeyCount, setLocalKeyCount] = useState("1");
  const formatNum = (n: number) => formatNumber(n, 2);

  const formatBuyerAddress = (addr: string) => {
    if (!addr || addr.length < 10) return addr || "---";
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const handleBuyKeys = async () => {
    await dispatch("buyKeys", localKeyCount);
    setLocalKeyCount("1");
  };

  const handleClaimPrize = async () => {
    await dispatch("claimPrize");
  };

  return (
    <div className="survivor-play-area">
      {/* Round info bar */}
      <div className="round-info-bar">
        <div className="round-info-item">
          <span className="round-info-label">{t("round") || "ROUND"}</span>
          <span className="round-info-value">{formattedRound}</span>
        </div>
        <div className="round-info-divider" />
        <div className="round-info-item">
          <span className="round-info-label">{t("status") || "STATUS"}</span>
          <span className={`round-info-value status-${isRoundActive ? "active" : "ended"}`}>
            {roundStatusDisplay}
          </span>
        </div>
        <div className="round-info-divider" />
        <div className="round-info-item">
          <span className="round-info-label">{t("totalPot") || "PRIZE POOL"}</span>
          <span className="round-info-value pot-value">{totalPotDisplay}</span>
        </div>
      </div>

      {/* Hero: countdown ring + danger meter */}
      <div className="hero-container">
        <DangerRingHero
          t={t}
          countdown={countdown}
          dangerLevel={dangerLevel}
          shouldPulse={shouldPulse}
          formattedPot={formatNum(totalPot)}
          canClaim={canClaim}
          isClaiming={isClaiming}
          onClaim={handleClaimPrize}
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
          <span className="last-buyer-icon" aria-hidden="true">&#x1F451;</span>
          <div className="last-buyer-info">
            <span className="last-buyer-label">{t("lastBuyer") || "CURRENT LEADER"}</span>
            <span className="last-buyer-address">{formatBuyerAddress(lastBuyer)}</span>
          </div>
          <span className="last-buyer-hint">{t("timeUntilEvent") || "Wins if timer hits zero"}</span>
        </div>
      )}

      {/* User participation stats */}
      <div className="participation-bar">
        <div className="participation-item">
          <span className="participation-icon" aria-hidden="true">&#x1F511;</span>
          <div className="participation-detail">
            <span className="participation-label">{t("yourKeys") || "YOUR KEYS"}</span>
            <span className="participation-value">{userKeys}</span>
          </div>
        </div>
        <div className="participation-divider" />
        <div className="participation-item">
          <span className="participation-icon" aria-hidden="true">&#x1F3DF;</span>
          <div className="participation-detail">
            <span className="participation-label">{t("totalKeys") || "TOTAL KEYS"}</span>
            <span className="participation-value">{keyCount}</span>
          </div>
        </div>
        <div className="participation-divider" />
        <div className="participation-item">
          <span className="participation-icon" aria-hidden="true">&#x1F4CA;</span>
          <div className="participation-detail">
            <span className="participation-label">{t("share") || "YOUR SHARE"}</span>
            <span className="participation-value">
              {keyCount > 0 ? `${((userKeys / keyCount) * 100).toFixed(1)}%` : "0%"}
            </span>
          </div>
        </div>
      </div>

      {/* Buy keys form (only when round is active and not claimable) */}
      {isRoundActive && !canClaim && (
        <NeoCard variant="erobo" className="buy-keys-card">
          <BuyKeysCard
            keyCount={localKeyCount}
            estimatedCost={estimatedCost}
            isPaying={isBuyingKeys}
            validationError={keyValidationError}
            t={t}
            onKeyCountChange={setLocalKeyCount}
            onBuy={handleBuyKeys}
          />
        </NeoCard>
      )}

      {/* Claim button when round ended (standalone, in addition to hero claim) */}
      {canClaim && !isClaiming && (
        <NeoCard variant="erobo" className="claim-card">
          <div className="claim-card-inner">
            <span className="claim-card-trophy" aria-hidden="true">&#x1F3C6;</span>
            <span className="claim-card-text">{t("roundEnded") || "Round ended! The last buyer wins the pot."}</span>
            <NeoButton
              variant="primary"
              size="lg"
              block
              loading={isClaiming}
              onClick={handleClaimPrize}
              aria-label={t("claimPrize") || "Claim Prize"}
            >
              {t("claimPrize") || "Claim Prize"}
            </NeoButton>
          </div>
        </NeoCard>
      )}

      {/* Game rules */}
      <NeoCard className="rules-card">
        <h4 className="rules-title">{t("howItWorks") || "How It Works"}</h4>
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
      </NeoCard>

      {/* Recent winners / history section */}
      <div className="history-section">
        <div className="history-section-header">
          <span className="history-section-icon" aria-hidden="true">&#x1F3C5;</span>
          <span className="history-section-title">{t("recentHistory") || "Recent Rounds"}</span>
        </div>
        <HistoryList history={history} t={t} />
      </div>
    </div>
  );
}
