/**
 * PlayArea.tsx -- Burn League
 *
 * Full UI: hero stats, season lifecycle banner (dormant / active countdown /
 * ended-with-settle), burn input with the real whole-pool prize model, and the
 * current-season leaderboard rebuilt from on-chain Burned events.
 */

import { useMemo, useState } from "react";
import { NeoButton, NeoCard, NeoInput } from "@shared/components-react";
import { CategoryIcon } from "@shared/components-react/illustrations";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import { formatNumber } from "@shared/utils/format";
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
  isUser?: boolean;
}

// Fallback burn bounds (the contract's compile-time MIN_BURN/MAX_BURN). The live
// minBurn()/maxBurn() reads (exposed via state) take precedence when available.
const MIN_BURN_FALLBACK = 1;
const MAX_BURN_FALLBACK = 1000;

type SeasonPhase = "dormant" | "active" | "ended";

export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { str, bool, num, val } = useStateBindings(state);

  const isLoading = bool("isLoading");
  const isBurning = bool("isBurning");
  const isSettling = bool("isSettling");
  const leagueDataAvailable = bool("leagueDataAvailable");
  const totalBurnedDisplay = str("totalBurnedDisplay", "0");
  const userBurnedDisplay = str("userBurnedDisplay", "0");
  const rewardPoolDisplay = str("rewardPoolDisplay", "0");
  const formattedRank = str("formattedRank", "--");
  const leaderboardSize = num("leaderboardSize");
  const prizePoolDisplay = str("prizePoolDisplay", "0");
  const projectedTotalDisplay = str("projectedTotalBurnedDisplay", "--");
  const burnAmount = str("burnAmount", "");
  const userBurned = num("userBurned");
  const serviceNotice = str("serviceNotice");
  const actionNotice = str("actionNotice");
  const burnValidationError = val<string>("burnValidationError");
  const lastSubmittedAmount = str("lastSubmittedAmount");
  const leaderboardPreview = val<LeaderboardEntry[]>("leaderboardPreview") ?? [];
  const prepaidCredit = num("prepaidCredit");
  const prepaidCreditDisplay = str("prepaidCreditDisplay", "0");
  const seasonDurationLabel = str("seasonDurationLabel", "--");
  // Burn bounds bound to the on-chain minBurn()/maxBurn() reads, falling back to
  // the contract's compile-time literals until the reads land.
  const minBurn = num("minBurnGas") || MIN_BURN_FALLBACK;
  const maxBurn = num("maxBurnGas") || MAX_BURN_FALLBACK;
  const hasRank = formattedRank !== "--" && formattedRank !== "";
  const hasLeaderboard = leaderboardPreview.length > 0;

  // ── Season lifecycle ──────────────────────────────────────────────────
  const seasonPhase = (str("seasonPhase", "dormant") || "dormant") as SeasonPhase;
  const needsSettle = bool("needsSettle");
  const countdown = str("countdown", "00:00:00");
  const seasonStatusLabel = str("seasonStatusLabel");
  const formattedSeason = str("formattedSeason", "--");
  const leaderLabel = str("leaderLabel", "--");
  const hasLeader = leaderLabel !== "--" && leaderLabel !== "";

  const [localBurnAmount, setLocalBurnAmount] = useState("");
  const currentBurnAmount = localBurnAmount || burnAmount;
  const currentBurnAmountNumber = Number(currentBurnAmount);
  const amountIsValid =
    Number.isFinite(currentBurnAmountNumber) &&
    currentBurnAmountNumber >= minBurn &&
    currentBurnAmountNumber <= maxBurn;
  const presets = ["1", "5", "10", "25"];
  const projectedPosition = useMemo(() => {
    if (!amountIsValid) return "--";
    // The user's projected season total is their EXISTING burn plus the new
    // amount — not the new amount alone (which contradicted the adjacent
    // "Projected total" stat). Their own current leaderboard entry is excluded
    // so they are never counted as ahead of themselves.
    const projectedTotal = userBurned + currentBurnAmountNumber;
    const higherEntries = leaderboardPreview.filter(
      (entry) => !entry.isUser && Number(entry.burned) > projectedTotal,
    );
    return `#${higherEntries.length + 1}`;
  }, [amountIsValid, currentBurnAmountNumber, leaderboardPreview, userBurned]);
  const rangeCopy = t("burnRange", {
    min: minBurn,
    max: maxBurn,
  });

  // Burns are blocked while a season has ended and is awaiting settle.
  const burnDisabled = isBurning || !amountIsValid || needsSettle;

  const handleBurnAmountChange = (value: string) => {
    setLocalBurnAmount(value);
    dispatch("setBurnAmount", value);
  };

  const handleBurn = async () => {
    await dispatch("burn", localBurnAmount || burnAmount);
    setLocalBurnAmount("");
  };

  const handleSettle = async () => {
    await dispatch("settle");
  };

  const handleReset = () => {
    setLocalBurnAmount("1");
    dispatch("setBurnAmount", "1");
  };

  const truncateAddress = (addr: string) => {
    if (!addr || addr.length < 12) return addr;
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  // Only the FIRST load replaces the whole UI with a spinner. Post-action
  // reloads (which also set isLoading) keep the content mounted — otherwise the
  // form, banner, and leaderboard unmount/remount after every burn or settle,
  // losing scroll position. Once league data exists, re-loads render in place.
  if (isLoading && !leagueDataAvailable) {
    return (
      <div className="burn-league-play-area">
        <div className="burn-league-loading">
          <div className="burn-league-loading-spinner" />
          <span>{t("loading")}</span>
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
            {hasRank ? (
              <p className="burn-league-hero-rank">
                <span className="burn-league-hero-rank-label">{t("yourRank")}</span>
                <strong className="burn-league-hero-rank-value">{formattedRank}</strong>
                <span className="burn-league-hero-rank-of">
                  {t("outOf", { total: leaderboardSize })}
                </span>
              </p>
            ) : (
              <p className="burn-league-hero-prompt">{t("heroFirstBurnPrompt")}</p>
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

      {/* Season lifecycle banner — dormant / active countdown / ended+settle.
          The whole pool is the prize; the top burner wins it at settle. */}
      <div
        className={`burn-league-season burn-league-season--${seasonPhase}`}
        role="status"
      >
        <div className="burn-league-season-head">
          <span className="burn-league-season-eyebrow">
            {t("seasonLabel")} {formattedSeason}
          </span>
          <span className="burn-league-season-status">{seasonStatusLabel}</span>
        </div>

        {seasonPhase === "active" && (
          <div className="burn-league-season-body">
            <div className="burn-league-season-fact">
              <span className="burn-league-season-fact-label">{t("seasonEndsIn")}</span>
              <strong className="burn-league-season-countdown">{countdown}</strong>
            </div>
            <div className="burn-league-season-fact">
              <span className="burn-league-season-fact-label">{t("prizePool")}</span>
              <strong className="burn-league-season-fact-value">{prizePoolDisplay}</strong>
            </div>
            <div className="burn-league-season-fact">
              <span className="burn-league-season-fact-label">{t("currentLeader")}</span>
              <strong className="burn-league-season-fact-value">
                {hasLeader ? leaderLabel : t("noLeaderYet")}
              </strong>
            </div>
            {seasonDurationLabel !== "--" && (
              <div className="burn-league-season-fact">
                <span className="burn-league-season-fact-label">{t("seasonLengthLabel")}</span>
                <strong className="burn-league-season-fact-value">{seasonDurationLabel}</strong>
              </div>
            )}
          </div>
        )}

        {seasonPhase === "dormant" && (
          <p className="burn-league-season-note">
            {seasonDurationLabel !== "--"
              ? t("seasonDormantHintWithLength", { length: seasonDurationLabel })
              : t("seasonDormantHint")}
          </p>
        )}

        {seasonPhase === "ended" && (
          <div className="burn-league-season-settle">
            <p className="burn-league-season-note">
              {t("seasonEndedHint", { amount: prizePoolDisplay })}
            </p>
            <NeoButton
              variant="primary"
              size="md"
              loading={isSettling}
              disabled={isSettling}
              aria-label={t("settleSeason")}
              onClick={handleSettle}
            >
              {t("settleSeason")}
            </NeoButton>
          </div>
        )}
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
            min={minBurn}
            max={maxBurn}
            hint={rangeCopy}
            error={
              currentBurnAmount && !amountIsValid
                ? t("burnRangeError", { min: minBurn, max: maxBurn })
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
              <span className="burn-league-impact-label">{t("prizePool")}</span>
              <strong className="burn-league-impact-value">{prizePoolDisplay}</strong>
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
                disabled={burnDisabled}
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
          {needsSettle && (
            <div className="burn-league-action-notice" role="status">
              {t("burnBlockedSettle")}
            </div>
          )}
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
                  <strong>{formatNumber(entry.burned, 2)} GAS</strong>
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

      {/* Recovery — unused prepaid burn-credit from a deposit whose burn didn't
          complete. The contract reuses it on the next burn, or the player can
          withdraw it back to the wallet here (money-in needs money-out). */}
      {prepaidCredit > 0 && (
        <NeoCard variant="erobo" className="burn-league-recovery-card">
          <div className="burn-league-recovery-card__body">
            <div className="burn-league-recovery-card__copy">
              <span className="burn-league-recovery-card__title">
                {t("prepaidCreditLabel")} · {prepaidCreditDisplay}
              </span>
              <span className="burn-league-recovery-card__text">{t("prepaidCreditHint")}</span>
            </div>
            <NeoButton
              size="md"
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
    </div>
  );
}
