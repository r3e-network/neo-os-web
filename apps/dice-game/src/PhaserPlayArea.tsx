/**
 * PhaserPlayArea.tsx — Phaser 3 wrapper for the Dice Game.
 *
 * Replaces the React-canvas PlayArea.tsx. All blockchain logic stays in
 * main.tsx; this component bridges the observable state into the Phaser
 * DiceScene and forwards Phaser dispatch calls back to main.tsx.
 */
import { useState } from "react";
import { useStateBindings } from "@shared/react";
import type { PlayAreaProps } from "@shared/react";
import { formatHash } from "@shared/utils/format";
import { PlayStage } from "@shared/components-react/v2";
import { PhaserGameComponent } from "@framework/phaser";
import { CoinArt } from "@shared/art";
import { ChevronDown, RefreshCw, ShieldCheck, Trophy, WalletCards } from "lucide-react";
import { DiceScene } from "./scenes/DiceScene";
import "./PlayArea.scss";

type RollOutcome = "" | "pending" | "won" | "lost" | "refunded";

type RollHistoryItem = {
  id?: string;
  face: string;
  stake: string;
  result: string;
  payout: string;
  outcome?: RollOutcome;
  rolled?: string;
  txid?: string;
  at?: string;
};

const GAME_CONFIG = {
  scene: [DiceScene],
  width: 520,
  height: 660,
  backgroundColor: "transparent",
  transparent: true,
} as const;

export default function PhaserPlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { str, bool, val } = useStateBindings(state);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const chainLabel = str("chainLabel") || t("networkLabel");
  const maxStake = val<number>("maxStake", 20) ?? 20;
  const maxPayableStake = val<number>("maxPayableStake", 0) ?? 0;
  const directCredit = val<number>("directCredit", 0) ?? 0;
  const rollHistory = val<RollHistoryItem[]>("rollHistory", []) ?? [];
  const isUnresolved = bool("isUnresolved");
  const isEvmChain = chainLabel.startsWith("Neo X");
  const effectiveMaxStake = maxPayableStake > 0 ? Math.min(maxStake, maxPayableStake) : maxStake;

  // Build the bridge state snapshot (plain object from observables)
  const bridgeState = {
    selectedFace:    str("selectedFace", "6"),
    stakeAmount:     str("stakeAmount", "0.10 GAS"),
    payoutPreview:   str("payoutPreview", "0.57 GAS"),
    lastStatus:      str("lastStatus", t("statusReady")),
    lastOutcome:     str("lastOutcome", ""),
    lastRoll:        str("lastRoll", ""),
    chainLabel,
    isSubmitting:    bool("isSubmitting"),
    isResolving:     bool("isResolving"),
    isUnresolved,
    maxStake,
    maxPayableStake,
    directCredit,
    walletConnected: bool("walletConnected"),
    rollHistory,
  };

  const isRolling  = bool("isSubmitting") || bool("isResolving");
  const lastOutcome = str("lastOutcome", "");
  const stageTitle  = isRolling
    ? t("throwingTitle")
    : isUnresolved ? t("statusSettlementPending")
    : lastOutcome === "won"  ? t("statusWon")
    : lastOutcome === "lost" ? t("statusLost")
    : t("readyTitle");
  const hudItems = [
    {
      label: t("faceMetric"),
      value: bridgeState.selectedFace,
      accent: true,
    },
    {
      label: t("stakeMetric"),
      value: bridgeState.stakeAmount,
      accent: false,
    },
    {
      label: t("payoutMetric"),
      value: bridgeState.payoutPreview,
      accent: lastOutcome === "won",
    },
  ];
  const drawerActions = [
    ...(isUnresolved
      ? [{
          label: t("checkAgain"),
          icon: <RefreshCw size={15} aria-hidden="true" />,
          onClick: () => void dispatch("recheckSettlement", {}),
          hint: t("settlementPendingBody"),
        }]
      : []),
    ...(directCredit > 0 && !isEvmChain
      ? [{
          label: t("withdrawCredit"),
          icon: <WalletCards size={15} aria-hidden="true" />,
          onClick: () => void dispatch("withdrawCredit", {}),
          hint: t("directCreditLabel"),
        }]
      : []),
  ];

  return (
    <div className="dice-playarea mx2 mx2-cat-game" aria-busy={isRolling || undefined}>
      <PlayStage
        category="game"
        className="dice-playstage"
        stage={{
          eyebrow:  t("rollTab"),
          title:    stageTitle,
          subtitle: t("rollDescription"),
          badges: (
            <>
              <span className="mx2-badge" data-tone="accent">
                <span className="mx2-badge__dot" />
                {chainLabel}
              </span>
              {directCredit > 0 && !isEvmChain && (
                <span className="mx2-badge">
                  <CoinArt size={14} variant="gas" /> {directCredit.toFixed(2)}
                </span>
              )}
            </>
          ),
        }}
        scene={
          <div className="dice-stage-shell">
            <PhaserGameComponent
              config={GAME_CONFIG}
              state={bridgeState}
              dispatch={dispatch}
              className="dice-phaser-canvas"
              ariaLabel="Dice Game table"
              loadingLabel="Opening dice table"
            />
            <div className="dice-stage-hud" aria-label={t("rollSummary")}>
              {hudItems.map((item) => (
                <div
                  className="dice-stage-hud__metric"
                  data-accent={item.accent ? "true" : undefined}
                  key={`${item.label}-${item.value}`}
                >
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
              ))}
              <button
                type="button"
                className="dice-stage-hud__drawer"
                onClick={() => setDrawerOpen((open) => !open)}
                aria-expanded={drawerOpen}
              >
                <span>{t("drawerTitleShort")}</span>
                <ChevronDown size={16} aria-hidden="true" data-open={drawerOpen ? "true" : undefined} />
              </button>
            </div>
            {drawerOpen && (
              <section className="dice-ingame-drawer" aria-label={t("diceHistoryTitle")}>
                <div className="dice-ingame-drawer__head">
                  <Trophy size={18} aria-hidden="true" />
                  <div>
                    <h3>{t("diceHistoryTitle")}</h3>
                    <p>{t("fairnessShort")}</p>
                  </div>
                </div>
                <div className="dice-ingame-drawer__grid">
                  <span>
                    <small>{t("networkLabel")}</small>
                    <strong>{chainLabel}</strong>
                  </span>
                  <span>
                    <small>{t("maxStakeNote")}</small>
                    <strong>{effectiveMaxStake} GAS</strong>
                  </span>
                  <span>
                    <small>{t("rangeLabel")}</small>
                    <strong>0.05-{effectiveMaxStake} GAS</strong>
                  </span>
                  <span>
                    <small>{t("feeLabel")}</small>
                    <strong>5%</strong>
                  </span>
                </div>
                {drawerActions.length > 0 && (
                  <div className="dice-ingame-drawer__actions">
                    {drawerActions.map((action) => (
                      <button type="button" key={action.label} onClick={action.onClick} title={action.hint}>
                        {action.icon}
                        <span>{action.label}</span>
                      </button>
                    ))}
                  </div>
                )}
                <div className="dice-drawer">
                  <section className="dice-drawer__section dice-drawer__section--history">
                    <div className="dice-drawer__section-head">
                      <strong>{t("networkLabel")}</strong>
                      <span>{chainLabel}</span>
                    </div>
                    {rollHistory.length > 0 ? (
                      <ul className="mx2-history">
                        {rollHistory.map((row) => (
                          <li
                            key={row.id ?? `${row.txid || row.at || row.face}-${row.result}`}
                            className="mx2-history__item"
                            data-outcome={row.outcome || undefined}
                          >
                            <span className="mx2-history__face">
                              {row.face ? `${t("selectedFace")} ${row.face}` : "-"}
                            </span>
                            <span className="mx2-history__stake">{row.stake || row.payout}</span>
                            <span className="mx2-history__result">{row.result}</span>
                            {row.txid && (
                              <code className="mx2-history__tx">
                                {formatHash(row.txid, 6, 4)}
                              </code>
                            )}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="dice-drawer__empty">{t("diceHistoryEmpty")}</p>
                    )}
                  </section>

                  <div className="dice-drawer__rule-grid">
                    <article className="dice-drawer__rule-card">
                      <span className="dice-drawer__rule-index">1</span>
                      <strong>{t("howItWorks")}</strong>
                      <p>{t("docHowItWorks")}</p>
                    </article>
                    <article className="dice-drawer__rule-card">
                      <span className="dice-drawer__rule-index">2</span>
                      <strong>{t("safetyModel")}</strong>
                      <p>{t("docSafetyModel")}</p>
                    </article>
                    {!isEvmChain && (
                      <article className="dice-drawer__rule-card">
                        <span className="dice-drawer__rule-index">3</span>
                        <strong>{t("diceVrfRouteTitle")}</strong>
                        <p>{t("vrfTrustLine")}</p>
                      </article>
                    )}
                    <article className="dice-drawer__rule-card">
                      <span className="dice-drawer__rule-index">{isEvmChain ? "3" : "4"}</span>
                      <strong>{t("diceRiskTitle")}</strong>
                      <p>{t("diceRiskCopy")}</p>
                    </article>
                  </div>
                </div>
                <div className="dice-ingame-drawer__fairness">
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
