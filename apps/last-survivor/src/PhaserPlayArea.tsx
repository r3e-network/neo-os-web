import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import { PlayStage } from "@shared/components-react/v2";
import { PhaserGameComponent } from "@framework/phaser";
import { Activity, Coins, History, RefreshCw, ShieldCheck, Trophy, WalletCards } from "lucide-react";
import { LastSurvivorScene } from "./scenes/LastSurvivorScene";
import type { HistoryEvent } from "./composables/useLastSurvivor";
import "./PlayArea.scss";

interface P {
  t: (k: string, p?: Record<string, string | number>) => string;
  state: Record<string, Observable>;
  dispatch: (n: string, ...a: unknown[]) => Promise<void>;
}

const GAME_CONFIG = { scene: [LastSurvivorScene], width: 420, height: 600 } as const;

function shortValue(value: string): string {
  if (!value || value === "--") return "--";
  return value.length > 16 ? `${value.slice(0, 8)}...${value.slice(-6)}` : value;
}

function gasLabel(value: number): string {
  return `${value.toFixed(value >= 10 ? 1 : 2)} GAS`;
}

export default function PhaserPlayArea({ t, state, dispatch }: P) {
  const { str, bool, num, val } = useStateBindings(state);
  const isRoundActive = bool("isRoundActive");
  const needsLifecycleSync = bool("needsLifecycleSync");
  const prepaidCredit = num("prepaidCredit");
  const totalKeys = num("totalKeysDisplay");
  const userKeys = num("userKeys");
  const isBuyingKeys = bool("isBuyingKeys");
  const isSettling = bool("isSettling");
  const isLoading = bool("isLoading");
  const totalPotDisplay = str("totalPotDisplay", "0.00 GAS");
  const countdown = str("countdown", "00:00:00");
  const keyCount = str("keyCount", "1");
  const estimatedCost = str("estimatedCost", "0.00");
  const dangerLevelText = str("dangerLevelText", "");
  const lastBuyerLabel = str("lastBuyerLabel", "--");
  const roundStatusDisplay = str("roundStatusDisplay", "");
  const keyValidationError = str("keyValidationError", "");
  const serviceNotice = str("serviceNotice", "");
  const viewerAddress = str("viewerAddress", "");
  const formattedRound = str("formattedRound", "#0");
  const userSharePercent = num("userSharePercent");
  const history = val<HistoryEvent[]>("history", []) ?? [];
  const roundReady = bool("roundDataAvailable");
  const busy = isBuyingKeys || isSettling || isLoading;
  const bridgeState = {
    countdown,
    dangerProgress:   num("dangerProgress"),
    dangerLevel:      str("dangerLevel", "low"),
    dangerLevelText,
    totalPotDisplay,
    keyCount,
    keyValidationError,
    estimatedCost,
    userKeys,
    totalKeys,
    totalKeysDisplay: totalKeys,
    lastBuyerLabel,
    isRoundActive,
    isBuyingKeys,
    isSettling,
    needsLifecycleSync,
    roundDataAvailable: roundReady,
    roundStatusDisplay,
    shouldPulse:      bool("shouldPulse"),
    serviceNotice,
    prepaidCredit,
    viewerAddress,
  };

  const scoreItems = [
    { label: t("totalPot"), value: totalPotDisplay, accent: true },
    { label: t("sidebarTimeLeft"), value: needsLifecycleSync ? t("inactiveRound") : countdown },
    { label: t("yourKeys"), value: String(userKeys) },
  ];

  const secondaryActions = [
    {
      label:   t("refreshRound"),
      onClick: () => void dispatch("refreshRound"),
      loading: isLoading,
      icon:    <RefreshCw size={16} aria-hidden="true" />,
      hint:    t("refreshRoundHint"),
    },
    ...(needsLifecycleSync
      ? [
          {
            label:   t("settleRound"),
            onClick: () => void dispatch("settleRound"),
            loading: isSettling,
            icon:    <Trophy size={16} aria-hidden="true" />,
            hint:    t("settleRoundHint"),
          },
        ]
      : []),
    ...(prepaidCredit > 0
      ? [
          {
            label:   t("withdrawCredit"),
            onClick: () => void dispatch("withdrawCredit"),
            disabled: busy,
            icon:    <WalletCards size={16} aria-hidden="true" />,
            hint:    t("prepaidCreditHint"),
          },
        ]
      : []),
  ];

  return (
    <div className="survivor-play-area mx2 mx2-cat-game">
      <PlayStage
        category="game"
        className="survivor-playstage"
        stage={{
          eyebrow:  t("appEyebrow"),
          title:    isRoundActive ? t("roundActive") : t("waitingForRound"),
          subtitle: t("appSubtitle"),
          badges: <span className="mx2-badge" data-tone="accent"><span className="mx2-badge__dot" /> Neo</span>,
        }}
        scene={
          <PhaserGameComponent
            config={GAME_CONFIG}
            state={bridgeState}
            dispatch={dispatch}
            className="survivor-phaser-canvas"
            ariaLabel="Last Survivor arena game"
            loadingLabel="Opening arena"
          />
        }
        actions={{
          secondary:            secondaryActions,
          secondaryToggleLabel: t("moreActions"),
        }}
        score={scoreItems}
        drawerToggleLabel={t("historyTitle")}
        drawer={{
          title: t("historyTitle"),
          children: (
            <div className="survivor-drawer">
              <div className="survivor-drawer__inner">
                <div className="survivor-drawer__summary" aria-label={t("drawerSummaryLabel")}>
                  <div>
                    <span>{t("round")}</span>
                    <strong>{formattedRound}</strong>
                  </div>
                  <div>
                    <span>{t("totalKeys")}</span>
                    <strong>{totalKeys}</strong>
                  </div>
                  <div>
                    <span>{t("share")}</span>
                    <strong>{userSharePercent.toFixed(1)}%</strong>
                  </div>
                  <div>
                    <span>{t("prepaidCreditLabel")}</span>
                    <strong>{gasLabel(prepaidCredit)}</strong>
                  </div>
                </div>

                <section className="survivor-drawer__panel survivor-drawer__panel--state">
                  <div className="survivor-drawer__panel-head">
                    <Activity size={16} aria-hidden="true" />
                    <h4>{roundStatusDisplay || (isRoundActive ? t("activeRound") : t("inactiveRound"))}</h4>
                  </div>
                  <div className="survivor-state-card">
                    <span>{t("currentLeader")}</span>
                    <strong>{shortValue(lastBuyerLabel)}</strong>
                    <small>{dangerLevelText || (roundReady ? t("safe") : t("roundStateRequired"))}</small>
                  </div>
                  {keyValidationError && (
                    <p className="survivor-drawer__notice" data-tone="danger">{keyValidationError}</p>
                  )}
                  {serviceNotice && (
                    <p className="survivor-drawer__notice">{serviceNotice}</p>
                  )}
                  {needsLifecycleSync && (
                    <p className="survivor-drawer__notice" data-tone="success">{t("settleRoundHint")}</p>
                  )}
                </section>

                <section className="survivor-drawer__panel">
                  <div className="survivor-drawer__panel-head">
                    <Coins size={16} aria-hidden="true" />
                    <h4>{t("keyChamber")}</h4>
                  </div>
                  <div className="survivor-economy">
                    <span>{t("keyCapsules")}</span>
                    <strong>{keyCount}</strong>
                    <small>{t("nextCost", { amount: estimatedCost })}</small>
                  </div>
                  <p>{t("nonRefundableNote")}</p>
                  <p>{t("shareHint")}</p>
                </section>

                <section className="survivor-drawer__panel">
                  <div className="survivor-drawer__panel-head">
                    <History size={16} aria-hidden="true" />
                    <h4>{t("recentHistory")}</h4>
                  </div>
                  <div className="survivor-history" role="list">
                    {history.length > 0 ? (
                      history.slice(0, 6).map((item) => (
                        <div key={item.id} role="listitem">
                          <strong>{item.title}</strong>
                          <span>{item.details}</span>
                        </div>
                      ))
                    ) : (
                      <p className="survivor-drawer__empty">{t("noHistory")}</p>
                    )}
                  </div>
                </section>

                <section className="survivor-drawer__panel survivor-drawer__panel--guide">
                  <div className="survivor-drawer__panel-head">
                    <ShieldCheck size={16} aria-hidden="true" />
                    <h4>{t("rulesTitle")}</h4>
                  </div>
                  <ul className="survivor-rules">
                    <li><strong>{t("ruleDeposit")}</strong><span>{t("ruleDepositDesc")}</span></li>
                    <li><strong>{t("ruleTimer")}</strong><span>{t("ruleTimerDesc")}</span></li>
                    <li><strong>{t("ruleWin")}</strong><span>{t("ruleWinDesc")}</span></li>
                  </ul>
                  {viewerAddress && (
                    <p className="survivor-drawer__wallet">{t("playerMarker")}: {shortValue(viewerAddress)}</p>
                  )}
                </section>
              </div>
            </div>
          ),
        }}
      />
    </div>
  );
}
