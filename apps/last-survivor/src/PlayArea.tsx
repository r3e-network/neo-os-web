import { useState } from "react";
import { NeoCard } from "@shared/components-react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import { formatNumber } from "@shared/utils/format";
import type { Observable } from "@shared/react/context";
import DangerRingHero from "./components/DangerRingHero";
import DangerMeter from "./components/DangerMeter";
import BuyKeysCard from "./pages/index/components/BuyKeysCard";
import "./PlayArea.scss";

interface PlayAreaProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Observable>;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
}

export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { str, bool, num, val } = useStateBindings(state);
  const totalPot = num("totalPot");
  const canClaim = bool("canClaim");
  const isClaiming = bool("isClaiming");
  const isBuyingKeys = bool("isBuyingKeys");
  const isRoundActive = bool("isRoundActive");
  const countdown = str("countdown", "00:00:00");
  const dangerLevel = str("dangerLevel", "low");
  const dangerLevelText = str("dangerLevelText");
  const dangerProgress = num("dangerProgress");
  const shouldPulse = bool("shouldPulse");
  const estimatedCost = str("estimatedCost", "0.00");
  const keyValidationError = val<string>("keyValidationError");
  const lastBuyer = str("lastBuyer");

  const formatBuyerAddress = (addr: string) => {
    if (!addr || addr.length < 10) return addr || "---";
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const [localKeyCount, setLocalKeyCount] = useState("1");
  const formatNum = (n: number) => formatNumber(n, 2);

  const handleBuyKeys = async () => {
    await dispatch("buyKeys", localKeyCount);
    setLocalKeyCount("1");
  };

  const handleClaimPrize = async () => {
    await dispatch("claimPrize");
  };

  return (
    <div className="survivor-play-area">
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

      {lastBuyer && isRoundActive && (
        <div className="last-buyer-badge">
          <span className="last-buyer-icon" aria-hidden="true">&#x1F451;</span>
          <div className="last-buyer-info">
            <span className="last-buyer-label">{t("lastBuyer") || "CURRENT LEADER"}</span>
            <span className="last-buyer-address">{formatBuyerAddress(lastBuyer)}</span>
          </div>
          <span className="last-buyer-hint">{t("timeUntilEvent")}</span>
        </div>
      )}

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
    </div>
  );
}
