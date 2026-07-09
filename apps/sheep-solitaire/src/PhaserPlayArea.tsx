/**
 * PhaserPlayArea.tsx — Phaser 3 wrapper for Sheep Solitaire.
 *
 * Bridges the observable state from main.tsx into the Phaser SheepScene
 * and forwards dispatch calls back to the blockchain layer.
 */
import { useState } from "react";
import { ChevronDown, RotateCcw, ShieldCheck, Trophy, WalletCards } from "lucide-react";
import { useStateBindings } from "@shared/react";
import type { PlayAreaProps } from "@shared/react";
import { PlayStage } from "@shared/components-react/v2";
import { PhaserGameComponent } from "@framework/phaser";
import { SheepScene } from "./scenes/SheepScene";
import "./PlayArea.scss";

const GAME_CONFIG = {
  scene: [SheepScene],
  width: 400,
  height: 640,
  backgroundColor: "transparent",
  transparent: true,
} as const;

export default function PhaserPlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { str, bool, val, num } = useStateBindings(state);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const gameStatus  = str("gameStatus", "idle");
  const isDealing   = bool("isDealing");
  const isStarting  = bool("isStarting");
  const isSubmitting = bool("isSubmitting");
  const isGameOver  = bool("isGameOver");
  const credit      = num("credit", 0);
  const poolFree    = num("poolFree", 0);
  const pileCards   = val<Array<{ picked?: boolean }>>("pileCards") ?? [];
  const slotCards   = val<unknown[]>("slotCards") ?? [];
  const activeGameId = str("activeGameId", "0");
  const deadline    = num("deadline", 0);
  const undosUsed   = num("undosUsed", 0);
  const shuffleLeft = num("shuffleLeft", 1);
  const remove3Left = num("remove3Left", 1);
  const cardsLeft   = pileCards.filter((card) => !card?.picked).length + slotCards.length;
  const trayUsed    = slotCards.length;
  const canRelease  = gameStatus === "dealt" || isGameOver;
  const canWithdraw = credit > 0 && gameStatus !== "dealt";

  // Localized copy for the presentation-only Phaser scene. The scene never
  // calls t(); it reads these resolved strings via this.str/this.val so zh users
  // see translated in-canvas text. English defaults still live in the scene as
  // fallbacks. Interpolated subs (payout/credit) are passed as templates the
  // scene fills with values it already holds.
  const diffTimers = ["5:00", "8:00", "12:00"];
  const diffTileCounts = [8, 12, 15];
  const loc = {
    title:    t("appEyebrow"),
    subtitle: t("boardTagline"),
    diffNames: [t("easyLabel"), t("mediumLabel"), t("hardLabel")],
    diffInfos: diffTileCounts.map(
      (count, i) => `${t("tileTypesLabel", { count })} · ${diffTimers[i]}`,
    ),
    diffEntries: ["0.02", "0.10", "0.20"].map((amount) => t("entryAmount", { amount })),
    diffRewards: ["0.10", "0.50", "1.00"].map((amount) => t("winAmount", { amount })),
    undo:     t("undoLabel"),
    shuffle:  t("shuffleLabel"),
    remove3:  t("remove3Label"),
    tray:     t("trayLabel"),
    loadTitle: t("loadingBoard"),
    loadSub:   t("securingPuzzle"),
    progress:  t("progressStat"),
    matched:   t("matchedStat"),
    wonTitle:      t("wonTitle"),
    creditedTitle: t("creditedTitle"),
    gameOverTitle: t("gameOverTitle"),
    boardClearedSub:  t("boardClearedSub"),
    boardVerifiedSub: t("boardVerifiedSub"),
    payoutSub:     t("payoutSub"),
    creditReadySub: t("creditReadySub"),
    trayFullSub:   t("trayFullSub"),
    playAgain:    t("playAgainAction"),
    claim:        t("claimRewardAction"),
    withdraw:     t("withdrawShortAction"),
    backToRoutes: t("backToRoutesAction"),
    tryAgain:     t("tryAgainAction"),
  };

  // Bridge state snapshot: all values must be plain (serializable)
  const bridgeState = {
    activeGameId,
    gameStatus,
    gameDifficulty: num("gameDifficulty", 0),
    pileCards,
    slotCards,
    dealtAt:        num("dealtAt", 0),
    deadline,
    shuffleLeft,
    remove3Left,
    undosUsed,
    isStarting,
    isDealing,
    isSubmitting,
    isPicking:      bool("isPicking"),
    isUndoing:      bool("isUndoing"),
    isMatching:     bool("isMatching"),
    isGameOver,
    lastStatus:     str("lastStatus", ""),
    lastPayout:     str("lastPayout", ""),
    credit,
    poolFree,
    loc,
  };

  // Derive stage header text
  const isLoading = isStarting || isDealing || gameStatus === "committed";
  const stageTitle = isLoading
    ? t("statusSealing")
    : gameStatus === "solved"
    ? t("statusSolved", { payout: str("lastPayout", "") })
    : isGameOver
    ? t("gameOverBanner")
    : gameStatus === "dealt"
    ? t("statusDealt")
    : t("statusReady");

  const stageSubtitle = gameStatus === "dealt"
    ? t("statusDealt")
    : t("rollDescription");

  const hudItems = [
    {
      label: gameStatus === "dealt" ? t("scoreCards") : t("poolMetric"),
      value: gameStatus === "dealt" ? String(cardsLeft) : `${poolFree.toFixed(2)} GAS`,
      accent: gameStatus === "dealt",
    },
    {
      label: t("trayMetric"),
      value: `${trayUsed}/7`,
      accent: trayUsed >= 5,
    },
    {
      label: t("toolsMetric"),
      value: `${Math.max(0, 3 - undosUsed)} + ${shuffleLeft}/${remove3Left}`,
      accent: false,
    },
  ];

  const drawerActions = [
    ...(canRelease
      ? [{
          label: t("expireGame"),
          icon: <RotateCcw size={16} aria-hidden="true" />,
          onClick: () => void dispatch("expireGame"),
        }]
      : []),
    ...(canWithdraw
      ? [{
          label: t("withdrawAction", { amount: credit.toFixed(2) }),
          icon: <WalletCards size={16} aria-hidden="true" />,
          onClick: () => void dispatch("withdrawWinnings", {}),
        }]
      : []),
  ];

  return (
    <div className="sheep-playarea mx2 mx2-cat-game">
      <PlayStage
        category="game"
        className="sheep-playstage"
        stage={{
          eyebrow: t("rollTab"),
          title:   stageTitle,
          subtitle: stageSubtitle,
          badges: (
            <span className="mx2-badge" data-tone="accent">
              <span className="mx2-badge__dot" />
              {str("chainLabel", "") || "Neo"}
            </span>
          ),
        }}
        scene={
          <div className="sheep-stage-shell">
            <PhaserGameComponent
              config={GAME_CONFIG}
              state={bridgeState}
              dispatch={dispatch}
              className="sheep-phaser-canvas"
              ariaLabel="Sheep Solitaire tile game"
              loadingLabel="Opening sheep board"
            />
            <div className="sheep-stage-hud" aria-label={t("routeSummary")}>
              {hudItems.map((item) => (
                <div
                  className="sheep-stage-hud__metric"
                  data-accent={item.accent ? "true" : undefined}
                  key={`${item.label}-${item.value}`}
                >
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
              ))}
              <button
                type="button"
                className="sheep-stage-hud__drawer"
                onClick={() => setDrawerOpen((open) => !open)}
                aria-expanded={drawerOpen}
              >
                <span>{t("historyTitle")}</span>
                <ChevronDown size={16} aria-hidden="true" data-open={drawerOpen ? "true" : undefined} />
              </button>
            </div>
            {drawerOpen && (
              <section className="sheep-ingame-drawer" aria-label={t("drawerTitle")}>
                <div className="sheep-ingame-drawer__head">
                  <Trophy size={18} aria-hidden="true" />
                  <div>
                    <h3>{t("historyTitle")}</h3>
                    <p>{t("fairnessNote")}</p>
                  </div>
                </div>
                <div className="sheep-ingame-drawer__grid">
                  <span>
                    <small>{t("creditLabel")}</small>
                    <strong>{credit.toFixed(2)} GAS</strong>
                  </span>
                  <span>
                    <small>{t("scoreTime")}</small>
                    <strong>{deadline > 0 ? "Live" : "--"}</strong>
                  </span>
                  <span>
                    <small>{t("scoreCards")}</small>
                    <strong>{cardsLeft}</strong>
                  </span>
                  <span>
                    <small>{t("scoreUndos")}</small>
                    <strong>{Math.max(0, 3 - undosUsed)}</strong>
                  </span>
                </div>
                {drawerActions.length > 0 && (
                  <div className="sheep-ingame-drawer__actions">
                    {drawerActions.map((action) => (
                      <button type="button" key={action.label} onClick={action.onClick}>
                        {action.icon}
                        <span>{action.label}</span>
                      </button>
                    ))}
                  </div>
                )}
                <div className="sheep-ingame-drawer__fairness">
                  <ShieldCheck size={17} aria-hidden="true" />
                  <p>{activeGameId !== "0" ? t("activeGameLine", { gameId: activeGameId }) : t("fairnessShort")}</p>
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
