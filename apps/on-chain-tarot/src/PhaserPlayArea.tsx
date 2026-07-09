import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import { PlayStage } from "@shared/components-react/v2";
import { PhaserGameComponent } from "@framework/phaser";
import { Copy, History, RefreshCw, RotateCcw, ShieldCheck, Sparkles, WalletCards } from "lucide-react";
import { TarotScene } from "./scenes/TarotScene";
import type { Card } from "./composables/useTarot";
import "./PlayArea.scss";

interface P {
  t: (k: string, p?: Record<string, string | number>) => string;
  state: Record<string, Observable>;
  dispatch: (n: string, ...a: unknown[]) => Promise<void>;
}

const GAME_CONFIG = { scene: [TarotScene], width: 420, height: 520 } as const;

const SPREAD_KEYS = ["past", "present", "future"] as const;

function formatGas(value: number): string {
  return `${value.toLocaleString(undefined, {
    minimumFractionDigits: value > 0 && value < 1 ? 2 : 0,
    maximumFractionDigits: 4,
  })} GAS`;
}

function shortValue(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "--";
  return trimmed.length > 18 ? `${trimmed.slice(0, 8)}...${trimmed.slice(-6)}` : trimmed;
}

function cardKeywords(card: Card): string {
  return card.keywords?.filter(Boolean).slice(0, 2).join(" / ") || card.suitLabel || card.arcana || "";
}

export default function PhaserPlayArea({ t, state, dispatch }: P) {
  const { bool, num, str, val } = useStateBindings(state);
  const hasDrawn = bool("hasDrawn");
  const allFlipped = bool("allFlipped");
  const isLoading = bool("isLoading");
  const readingMode = str("readingMode", "idle");
  const question = str("question", "");
  const walletAddress = str("walletAddress", "");
  const drawn = val<Card[]>("drawn", []) ?? [];
  const prepaidCredit = num("prepaidCredit");
  const readingsCount = num("readingsCount");
  const cardsDrawnCount = num("cardsDrawnCount");
  const revealCount = drawn.filter((card) => card.flipped).length;
  const oracleReady = readingMode === "oracle";
  const questionText = question.trim();
  const busy = isLoading;

  const bridgeState = {
    hasDrawn,
    allFlipped,
    readingMode,
    question,
    intentOptions: [
      { label: t("intentClarityLabel"), question: t("questionPresetClarity") },
      { label: t("intentDecisionLabel"), question: t("questionPresetDecision") },
      { label: t("intentMomentumLabel"), question: t("questionPresetMomentum") },
    ],
    // Localized copy for the in-canvas tarot table. Additive bridge field only:
    // the scene reads these with English fallbacks so every user-visible string
    // in the canvas follows the active locale.
    sceneText: {
      chooseIntent: t("sceneChooseIntent"),
      drawing: t("dealingCards"),
      tapToReveal: t("sceneTapToReveal"),
      verified: t("oracleVerifiedShort"),
      idleStatus: t("sceneIdleStatus"),
      drawingStatus: t("sceneDrawingStatus"),
      revealedStatus: t("sceneRevealedStatus"),
      revealCount: t("sceneRevealCount"),
      focusLabel: t("questionPreviewLabel"),
      focusFallback: t("questionPreviewFallback"),
      positions: [t("past"), t("present"), t("future")],
      sealed: t("hiddenCard"),
      awaiting: t("awaitingDraw"),
      actionDraw: t("drawCards"),
      actionReveal: t("revealAllCards"),
      actionNew: t("newReading"),
      actionDrawing: t("drawing"),
      tapToDraw: t("tapToDraw"),
      tagline: t("sceneHeaderTagline"),
    },
    drawn,
    isLoading,
    prepaidCredit,
    readingsCount,
    cardsDrawnCount,
    walletConnected: Boolean(walletAddress),
  };

  const revealRemainingCards = () => {
    drawn.forEach((card, index) => {
      if (!card.flipped) void dispatch("flipCard", index);
    });
  };

  const stageTitle = isLoading
    ? t("dealingCards")
    : allFlipped
      ? t("oracleVerifiedShort")
      : hasDrawn
        ? t("tapToReveal")
        : t("drawYourCards");

  const readingStateValue = allFlipped
    ? t("oracleVerifiedShort")
    : hasDrawn
      ? t("oracleSealed")
      : t("awaitingDraw");

  const score = [
    { label: t("readingStateLabel"), value: readingStateValue, accent: allFlipped },
    { label: t("readings"), value: String(readingsCount) },
    { label: t("prepaidCreditLabel"), value: formatGas(prepaidCredit) },
  ];

  const primary = allFlipped
    ? {
        label: t("newReading"),
        onClick: () => void dispatch("reset"),
        disabled: busy,
        icon: <RotateCcw size={18} aria-hidden="true" />,
      }
    : hasDrawn
      ? {
          label: t("revealAllCards"),
          onClick: revealRemainingCards,
          disabled: busy,
          icon: <Sparkles size={18} aria-hidden="true" />,
          hint: t("tapToReveal"),
        }
      : {
          label: isLoading ? t("drawingCards") : t("drawCards"),
          onClick: () => void dispatch("draw"),
          disabled: busy,
          loading: isLoading,
          icon: <Sparkles size={18} aria-hidden="true" />,
          hint: t("drawValueHint"),
        };

  const secondary = [
    ...(allFlipped
      ? [
          {
            label: t("copyReading"),
            onClick: () => void dispatch("copyReading"),
            icon: <Copy size={16} aria-hidden="true" />,
            hint: t("readingCopied"),
          },
        ]
      : []),
    ...(hasDrawn && !allFlipped
      ? [
          {
            label: t("drawAgain"),
            onClick: () => void dispatch("reset"),
            disabled: busy,
            icon: <RotateCcw size={16} aria-hidden="true" />,
            hint: t("newReading"),
          },
        ]
      : []),
    ...(prepaidCredit > 0
      ? [
          {
            label: t("withdrawCredit"),
            onClick: () => void dispatch("withdrawCredit"),
            disabled: busy,
            icon: <WalletCards size={16} aria-hidden="true" />,
            hint: t("prepaidCreditHint"),
          },
        ]
      : []),
    {
      label: t("refreshReadingState"),
      onClick: () => void dispatch("refreshReadingState"),
      disabled: busy,
      icon: <RefreshCw size={16} aria-hidden="true" />,
      hint: t("verificationPanelTitle"),
    },
  ];

  return (
    <div className="tarot-play-area mx2 mx2-cat-game">
      <PlayStage
        category="game"
        className="tarot-phaser-playstage"
        stage={{
          eyebrow:  t("appEyebrow"),
          title:    stageTitle,
          subtitle: t("appSubtitle"),
          badges: (
            <>
              <span className="mx2-badge" data-tone="accent">
                <span className="mx2-badge__dot" /> {t("tarotFee")}
              </span>
              <span className="mx2-badge">{oracleReady ? t("oracleVerifiedShort") : t("oraclePendingShort")}</span>
            </>
          ),
        }}
        scene={
          <PhaserGameComponent
            config={GAME_CONFIG}
            state={bridgeState}
            dispatch={dispatch}
            className="tarot-phaser-canvas"
            ariaLabel="On-chain tarot reading table"
            loadingLabel="Opening tarot table"
          />
        }
        score={score}
        actions={{
          primary,
          secondary,
          secondaryToggleLabel: t("moreActions"),
        }}
        drawerToggleLabel={t("readingIntentTitle")}
        drawer={{
          title: t("readingIntentTitle"),
          children: (
            <div className="tarot-drawer">
              <div className="tarot-drawer__inner">
                <div className="tarot-drawer__head">
                  <img src="./logo.webp" alt="" width={42} height={42} draggable={false} />
                  <p>{t("readingIntentCopy")}</p>
                </div>

                <div className="tarot-drawer__summary" aria-label={t("drawerSummaryLabel")}>
                  <div>
                    <span>{t("readingStateLabel")}</span>
                    <strong>{readingStateValue}</strong>
                  </div>
                  <div>
                    <span>{t("revealed")}</span>
                    <strong>{revealCount}/3</strong>
                  </div>
                  <div>
                    <span>{t("readings")}</span>
                    <strong>{readingsCount}</strong>
                  </div>
                  <div>
                    <span>{t("cardsDrawnCount")}</span>
                    <strong>{cardsDrawnCount}</strong>
                  </div>
                  <div>
                    <span>{t("prepaidCreditLabel")}</span>
                    <strong>{formatGas(prepaidCredit)}</strong>
                  </div>
                  <div>
                    <span>{t("readerWalletLabel")}</span>
                    <strong>{walletAddress ? shortValue(walletAddress) : t("readerWalletMissing")}</strong>
                  </div>
                </div>

                <section className="tarot-drawer__section">
                  <div className="tarot-drawer__section-head">
                    <Sparkles size={16} aria-hidden="true" />
                    <h4>{t("readingIntentTitle")}</h4>
                  </div>
                  <div className="tarot-drawer__intent-grid" aria-label={t("quickIntentLabel")}>
                    {bridgeState.intentOptions.map((option) => {
                      const selected = option.question === questionText;
                      return (
                        <button
                          key={option.question}
                          type="button"
                          className="mx2-btn tarot-drawer__intent-card"
                          data-selected={selected ? "true" : undefined}
                          onClick={() => void dispatch("setQuestion", option.question)}
                        >
                          <span>{option.label}</span>
                          <strong>{option.question}</strong>
                        </button>
                      );
                    })}
                  </div>
                </section>

                <section className="tarot-drawer__section">
                  <div className="tarot-drawer__section-head">
                    <History size={16} aria-hidden="true" />
                    <h4>{t("currentSpreadTitle")}</h4>
                  </div>
                  <ol className="tarot-spread-list" data-empty={drawn.length === 0 ? "true" : undefined}>
                    {SPREAD_KEYS.map((key, index) => {
                      const card = drawn[index];
                      return (
                        <li key={key} data-revealed={card?.flipped ? "true" : undefined}>
                          <span>{t(key)}</span>
                          <strong>{card ? (card.flipped ? card.name : t("hiddenCard")) : t("awaitingDraw")}</strong>
                          <em>{card ? (card.flipped ? cardKeywords(card) : t("sealedReadingHint")) : t("notDrawnYet")}</em>
                        </li>
                      );
                    })}
                  </ol>
                </section>

                <section className="tarot-drawer__section">
                  <div className="tarot-drawer__section-head">
                    <ShieldCheck size={16} aria-hidden="true" />
                    <h4>{t("verificationPanelTitle")}</h4>
                  </div>
                  <ul className="tarot-drawer__verify">
                    <li>{t("verificationPointFee")}</li>
                    <li>{t("verificationPointRandom")}</li>
                    <li>{t("verificationPointWallet")}</li>
                  </ul>
                  <p className="tarot-drawer__route">
                    {t("contractRouteLabel")}: <code>{t("tarotContractRoute")}</code>
                  </p>
                  <p>{t("fairnessCopy")}</p>
                </section>

                <ol className="tarot-drawer__flow" aria-label={t("readingFlowTitle")}>
                  <li>
                    <strong>{t("readingStepOneShort")}</strong>
                    <em>{t("readingStepOneCopy")}</em>
                  </li>
                  <li>
                    <strong>{t("readingStepTwoShort")}</strong>
                    <em>{t("readingStepTwoCopy")}</em>
                  </li>
                  <li>
                    <strong>{t("readingStepThreeShort")}</strong>
                    <em>{t("readingStepThreeCopy")}</em>
                  </li>
                </ol>

                {prepaidCredit > 0 && (
                  <section className="tarot-drawer__credit" aria-label={t("prepaidCreditLabel")}>
                    <span>
                      <small>{t("prepaidCreditHint")}</small>
                      <strong>{formatGas(prepaidCredit)}</strong>
                    </span>
                    <button
                      type="button"
                      className="mx2-btn mx2-btn--ghost"
                      disabled={busy}
                      onClick={() => void dispatch("withdrawCredit")}
                    >
                      <WalletCards size={16} aria-hidden="true" />
                      <span>{t("withdrawCredit")}</span>
                    </button>
                  </section>
                )}
              </div>
            </div>
          ),
        }}
      />
    </div>
  );
}
