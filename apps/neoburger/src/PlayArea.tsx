/**
 * PlayArea.tsx -- NeoBurger
 *
 * React version of the NeoBurger play area with hero, stats,
 * station panel, and swap interface.
 */

import { useState } from "react";
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
  const { str, bool, val } = useStateBindings(state);

  const neoBalance = val<number>("neoBalance", 0);
  const bNeoBalance = val<number>("bNeoBalance", 0);
  const walletConnected = bool("walletConnected");
  const totalStakedDisplay = str("totalStakedDisplay");
  const totalStakedUsdText = str("totalStakedUsdText");
  const aprDisplay = str("aprDisplay");
  const loading = bool("loading");
  const swapMode = str("swapMode", "stake");
  const swapAmount = str("swapAmount");
  const swapOutput = str("swapOutput");
  const swapUsdText = str("swapUsdText");
  const swapCanSubmit = bool("swapCanSubmit");

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

      <StatsPanel t={t} onSwitchToJazz={() => setHomeMode("jazz")} onOpenLink={openExternal} />

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
    </div>
  );
}
