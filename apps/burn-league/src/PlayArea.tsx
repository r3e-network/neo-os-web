/**
 * PlayArea.tsx -- Burn League (v2 scene-driven rebuild)
 *
 * The arena IS the scene: a bright prize court, a tappable brazier asset,
 * animated GAS tokens, and a compact fuel rail. Burn is the primary action;
 * leaderboard, season lifecycle, prepaid-credit recovery, and how-it-works
 * stay tucked into the drawer. Chain logic untouched.
 */
import { useEffect, useRef, useState } from "react";
import { Trophy } from "lucide-react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import { ParticleBurst, CoinArt } from "@shared/art";
import { PlayStage } from "@shared/components-react/v2";
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
const MIN_BURN_FALLBACK = 1;
const MAX_BURN_FALLBACK = 1000;
const BURN_PRESETS = ["1", "5", "10", "25"];
const ARENA_IMAGE = "burn-league-arena.webp";
const BRAZIER_IMAGE = "burnleague-scene-art.webp";
type SeasonPhase = "dormant" | "active" | "ended";

function shortAddr(addr: string): string {
  return addr.length > 14 ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr;
}

export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { str, bool, num, val } = useStateBindings(state);

  const isBurning = bool("isBurning");
  const isSettling = bool("isSettling");
  const totalBurnedDisplay = str("totalBurnedDisplay", "0");
  const userBurnedDisplay = str("userBurnedDisplay", "0");
  const formattedRank = str("formattedRank", "--");
  const prizePoolDisplay = str("prizePoolDisplay", "0");
  const projectedTotalDisplay = str("projectedTotalBurnedDisplay", "--");
  const burnAmount = str("burnAmount", "1");
  const serviceNotice = str("serviceNotice");
  const actionNotice = str("actionNotice");
  const burnValidationError = val<string>("burnValidationError");
  const leaderboardPreview = val<LeaderboardEntry[]>("leaderboardPreview") ?? EMPTY_LEADERBOARD;
  const userIsLeader = bool("userIsLeader");
  const settleResult = val<SettleResult | null>("lastSettleResult");
  const prepaidCredit = num("prepaidCredit");
  const prepaidCreditDisplay = str("prepaidCreditDisplay", "0");
  const minBurn = num("minBurnGas") || MIN_BURN_FALLBACK;
  const maxBurn = num("maxBurnGas") || MAX_BURN_FALLBACK;
  const hasLeaderboard = leaderboardPreview.length > 0;

  const seasonPhase = (str("seasonPhase", "dormant") || "dormant") as SeasonPhase;
  const needsSettle = bool("needsSettle");
  const countdown = str("countdown", "00:00:00");
  const seasonStatusLabel = str("seasonStatusLabel");
  const formattedSeason = str("formattedSeason", "--");
  const leaderLabel = str("leaderLabel", "--");
  const seasonDurationLabel = str("seasonDurationLabel", "--");

  const [localBurnAmount, setLocalBurnAmount] = useState("");
  const [amountPulse, setAmountPulse] = useState(0);
  const [burnPreview, setBurnPreview] = useState(false);
  const burnPreviewTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Win/settle celebration — fires once per settleResult.token edge.
  const [celebration, setCelebration] = useState<SettleResult | null>(null);
  const lastCelebratedToken = useRef<number | null>(null);
  useEffect(() => {
    if (!settleResult || settleResult.token === lastCelebratedToken.current) return;
    lastCelebratedToken.current = settleResult.token;
    setCelebration(settleResult);
  }, [settleResult]);

  useEffect(
    () => () => {
      if (burnPreviewTimeout.current !== null) clearTimeout(burnPreviewTimeout.current);
    },
    [],
  );

  const currentBurnAmount = localBurnAmount || burnAmount || "1";
  const currentBurnAmountNumber = Number(currentBurnAmount);
  const amountIsValid =
    Number.isFinite(currentBurnAmountNumber) &&
    currentBurnAmountNumber >= minBurn &&
    currentBurnAmountNumber <= maxBurn;

  const startBurnPreview = () => {
    if (burnPreviewTimeout.current !== null) clearTimeout(burnPreviewTimeout.current);
    setBurnPreview(true);
    setAmountPulse((p) => p + 1);
    burnPreviewTimeout.current = setTimeout(() => {
      setBurnPreview(false);
      burnPreviewTimeout.current = null;
    }, 1400);
  };

  const handleBurn = async () => {
    if (isBurning || isSettling || !amountIsValid) return;
    startBurnPreview();
    await dispatch("burn", currentBurnAmount);
  };

  const choosePreset = (value: string) => {
    setLocalBurnAmount(value);
    void dispatch("setBurnAmount", value);
    setAmountPulse((p) => p + 1);
  };

  const controlsLocked = isBurning || isSettling || burnPreview;
  // Keep a visible floor on the fuel meters: 1-4 GAS on the 1000-GAS max would
  // otherwise round to a 0% bar that reads broken rather than "low charge".
  const fuelPct = amountIsValid
    ? Math.max(5, Math.min(100, Math.round((currentBurnAmountNumber / maxBurn) * 100)))
    : 0;
  const topEntry = leaderboardPreview[0];
  const poolIsEmpty = seasonPhase === "dormant" && prizePoolDisplay.startsWith("0");
  const tokenCount = Math.max(3, Math.min(8, Math.round(Math.min(currentBurnAmountNumber || 1, 25) / 4) + 3));
  const sceneState = isBurning || burnPreview ? "burning" : seasonPhase;
  const canBurn = !controlsLocked && amountIsValid;

  // ----- The scene: a real arena asset with a tappable burn target + token trail -----
  const scene = (
    <div
      className="burn-scene"
      data-state={sceneState}
    >
      <img className="burn-scene__arena-image" src={ARENA_IMAGE} alt="" aria-hidden="true" />
      <span className="burn-scene__shade" aria-hidden="true" />

      <div className="burn-scene__hud">
        <div className="burn-scene__stat burn-scene__stat--pool">
          <CoinArt size={22} variant="gas" />
          <span>{poolIsEmpty ? t("startPool") : t("prizePool")}</span>
          <strong>{poolIsEmpty ? "--" : prizePoolDisplay}</strong>
        </div>
        <div className="burn-scene__stat burn-scene__stat--clock">
          <span>{seasonPhase === "active" ? t("seasonEndsIn") : t("seasonStatus")}</span>
          <strong>{seasonPhase === "active" ? countdown : seasonStatusLabel || t("seasonStatus")}</strong>
        </div>
      </div>

      <button
        type="button"
        className="burn-scene__brazier"
        onClick={() => void handleBurn()}
        disabled={!canBurn}
        aria-label={
          isBurning
            ? `${t("burning")} ${currentBurnAmount} GAS`
            : burnPreview
              ? `${t("burning")} ${currentBurnAmount} GAS — ${t("burnNow")}`
              : !amountIsValid
                ? t("burnRange", { min: minBurn, max: maxBurn })
                : `${t("burnNow")} — ${currentBurnAmount} GAS`
        }
      >
        <span className="burn-scene__brazier-scrim" aria-hidden="true" />
        <span className="burn-scene__torch-medal" aria-hidden="true">
          <CoinArt size={34} variant="gas" decorative />
        </span>
        <span className="burn-scene__brazier-copy">
          <span>{userIsLeader ? t("youLeadBadge") : t("fuelCore")}</span>
          <strong>{currentBurnAmount} GAS</strong>
          <em>{isBurning || burnPreview ? "🔥 " + t("burning") : t("burnNow")}</em>
        </span>
        <span className="burn-scene__meter" aria-hidden="true">
          <span className="burn-scene__meter-fill" style={{ width: `${fuelPct}%` }} />
        </span>
      </button>

      {(isBurning || burnPreview) && (
        <div className="burn-scene__token-trail" key={`trail-${amountPulse}-${burnPreview}`} aria-hidden="true">
          {Array.from({ length: tokenCount }).map((_, i) => (
            <span key={i} className={`burn-scene__token burn-scene__token--${i}`}>
              <CoinArt size={i % 3 === 0 ? 26 : 22} variant="gas" />
            </span>
          ))}
        </div>
      )}

      {(isBurning || burnPreview) && (
        <div className="burn-scene__coin-burst" aria-hidden="true">
          {Array.from({ length: 10 }).map((_, i) => (
            <span key={i} className={`burn-scene__spark burn-scene__spark--${i} mx2-spark`}>
              <CoinArt size={20} variant="gas" />
            </span>
          ))}
        </div>
      )}

      <div className="burn-scene__readout">
        <div className="burn-scene__readout-card">
          <span>{t("totalBurned")}</span>
          <strong>{totalBurnedDisplay}</strong>
        </div>
        <div className="burn-scene__readout-card">
          <span>{t("currentLeader")}</span>
          <strong>{topEntry ? shortAddr(topEntry.address) : leaderLabel !== "--" ? shortAddr(leaderLabel) : t("noLeaderYet")}</strong>
        </div>
        <div className="burn-scene__readout-card">
          <span>{t("projectedTotal")}</span>
          <strong>{projectedTotalDisplay}</strong>
        </div>
      </div>

      <p className="burn-scene__status" aria-live="polite">
        {isBurning || burnPreview
          ? t("burning")
          : serviceNotice
            ? serviceNotice
            : seasonPhase === "ended"
              ? t("seasonEndedHint")
              : seasonPhase === "active"
                ? `${t("seasonEndsIn")} ${countdown}`
                : t("seasonDormantHint")}
      </p>
    </div>
  );

  // ----- Fuel console (under the scene) -----
  const controls = (
    <div className="burn-controls" aria-label={t("fuelConsole")}>
      <div className="burn-controls__dock">
        <div className="burn-controls__header">
          <span className="burn-controls__eyebrow">{t("projectedTotal")}</span>
          <strong>{projectedTotalDisplay}</strong>
          <em>{amountIsValid ? t("fuelLoadHint") : t("burnRange", { min: minBurn, max: maxBurn })}</em>
        </div>
        <div className="burn-controls__presets" aria-label={t("burnPresets")}>
          {BURN_PRESETS.map((preset) => {
            const presetNum = Number(preset);
            const outOfRange = presetNum < minBurn || presetNum > maxBurn;
            const active = currentBurnAmount === preset;
            return (
              <button
                key={preset}
                type="button"
                className={[
                  "burn-preset",
                  active ? "burn-preset--active" : null,
                  outOfRange ? "burn-preset--disabled" : null,
                ].filter(Boolean).join(" ")}
                onClick={() => choosePreset(preset)}
                disabled={controlsLocked || outOfRange}
                aria-pressed={active}
                aria-label={`${preset} GAS`}
              >
                <span className="burn-preset__core" aria-hidden="true">
                  <CoinArt size={18} variant="gas" decorative />
                </span>
                <strong>{preset}</strong>
                <em>GAS</em>
              </button>
            );
          })}
        </div>
        <div className="burn-controls__stepper" aria-label={t("fuelDialLabel")}>
          <button
            type="button"
            className="burn-stepper__btn"
            onClick={() => choosePreset(String(Math.max(minBurn, currentBurnAmountNumber - 1)))}
            disabled={controlsLocked}
            aria-label={t("decreaseBurn")}
          >−</button>
          <output className="burn-stepper__output" aria-live="polite">
            <span className="burn-stepper__track" aria-hidden="true">
              <span className="burn-stepper__track-fill" style={{ width: `${fuelPct}%` }} />
            </span>
            <strong>{currentBurnAmount}</strong>
            <span>GAS</span>
          </output>
          <button
            type="button"
            className="burn-stepper__btn"
            onClick={() => choosePreset(String(Math.min(maxBurn, currentBurnAmountNumber + 1)))}
            disabled={controlsLocked}
            aria-label={t("increaseBurn")}
          >+</button>
        </div>
        <p className="burn-controls__range">{t("burnRange", { min: minBurn, max: maxBurn })}</p>
        {burnValidationError && (
          <p className="burn-controls__error" role="alert">{burnValidationError}</p>
        )}
        {actionNotice && <p className="burn-controls__notice">{actionNotice}</p>}
      </div>
    </div>
  );

  const stageTitle =
    isBurning || burnPreview
      ? t("burning")
      : userIsLeader
        ? t("youLeadBadge")
        : seasonPhase === "dormant"
          ? t("startTheSeason")
          : t("readyToBurn");

  return (
    <div className="burn-league-play-area mx2 mx2-cat-game">
      <PlayStage
        category="game"
        stage={{
          eyebrow: seasonPhase === "active" ? t("liveLeague") : seasonStatusLabel || t("seasonStatus"),
          title: stageTitle,
          subtitle: t("subtitle"),
          badges: (
            <>
              {formattedSeason !== "--" && (
                <span className="mx2-badge" data-tone="accent" aria-label={`Active season ${formattedSeason}`}>
                  <span className="mx2-badge__dot" /> {t("seasonLabel")} {formattedSeason}
                </span>
              )}
              {userIsLeader && (
                <span className="mx2-badge" data-tone="success" aria-label="You are currently leading the leaderboard">
                  <Trophy size={14} aria-hidden="true" /> {t("youLeadBadge")}
                </span>
              )}
            </>
          ),
        }}
        scene={
          <>
            {scene}
            {controls}
          </>
        }
        score={[
          { label: t("prizePool"), value: prizePoolDisplay, accent: true },
          { label: t("youBurned"), value: userBurnedDisplay },
          { label: t("yourRank"), value: formattedRank },
          { label: t("projectedTotal"), value: projectedTotalDisplay },
        ]}
        actions={{
          primary: {
            label: isBurning || burnPreview ? t("burning") : t("burnNow"),
            onClick: () => void handleBurn(),
            disabled: controlsLocked || !amountIsValid,
            loading: isBurning || burnPreview,
            hint: t("burnTokens"),
          },
          secondary: [
            ...(needsSettle
              ? [{ label: t("settleSeason"), onClick: () => void dispatch("settle"), loading: isSettling, hint: t("settleSuccess") }]
              : []),
            ...(prepaidCredit > 0
              ? [{ label: t("withdrawCredit"), onClick: () => void dispatch("withdrawCredit"), hint: t("prepaidCreditLabel") }]
              : []),
          ],
        }}
        drawerToggleLabel={t("leaderboard")}
        drawer={{
          title: t("leaderboard"),
          children: (
            <>
              {/* Season status */}
              <h4>{t("seasonLabel")} {formattedSeason}</h4>
              <p>
                {seasonPhase === "active"
                  ? `${t("seasonEndsIn")} ${countdown} · ${t("seasonLengthLabel")}: ${seasonDurationLabel}`
                  : seasonPhase === "ended"
                    ? t("seasonEndedHint")
                    : t("seasonDormantHint")}
                {leaderLabel !== "--" && ` · ${t("currentLeader")}: ${shortAddr(leaderLabel)}`}
              </p>

              {/* Leaderboard */}
              <h4>{t("leaderboard")}</h4>
              {hasLeaderboard ? (
                <ul className="mx2-history burn-drawer__leaderboard">
                  {leaderboardPreview.slice(0, 10).map((entry) => {
                    const medal = entry.rank === 1 ? "🥇" : entry.rank === 2 ? "🥈" : entry.rank === 3 ? "🥉" : null;
                    return (
                      <li
                        key={entry.address}
                        className={[
                          "mx2-history__item",
                          entry.rank <= 3 ? "mx2-history__item--podium" : null,
                          entry.isUser ? "mx2-history__item--you" : null,
                        ].filter(Boolean).join(" ")}
                        data-outcome={entry.isUser ? "won" : undefined}
                        data-rank={entry.rank}
                        aria-label={`Rank ${entry.rank}${entry.isUser ? " (you)" : ""}: ${shortAddr(entry.address)}, ${entry.burned.toFixed(2)} GAS burned`}
                      >
                        <span className="mx2-history__face" aria-hidden="true">
                          {medal ?? `#${entry.rank}`}
                        </span>
                        <span className="mx2-history__stake">
                          {shortAddr(entry.address)}
                          {entry.isUser && <em className="burn-drawer__you-tag"> {t("youLeadBadge")}</em>}
                        </span>
                        <span className="mx2-history__result">{entry.burned.toFixed(2)} GAS</span>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p>{t("noEntries")}</p>
              )}

              {/* How it works */}
              <h4>{t("howItWorks")}</h4>
              <ol className="burn-drawer__steps">
                <li>{t("howStepPick")}</li>
                <li>{t("howStepBurn")}</li>
                <li>{t("howStepClimb")}</li>
                <li>{t("howStepWin")}</li>
              </ol>

              {/* Recovery */}
              {prepaidCredit > 0 && (
                <div className="burn-drawer__credit">
                  <span>
                    {t("prepaidCreditLabel")}: <strong>{prepaidCreditDisplay}</strong>
                    <em>{t("prepaidCreditHint")}</em>
                  </span>
                  <button
                    type="button"
                    className="mx2-btn mx2-btn--ghost"
                    onClick={() => void dispatch("withdrawCredit")}
                  >
                    {t("withdrawCredit")}
                  </button>
                </div>
              )}
            </>
          ),
        }}
      />

      {/* Win/settle celebration overlay */}
      {celebration && (
        <div className="burn-celebrate" role="dialog" aria-modal="true" aria-label={celebration.won ? t("settleWinTitle") : t("settleDoneTitle")}>
          <div className="burn-celebrate__card mx2-rise-in">
            {celebration.won && <ParticleBurst coins count={14} />}
            <div className="burn-celebrate__medal mx2-float">
              <img src={BRAZIER_IMAGE} alt="" aria-hidden="true" />
              <Trophy size={34} />
            </div>
            <h3>{celebration.won ? t("settleWinTitle") : t("settleDoneTitle")}</h3>
            <p className="burn-celebrate__amount">{celebration.amount}</p>
            <p className="burn-celebrate__body">{celebration.won ? t("settleWinBody") : t("settleDoneBody")}</p>
            <button type="button" className="mx2-btn mx2-btn--primary" onClick={() => setCelebration(null)}>
              {t("celebrationDismiss")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
