/**
 * PhaserPlayArea.tsx — Phaser 3 wrapper for Flappy Dash.
 *
 * Bridges observable state from main.tsx into the Phaser FlappyScene and
 * forwards Phaser dispatch calls back to the blockchain layer.
 *
 * PlayStage provides only the app frame. Score, recovery actions, rules, and
 * leaderboard live inside the flight deck so the game does not feel like a form
 * with a canvas preview.
 */
import * as Phaser from "phaser";
import { useState } from "react";
import { useStateBindings } from "@shared/react";
import type { PlayAreaProps } from "@shared/react";
import { PlayStage } from "@shared/components-react/v2";
import { PhaserGameComponent } from "@framework/phaser";
import { ChevronDown, RefreshCw, RotateCcw, ShieldCheck, Trophy, WalletCards } from "lucide-react";
import { FlappyScene } from "./scenes/FlappyScene";
import { DIFFICULTY_RULES, formatClock, gasDisplay, ruleOf } from "./logic/game-rules";
import type { LeaderEntry, SolveRow } from "./main";
import "./PlayArea.scss";

const GAME_CONFIG: Phaser.Types.Core.GameConfig = {
  scene: [FlappyScene],
  width:  400,
  height: 600,
  backgroundColor: "transparent",
  transparent: true,
};

function clampDifficulty(value: number): number {
  return Math.max(0, Math.min(2, Number.isFinite(value) ? Math.round(value) : 0));
}

function shortHash(value: string, head = 10, tail = 6): string {
  if (!value || value.length <= head + tail + 1) return value;
  return `${value.slice(0, head)}...${value.slice(-tail)}`;
}

function gasAmountDisplay(amount: number): string {
  if (!Number.isFinite(amount)) return "0.00";
  return amount.toLocaleString("en-US", {
    minimumFractionDigits: Math.abs(amount) >= 10 ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

function historyElapsed(row: SolveRow): number {
  const candidate = (row as { solveMs?: unknown; elapsedMs?: unknown }).solveMs
    ?? (row as { solveMs?: unknown; elapsedMs?: unknown }).elapsedMs;
  const value = Number(candidate ?? 0);
  return Number.isFinite(value) ? value : 0;
}

function historyPipes(row: SolveRow): number {
  const value = Number((row as { pipes?: unknown }).pipes ?? 0);
  return Number.isFinite(value) ? value : 0;
}

export default function PhaserPlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { str, bool, val } = useStateBindings(state);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // ── Observables ─────────────────────────────────────────────────────────
  const gameStatus     = str("gameStatus", "idle");
  const seed           = str("seed", "");
  const activeGameId   = str("activeGameId", "0");
  const gameDifficulty = clampDifficulty(Number(val<number>("gameDifficulty", 0) ?? 0));
  const commitment     = str("commitment", "");
  const deadline       = val<number>("deadline", 0) ?? 0;
  const dealtAt        = val<number>("dealtAt", 0) ?? 0;
  const pipesPassed    = val<number>("pipesPassed", 0) ?? 0;
  const poolFree       = val<number>("poolFree", 0) ?? 0;
  const creditGas      = Number(val<number>("credit", 0) ?? 0);
  const isStarting     = bool("isStarting");
  const isDealing      = bool("isDealing");
  const isSubmitting   = bool("isSubmitting");
  const lastPayout     = str("lastPayout", "");
  const myRank         = val<number>("myRank", 0) ?? 0;
  const myTotalWon     = Number(val<number>("myTotalWon", 0) ?? 0);
  const mySolves       = val<number>("mySolves", 0) ?? 0;
  const leaderboard    = val<LeaderEntry[]>("leaderboard", []) ?? [];
  const myHistory      = val<SolveRow[]>("myHistory", []) ?? [];
  const lastStatus     = str("lastStatus", "");
  // Play mode — guest hides GAS-at-stake / pool / reward framing and shows a
  // purely local ("practice") framing. GameFi copy is unchanged.
  const appMode        = str("appMode", "gamefi");
  const isGuest        = appMode === "guest";

  const rule    = ruleOf(gameDifficulty);
  const nowMs   = Date.now();
  const isPlaying = gameStatus === "dealt";
  const isSolved  = gameStatus === "solved";
  const isExpired = gameStatus === "expired" || gameStatus === "refunded";
  const dealPending = gameStatus === "committed";
  const remMs   = isPlaying && deadline > 0 ? Math.max(0, deadline - nowMs) : 0;
  const timeUp  = isPlaying && deadline > 0 && remMs <= 0;
  const busy    = isStarting || isDealing || isSubmitting;

  // ── Localized labels handed to the canvas ────────────────────────────────
  // The Phaser scene only sees the raw bridge snapshot, so every in-canvas
  // string is pre-resolved here through `t` and read back via this.str/val.
  // Templates keep their {placeholders}; the scene substitutes live values.
  const sceneLabels = {
    eyebrow:      t("canvasEyebrow"),
    heroTagline:  isGuest ? t("canvasGuestHeroTagline") : t("canvasHeroTagline"),
    title:        t("appEyebrow"),
    poolChip:     isGuest ? t("canvasGuestPoolChip") : t("canvasPoolChip"),
    awaitingPool: t("canvasAwaitingPool"),
    launch:       t("canvasLaunch"),
    launching:    t("canvasLaunching"),
    flyAgain:     t("canvasFlyAgain"),
    retryRun:     t("canvasRetryRun"),
    tapTitle:     t("canvasTapTitle"),
    tapHint:      t("canvasTapHint"),
    sealingTitle: t("canvasSealingTitle"),
    sealingHint:  t("canvasSealingHint"),
    winTitle:     t("canvasWinTitle"),
    crashTitle:   t("canvasCrashTitle"),
    timeUpTitle:  t("canvasTimeUpTitle"),
    winBody:      isGuest ? t("canvasGuestWinBody") : t("canvasWinBody"),
    crashBody:    t("canvasCrashBody"),
    timeUpBody:   t("canvasTimeUpBody"),
    submitScore:  t("canvasSubmitScore"),
    submitting:   t("canvasSubmitting"),
    playAgain:    t("canvasPlayAgain"),
    backToLobby:  t("canvasBackToLobby"),
    tryAgain:     t("canvasTryAgain"),
    routes: DIFFICULTY_RULES.map((r) => ({
      title:     t("canvasRouteTitle", { name: t(`difficulty_${r.key}`) }),
      meta:      t("canvasRouteMeta", { gates: r.targetPipes, minutes: Math.round(r.limitMs / 60000) }),
      cardName:  t(`difficulty_${r.key}`),
      cardGates: t("canvasCardGates", { gates: r.targetPipes }),
      entry:     isGuest ? t("canvasGuestEntry") : t("canvasEntry", { amount: gasDisplay(r.entryFixed8) }),
      reward:    isGuest
        ? t("canvasGuestRouteReward", { gates: r.targetPipes })
        : `${gasDisplay(r.rewardFixed8)} GAS`,
    })),
  };

  // ── Bridge state pushed into the Phaser scene ────────────────────────────
  const bridgeState = {
    appMode,
    gameStatus,
    seed,
    activeGameId,
    gameDifficulty,
    commitment,
    deadline,
    dealtAt,
    pipesPassed,
    poolFree,
    credit: creditGas,
    isStarting,
    isDealing,
    isSubmitting,
    lastPayout,
    myRank,
    myTotalWon,
    lastStatus,
    sceneLabels,
  };

  // ── PlayStage chrome ─────────────────────────────────────────────────────
  const stageTitle = (() => {
    if (isSubmitting) return t("statusSubmitting");
    if (isDealing || dealPending) return t("statusShuffling");
    if (isPlaying) return t("playingTitle", { difficulty: t(`difficulty_${rule.key}`) });
    if (isSolved) return t("statusWonTitle");
    if (isExpired) return t("expiredBanner");
    return t("lobbyTitle");
  })();

  const hudItems = [
    {
      label: isGuest ? t("guestModeHudLabel") : t("scoreReward"),
      value: isGuest ? t("guestModeHudValue") : `${gasDisplay(rule.rewardFixed8)} GAS`,
      accent: true,
    },
    {
      label: t("scoreTime"),
      value: isPlaying ? formatClock(remMs) : formatClock(rule.limitMs),
    },
    {
      label: t("scorePipes"),
      value: `${pipesPassed}/${rule.targetPipes}`,
    },
  ];

  const drawerActions = [
    ...(dealPending && !isDealing
      ? [
          {
            label:   t("checkDealAgain"),
            onClick: () => void dispatch("retryDeal", {}),
            icon:    <RefreshCw size={16} aria-hidden="true" />,
            hint:    t("statusDealPending"),
          },
        ]
      : []),
    ...(timeUp || (dealPending && !isDealing)
      ? [
          {
            label:   timeUp ? t("timeUpAction") : t("releaseAction"),
            onClick: () => void dispatch("expireGame", {}),
            icon:    <RotateCcw size={16} aria-hidden="true" />,
            hint:    t("releaseHint"),
          },
        ]
      : []),
  ];

  return (
    <div className="flappy-playarea mx2 mx2-cat-game" aria-busy={busy || undefined}>
      <PlayStage
        category="game"
        className="flappy-playstage"
        stage={{
          eyebrow:  t("appEyebrow"),
          title:    stageTitle,
          subtitle: isGuest ? t("guestSubtitle") : t("appSubtitle"),
          badges: (
            <>
              <span className="mx2-badge" data-tone="accent">
                <span className="mx2-badge__dot" /> {t("networkBadge")}
              </span>
              {myRank > 0 && (
                <span className="mx2-badge">{t("rankBadge", { rank: myRank })}</span>
              )}
              {creditGas > 0 && (
                <span className="mx2-badge" data-tone="success">
                  <WalletCards size={14} aria-hidden="true" /> {t("creditLabel")}
                </span>
              )}
            </>
          ),
        }}
        scene={
          <div className="flappy-stage-shell">
            <PhaserGameComponent
              config={GAME_CONFIG}
              state={bridgeState}
              dispatch={dispatch}
              className="flappy-phaser-canvas"
              ariaLabel="Flappy Dash arcade game"
              loadingLabel="Opening flight deck"
              preserveLogicalSize
            />
            <div className="flappy-stage-hud" aria-label={t("routeSummary")}>
              {hudItems.map((item) => (
                <div
                  className="flappy-stage-hud__metric"
                  data-accent={item.accent ? "true" : undefined}
                  key={`${item.label}-${item.value}`}
                >
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
              ))}
              <button
                type="button"
                className="flappy-stage-hud__drawer"
                onClick={() => setDrawerOpen((open) => !open)}
                aria-expanded={drawerOpen}
              >
                <span>{t("drawerTitleShort")}</span>
                <ChevronDown size={16} aria-hidden="true" data-open={drawerOpen ? "true" : undefined} />
              </button>
            </div>
            {drawerOpen && (
              <section className="flappy-ingame-drawer" aria-label={t("drawerTitle")}>
                <div className="flappy-ingame-drawer__head">
                  <Trophy size={18} aria-hidden="true" />
                  <div>
                    <h3>{t("drawerTitle")}</h3>
                    <p>{t("fairnessShort")}</p>
                  </div>
                </div>

                <section className="flappy-ingame-drawer__summary" aria-label={t("sidebarTitle")}>
                  <span>
                    <small>{isGuest ? t("guestPlayModeLabel") : t("scoreWon")}</small>
                    <strong>
                      {isGuest ? t("guestPlayModeValue") : `${gasAmountDisplay(myTotalWon)} GAS`}
                    </strong>
                  </span>
                  <span>
                    <small>{t("rankLabel")}</small>
                    <strong>{myRank > 0 ? `#${myRank}` : "--"}</strong>
                  </span>
                  <span>
                    <small>{t("solvesCount", { count: mySolves })}</small>
                    <strong>{mySolves}</strong>
                  </span>
                  <span>
                    <small>{t("networkBadge")}</small>
                    <strong>{activeGameId !== "0" ? `#${activeGameId}` : t("lobbyReady")}</strong>
                  </span>
                </section>

                {drawerActions.length > 0 && (
                  <div className="flappy-ingame-drawer__actions">
                    {drawerActions.map((action) => (
                      <button type="button" key={action.label} onClick={action.onClick} title={action.hint}>
                        {action.icon}
                        <span>{action.label}</span>
                      </button>
                    ))}
                  </div>
                )}

                <div className="flappy-drawer">
                  <div className="flappy-drawer__head">
                    <img src="./logo.webp" alt="" width={40} height={40} draggable={false} />
                    <p>{isGuest ? t("guestLeaderboardIntro") : t("leaderboardIntro")}</p>
                  </div>

                  <section className="flappy-drawer__section" aria-label={t("leaderboardTitle")}>
                    <div className="flappy-drawer__section-head">
                      <h4>{t("leaderboardTitle")}</h4>
                      <button
                        type="button"
                        className="mx2-btn mx2-btn--ghost"
                        onClick={() => void dispatch("refreshLeaderboard", {})}
                      >
                        <RefreshCw size={16} aria-hidden="true" />
                        {t("refreshRanks")}
                      </button>
                    </div>
                    {leaderboard.length > 0 ? (
                      <ol className="flappy-ranks">
                        {leaderboard.slice(0, 10).map((entry) => (
                          <li
                            key={entry.address}
                            className="flappy-ranks__row"
                            data-me={entry.isUser ? "true" : undefined}
                          >
                            <span className="flappy-ranks__rank">#{entry.rank}</span>
                            <span className="flappy-ranks__addr">{shortHash(entry.address)}</span>
                            <span className="flappy-ranks__solves">
                              {t("solvesCount", { count: entry.solves })}
                            </span>
                            <span className="flappy-ranks__won">
                              {isGuest
                                ? t("historyPipes", { pipes: entry.totalWon })
                                : `${gasAmountDisplay(entry.totalWon)} GAS`}
                            </span>
                            {entry.isUser && (
                              <span className="flappy-ranks__me">{t("youTag")}</span>
                            )}
                          </li>
                        ))}
                      </ol>
                    ) : (
                      <p className="flappy-drawer__empty">{t("leaderboardEmpty")}</p>
                    )}
                  </section>

                  <section className="flappy-drawer__section" aria-label={t("historyTitle")}>
                    <h4>{t("historyTitle")}</h4>
                    {myHistory.length > 0 ? (
                      <ul className="flappy-history">
                        {myHistory.slice(0, 8).map((row) => (
                          <li key={row.gameId} className="flappy-history__row">
                            <span>#{row.gameId}</span>
                            <span>{t(`difficulty_${ruleOf(Number(row.difficulty)).key}`)}</span>
                            <span>{formatClock(historyElapsed(row))}</span>
                            <span>{t("historyPipes", { pipes: historyPipes(row) })}</span>
                            <span className="flappy-history__won">{row.payout}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="flappy-drawer__empty">{t("historyEmpty")}</p>
                    )}
                  </section>

                  <section className="flappy-drawer__section flappy-drawer__rules" aria-label={t("rulesTitle")}>
                    <h4>{t("rulesTitle")}</h4>
                    <p>{t("rulesCopy")}</p>
                  </section>

                  <section className="flappy-drawer__section flappy-drawer__fairness" aria-label={t("fairnessTitle")}>
                    <h4><ShieldCheck size={16} aria-hidden="true" /> {t("fairnessTitle")}</h4>
                    <p>{t("fairnessCopy")}</p>
                    <p className="flappy-drawer__status">{t("rulesShort")}</p>
                    {activeGameId !== "0" && commitment && (
                      <p className="flappy-drawer__seed">
                        {t("commitmentLine", { gameId: activeGameId, commitment: shortHash(commitment) })}
                      </p>
                    )}
                    {lastStatus && <p className="flappy-drawer__status">{lastStatus}</p>}
                  </section>

                  {creditGas > 0 && (
                    <section className="flappy-drawer__credit" aria-label={t("withdrawTitle")}>
                      <span>
                        {t("creditLabel")}: <strong>{gasAmountDisplay(creditGas)} GAS</strong>
                        <em>{t("withdrawHint")}</em>
                      </span>
                      <button
                        type="button"
                        className="mx2-btn mx2-btn--ghost"
                        onClick={() => void dispatch("withdrawWinnings", {})}
                      >
                        <WalletCards size={16} aria-hidden="true" />
                        {t("withdrawAction", { amount: gasAmountDisplay(creditGas) })}
                      </button>
                    </section>
                  )}
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
