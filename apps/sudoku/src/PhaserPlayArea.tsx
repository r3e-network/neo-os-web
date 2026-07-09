/**
 * PhaserPlayArea.tsx — Phaser 3 wrapper for the Sudoku miniapp.
 *
 * Replaces the React-canvas PlayArea.tsx for the Phaser renderer path.
 * All blockchain / session logic stays in main.tsx; this component
 * bridges the observable state into SudokuScene and forwards Phaser
 * dispatch calls back to main.tsx.
 */
import { useState } from "react";
import { ChevronDown, RefreshCcw, RotateCcw, ShieldCheck, Trophy, WalletCards } from "lucide-react";
import { useStateBindings } from "@shared/react";
import type { PlayAreaProps } from "@shared/react";
import { PlayStage } from "@shared/components-react/v2";
import { PhaserGameComponent } from "@framework/phaser";
import { SudokuScene } from "./scenes/SudokuScene";
import { DIFFICULTY_RULES, formatClock, gasDisplay, ruleOf } from "./logic/game-rules";
import "./PlayArea.scss";

// GameConfig — scene array must not be readonly (satisfies Phaser.Types.Core.GameConfig)
const GAME_CONFIG: Phaser.Types.Core.GameConfig = {
  scene: [SudokuScene],
  width: 520,
  height: 720,
  backgroundColor: "transparent",
  transparent: true,
};

export default function PhaserPlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { str, bool, val } = useStateBindings(state);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const gameStatus     = str("gameStatus", "idle");
  const activeGameId   = str("activeGameId", "0");
  const gameDifficulty = val<number>("gameDifficulty", 0) ?? 0;
  const clues          = str("clues", "");
  const undosUsed      = val<number>("undosUsed", 0) ?? 0;
  const deadline       = val<number>("deadline", 0) ?? 0;
  const dealtAt        = val<number>("dealtAt", 0) ?? 0;
  const poolFree       = val<number>("poolFree", 0) ?? 0;
  const isStarting     = bool("isStarting");
  const isDealing      = bool("isDealing");
  const isSubmitting   = bool("isSubmitting");
  const isUndoing      = bool("isUndoing");
  const lastStatus     = str("lastStatus", t("statusReady"));
  const myTotalWon     = val<number>("myTotalWon", 0) ?? 0;
  const myRank         = val<number>("myRank", 0) ?? 0;
  const creditGas      = val<number>("credit", 0) ?? 0;
  const walletConnected = bool("walletConnected");
  const progressionReady = bool("progressionReady");
  const progressionRequiredDifficulty =
    val<number>("progressionRequiredDifficulty", 0) ?? 0;

  // Pre-translated canvas strings. BaseScene reads only bridge state, so every
  // label the Phaser scene draws is localised here and handed over as a plain
  // object under `labels` — new bridge data only, no renamed/removed keys.
  const canvasLabels = {
    vaultTitle: t("lobbyVaultTitle"),
    vaultSub: t("lobbyVaultSub"),
    diffNames: [t("diffName_0"), t("diffName_1"), t("diffName_2")],
    diffCopy: [t("difficulty_easy"), t("difficulty_medium"), t("difficulty_hard")],
    diffRewards: DIFFICULTY_RULES.map((r) => `${gasDisplay(r.rewardFixed8)} GAS`),
    sealing: t("statusShuffling"),
    undoTemplate: t("undoLeftTemplate"),
    undoNone: t("undoNoneLabel"),
    poolTemplate: t("poolLimitTemplate"),
    gateConnect: t("gateConnect"),
    gateChecking: t("gateChecking"),
    gateRouteLocked: t("gateRouteLockedTemplate"),
    gatePoolLow: t("gatePoolLowTemplate"),
    gateChoose: t("gateChoose"),
    act: {
      open: t("startAction"),
      playAgain: t("playAgainAction"),
      tryAgain: t("tryAgainAction"),
      starting: t("startingShort"),
      connect: t("connectWalletAction"),
      routeLocked: t("routeLockedAction"),
      poolLow: t("poolLowShort"),
      submit: t("submitAction"),
      submitting: t("submittingShort"),
      working: t("workingShort"),
      timeUp: t("timeUpAction"),
      tooLate: t("tooLateAction"),
      wait: t("waitToSubmitAction"),
      solve: t("solveToUnlockAction"),
    },
    msg: {
      deadlinePassed: t("deadlinePassedMsg"),
      deadlineClose: t("deadlineCloseMsg"),
      submitUnlock: t("submitUnlockTemplate"),
    },
    resultSolved: t("resultCaptionSolved"),
    resultExpired: t("resultCaptionExpired"),
  };

  // Plain-object snapshot pushed into the Phaser bridge on every render
  const bridgeState = {
    activeGameId,
    gameStatus,
    gameDifficulty,
    clues,
    undosUsed,
    deadline,
    dealtAt,
    poolFree,
    isStarting,
    isDealing,
    isSubmitting,
    isUndoing,
    lastStatus,
    walletConnected,
    credit: creditGas,
    progressionReady,
    progressionRequiredDifficulty,
    labels: canvasLabels,
  };

  // Stage title follows game phase
  const stageTitle =
    isSubmitting                              ? t("submittingTitle")
    : isDealing || gameStatus === "committed" ? t("statusShuffling")
    : gameStatus === "dealt"                  ? t("playingTitle", { difficulty: t(`difficulty_${gameDifficulty}`) })
    : gameStatus === "solved"                 ? t("statusWonTitle")
    : gameStatus === "expired"                ? t("expiredBanner")
    : t("lobbyTitle");

  const hasCredit =
    (gameStatus === "expired" || gameStatus === "solved") && creditGas > 0;
  const remainMs = deadline > 0 ? deadline - Date.now() : 0;
  const timeUp = gameStatus === "dealt" && deadline > 0 && remainMs <= 0;
  const busy = isStarting || isDealing || isSubmitting || isUndoing;
  const rule = ruleOf(gameDifficulty);
  const hasLiveGame = gameStatus !== "idle";
  const drawerActions = [
    ...(gameStatus === "committed" && !isDealing
      ? [{
          label:   t("checkDealAgain"),
          icon:    <RefreshCcw size={16} aria-hidden="true" />,
          onClick: () => void dispatch("retryDeal", {}),
        }]
      : []),
    ...(timeUp || (gameStatus === "committed" && !isDealing)
      ? [{
          label:   t("releaseAction"),
          icon:    <RotateCcw size={16} aria-hidden="true" />,
          onClick: () => void dispatch("expireGame", {}),
        }]
      : []),
    ...(hasCredit
      ? [{
          label:   t("withdrawAction", { amount: creditGas.toFixed(2) }),
          icon:    <WalletCards size={16} aria-hidden="true" />,
          onClick: () => void dispatch("withdrawWinnings", {}),
        }]
      : []),
  ];
  const hudItems = [
    {
      label: t("rewardMetric"),
      value: `${gasDisplay(rule.rewardFixed8)} GAS`,
      accent: true,
    },
    {
      label: t("timeMetric"),
      value: gameStatus === "dealt" && deadline > 0
        ? formatClock(deadline - Date.now())
        : formatClock(rule.limitMs),
      accent: timeUp,
    },
    {
      label: t("undosMetric"),
      value: hasLiveGame ? `${Math.max(0, 3 - undosUsed)}/3` : "3/3",
      accent: false,
    },
  ];

  return (
    <div className="sudoku-playarea mx2 mx2-cat-game" aria-busy={busy || undefined}>
      <PlayStage
        category="game"
        className="sudoku-playstage"
        stage={{
          eyebrow:  t("appEyebrow"),
          title:    stageTitle,
          subtitle: t("appSubtitle"),
          badges: (
            <>
              <span className="mx2-badge" data-tone="accent">
                <span className="mx2-badge__dot" /> {t("networkBadge")}
              </span>
              {myRank > 0 && (
                <span className="mx2-badge">{t("rankBadge", { rank: myRank })}</span>
              )}
            </>
          ),
        }}
        scene={
          <div className="sudoku-stage-shell">
            <PhaserGameComponent
              config={GAME_CONFIG}
              state={bridgeState}
              dispatch={dispatch}
              className="sudoku-phaser-canvas"
              ariaLabel="Sudoku Arena puzzle game"
              loadingLabel="Opening sealed sudoku board"
            />
            <div className="sudoku-stage-hud" aria-label={t("routeSummary")}>
              {hudItems.map((item) => (
                <div
                  className="sudoku-stage-hud__metric"
                  data-accent={item.accent ? "true" : undefined}
                  key={`${item.label}-${item.value}`}
                >
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
              ))}
              <button
                type="button"
                className="sudoku-stage-hud__drawer"
                onClick={() => setDrawerOpen((open) => !open)}
                aria-expanded={drawerOpen}
              >
                <span>{t("drawerTitleShort")}</span>
                <ChevronDown size={16} aria-hidden="true" data-open={drawerOpen ? "true" : undefined} />
              </button>
            </div>
            {drawerOpen && (
              <section className="sudoku-ingame-drawer" aria-label={t("drawerTitle")}>
                <div className="sudoku-ingame-drawer__head">
                  <Trophy size={18} aria-hidden="true" />
                  <div>
                    <h3>{t("drawerTitle")}</h3>
                    <p>{t("fairnessShort")}</p>
                  </div>
                </div>
                <div className="sudoku-ingame-drawer__grid">
                  <span>
                    <small>{t("creditLabel")}</small>
                    <strong>{creditGas.toFixed(2)} GAS</strong>
                  </span>
                  <span>
                    <small>{t("scoreWon")}</small>
                    <strong>{myTotalWon.toFixed(2)} GAS</strong>
                  </span>
                  <span>
                    <small>{t("scoreTime")}</small>
                    <strong>{deadline > 0 ? formatClock(remainMs) : "--"}</strong>
                  </span>
                  <span>
                    <small>{t("scoreUndos")}</small>
                    <strong>{Math.max(0, 3 - undosUsed)}/3</strong>
                  </span>
                </div>
                {drawerActions.length > 0 && (
                  <div className="sudoku-ingame-drawer__actions">
                    {drawerActions.map((action) => (
                      <button type="button" key={action.label} onClick={action.onClick}>
                        {action.icon}
                        <span>{action.label}</span>
                      </button>
                    ))}
                  </div>
                )}
                <div className="sudoku-ingame-drawer__fairness">
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
