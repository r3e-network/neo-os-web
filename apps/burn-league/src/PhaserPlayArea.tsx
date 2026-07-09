import { useEffect, useRef, useState } from "react";
import { Flame, Trophy, WalletCards } from "lucide-react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import { PlayStage } from "@shared/components-react/v2";
import { PhaserGameComponent } from "@framework/phaser";
import { BurnLeagueScene } from "./scenes/BurnLeagueScene";
import "./PlayArea.scss";

interface P {
  t: (k: string, p?: Record<string, string | number>) => string;
  state: Record<string, Observable>;
  dispatch: (n: string, ...a: unknown[]) => Promise<void>;
}

const GAME_CONFIG = { scene: [BurnLeagueScene], width: 420, height: 600 } as const;
const EMPTY_LEADERBOARD: LeaderboardEntry[] = [];

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

type SeasonPhase = "dormant" | "active" | "ended";

function shortAddr(address: string): string {
  return address.length > 14 ? `${address.slice(0, 6)}...${address.slice(-4)}` : address;
}

function burnedAmount(entry: LeaderboardEntry): string {
  return Number.isFinite(entry.burned) ? `${entry.burned.toFixed(2)} GAS` : "--";
}

/** Strip a GAS suffix so guest (local) mode renders a bare heat number. */
function stripGas(value: string): string {
  return String(value ?? "").replace(/\s*GAS\b/i, "").trim() || "0";
}

export default function PhaserPlayArea({ t, state, dispatch }: P) {
  const { str, bool, num, val } = useStateBindings(state);
  // Two-mode surface: guest is a local burn-streak game with NO GAS / pool /
  // reward / season framing; gamefi copy stays exactly as-is.
  const mode = str("appMode", "gamefi");
  const guest = mode === "guest";
  const guestStreak = num("guestStreak", 0);
  const seasonPhase = (str("seasonPhase", "dormant") || "dormant") as SeasonPhase;
  const prizePoolDisplay = str("prizePoolDisplay", "0");
  const userBurnedDisplay = str("userBurnedDisplay", "0");
  const formattedRank = str("formattedRank", "--");
  const countdown = str("countdown", "00:00:00");
  const burnAmount = str("burnAmount", "1");
  const isBurning = bool("isBurning");
  const isSettling = bool("isSettling");
  const needsSettle = bool("needsSettle");
  const leaderboardPreview =
    val<LeaderboardEntry[]>("leaderboardPreview", EMPTY_LEADERBOARD) ?? EMPTY_LEADERBOARD;
  const serviceNotice = str("serviceNotice", "");
  const actionNotice = str("actionNotice", "");
  const burnValidationError = str("burnValidationError", "");
  const seasonStatusLabel = str("seasonStatusLabel", "");
  const formattedSeason = str("formattedSeason", "--");
  const seasonDurationLabel = str("seasonDurationLabel", "--");
  const leaderLabel = str("leaderLabel", "--");
  const topBurnedDisplay = str("topBurnedDisplay", "--");
  const projectedTotalDisplay = str("projectedTotalBurnedDisplay", "--");
  const prepaidCredit = num("prepaidCredit");
  const prepaidCreditDisplay = str("prepaidCreditDisplay", "0");
  const userIsLeader = bool("userIsLeader");
  const settleResult = val<SettleResult | null>("lastSettleResult");
  const hasLeaderboard = leaderboardPreview.length > 0;
  const topEntry = leaderboardPreview[0];
  // Guest "top run" = the best banked heat on the local board ("--" when none).
  const guestTopValue = Number(stripGas(topBurnedDisplay)) > 0 ? stripGas(topBurnedDisplay) : "--";
  const [celebration, setCelebration] = useState<SettleResult | null>(null);
  const lastCelebratedToken = useRef<number | null>(null);

  useEffect(() => {
    if (!settleResult || settleResult.token === lastCelebratedToken.current) return;
    lastCelebratedToken.current = settleResult.token;
    setCelebration(settleResult);
  }, [settleResult]);

  const bridgeState = {
    seasonPhase,
    prizePoolDisplay,
    userBurnedDisplay,
    formattedRank,
    countdown,
    burnAmount,
    isBurning,
    isSettling,
    needsSettle,
    leaderboardPreview,
    serviceNotice,
    actionNotice,
    burnValidationError,
    seasonStatusLabel,
    formattedSeason,
    seasonDurationLabel,
    leaderLabel,
    topBurnedDisplay,
    minBurnGas: num("minBurnGas"),
    maxBurnGas: num("maxBurnGas"),
    prepaidCredit,
    prepaidCreditDisplay,
    // Two-mode surface + localized guest labels the scene swaps in (gamefi
    // ignores them). Passing them (not hardcoding in-scene) keeps the canvas
    // guest copy localized in every locale.
    appMode: mode,
    guestStreak,
    guestPoolLabel: t("guestBest"),
    guestSeasonLabel: t("guestStreakLabel"),
    guestRunLabel: t("guestRun"),
    guestBoardLabel: t("guestBoardTitle"),
    guestEmptyLabel: t("guestNoRuns"),
    guestBurnVerb: t("guestStokeVerb"),
    guestUnit: t("guestHeatUnit"),
  };

  const seasonLine =
    seasonPhase === "active"
      ? `${t("seasonEndsIn")} ${countdown} - ${t("seasonLengthLabel")}: ${seasonDurationLabel}`
      : seasonPhase === "ended"
        ? t("seasonEndedHint", { amount: prizePoolDisplay })
        : seasonDurationLabel !== "--"
          ? t("seasonDormantHintWithLength", { length: seasonDurationLabel })
          : t("seasonDormantHint");

  const stageTitle = guest
    ? isBurning
      ? t("burning")
      : t("guestStageTitle")
    : isBurning
      ? t("burning")
      : needsSettle
        ? t("settleSeason")
        : userIsLeader
          ? t("youLeadBadge")
          : t("readyToBurn");

  const leaderDisplay = topEntry
    ? shortAddr(topEntry.address)
    : leaderLabel !== "--"
      ? shortAddr(leaderLabel)
      : t("noLeaderYet");

  return (
    <div className="burn-league-play-area mx2 mx2-cat-game">
      <PlayStage
        category="game"
        stage={{
          eyebrow: guest
            ? t("guestEyebrow")
            : seasonPhase === "active"
              ? t("liveLeague")
              : seasonStatusLabel || t("seasonStatus"),
          title: stageTitle,
          subtitle: guest ? t("guestSubtitle") : t("subtitle"),
          badges: guest ? (
            <>
              {guestStreak > 0 && (
                <span className="mx2-badge" data-tone="success">
                  <Flame size={14} aria-hidden="true" /> {t("guestStreakBadge", { streak: guestStreak })}
                </span>
              )}
            </>
          ) : (
            <>
              {formattedSeason !== "--" && (
                <span className="mx2-badge" data-tone="accent">
                  <span className="mx2-badge__dot" /> {t("seasonLabel")} {formattedSeason}
                </span>
              )}
              {seasonPhase === "active" && (
                <span className="mx2-badge" data-tone="success">
                  <Flame size={14} aria-hidden="true" /> {t("seasonEndsIn")} {countdown}
                </span>
              )}
              {userIsLeader && (
                <span className="mx2-badge" data-tone="success">
                  <Trophy size={14} aria-hidden="true" /> {t("youLeadBadge")}
                </span>
              )}
            </>
          ),
        }}
        scene={<PhaserGameComponent config={GAME_CONFIG} state={bridgeState} dispatch={dispatch} />}
        score={guest ? [
          { label: t("guestBest"), value: stripGas(prizePoolDisplay), accent: true },
          { label: t("guestRun"), value: stripGas(userBurnedDisplay) },
          { label: t("yourRank"), value: formattedRank },
          { label: t("guestTopRun"), value: guestTopValue },
        ] : [
          { label: t("prizePool"), value: prizePoolDisplay, accent: true },
          { label: t("youBurned"), value: userBurnedDisplay },
          { label: t("yourRank"), value: formattedRank },
          { label: t("currentLeader"), value: leaderDisplay },
        ]}
        actions={{
          secondary: [
            ...(needsSettle
              ? [{
                  label: t("settleSeason"),
                  onClick: () => void dispatch("settle"),
                  loading: isSettling,
                  icon: <Trophy size={16} aria-hidden="true" />,
                  hint: t("settleSuccess"),
                }]
              : []),
            ...(prepaidCredit > 0
              ? [{
                  label: t("withdrawCredit"),
                  onClick: () => void dispatch("withdrawCredit"),
                  icon: <WalletCards size={16} aria-hidden="true" />,
                  hint: t("prepaidCreditHint"),
                }]
              : []),
          ],
        }}
        drawerToggleLabel={guest ? t("guestBoardTitle") : t("leaderboard")}
        drawer={{
          title: guest ? t("guestBoardTitle") : t("leaderboard"),
          children: (
            <div className="burn-drawer">
              {guest ? (
                <section className="burn-drawer__summary" aria-label={t("guestBoardTitle")}>
                  <h4>{t("guestSummaryTitle")}</h4>
                  <p>{t("guestSummaryLine")}</p>
                  <dl className="burn-drawer__metrics">
                    <div>
                      <dt>{t("guestBest")}</dt>
                      <dd>{stripGas(prizePoolDisplay)}</dd>
                    </div>
                    <div>
                      <dt>{t("guestStreakLabel")}</dt>
                      <dd>{guestStreak > 0 ? `x${guestStreak}` : "--"}</dd>
                    </div>
                    <div>
                      <dt>{t("guestTopRun")}</dt>
                      <dd>{guestTopValue}</dd>
                    </div>
                  </dl>
                </section>
              ) : (
                <section className="burn-drawer__summary" aria-label={t("seasonStatus")}>
                  <h4>{t("seasonLabel")} {formattedSeason}</h4>
                  <p>{seasonLine}</p>
                  <dl className="burn-drawer__metrics">
                    <div>
                      <dt>{t("prizePool")}</dt>
                      <dd>{prizePoolDisplay}</dd>
                    </div>
                    <div>
                      <dt>{t("currentLeader")}</dt>
                      <dd>{leaderDisplay}</dd>
                    </div>
                    <div>
                      <dt>{t("burned")}</dt>
                      <dd>{topBurnedDisplay}</dd>
                    </div>
                  </dl>
                </section>
              )}

              <section
                className="burn-drawer__board"
                aria-label={guest ? t("guestBoardTitle") : t("leaderboard")}
              >
                <h4>{guest ? t("guestBoardTitle") : t("leaderboard")}</h4>
                {hasLeaderboard ? (
                  <ul className="mx2-history burn-drawer__leaderboard">
                    {leaderboardPreview.slice(0, 10).map((entry) => (
                      <li
                        key={entry.address}
                        className={[
                          "mx2-history__item",
                          entry.rank <= 3 ? "mx2-history__item--podium" : null,
                          entry.isUser ? "mx2-history__item--you" : null,
                        ].filter(Boolean).join(" ")}
                        data-rank={entry.rank}
                      >
                        <span className="mx2-history__face" aria-hidden="true">#{entry.rank}</span>
                        <span className="mx2-history__stake">
                          {shortAddr(entry.address)}
                          {entry.isUser && (
                            <em className="burn-drawer__you-tag"> {guest ? t("guestYouTag") : t("youBurned")}</em>
                          )}
                        </span>
                        <span className="mx2-history__result">
                          {guest ? `${entry.burned.toFixed(0)} ${t("guestHeatUnit")}` : burnedAmount(entry)}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="burn-drawer__empty">{guest ? t("guestNoRuns") : t("noEntries")}</p>
                )}
              </section>

              {guest ? (
                <section className="burn-drawer__rules" aria-label={t("guestHowTitle")}>
                  <h4>{t("guestHowTitle")}</h4>
                  <ol className="burn-drawer__steps">
                    <li>{t("guestStepPick")}</li>
                    <li>{t("guestStepStoke")}</li>
                    <li>{t("guestStepStreak")}</li>
                    <li>{t("guestStepBank")}</li>
                  </ol>
                </section>
              ) : (
                <section className="burn-drawer__rules" aria-label={t("howItWorks")}>
                  <h4>{t("howItWorks")}</h4>
                  <ol className="burn-drawer__steps">
                    <li>{t("howStepPick")}</li>
                    <li>{t("howStepBurn")}</li>
                    <li>{t("howStepClimb")}</li>
                    <li>{t("howStepWin")}</li>
                  </ol>
                </section>
              )}

              {guest ? (
                <p className="burn-drawer__note">{t("guestNextStoke")}: {stripGas(projectedTotalDisplay)}</p>
              ) : (
                projectedTotalDisplay !== "--" && (
                  <p className="burn-drawer__note">{t("projectedTotal")}: {projectedTotalDisplay}</p>
                )
              )}

              {prepaidCredit > 0 && (
                <section className="burn-drawer__credit" aria-label={t("prepaidCreditLabel")}>
                  <span>
                    {t("prepaidCreditLabel")}: <strong>{prepaidCreditDisplay}</strong>
                    <em>{t("prepaidCreditHint")}</em>
                  </span>
                  <button
                    type="button"
                    className="mx2-btn mx2-btn--ghost"
                    onClick={() => void dispatch("withdrawCredit")}
                  >
                    <WalletCards size={16} aria-hidden="true" />
                    {t("withdrawCredit")}
                  </button>
                </section>
              )}
            </div>
          ),
        }}
      />
      {celebration && (
        <div
          className="burn-celebrate"
          role="dialog"
          aria-modal="true"
          aria-label={celebration.won ? t("settleWinTitle") : t("settleDoneTitle")}
        >
          <div className="burn-celebrate__card mx2-rise-in">
            <div className="burn-celebrate__medal mx2-float">
              <Trophy size={34} aria-hidden="true" />
            </div>
            <h3>{celebration.won ? t("settleWinTitle") : t("settleDoneTitle")}</h3>
            <p className="burn-celebrate__amount">{celebration.amount}</p>
            <p className="burn-celebrate__body">
              {celebration.won
                ? t("settleWinBody", { amount: celebration.amount })
                : t("settleDoneBody", { amount: celebration.amount })}
            </p>
            <button type="button" className="mx2-btn mx2-btn--primary" onClick={() => setCelebration(null)}>
              {t("celebrationDismiss")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
