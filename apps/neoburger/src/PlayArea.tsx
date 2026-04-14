/**
 * PlayArea.tsx — NeoBurger
 *
 * NEO staking for bNEO with hero stats, swap interface,
 * rewards display, and station panel. Uses all state and actions from main.tsx.
 */

import { useState } from "react";
import { NeoCard, NeoButton } from "@shared/components-react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import HeroSection from "./components/HeroSection";
import HeroConversion from "./components/HeroConversion";
import StatsPanel from "./components/StatsPanel";
import StationPanel from "./components/StationPanel";
import SwapInterface from "./components/SwapInterface";
import "./PlayArea.scss";

interface PlayAreaProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Observable>;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
}

export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { str, bool, num, val } = useStateBindings(state);

  // Core balances
  const neoBalance = val<number>("neoBalance", 0);
  const bNeoBalance = val<number>("bNeoBalance", 0);
  const neoBalanceDisplay = str("neoBalanceDisplay", t("notAvailable") || "N/A");
  const bNeoBalanceDisplay = str("bNeoBalanceDisplay", t("notAvailable") || "N/A");
  const walletConnected = bool("walletConnected");

  // Stats
  const totalStakedDisplay = str("totalStakedDisplay");
  const totalStakedUsdText = str("totalStakedUsdText");
  const aprDisplay = str("aprDisplay");

  // Swap state
  const loading = bool("loading");
  const swapMode = str("swapMode", "stake");
  const swapAmount = str("swapAmount");
  const swapOutput = str("swapOutput");
  const swapUsdText = str("swapUsdText");
  const swapCanSubmit = bool("swapCanSubmit");

  // Rewards
  const dailyRewards = str("dailyRewards");
  const weeklyRewards = str("weeklyRewards");
  const monthlyRewards = str("monthlyRewards");
  const totalRewards = str("totalRewards");
  const totalRewardsUsdText = str("totalRewardsUsdText");

  const [homeMode, setHomeMode] = useState<"burger" | "jazz">("burger");

  const handlePrimaryAction = async () => {
    await dispatch(walletConnected ? "swap" : "connectWallet");
  };

  const handleJazzAction = async () => {
    await dispatch(walletConnected ? "claimRewards" : "connectWallet");
  };

  const openExternal = (url: string) => {
    if (!url) return;
    if (typeof window !== "undefined" && window.open) {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <div className="neoburger-shell">
      {/* Hero */}
      <div className="hero-container">
        <HeroSection
          t={t}
          totalStakedDisplay={totalStakedDisplay}
          totalStakedUsdText={totalStakedUsdText}
          aprDisplay={aprDisplay}
        />
        <HeroConversion
          t={t}
          neoBalance={neoBalance}
          bNeoBalance={bNeoBalance}
        />
      </div>

      {/* Balance Display */}
      {walletConnected && (
        <NeoCard className="balance-card">
          <div className="balance-display">
            <div className="balance-item">
              <span className="balance-label">NEO</span>
              <span className="balance-value">{neoBalanceDisplay}</span>
            </div>
            <div className="balance-divider" />
            <div className="balance-item">
              <span className="balance-label">bNEO</span>
              <span className="balance-value">{bNeoBalanceDisplay}</span>
            </div>
          </div>
        </NeoCard>
      )}

      {/* Stats */}
      <StatsPanel
        t={t}
        onSwitchToJazz={() => setHomeMode("jazz")}
        onOpenLink={openExternal}
      />

      {/* Station / Swap */}
      <StationPanel
        t={t}
        mode={homeMode}
        onSetMode={setHomeMode}
        walletConnected={walletConnected}
        canSubmit={swapCanSubmit}
        loading={loading}
        onPrimaryAction={handlePrimaryAction}
        onJazzAction={handleJazzAction}
        dispatch={dispatch}
      >
        <SwapInterface
          t={t}
          swapMode={swapMode}
          neoBalance={neoBalance}
          bNeoBalance={bNeoBalance}
          swapAmount={swapAmount}
          swapOutput={swapOutput}
          swapUsdText={swapUsdText}
          state={state}
        />
      </StationPanel>

      {/* Rewards Estimator */}
      {walletConnected && (
        <NeoCard className="rewards-card">
          <span className="rewards-title">{t("rewardsEstimator") || "Rewards Estimator"}</span>
          <div className="rewards-grid">
            <div className="reward-item">
              <span className="reward-label">{t("daily") || "Daily"}</span>
              <span className="reward-value">{dailyRewards || "0"}</span>
            </div>
            <div className="reward-item">
              <span className="reward-label">{t("weekly") || "Weekly"}</span>
              <span className="reward-value">{weeklyRewards || "0"}</span>
            </div>
            <div className="reward-item">
              <span className="reward-label">{t("monthly") || "Monthly"}</span>
              <span className="reward-value">{monthlyRewards || "0"}</span>
            </div>
            <div className="reward-item reward-total">
              <span className="reward-label">{t("totalRewards") || "Total Rewards"}</span>
              <span className="reward-value">{totalRewards || "0"}</span>
              {totalRewardsUsdText && (
                <span className="reward-usd">{totalRewardsUsdText}</span>
              )}
            </div>
          </div>
          <NeoButton
            variant="primary"
            loading={loading}
            onClick={handleJazzAction}
          >
            {walletConnected
              ? (t("claimRewards") || "Claim Rewards")
              : (t("connectWallet") || "Connect Wallet")}
          </NeoButton>
        </NeoCard>
      )}

      {/* Connect Wallet CTA (when not connected) */}
      {!walletConnected && (
        <NeoCard className="connect-cta">
          <span className="connect-message">
            {t("connectToStake") || "Connect your wallet to start staking NEO for bNEO."}
          </span>
          <NeoButton
            variant="primary"
            onClick={() => dispatch("connectWallet")}
          >
            {t("connectWallet") || "Connect Wallet"}
          </NeoButton>
        </NeoCard>
      )}
    </div>
  );
}
