/**
 * PhaserPlayArea.tsx — Phaser 3 wrapper for the Aim Master archery game.
 *
 * Bridges the React/framework observable state into the AimMasterScene and
 * forwards scene dispatch calls back to main.tsx. All blockchain / TEE logic
 * lives in main.tsx; this component owns only the Phaser canvas lifecycle.
 */
import { useStateBindings } from "@shared/react";
import type { PlayAreaProps } from "@shared/react";
import { PlayStage } from "@shared/components-react/v2";
import { PhaserGameComponent } from "@framework/phaser";
import { AimMasterScene } from "./scenes/AimMasterScene";
import { ruleOf, formatClock, gasDisplay } from "./logic/game-rules";
import "./PlayArea.scss";

import type * as Phaser from "phaser";

const GAME_CONFIG: Phaser.Types.Core.GameConfig = {
  scene:  [AimMasterScene],
  width:  400,
  height: 600,
  backgroundColor: "transparent",
  transparent: true,
};

export default function PhaserPlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { str, bool, val } = useStateBindings(state);

  // ── Bridge state snapshot ────────────────────────────────────────────────
  const bridgeState = {
    gameStatus:      str("gameStatus", "idle"),
    pattern:         str("pattern", ""),
    targetAccuracy:  val<number>("targetAccuracy", 3) ?? 3,
    gameDifficulty:  val<number>("gameDifficulty", 0) ?? 0,
    poolFree:        val<number>("poolFree", 0) ?? 0,
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
  const deadline       = val<number>("deadline", 0) ?? 0;
  const targetAccuracy = val<number>("targetAccuracy", 3) ?? 3;
  const isSubmitting   = bool("isSubmitting");
  const isDealing      = bool("isDealing") || bool("isStarting");

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

  // Score cells — shown only during active gameplay
  const scoreRows =
    gameStatus !== "idle"
      ? [
          {
            label: t("scoreTime"),
            value: formatClock(remainingMs),
          },
          {
            label: t("scoreRings"),
            value: `0/${targetAccuracy}`,
          },
          {
            label: t("scoreReward"),
            value: `${gasDisplay(rule.rewardFixed8)} GAS`,
            accent: true,
          },
        ]
      : undefined;

  return (
    <div className="aim-playarea mx2 mx2-cat-game">
      <PlayStage
        category="game"
        stage={{
          eyebrow:  t("appEyebrow"),
          title:    stageTitle,
          subtitle: t("appSubtitle"),
          badges: (
            <span className="mx2-badge" data-tone="accent">
              <span className="mx2-badge__dot" />
              {t("networkBadge")}
            </span>
          ),
        }}
        scene={
          <PhaserGameComponent
            config={GAME_CONFIG}
            state={bridgeState}
            dispatch={dispatch}
          />
        }
        score={scoreRows}
        actions={{}}
        drawerToggleLabel={t("drawerTitle")}
        drawer={{
          children: (
            <>
              <h4>{t("rulesTitle")}</h4>
              <p>{t("rulesCopy")}</p>
              <h4>{t("fairnessTitle")}</h4>
              <p>{t("fairnessCopy")}</p>
            </>
          ),
        }}
      />
    </div>
  );
}
