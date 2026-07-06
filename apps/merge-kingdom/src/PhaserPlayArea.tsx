/**
 * PhaserPlayArea.tsx — Phaser 3 wrapper for Merge Kingdom.
 *
 * Bridges the observable state from main.tsx into the Phaser
 * MergeKingdomScene and forwards scene dispatch calls back to the
 * blockchain layer. All chain/wallet/oracle logic remains in main.tsx.
 *
 * bridgeState keys pushed into the Phaser scene:
 *   gameStatus      string   "idle"|"committed"|"dealt"|"solved"|"expired"
 *   board           number[][] 4×4 grid (0 = empty)
 *   moveCount       number
 *   tileAchieved    number   highest tile value this session
 *   gameDifficulty  number   0=Easy 1=Medium 2=Hard
 *   deadline        number   Unix-epoch ms when the game expires (0=none)
 *   isStarting      boolean
 *   isDealing       boolean
 *   isSubmitting    boolean
 *   walletConnected boolean
 *   poolFree        number   pool GAS available for payouts
 *   credit          number   pending GAS credit (GAS units, not Fixed8)
 *   lastPayoutFixed8 number  Fixed8 payout of the last completed game
 *   lastElapsedMs   number   elapsed ms of the last completed game
 *   lastStatus      string   human-readable status key
 */
import Phaser from "phaser";
import { useStateBindings } from "@shared/react";
import type { PlayAreaProps } from "@shared/react";
import { PlayStage } from "@shared/components-react/v2";
import { PhaserGameComponent } from "@framework/phaser";
import { MergeKingdomScene, SCENE_W, SCENE_H } from "./scenes/MergeKingdomScene";
import { gasDisplay, ruleOf } from "./logic/game-rules";
import "./PlayArea.scss";

const GAME_CONFIG: Phaser.Types.Core.GameConfig = {
  scene: [MergeKingdomScene],
  width:  SCENE_W,
  height: SCENE_H,
  backgroundColor: "transparent",
  transparent: true,
};

export default function PhaserPlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { str, bool, num, val } = useStateBindings(state);

  // ── Bridge state pushed into the Phaser scene ─────────────────────────────
  const bridgeState = {
    gameStatus:      str("gameStatus",   "idle"),
    board:           val<number[][]>("board", []),
    moveCount:       val<number>("moveCount",      0),
    tileAchieved:    val<number>("tileAchieved",   0),
    gameDifficulty:  num("gameDifficulty"),
    deadline:        val<number>("deadline",        0),
    isStarting:      bool("isStarting"),
    isDealing:       bool("isDealing"),
    isSubmitting:    bool("isSubmitting"),
    walletConnected: bool("walletConnected"),
    poolFree:        num("poolFree"),
    credit:          num("credit"),
    lastPayoutFixed8:Number(val<bigint>("lastPayoutFixed8", 0n) ?? 0n),
    lastElapsedMs:   val<number>("lastElapsedMs",   0),
    lastStatus:      str("lastStatus",   ""),
  };

  // ── Derive UI state for PlayStage chrome ──────────────────────────────────
  const status      = str("gameStatus", "idle");
  const isPlaying   = status === "dealt";
  const isSolved    = status === "solved";
  const isExpired   = status === "expired";
  const isBusy      = bool("isStarting") || bool("isDealing") || bool("isSubmitting");
  const hasCredit   = num("credit") > 0;
  const tileAchieved = val<number>("tileAchieved", 0) ?? 0;
  const diff        = num("gameDifficulty");
  const rule        = (() => { try { return ruleOf(diff); } catch { return null; } })();
  const targetReached = rule ? tileAchieved >= rule.targetTile : false;
  const walletConnected = bool("walletConnected");

  const stageTitle = isPlaying
    ? rule ? t("tileTarget", { tile: rule.targetTile }) : t("gameTitle")
    : isSolved
      ? t("statusWonTitle")
      : isExpired
        ? t("statusExpired")
        : t("lobbyTitle");

  // ── Action buttons (PlayStage rail) ───────────────────────────────────────
  // Primary: submit when target reached, restart after result, nothing while
  // lobby (start happens inside the canvas for direct difficulty coupling).
  let primary: Parameters<typeof PlayStage>[0]["actions"]["primary"];

  if (isPlaying && targetReached) {
    primary = {
      label:    t("submitAction"),
      onClick:  () => void dispatch("submitSolution"),
      disabled: isBusy,
      loading:  bool("isSubmitting"),
    };
  } else if (isSolved || isExpired) {
    primary = {
      label:    t("startAction"),
      onClick:  () => void dispatch("startGame", diff),
      disabled: isBusy || !walletConnected,
      loading:  bool("isStarting") || bool("isDealing"),
      hint: !walletConnected
        ? t("walletRequiredStatus")
        : rule
          ? t("startHint", { amount: gasDisplay(rule.entry) })
          : undefined,
    };
  }

  const secondary = hasCredit
    ? [{
        label:   t("withdrawAction", { amount: num("credit").toFixed(2) }),
        onClick: () => void dispatch("withdrawWinnings"),
      }]
    : undefined;

  return (
    <div className="mk-playarea mx2 mx2-cat-game">
      <PlayStage
        category="game"
        stage={{
          eyebrow:  t("appEyebrow"),
          title:    stageTitle,
          subtitle: t("appSubtitle"),
          badges: (
            <span className="mx2-badge" data-tone="accent">
              <span className="mx2-badge__dot" /> {t("networkBadge")}
            </span>
          ),
        }}
        scene={
          <PhaserGameComponent
            config={GAME_CONFIG}
            state={bridgeState}
            dispatch={dispatch}
            height={520}
          />
        }
        actions={{ primary, secondary }}
        drawerToggleLabel={t("leaderboardTitle")}
        drawer={{ children: <p>{t("leaderboardIntro")}</p> }}
      />
    </div>
  );
}
