/**
 * PlayArea.tsx -- Burn League
 *
 * Full UI: hero stats, rank display, burn input, leaderboard preview.
 */

import { useMemo, useState } from "react";
import { NeoButton, NeoCard, NeoInput } from "@shared/components-react";
import { CategoryIcon } from "@shared/components-react/illustrations";
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

const MIN_BURN = 1;
const MAX_BURN = 1000;

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
  const projectedTotalDisplay = str("projectedTotalBurnedDisplay", "--");
  const burnAmount = str("burnAmount", "");
  const serviceNotice = str("serviceNotice");
  const actionNotice = str("actionNotice");
  const burnValidationError = val<string>("burnValidationError");
  const lastSubmittedAmount = str("lastSubmittedAmount");
  const leaderboardPreview = val<LeaderboardEntry[]>("leaderboardPreview") ?? [];
  const hasRank = formattedRank !== "--" && formattedRank !== "";
  const hasLeaderboard = leaderboardPreview.length > 0;

  const [localBurnAmount, setLocalBurnAmount] = useState("");
  const currentBurnAmount = localBurnAmount || burnAmount;
  const currentBurnAmountNumber = Number(currentBurnAmount);
  const amountIsValid =
    Number.isFinite(currentBurnAmountNumber) &&
    currentBurnAmountNumber >= MIN_BURN &&
    currentBurnAmountNumber <= MAX_BURN;
  const presets = ["1", "5", "10", "25"];
  const projectedPosition = useMemo(() => {
    if (!amountIsValid) return "--";
    const higherEntries = leaderboardPreview.filter(
      (entry) => Number(entry.burned) > currentBurnAmountNumber,
    );
    return `#${higherEntries.length + 1}`;
  }, [amountIsValid, currentBurnAmountNumber, leaderboardPreview]);
  const rangeCopy = t("burnRange", {
    min: MIN_BURN,
    max: MAX_BURN,
  });

  const handleBurnAmountChange = (value: string) => {
    setLocalBurnAmount(value);
    dispatch("setBurnAmount", value);
  };

  const handleBurn = async () => {
    await dispatch("burn", localBurnAmount || burnAmount);
    setLocalBurnAmount("");
  };

  const handleReset = () => {
    setLocalBurnAmount("1");
    dispatch("setBurnAmount", "1");
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
      {/* Hero — icon badge + title + subtitle + compact stat strip */}
      <div className="burn-league-hero">
        <div className="burn-league-hero-lead">
          <span className="burn-league-hero-badge">
            <CategoryIcon name="game" size={40} title={t("title")} />
          </span>
          <div className="burn-league-hero-copy">
            <span className="burn-league-hero-eyebrow">{t("liveLeague")}</span>
            <h2 className="burn-league-hero-title">{t("title")}</h2>
            <p className="burn-league-hero-subtitle">{t("subtitle")}</p>
            {hasRank && (
              <p className="burn-league-hero-rank">
                <span className="burn-league-hero-rank-label">{t("yourRank")}</span>
                <strong className="burn-league-hero-rank-value">{formattedRank}</strong>
                <span className="burn-league-hero-rank-of">
                  {t("outOf", { total: leaderboardSize })}
                </span>
              </p>
            )}
          </div>
        </div>
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
      </div>

      {serviceNotice && (
        <div className="burn-league-service-notice" role="status">
          <div className="burn-league-service-notice__copy">
            <span className="burn-league-service-notice__title">
              {t("burnServiceUnavailableTitle")}
            </span>
            <span>{serviceNotice}</span>
            <span className="burn-league-service-notice__status">
              {t("seasonStatus")}: {t("localPreview")}
            </span>
          </div>
        </div>
      )}

      {/* Burn Action — primary business action, surfaced high */}
      <NeoCard variant="erobo" className="burn-league-action-card">
        <h3 className="burn-league-section-title">{t("burnTokens")}</h3>
        <div className="burn-league-burn-form">
          <NeoInput
            type="number"
            value={currentBurnAmount}
            placeholder={t("enterAmount")}
            label={t("amount")}
            suffix="GAS"
            min={MIN_BURN}
            max={MAX_BURN}
            hint={rangeCopy}
            error={
              currentBurnAmount && !amountIsValid
                ? t("burnRangeError", { min: MIN_BURN, max: MAX_BURN })
                : ""
            }
            onChange={handleBurnAmountChange}
          />
          <div className="burn-league-presets" aria-label={t("burnPresets")}>
            {presets.map((preset) => (
              <button
                key={preset}
                className={`burn-league-preset${currentBurnAmount === preset ? " is-active" : ""}`}
                type="button"
                onClick={() => handleBurnAmountChange(preset)}
              >
                {preset} GAS
              </button>
            ))}
          </div>
          <div
            className="burn-league-impact-strip"
            role="group"
            aria-label={t("burnReview")}
          >
            <div className="burn-league-impact-item">
              <span className="burn-league-impact-label">{t("entryAmount")}</span>
              <strong className="burn-league-impact-value">
                {amountIsValid ? `${currentBurnAmount} GAS` : "--"}
              </strong>
            </div>
            <div className="burn-league-impact-divider" aria-hidden="true" />
            <div className="burn-league-impact-item">
              <span className="burn-league-impact-label">{t("projectedTotal")}</span>
              <strong className="burn-league-impact-value">
                {amountIsValid ? projectedTotalDisplay : "--"}
              </strong>
            </div>
            <div className="burn-league-impact-divider" aria-hidden="true" />
            <div className="burn-league-impact-item">
              <span className="burn-league-impact-label">{t("projectedRank")}</span>
              <strong className="burn-league-impact-value">{projectedPosition}</strong>
            </div>
            <div className="burn-league-impact-divider" aria-hidden="true" />
            <div className="burn-league-impact-item">
              <span className="burn-league-impact-label">{t("estimatedReward")}</span>
              <strong className="burn-league-impact-value">
                {amountIsValid ? estimatedReward : "--"}
              </strong>
            </div>
          </div>
          {burnValidationError && (
            <div className="burn-league-action-error" role="alert">
              {burnValidationError}
            </div>
          )}
          {actionNotice && (
            <div className="burn-league-action-notice" role="status">
              {actionNotice}
            </div>
          )}
          {lastSubmittedAmount && (
            <div className="burn-league-last-submit">
              {t("lastSubmitted", { amount: lastSubmittedAmount })}
            </div>
          )}
          <div className="burn-league-action-buttons">
            <div className="burn-league-burn-cta">
              <NeoButton
                variant="primary"
                size="lg"
                block
                loading={isBurning}
                disabled={isBurning || !amountIsValid}
                aria-label={isBurning ? t("burning") : t("burn")}
                onClick={handleBurn}
              >
                {t("burn")}
              </NeoButton>
              <span
                className="burn-league-review-tip"
                tabIndex={0}
                role="note"
                aria-label={t("burnReview")}
              >
                <span className="burn-league-review-tip__icon" aria-hidden="true">
                  i
                </span>
                <span className="burn-league-review-tip__popover" role="tooltip">
                  <span className="burn-league-review-tip__heading">
                    {t("burnReview")}
                  </span>
                  <span>{t("reviewAmount")}</span>
                  <span>{t("reviewLeaderboard")}</span>
                  <span>{t("reviewWallet")}</span>
                </span>
              </span>
            </div>
            <NeoButton
              variant="secondary"
              size="lg"
              disabled={isBurning}
              onClick={handleReset}
            >
              {t("resetBurn")}
            </NeoButton>
          </div>
        </div>
      </NeoCard>

      {/* Leaderboard — only a full card once real entries exist;
          otherwise a single muted empty-state line. */}
      {hasLeaderboard ? (
        <NeoCard variant="erobo" className="burn-league-leaderboard-card">
          <h3 className="burn-league-section-title">{t("leaderboard")}</h3>
          <div className="burn-league-leaderboard-list">
            {leaderboardPreview.map((entry, i) => (
              <div key={entry.address || i} className="burn-league-leaderboard-row">
                <span className="burn-league-lb-rank">#{entry.rank}</span>
                <span className="burn-league-lb-address">{truncateAddress(entry.address)}</span>
                <span className="burn-league-lb-amount">
                  <strong>{entry.burned} GAS</strong>
                  <small>{t("burned")}</small>
                </span>
              </div>
            ))}
          </div>
        </NeoCard>
      ) : (
        <NeoCard variant="erobo" className="burn-league-leaderboard-card">
          <h3 className="burn-league-section-title">{t("leaderboard")}</h3>
          <div className="burn-league-empty-state">
            <span className="burn-league-empty-icon" aria-hidden="true">
              <CategoryIcon name="game" size={36} title={t("leaderboard")} />
            </span>
            <p className="burn-league-empty-title">{t("noEntriesTitle")}</p>
            <p className="burn-league-empty-body">{t("noEntries")}</p>
          </div>
        </NeoCard>
      )}
    </div>
  );
}
