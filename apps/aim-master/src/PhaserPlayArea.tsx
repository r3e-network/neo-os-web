/**
 * PhaserPlayArea.tsx — Phaser 3 wrapper for the Aim Master archery game.
 *
 * Bridges the React/framework observable state into the AimMasterScene and
 * forwards scene dispatch calls back to main.tsx. All blockchain / TEE logic
 * lives in main.tsx; this component owns only the Phaser canvas lifecycle.
 */
import { useState } from "react";
import { useStateBindings } from "@shared/react";
import type { PlayAreaProps } from "@shared/react";
import { PlayStage } from "@shared/components-react/v2";
import { PhaserGameComponent } from "@framework/phaser";
import type { LeaderEntry, SolveRow } from "@framework/game";
import { ChevronDown, RefreshCw, ShieldCheck, Trophy, WalletCards } from "lucide-react";
import { AimMasterScene } from "./scenes/AimMasterScene";
import { ruleOf, formatClock, gasDisplay } from "./logic/game-rules";
import "./PlayArea.scss";

import type * as Phaser from "phaser";

const GAME_CONFIG: Phaser.Types.Core.GameConfig = {
  scene:  [AimMasterScene],
  width:  520,
  height: 720,
  backgroundColor: "transparent",
  transparent: true,
};

function shortHash(value: string, head = 10, tail = 6): string {
  if (!value || value.length <= head + tail + 1) return value;
  return `${value.slice(0, head)}...${value.slice(-tail)}`;
}

export default function PhaserPlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { str, bool, val } = useStateBindings(state);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // ── Bridge state snapshot ────────────────────────────────────────────────
  const bridgeState = {
    gameStatus:      str("gameStatus", "idle"),
    pattern:         str("pattern", ""),
    targetAccuracy:  val<number>("targetAccuracy", 3) ?? 3,
    gameDifficulty:  val<number>("gameDifficulty", 0) ?? 0,
    poolFree:        val<number>("poolFree", 0) ?? 0,
    ringsHit:        val<number>("ringsHit", 0) ?? 0,
    roundIndex:      val<number>("roundIndex", 0) ?? 0,
    roundResults:    val("roundResults") ?? [],
    isStarting:      bool("isStarting"),
    isDealing:       bool("isDealing"),
    isSubmitting:    bool("isSubmitting"),
    lastStatus:      str("lastStatus", ""),
    deadline:        val<number>("deadline", 0) ?? 0,
    dealtAt:         val<number>("dealtAt", 0) ?? 0,
  };

  // ── Derived display values (for PlayStage chrome) ─────────────────────────
  const gameStatus     = str("gameStatus", "idle");
  const gameDifficulty = val<number>("gameDifficulty", 0) ?? 0;
  const activeGameId   = str("activeGameId", "0");
  const commitment     = str("commitment", "");
  const deadline       = val<number>("deadline", 0) ?? 0;
  const targetAccuracy = val<number>("targetAccuracy", 3) ?? 3;
  const ringsHit       = val<number>("ringsHit", 0) ?? 0;
  const creditGas      = val<number>("credit", 0) ?? 0;
  const myRank         = val<number>("myRank", 0) ?? 0;
  const myTotalWon     = val<number>("myTotalWon", 0) ?? 0;
  const leaderboard    = val<LeaderEntry[]>("leaderboard", []) ?? [];
  const myHistory      = val<SolveRow[]>("myHistory", []) ?? [];
  const isSubmitting   = bool("isSubmitting");
  const isDealing      = bool("isDealing") || bool("isStarting");
  const timeUp         = gameStatus === "dealt" && deadline > 0 && deadline <= Date.now();

  const rule = ruleOf(
    gameStatus === "dealt" || gameStatus === "committed" ? gameDifficulty : 0,
  );

  // Remaining time (rough — scene handles precise countdown)
  const remainingMs = deadline > 0 ? Math.max(0, deadline - Date.now()) : rule.limitMs;

  const stageTitle =
    isSubmitting ? t("submitRound")
    : isDealing   ? t("statusShuffling")
    : gameStatus === "dealt"
      ? t("playingTitle", { difficulty: t(`difficulty_${rule.key}`) })
    : gameStatus === "solved"  ? t("statusWonTitle")
    : gameStatus === "expired" ? t("expiredBanner")
    : t("lobbyTitle");

  const hudItems = [
    {
      label: t("rewardMetric"),
      value: `${gasDisplay(rule.rewardFixed8)} GAS`,
      accent: true,
    },
    {
      label: t("timeMetric"),
      value: formatClock(remainingMs),
      accent: timeUp,
    },
    {
      label: t("hitsMetric"),
      value: `${ringsHit}/${targetAccuracy}`,
      accent: false,
    },
  ];
  const drawerActions = [
    ...(gameStatus === "committed"
      ? [{
          label: t("checkDealAgain"),
          icon: <RefreshCw size={15} aria-hidden="true" />,
          onClick: () => void dispatch("retryDeal", {}),
          disabled: isDealing,
          hint: t("shufflingCopy"),
        }]
      : []),
    ...(timeUp || (gameStatus === "committed" && !isDealing)
      ? [{
          label: t("releaseAction"),
          icon: <RefreshCw size={15} aria-hidden="true" />,
          onClick: () => void dispatch("expireGame", {}),
          hint: t("releaseHint"),
        }]
      : []),
    ...(creditGas > 0 && gameStatus !== "dealt"
      ? [{
          label: t("withdrawAction", { amount: creditGas.toFixed(2) }),
          icon: <WalletCards size={15} aria-hidden="true" />,
          onClick: () => void dispatch("withdrawWinnings", {}),
          hint: t("withdrawHint"),
        }]
      : []),
  ];

  return (
    <div className="aim-playarea mx2 mx2-cat-game" aria-busy={isDealing || isSubmitting || undefined}>
      <PlayStage
        category="game"
        className="aim-playstage"
        stage={{
          eyebrow:  t("appEyebrow"),
          title:    stageTitle,
          subtitle: t("appSubtitle"),
          badges: (
            <>
              <span className="mx2-badge" data-tone="accent">
                <span className="mx2-badge__dot" />
                {t("networkBadge")}
              </span>
              {myRank > 0 && (
                <span className="mx2-badge">{t("rankBadge", { rank: myRank })}</span>
              )}
            </>
          ),
        }}
        scene={
          <div className="aim-stage-shell">
            <PhaserGameComponent
              config={GAME_CONFIG}
              state={bridgeState}
              dispatch={dispatch}
              className="aim-phaser-canvas"
              ariaLabel="Aim Master archery game"
              loadingLabel="Opening target range"
            />
            <div className="aim-stage-hud" aria-label={t("routeSummary")}>
              {hudItems.map((item) => (
                <div
                  className="aim-stage-hud__metric"
                  data-accent={item.accent ? "true" : undefined}
                  key={`${item.label}-${item.value}`}
                >
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
              ))}
              <button
                type="button"
                className="aim-stage-hud__drawer"
                onClick={() => setDrawerOpen((open) => !open)}
                aria-expanded={drawerOpen}
              >
                <span>{t("drawerTitleShort")}</span>
                <ChevronDown size={16} aria-hidden="true" data-open={drawerOpen ? "true" : undefined} />
              </button>
            </div>
            {drawerOpen && (
              <section className="aim-ingame-drawer" aria-label={t("drawerTitle")}>
                <div className="aim-ingame-drawer__head">
                  <Trophy size={18} aria-hidden="true" />
                  <div>
                    <h3>{t("drawerTitle")}</h3>
                    <p>{t("fairnessShort")}</p>
                  </div>
                </div>
                <div className="aim-ingame-drawer__grid">
                  <span>
                    <small>{t("creditLabel")}</small>
                    <strong>{creditGas.toFixed(2)} GAS</strong>
                  </span>
                  <span>
                    <small>{t("scoreWon")}</small>
                    <strong>{myTotalWon.toFixed(2)} GAS</strong>
                  </span>
                  <span>
                    <small>{t("scoreRings")}</small>
                    <strong>{ringsHit}/{targetAccuracy}</strong>
                  </span>
                  <span>
                    <small>{t("scoreTime")}</small>
                    <strong>{formatClock(remainingMs)}</strong>
                  </span>
                </div>
                {drawerActions.length > 0 && (
                  <div className="aim-ingame-drawer__actions">
                    {drawerActions.map((action) => (
                      <button
                        type="button"
                        key={action.label}
                        onClick={action.onClick}
                        disabled={action.disabled}
                        title={action.hint}
                      >
                        {action.icon}
                        <span>{action.label}</span>
                      </button>
                    ))}
                  </div>
                )}
                <div className="aim-drawer">
                  <div className="aim-drawer__head">
                    <img src="./logo.webp" alt="" width={40} height={40} draggable={false} />
                    <p>{t("leaderboardIntro")}</p>
                  </div>
                  <h4>{t("leaderboardTitle")}</h4>
                  {leaderboard.length > 0 ? (
                    <ol className="aim-ranks">
                      {leaderboard.slice(0, 10).map((entry) => (
                        <li
                          key={entry.address}
                          className="aim-ranks__row"
                          data-me={entry.isUser ? "true" : undefined}
                        >
                          <span className="aim-ranks__rank">#{entry.rank}</span>
                          <span className="aim-ranks__addr">{shortHash(entry.address)}</span>
                          <span className="aim-ranks__solves">{t("solvesCount", { count: entry.solves })}</span>
                          <span className="aim-ranks__won">{entry.totalWon.toFixed(2)} GAS</span>
                          {entry.isUser && <span className="aim-ranks__me">{t("youTag")}</span>}
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p>{t("leaderboardEmpty")}</p>
                  )}
                  <button
                    type="button"
                    className="mx2-btn mx2-btn--ghost aim-drawer__refresh"
                    onClick={() => void dispatch("refreshLeaderboard", {})}
                  >
                    <RefreshCw size={16} aria-hidden="true" />
                    {t("refreshRanks")}
                  </button>
                  <h4>{t("historyTitle")}</h4>
                  {myHistory.length > 0 ? (
                    <ul className="mx2-history">
                      {myHistory.map((row) => {
                        const rowHits = Number(row.ringsHit ?? 0);
                        return (
                          <li
                            key={row.gameId}
                            className="mx2-history__item"
                            data-outcome={row.payout && Number.parseFloat(row.payout) > 0 ? "won" : "lost"}
                          >
                            <span className="mx2-history__face">
                              {t(`difficulty_${ruleOf(row.difficulty).key}`)}
                            </span>
                            <span className="mx2-history__stake">{formatClock(row.solveMs)}</span>
                            <span className="mx2-history__result">
                              {t("historyRings", { rings: Number.isFinite(rowHits) ? rowHits : 0 })}
                            </span>
                            <span className="mx2-history__stake">{row.payout}</span>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p>{t("historyEmpty")}</p>
                  )}
                  <h4>{t("rulesTitle")}</h4>
                  <p>{t("rulesCopy")}</p>
                  <h4>{t("fairnessTitle")}</h4>
                  <p>{t("fairnessCopy")}</p>
                  {commitment && (
                    <p className="aim-drawer__seed">
                      {t("commitmentLine", {
                        commitment: shortHash(commitment, 12, 8),
                        gameId: activeGameId,
                      })}
                    </p>
                  )}
                </div>
                <div className="aim-ingame-drawer__fairness">
                  <ShieldCheck size={17} aria-hidden="true" />
                  <p>{t("rulesShort")}</p>
                </div>
              </section>
            )}
          </div>
        }
        actions={{}}
      />
    </div>
  );
}
