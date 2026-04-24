/**
 * PlayArea.tsx -- Burn League
 *
 * Full UI: hero stats, rank display, burn input, leaderboard preview.
 */

import { useState } from "react";
import { NeoButton, NeoCard, NeoInput } from "@shared/components-react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import "./PlayArea.scss";

interface PlayAreaProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Observable>;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
}

interface LeaderboardEntry {
  address: string;
  burned: number;
  rank: number;
}

export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { str, bool, num, val } = useStateBindings(state);

  const isLoading = bool("isLoading");
  const isBurning = bool("isBurning");
  const totalBurnedDisplay = str("totalBurnedDisplay", "0");
  const userBurnedDisplay = str("userBurnedDisplay", "0");
  const rewardPoolDisplay = str("rewardPoolDisplay", "0");
  const formattedRank = str("formattedRank", "--");
  const leaderboardSize = num("leaderboardSize");
  const estimatedReward = str("estimatedReward", "0");
  const burnAmount = str("burnAmount", "");
  const leaderboardPreview = val<LeaderboardEntry[]>("leaderboardPreview") ?? [];

  const [localBurnAmount, setLocalBurnAmount] = useState("");

  const handleBurnAmountChange = (value: string) => {
    setLocalBurnAmount(value);
    dispatch("setBurnAmount", value);
  };

  const handleBurn = async () => {
    await dispatch("burn", localBurnAmount || burnAmount);
    setLocalBurnAmount("");
  };

  const truncateAddress = (addr: string) => {
    if (!addr || addr.length < 12) return addr;
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  if (isLoading) {
    return (
      <div className="burn-league-play-area">
        <div className="burn-league-loading">
          <div className="burn-league-loading-spinner" />
          <span>{t("loading") || "Loading..."}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="burn-league-play-area">
      {/* Hero Stats */}
      <div className="burn-league-hero-stats">
        <div className="burn-league-hero-stat">
          <span className="burn-league-hero-stat-value">{totalBurnedDisplay}</span>
          <span className="burn-league-hero-stat-label">{t("totalBurned")}</span>
        </div>
        <div className="burn-league-hero-stat">
          <span className="burn-league-hero-stat-value">{userBurnedDisplay}</span>
          <span className="burn-league-hero-stat-label">{t("yourBurns")}</span>
        </div>
        <div className="burn-league-hero-stat">
          <span className="burn-league-hero-stat-value">{rewardPoolDisplay}</span>
          <span className="burn-league-hero-stat-label">{t("rewardPool")}</span>
        </div>
      </div>

      {/* Rank Display */}
      <NeoCard variant="erobo" className="burn-league-rank-card">
        <div className="burn-league-rank-display">
          <div className="burn-league-rank-number">
            <span className="burn-league-rank-hash">#</span>
            <span className="burn-league-rank-value">{formattedRank}</span>
          </div>
          <div className="burn-league-rank-meta">
            <span className="burn-league-rank-title">{t("yourRank")}</span>
            <span className="burn-league-rank-subtitle">
              {t("outOf", { total: leaderboardSize })}
            </span>
          </div>
          <div className="burn-league-estimated-reward">
            <span className="burn-league-reward-label">{t("estimatedReward")}</span>
            <span className="burn-league-reward-value">{estimatedReward}</span>
          </div>
        </div>
      </NeoCard>

      {/* Burn Action */}
      <NeoCard variant="erobo" className="burn-league-action-card">
        <h3 className="burn-league-section-title">{t("burnTokens")}</h3>
        <div className="burn-league-burn-form">
          <NeoInput
            type="number"
            value={localBurnAmount || burnAmount}
            placeholder={t("enterAmount")}
            label={t("amount")}
            suffix="GAS"
            min={0}
            onChange={handleBurnAmountChange}
          />
          <NeoButton
            variant="danger"
            size="lg"
            block
            loading={isBurning}
            disabled={isBurning || !(localBurnAmount || burnAmount)}
            onClick={handleBurn}
          >
            {t("burn")}
          </NeoButton>
        </div>
      </NeoCard>

      {/* Leaderboard Preview */}
      <NeoCard variant="erobo" className="burn-league-leaderboard-card">
        <h3 className="burn-league-section-title">{t("leaderboard")}</h3>
        {leaderboardPreview.length === 0 ? (
          <div className="burn-league-empty">{t("noEntries")}</div>
        ) : (
          <div className="burn-league-leaderboard-list">
            {leaderboardPreview.map((entry, i) => (
              <div key={entry.address || i} className="burn-league-leaderboard-row">
                <span className="burn-league-lb-rank">#{entry.rank}</span>
                <span className="burn-league-lb-address">{truncateAddress(entry.address)}</span>
                <span className="burn-league-lb-amount">{entry.burned}</span>
              </div>
            ))}
          </div>
        )}
      </NeoCard>
    </div>
  );
}
