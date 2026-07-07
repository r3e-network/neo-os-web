/**
 * PhaserPlayArea.tsx — Phaser 3 wrapper for the Sudoku miniapp.
 *
 * Replaces the React-canvas PlayArea.tsx for the Phaser renderer path.
 * All blockchain / session logic stays in main.tsx; this component
 * bridges the observable state into SudokuScene and forwards Phaser
 * dispatch calls back to main.tsx.
 */
import { useStateBindings } from "@shared/react";
import type { PlayAreaProps } from "@shared/react";
import { PlayStage } from "@shared/components-react/v2";
import { PhaserGameComponent } from "@framework/phaser";
import { SudokuScene } from "./scenes/SudokuScene";
import "./PlayArea.scss";

// GameConfig — scene array must not be readonly (satisfies Phaser.Types.Core.GameConfig)
const GAME_CONFIG: Phaser.Types.Core.GameConfig = {
  scene: [SudokuScene],
  width: 400,
  height: 600,
  backgroundColor: "transparent",
  transparent: true,
};

export default function PhaserPlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { str, bool, val } = useStateBindings(state);

  const gameStatus     = str("gameStatus", "idle");
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
  const creditGas      = val<number>("creditGas", 0) ?? 0;

  // Plain-object snapshot pushed into the Phaser bridge on every render
  const bridgeState = {
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

  return (
    <div className="sudoku-playarea mx2 mx2-cat-game">
      <PlayStage
        category="game"
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
          <PhaserGameComponent
            config={GAME_CONFIG}
            state={bridgeState}
            dispatch={dispatch}
          />
        }
        score={gameStatus === "idle" ? undefined : [
          {
            label: t("scoreTime"),
            value: gameStatus === "dealt" && deadline > 0
              ? `${Math.max(0, Math.ceil((deadline - Date.now()) / 1000))}s`
              : "—",
          },
          { label: t("scoreUndos"), value: `${3 - undosUsed}/3` },
          { label: t("scoreWon"),   value: `${myTotalWon.toFixed(2)} GAS` },
        ]}
        actions={{
          secondary: hasCredit
            ? [
                {
                  label:   t("withdrawAction", { amount: creditGas.toFixed(2) }),
                  onClick: () => void dispatch("withdrawWinnings", {}),
                  hint:    t("withdrawHint"),
                },
              ]
            : undefined,
        }}
        drawerToggleLabel={t("drawerTitle")}
        drawer={{
          title: t("drawerTitle"),
          children: (
            <>
              <p>{t("rulesCopy")}</p>
              <p>{t("fairnessCopy")}</p>
            </>
          ),
        }}
      />
    </div>
  );
}
