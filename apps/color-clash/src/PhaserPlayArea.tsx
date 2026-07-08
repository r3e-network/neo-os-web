import { useStateBindings } from "@shared/react";
import type { PlayAreaProps } from "@shared/react";
import { PlayStage } from "@shared/components-react/v2";
import { PhaserGameComponent } from "@framework/phaser";
import { RefreshCw, RotateCcw, ShieldCheck, Trophy, WalletCards } from "lucide-react";
import { ColorClashScene } from "./scenes/ColorClashScene";
import { formatClock, gasDisplay, payoutFixed8, ruleOf } from "./logic/game-rules";
import "./PlayArea.scss";

const GAME_CONFIG = { scene: [ColorClashScene], width: 420, height: 580 } as const;
const DIFF_KEYS = ["easy", "medium", "hard"] as const;

interface LeaderRow {
  address?: string;
  player?: string;
  rank?: number;
  totalWon?: number;
  solves?: number;
  solved?: number;
  isUser?: boolean;
}

interface HistoryRow {
  gameId: string;
  difficulty: number;
  payout: number | string;
  solveMs: number;
  undos: number;
  seqAchieved: number;
}

function clampDifficulty(value: number): number {
  return Math.max(0, Math.min(2, Number.isFinite(value) ? Math.round(value) : 0));
}

function shortAddr(addr: string): string {
  return addr.length > 14 ? `${addr.slice(0, 8)}...${addr.slice(-4)}` : addr;
}

function gasAmountDisplay(amount: number): string {
  if (!Number.isFinite(amount)) return "0.00";
  return amount.toLocaleString("en-US", {
    minimumFractionDigits: Math.abs(amount) >= 10 ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

function payoutDisplay(value: number | string): string {
  return typeof value === "number" ? `${gasDisplay(value)} GAS` : value;
}

export default function PhaserPlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { str, bool, val, num } = useStateBindings(state);
  const gameStatus = str("gameStatus", "idle");
  const gameDifficulty = clampDifficulty(num("gameDifficulty"));
  const activeGameId = str("activeGameId", "0");
  const sequence = str("sequence", "");
  const playerSequence = str("playerSequence", "");
  const commitment = str("commitment", "");
  const deadline = val<number>("deadline", 0) ?? 0;
  const dealtAt = val<number>("dealtAt", 0) ?? 0;
  const undosUsed = val<number>("undosUsed", 0) ?? 0;
  const seqAchieved = val<number>("seqAchieved", 0) ?? 0;
  const poolFree = val<number>("poolFree", 0) ?? 0;
  const credit = val<number>("credit", 0) ?? 0;
  const myRank = val<number>("myRank", 0) ?? 0;
  const myTotalWon = val<number>("myTotalWon", 0) ?? 0;
  const mySolves = val<number>("mySolves", 0) ?? 0;
  const leaderboard = val<LeaderRow[]>("leaderboard", []) ?? [];
  const myHistory = val<HistoryRow[]>("myHistory", []) ?? [];
  const isStarting = bool("isStarting");
  const isDealing = bool("isDealing");
  const isSubmitting = bool("isSubmitting");
  const lastStatus = str("lastStatus", "");
  const rule = ruleOf(gameDifficulty);
  const remainingMs = deadline > 0 ? Math.max(0, deadline - Date.now()) : 0;
  const isPlaying = gameStatus === "dealt";
  const isSolved = gameStatus === "solved";
  const dealPending = gameStatus === "committed" || lastStatus === "deal-pending";
  const timeUp = isPlaying && deadline > 0 && remainingMs <= 0;
  const completedSequence =
    lastStatus === "all-correct" ||
    (sequence.length > 0 && playerSequence.length >= sequence.length);
  const canClaim = isPlaying && completedSequence && !isSubmitting;
  const canRelease = timeUp || (isPlaying && lastStatus === "wrong") || dealPending;
  const busy = isStarting || isDealing || isSubmitting;

  const bridgeState = {
    activeGameId,
    gameStatus,
    gameDifficulty,
    sequence,
    playerSequence,
    commitment,
    deadline,
    dealtAt,
    undosUsed,
    seqAchieved,
    isStarting,
    isDealing,
    isSubmitting,
    poolFree,
    credit,
    lastStatus,
  };

  const stageTitle =
    isSubmitting
      ? t("statusSubmitting")
      : isDealing || dealPending
        ? t("statusShuffling")
        : isPlaying
          ? t("repeatPhase")
          : isSolved
            ? t("statusWonTitle")
            : gameStatus === "expired" || gameStatus === "refunded"
              ? t("expiredBanner")
              : t("lobbyTitle");

  const secondaryActions = [
    ...(dealPending && !isDealing
      ? [{
          label: t("checkDealAgain"),
          onClick: () => void dispatch("retryDeal"),
          icon: <RefreshCw size={16} aria-hidden="true" />,
          hint: t("statusDealPending"),
        }]
      : []),
    ...(canRelease
      ? [{
          label: timeUp ? t("timeUpAction") : t("releaseAction"),
          onClick: () => void dispatch("expireGame"),
          icon: <RotateCcw size={16} aria-hidden="true" />,
          hint: t("releaseHint"),
        }]
      : []),
    ...(credit > 0 && !isPlaying
      ? [{
          label: t("withdrawAction", { amount: gasAmountDisplay(credit) }),
          onClick: () => void dispatch("withdrawWinnings"),
          icon: <WalletCards size={16} aria-hidden="true" />,
          hint: t("withdrawHint"),
        }]
      : []),
  ];

  return (
    <div className="cclash-playarea mx2 mx2-cat-game" aria-busy={busy || undefined}>
      <PlayStage
        category="game"
        className="cclash-stage"
        stage={{
          eyebrow: t("appEyebrow"),
          title: stageTitle,
          subtitle: t("appSubtitle"),
          badges: (
            <>
              <span className="mx2-badge" data-tone="accent">
                <span className="mx2-badge__dot" /> {t("networkBadge")}
              </span>
              {myRank > 0 && <span className="mx2-badge">{t("rankBadge", { rank: myRank })}</span>}
              {credit > 0 && (
                <span className="mx2-badge" data-tone="success">
                  <WalletCards size={14} aria-hidden="true" /> {t("creditLabel")}
                </span>
              )}
            </>
          ),
        }}
        scene={<PhaserGameComponent config={GAME_CONFIG} state={bridgeState} dispatch={dispatch} />}
        score={[
          {
            label: t("scoreReward"),
            value: `${gasDisplay(payoutFixed8(rule.reward, undosUsed))} GAS`,
            accent: true,
          },
          {
            label: t("scoreTime"),
            value: isPlaying && deadline > 0 ? formatClock(remainingMs) : formatClock(rule.limitMs),
          },
          { label: t("scoreWon"), value: `${gasAmountDisplay(myTotalWon)} GAS` },
          { label: t("rankLabel"), value: myRank > 0 ? `#${myRank}` : "--" },
        ]}
        actions={{
          primary: canClaim
            ? {
                label: t("submitAction"),
                onClick: () => void dispatch("submitSolution"),
                disabled: isSubmitting,
                loading: isSubmitting,
                icon: <Trophy size={16} aria-hidden="true" />,
                hint: t("submitHint"),
              }
            : undefined,
          secondary: secondaryActions.length > 0 ? secondaryActions : undefined,
        }}
        drawerToggleLabel={t("leaderboardTitle")}
        drawer={{
          title: t("drawerTitle"),
          children: (
            <div className="cclash-drawer">
              <div className="cclash-drawer__head">
                <img src="./logo.webp" alt="" width={40} height={40} draggable={false} />
                <p>{t("leaderboardIntro")}</p>
              </div>

              <section className="cclash-drawer__summary" aria-label={t("sidebarTitle")}>
                <div>
                  <span>{t("scoreWon")}</span>
                  <strong>{gasAmountDisplay(myTotalWon)} GAS</strong>
                </div>
                <div>
                  <span>{t("rankLabel")}</span>
                  <strong>{myRank > 0 ? `#${myRank}` : "--"}</strong>
                </div>
                <div>
                  <span>{t("solvesCount", { count: mySolves })}</span>
                  <strong>{mySolves}</strong>
                </div>
              </section>

              <section className="cclash-drawer__section" aria-label={t("leaderboardTitle")}>
                <div className="cclash-drawer__section-head">
                  <h4>{t("leaderboardTitle")}</h4>
                  <button type="button" className="mx2-btn mx2-btn--ghost" onClick={() => void dispatch("refreshLeaderboard")}>
                    <RefreshCw size={16} aria-hidden="true" />
                    {t("refreshRanks")}
                  </button>
                </div>
                {leaderboard.length === 0 ? (
                  <p className="cclash-drawer__empty">{t("leaderboardEmpty")}</p>
                ) : (
                  <ol className="cclash-ranks">
                    {leaderboard.slice(0, 10).map((rawEntry, index) => {
                      const address = String(rawEntry.address ?? rawEntry.player ?? "");
                      const solves = Number(rawEntry.solves ?? rawEntry.solved ?? 0);
                      const rank = rawEntry.rank ?? index + 1;
                      const isUser = rawEntry.isUser ?? (myRank > 0 && rank === myRank);
                      return (
                        <li key={address || index} className="cclash-ranks__row" data-me={isUser ? "true" : undefined}>
                          <span className="cclash-ranks__rank">#{rank}</span>
                          <span className="cclash-ranks__addr">{shortAddr(address)}</span>
                          <span className="cclash-ranks__solves">{t("solvesCount", { count: solves })}</span>
                          <span className="cclash-ranks__won">{gasAmountDisplay(Number(rawEntry.totalWon ?? 0))} GAS</span>
                          {isUser && <span className="cclash-ranks__me">{t("youTag")}</span>}
                        </li>
                      );
                    })}
                  </ol>
                )}
              </section>

              <section className="cclash-drawer__section" aria-label={t("historyTitle")}>
                <h4>{t("historyTitle")}</h4>
                {myHistory.length === 0 ? (
                  <p className="cclash-drawer__empty">{t("historyEmpty")}</p>
                ) : (
                  <ul className="cclash-history">
                    {myHistory.slice(0, 8).map((row) => (
                      <li key={row.gameId} className="cclash-history__row">
                        <span>#{row.gameId}</span>
                        <span>{t(`difficulty_${DIFF_KEYS[clampDifficulty(row.difficulty)]}`)}</span>
                        <span>{t("scoreSeqLen")}: {row.seqAchieved}</span>
                        <span className="cclash-history__won">+{payoutDisplay(row.payout)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="cclash-drawer__section cclash-drawer__rules" aria-label={t("rulesTitle")}>
                <h4>{t("rulesTitle")}</h4>
                <p>{t("rulesCopy")}</p>
              </section>

              <section className="cclash-drawer__section cclash-drawer__fairness" aria-label={t("fairnessTitle")}>
                <h4><ShieldCheck size={16} aria-hidden="true" /> {t("fairnessTitle")}</h4>
                <p>{t("fairnessCopy")}</p>
                {activeGameId !== "0" && commitment && (
                  <p className="cclash-drawer__commitment">
                    {t("commitmentLine", { gameId: activeGameId, commitment: shortAddr(commitment) })}
                  </p>
                )}
              </section>

              {credit > 0 && (
                <section className="cclash-drawer__credit" aria-label={t("withdrawTitle")}>
                  <span>
                    {t("creditLabel")}: <strong>{gasAmountDisplay(credit)} GAS</strong>
                    <em>{t("withdrawHint")}</em>
                  </span>
                  <button type="button" className="mx2-btn mx2-btn--ghost" onClick={() => void dispatch("withdrawWinnings")}>
                    <WalletCards size={16} aria-hidden="true" />
                    {t("withdrawAction", { amount: gasAmountDisplay(credit) })}
                  </button>
                </section>
              )}
            </div>
          ),
        }}
      />
    </div>
  );
}
