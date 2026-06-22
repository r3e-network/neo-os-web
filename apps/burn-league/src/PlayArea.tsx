/**
 * PlayArea.tsx -- Burn League
 *
 * Full UI: hero stats, season lifecycle banner (dormant / active countdown /
 * ended-with-settle), burn input with the real whole-pool prize model, and the
 * current-season leaderboard rebuilt from on-chain Burned events.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Flame,
  Gauge,
  Info,
  Minus,
  Plus,
} from "lucide-react";
import { NeoButton, NeoCard, NeoInput } from "@shared/components-react";
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

interface SettleResult {
  won: boolean;
  amount: string;
  token: number;
}

const EMPTY_LEADERBOARD: LeaderboardEntry[] = [];

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
  const leaderboardPreview = val<LeaderboardEntry[]>("leaderboardPreview") ?? EMPTY_LEADERBOARD;
  const userIsLeader = bool("userIsLeader");
  const settleResult = val<SettleResult | null>("lastSettleResult");
  const prepaidCredit = num("prepaidCredit");
  const prepaidCreditDisplay = str("prepaidCreditDisplay", "0");
  const seasonDurationLabel = str("seasonDurationLabel", "--");
  // Burn bounds bound to the on-chain minBurn()/maxBurn() reads, falling back to
  // the contract's compile-time literals until the reads land.
  const minBurn = num("minBurnGas") || MIN_BURN_FALLBACK;
  const maxBurn = num("maxBurnGas") || MAX_BURN_FALLBACK;
  const hasRank = formattedRank !== "--" && formattedRank !== "";
  const hasLeaderboard = leaderboardPreview.length > 0;
  // A pool of exactly zero with no entries means there is nothing to win yet —
  // surfacing "Projected Rank #1" / "Prize Pool 0.00 GAS" here would imply you
  // were winning a pool worth nothing. Treat that combination as "no live pool".
  const prizePoolIsEmpty = /^0(\.0+)?\s/.test(prizePoolDisplay) || prizePoolDisplay === "0";
  const hasLivePool = !(prizePoolIsEmpty && !hasLeaderboard);

  // ── Season lifecycle ──────────────────────────────────────────────────
  const seasonPhase = (str("seasonPhase", "dormant") || "dormant") as SeasonPhase;
  const needsSettle = bool("needsSettle");
  const countdown = str("countdown", "00:00:00");
  const seasonStatusLabel = str("seasonStatusLabel");
  const formattedSeason = str("formattedSeason", "--");
  const leaderLabel = str("leaderLabel", "--");
  const hasLeader = leaderLabel !== "--" && leaderLabel !== "";

  const [localBurnAmount, setLocalBurnAmount] = useState("");
  const [showHowItWorks, setShowHowItWorks] = useState(false);

  // ── Win / settle celebration ──────────────────────────────────────────
  // Fire once per settle on the real event edge: lastSettleResult is stamped
  // with a fresh `token` inside settleSeason() right after the SeasonSettled
  // event resolves. We compare the token against the last one we celebrated so
  // a re-render never re-triggers, and standalone (no result) never fires.
  const [celebration, setCelebration] = useState<SettleResult | null>(null);
  const lastCelebratedToken = useRef<number | null>(null);
  useEffect(() => {
    if (!settleResult || settleResult.token === lastCelebratedToken.current) {
      return;
    }
    lastCelebratedToken.current = settleResult.token;
    setCelebration(settleResult);
  }, [settleResult]);

  const dismissCelebration = () => setCelebration(null);

  const currentBurnAmount = localBurnAmount || burnAmount;
  const currentBurnAmountNumber = Number(currentBurnAmount);
  const amountIsValid =
    Number.isFinite(currentBurnAmountNumber) &&
    currentBurnAmountNumber >= minBurn &&
    currentBurnAmountNumber <= maxBurn;
  const burnMeterPercent = useMemo(() => {
    if (!amountIsValid) return 0;
    const range = Math.max(maxBurn - minBurn, 1);
    const normalized = (currentBurnAmountNumber - minBurn) / range;
    return Math.max(12, Math.min(100, normalized * 88 + 12));
  }, [amountIsValid, currentBurnAmountNumber, maxBurn, minBurn]);
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

  const nudgeBurnAmount = (delta: number) => {
    const baseAmount = amountIsValid ? currentBurnAmountNumber : minBurn;
    const nextAmount = Math.max(minBurn, Math.min(maxBurn, baseAmount + delta));
    handleBurnAmountChange(Number(nextAmount.toFixed(8)).toString());
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
      {/* Win/payout celebration — fires once per settle on the real event edge. */}
      {celebration && (
        <div className="burn-league-celebrate" role="dialog" aria-modal="false">
          <div className="burn-league-confetti" aria-hidden="true">
            {Array.from({ length: 18 }).map((_, i) => (
              <span
                key={i}
                className={`burn-league-confetti-piece burn-league-confetti-piece-${(i % 6) + 1}`}
              />
            ))}
          </div>
          <NeoCard variant="erobo" className="burn-league-celebrate-card">
            <span
              className={`burn-league-celebrate-icon${celebration.won ? " is-win" : ""}`}
              aria-hidden="true"
            >
              <Flame size={44} strokeWidth={2.2} />
            </span>
            <h3 className="burn-league-celebrate-title">
              {celebration.won ? t("settleWinTitle") : t("settleDoneTitle")}
            </h3>
            <p className="burn-league-celebrate-body">
              {celebration.won
                ? t("settleWinBody", { amount: celebration.amount })
                : t("settleDoneBody", { amount: celebration.amount })}
            </p>
            <NeoButton
              variant="primary"
              size="md"
              onClick={dismissCelebration}
              aria-label={t("celebrationDismiss")}
            >
              {t("celebrationDismiss")}
            </NeoButton>
          </NeoCard>
        </div>
      )}

      {/* Hero — arena identity + title + focal prize pool */}
      <div
        className={`burn-league-hero${seasonPhase === "active" ? " is-live" : ""}`}
      >
        <div className="burn-league-hero-media">
          <img
            src="./burn-league-arena.jpg"
            alt={t("arenaAlt")}
            loading="eager"
            decoding="async"
          />
        </div>
        <div className="burn-league-hero-panel">
          <div className="burn-league-hero-lead">
            <span
              className={`burn-league-hero-badge${seasonPhase === "active" ? " is-live" : ""}`}
            >
              <Flame size={34} strokeWidth={2.2} aria-label={t("title")} />
            </span>
            <div className="burn-league-hero-copy">
              <span className="burn-league-hero-eyebrow">{t("liveLeague")}</span>
              <h2 className="burn-league-hero-title">{t("title")}</h2>
              <p className="burn-league-hero-subtitle">{t("subtitle")}</p>
              {userIsLeader && seasonPhase === "active" ? (
                <p className="burn-league-hero-leadbadge">
                  <span className="burn-league-hero-leadbadge-dot" aria-hidden="true" />
                  {t("youLeadBadge")}
                </p>
              ) : hasRank ? (
                <p className="burn-league-hero-rank">
                  <span className="burn-league-hero-rank-label">{t("yourRank")}</span>
                  <strong className="burn-league-hero-rank-value">{formattedRank}</strong>
                  <span className="burn-league-hero-rank-of">
                    {t("outOf", { total: leaderboardSize })}
                  </span>
                </p>
              ) : hasLivePool ? (
                <p className="burn-league-hero-prompt">{t("heroFirstBurnPrompt")}</p>
              ) : null}
            </div>
          </div>

          {/* Focal prize pool — the whole point of the league, given the spotlight.
              Falls back to an inviting "start the season" call when no pool exists.
              Total/your burns are demoted to a compact muted sub-row below. */}
          <div className={`burn-league-hero-pool${hasLivePool ? "" : " is-empty"}`}>
            <span className="burn-league-hero-pool-label">
              {hasLivePool ? t("heroPoolLabel") : t("startTheSeason")}
            </span>
            {hasLivePool ? (
              <strong className="burn-league-hero-pool-value">{prizePoolDisplay}</strong>
            ) : (
              <span className="burn-league-hero-pool-flame" aria-hidden="true">
                <Flame size={32} strokeWidth={2.2} />
              </span>
            )}
            <span className="burn-league-hero-pool-hint">
              {hasLivePool ? t("subtitle") : t("heroPoolEmptyHint")}
            </span>
            <div className="burn-league-hero-substats">
              <span className="burn-league-hero-substat">
                {t("totalBurned")}
                <strong>{totalBurnedDisplay}</strong>
              </span>
              <span className="burn-league-hero-substat">
                {t("yourBurns")}
                <strong>{userBurnedDisplay}</strong>
              </span>
            </div>
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

      {/* Burn Action — primary business action, surfaced high */}
      <NeoCard variant="erobo" className="burn-league-action-card">
        <div className="burn-league-action-head">
          <h3 className="burn-league-section-title">{t("burnTokens")}</h3>
          <button
            type="button"
            className="burn-league-howto-toggle"
            aria-expanded={showHowItWorks}
            onClick={() => setShowHowItWorks((open) => !open)}
          >
            {t("howItWorks")}
            <ChevronDown className="burn-league-howto-caret" size={14} aria-hidden="true" />
          </button>
        </div>
        {serviceNotice && (
          <div className="burn-league-service-notice" role="status">
            <span className="burn-league-service-notice__icon" aria-hidden="true">
              <AlertTriangle size={15} strokeWidth={2.2} />
            </span>
            <span className="burn-league-service-notice__copy">
              <span className="burn-league-service-notice__title">
                {t("burnServiceUnavailableTitle")}
              </span>
              <span className="burn-league-service-notice__status">{t("localPreview")}</span>
            </span>
          </div>
        )}
        {showHowItWorks && (
          <ol className="burn-league-howto-steps">
            <li className="burn-league-howto-step">
              <span className="burn-league-howto-step-index">1</span>
              {t("howStepPick")}
            </li>
            <li className="burn-league-howto-step">
              <span className="burn-league-howto-step-index">2</span>
              {t("howStepBurn")}
            </li>
            <li className="burn-league-howto-step">
              <span className="burn-league-howto-step-index">3</span>
              {t("howStepClimb")}
            </li>
            <li className="burn-league-howto-step is-prize">
              <span className="burn-league-howto-step-index">4</span>
              {t("howStepWin")}
            </li>
          </ol>
        )}
        <div className="burn-league-burn-form">
          <div className="burn-league-arena-console">
            <div className="burn-league-stake-stage" aria-label={t("arenaConsoleLabel")}>
              <img
                className="burn-league-stake-stage__image"
                src="./burn-league-arena.jpg"
                alt=""
                aria-hidden="true"
                loading="lazy"
                decoding="async"
              />
              <div className="burn-league-stake-stage__glass">
                <div className="burn-league-fuel-head">
                  <span className="burn-league-fuel-icon" aria-hidden="true">
                    <Gauge size={18} strokeWidth={2.2} />
                  </span>
                  <span className="burn-league-fuel-copy">
                    <span className="burn-league-fuel-label">{t("fuelConsole")}</span>
                    <strong className="burn-league-fuel-value">
                      {amountIsValid ? `${currentBurnAmount} GAS` : t("dashPlaceholder")}
                    </strong>
                  </span>
                </div>
                <div className="burn-league-fuel-meter" aria-label={t("fuelMeter")}>
                  <span
                    className="burn-league-fuel-meter__fill"
                    style={{ width: `${burnMeterPercent}%` }}
                  />
                  <span className="burn-league-fuel-meter__spark burn-league-fuel-meter__spark--one" />
                  <span className="burn-league-fuel-meter__spark burn-league-fuel-meter__spark--two" />
                  <span className="burn-league-fuel-meter__spark burn-league-fuel-meter__spark--three" />
                </div>
                <div className="burn-league-stage-dial">
                  <button
                    type="button"
                    className="burn-league-stepper"
                    aria-label={t("decreaseBurn")}
                    disabled={isBurning || (amountIsValid && currentBurnAmountNumber <= minBurn)}
                    onClick={() => nudgeBurnAmount(-1)}
                  >
                    <Minus size={16} strokeWidth={2.4} aria-hidden="true" />
                  </button>
                  <NeoInput
                    className="burn-league-amount-input"
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
                  <button
                    type="button"
                    className="burn-league-stepper"
                    aria-label={t("increaseBurn")}
                    disabled={isBurning || (amountIsValid && currentBurnAmountNumber >= maxBurn)}
                    onClick={() => nudgeBurnAmount(1)}
                  >
                    <Plus size={16} strokeWidth={2.4} aria-hidden="true" />
                  </button>
                </div>
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
              </div>
            </div>
            <div className="burn-league-scoreboard">
              <div className="burn-league-scoreboard-head">
                <span className="burn-league-scoreboard-eyebrow">
                  {t("scoreboardEyebrow")}
                </span>
                <strong className="burn-league-scoreboard-title">
                  {amountIsValid ? t("readyToBurn") : t("chooseFuel")}
                </strong>
              </div>
              <div
                className="burn-league-impact-strip"
                role="group"
                aria-label={t("burnReview")}
              >
                <div className="burn-league-impact-item">
                  <span className="burn-league-impact-label">{t("entryAmount")}</span>
                  <strong className="burn-league-impact-value">
                    {amountIsValid ? `${currentBurnAmount} GAS` : t("dashPlaceholder")}
                  </strong>
                </div>
                <div className="burn-league-impact-item">
                  <span className="burn-league-impact-label">{t("projectedTotal")}</span>
                  <strong className="burn-league-impact-value">
                    {amountIsValid ? projectedTotalDisplay : t("dashPlaceholder")}
                  </strong>
                </div>
                <div className="burn-league-impact-item">
                  <span className="burn-league-impact-label">{t("projectedRank")}</span>
                  <strong className="burn-league-impact-value">
                    {amountIsValid && hasLivePool ? projectedPosition : t("dashPlaceholder")}
                  </strong>
                </div>
                <div className="burn-league-impact-item">
                  <span className="burn-league-impact-label">{t("prizePool")}</span>
                  <strong className="burn-league-impact-value">
                    {hasLivePool ? prizePoolDisplay : t("dashPlaceholder")}
                  </strong>
                </div>
              </div>
              {!hasLivePool && (
                <p className="burn-league-impact-hint">{t("impactPoolEmptyHint")}</p>
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
                      <Info size={16} strokeWidth={2.2} />
                    </span>
                    <span className="burn-league-review-tip__popover" role="tooltip">
                      <span className="burn-league-review-tip__heading">
                        {t("burnReview")}
                      </span>
                      <span className="burn-league-review-tip__item">
                        <CheckCircle2 size={13} aria-hidden="true" />
                        {t("reviewAmount")}
                      </span>
                      <span className="burn-league-review-tip__item">
                        <CheckCircle2 size={13} aria-hidden="true" />
                        {t("reviewLeaderboard")}
                      </span>
                      <span className="burn-league-review-tip__item">
                        <CheckCircle2 size={13} aria-hidden="true" />
                        {t("reviewWallet")}
                      </span>
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
              <Flame size={32} strokeWidth={2.2} />
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
