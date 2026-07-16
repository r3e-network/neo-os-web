import { useCallback, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { useNowMs } from "@shared/react/hooks/useNowMs";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import { PlayStage } from "@shared/components-react/v2";
import { LazyPhaserGameComponent as PhaserGameComponent } from "@framework/phaser/LazyPhaserGameComponent";
import { ChevronDown, Copy, History, RefreshCw, RotateCcw, ShieldCheck, Sparkles, WalletCards, X } from "lucide-react";
import type { Card } from "./composables/useTarot";
import { localizeTarotCard, normalizeTarotLocale } from "./data/tarot-data";
import "./PlayArea.scss";

interface P {
  t: (k: string, p?: Record<string, string | number>) => string;
  state: Record<string, Observable>;
  dispatch: (n: string, ...a: unknown[]) => Promise<void>;
}

const GAME_CONFIG = { width: 390, height: 780 } as const;
const loadTarotScene = () =>
  import("./scenes/TarotScene").then((module) => module.TarotScene);

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
  const [drawerOpen, setDrawerOpen] = useState(false);
  const intentRadioRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const drawerTriggerRef = useRef<HTMLButtonElement | null>(null);
  const runAction = useCallback((name: string, ...args: unknown[]) => {
    // The framework already turns action failures into a concise toast. Catch
    // the rethrow here so keyboard/DOM controls do not create an unhandled
    // rejection in addition to that user-facing recovery message.
    void dispatch(name, ...args).catch(() => {
      /* MiniAppRoot already displayed the action failure. */
    });
  }, [dispatch]);
  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
    drawerTriggerRef.current?.focus();
  }, []);
  // Launcher-selected play mode. In guest the reading is a free local draw, so
  // every GAS-at-stake / draw-fee label is reframed to local framing; gamefi
  // is intentionally disabled for this release. Default to guest so direct
  // play never flashes a paid/on-chain state before setup bindings arrive.
  const mode = str("mode", "guest");
  const isGuest = mode === "guest";
  const hasDrawn = bool("hasDrawn");
  const allFlipped = bool("allFlipped");
  const isLoading = bool("isLoading");
  const readingMode = str("readingMode", "idle");
  const hasPending = bool("hasPending");
  const pendingExpired = bool("pendingExpired");
  const pendingReadingId = str("pendingReadingId", "");
  const pendingRequestId = str("pendingRequestId", "");
  const pendingExpiresAt = num("pendingExpiresAt");
  const clockNow = useNowMs(30_000, {
    enabled: hasPending && pendingExpiresAt > 0,
    resetKey: pendingExpiresAt,
  });
  const canRecoverPending = pendingExpired || (
    hasPending && pendingExpiresAt > 0 && clockNow >= pendingExpiresAt
  );
  const intentId = str("intentId", "decision");
  const question = str("question", "");
  const walletAddress = str("walletAddress", "");
  const drawn = val<Card[]>("drawn", []) ?? [];
  const localeCode = normalizeTarotLocale(t("localeCode"));
  const localizedDrawn = drawn.map((card) => localizeTarotCard(card, localeCode));
  const prepaidCredit = num("prepaidCredit");
  const readingFee = num("readingFee");
  const oracleFee = num("oracleFee");
  const readingsCount = num("readingsCount");
  const cardsDrawnCount = num("cardsDrawnCount");
  const assetRecoveryCount = num("assetRecoveryCount");
  const assetRetryNonce = num("assetRetryNonce");
  const assetRecoveryActive = assetRecoveryCount > 0;
  const revealCount = drawn.filter((card) => card.flipped).length;
  const readingRecorded = isGuest
    ? readingMode === "local"
    : readingMode === "oracle";
  const questionText = question.trim();
  const busy = isLoading;
  const intentOptions = [
    { id: "clarity", label: t("intentClarityLabel"), question: t("questionPresetClarity") },
    { id: "decision", label: t("intentDecisionLabel"), question: t("questionPresetDecision") },
    { id: "momentum", label: t("intentMomentumLabel"), question: t("questionPresetMomentum") },
  ];
  const activeIntent =
    intentOptions.find((option) => option.id === intentId) ?? intentOptions[1]!;
  const positionLabels = [t("past"), t("present"), t("future")];
  const primaryActionLabel = isLoading
    ? (hasPending ? t("checkingOracle") : t("drawing"))
    : canRecoverPending
      ? t("recoverReadingFee")
      : hasPending
        ? t("checkOracleResult")
        : allFlipped
          ? t("newReading")
          : hasDrawn
            ? t("revealAllCards")
            : t("ritualActionConfirm");

  const handleIntentRadioKeyDown = (
    event: ReactKeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    const direction =
      event.key === "ArrowRight" || event.key === "ArrowDown"
        ? 1
        : event.key === "ArrowLeft" || event.key === "ArrowUp"
          ? -1
          : 0;
    if (direction === 0 || assetRecoveryActive || hasDrawn || hasPending || busy) return;

    event.preventDefault();
    const nextIndex = (index + direction + intentOptions.length) % intentOptions.length;
    const nextIntent = intentOptions[nextIndex]!;
    intentRadioRefs.current[nextIndex]?.focus();
    runAction("setIntent", nextIntent.id);
  };

  // Keep the localized question synchronized from a stable intent id. Locale
  // changes can replace display copy without losing which physical token the
  // player selected.
  useEffect(() => {
    if (hasDrawn || hasPending || busy || questionText === activeIntent.question) return;
    runAction("setIntent", activeIntent.id);
  }, [activeIntent.id, activeIntent.question, busy, hasDrawn, hasPending, questionText, runAction]);

  useEffect(() => {
    if (!drawerOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeDrawer();
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [closeDrawer, drawerOpen]);

  const bridgeState = {
    hasDrawn,
    hasPending,
    pendingExpired: canRecoverPending,
    allFlipped,
    readingMode,
    intentId,
    question,
    localeCode,
    assetRetryNonce,
    intentOptions,
    // Localized copy for the in-canvas tarot table. Additive bridge field only:
    // the scene reads these with English fallbacks so every user-visible string
    // in the canvas follows the active locale.
    sceneText: {
      appTitle: t("title"),
      networkStatus: isGuest ? t("guestRitualStatus") : t("ritualNetworkStatus"),
      stepChooseIntent: t("ritualStepChooseIntent"),
      intentPrompt: t("ritualIntentPrompt"),
      steps: [t("ritualStepIntent"), t("ritualStepDraw"), t("ritualStepRead")],
      drawing: t("dealingCards"),
      oracleWaiting: t("oracleWaitingTitle"),
      oracleWaitingStatus: t("oracleWaitingStatus"),
      tapToReveal: t("sceneTapToReveal"),
      verified: isGuest ? t("guestRevealed") : t("oracleVerifiedShort"),
      idleStatus: isGuest ? t("guestSceneIdleStatus") : t("sceneIdleStatus"),
      drawingStatus: isGuest ? t("guestSceneDrawingStatus") : t("sceneDrawingStatus"),
      revealedStatus: isGuest ? t("guestSceneRevealedStatus") : t("sceneRevealedStatus"),
      revealCount: t("sceneRevealCount"),
      positions: positionLabels,
      sealed: t("hiddenCard"),
      awaiting: t("awaitingDraw"),
      loadingCard: t("loadingCard"),
      cardUnavailable: t("cardUnavailable"),
      assetErrorTitle: t("assetErrorTitle"),
      assetErrorBody: t("assetErrorBody"),
      assetRetry: t("assetRetry"),
      assetRetrying: t("assetRetrying"),
      actionConfirm: t("ritualActionConfirm"),
      actionReveal: t("revealAllCards"),
      actionNew: t("newReading"),
      actionDrawing: t("drawing"),
      actionCheck: t("checkOracleResult"),
      actionRecover: t("recoverReadingFee"),
      detailClose: t("detailClose"),
      detailPosition: t("detailPosition"),
      detailElement: t("detailElement"),
      detailKeywords: t("detailKeywords"),
      detailPastFrame: t("detailPastFrame"),
      detailPresentFrame: t("detailPresentFrame"),
      detailFutureFrame: t("detailFutureFrame"),
      elementFire: t("elementFire"),
      elementWater: t("elementWater"),
      elementAir: t("elementAir"),
      elementEarth: t("elementEarth"),
      elementNone: t("elementNone"),
    },
    drawn: localizedDrawn,
    isLoading,
    prepaidCredit,
    readingsCount,
    cardsDrawnCount,
    walletConnected: Boolean(walletAddress),
    mode,
  };

  const stageTitle = isLoading
    ? (hasPending ? t("checkingOracle") : t("dealingCards"))
    : hasPending
      ? (canRecoverPending ? t("oracleTimeoutTitle") : t("oracleWaitingTitle"))
      : allFlipped
        ? (isGuest ? t("guestRevealed") : t("oracleVerifiedShort"))
        : hasDrawn
          ? t("tapToReveal")
          : t("drawYourCards");

  const readingStateValue = allFlipped
    ? (isGuest ? t("guestRevealed") : t("oracleVerifiedShort"))
    : hasDrawn
      ? (isGuest ? t("guestSealed") : t("oracleSealed"))
      : hasPending
        ? (canRecoverPending ? t("oracleTimedOut") : t("oraclePendingShort"))
        : readingMode === "refunded"
          ? t("readingFeeRestored")
          : t("awaitingDraw");

  const drawerTitle = t("readingIntentTitle");
  const drawerId = "tarot-ingame-drawer";
  const drawerContent = (
    <div className="tarot-drawer">
      <div className="tarot-drawer__inner">
        <div className="tarot-drawer__head">
          <img src="./logo.webp" alt="" width={42} height={42} draggable={false} />
          <p>{isGuest ? t("guestReadingIntentCopy") : t("readingIntentCopy")}</p>
          <button
            type="button"
            className="tarot-drawer__close"
            aria-label={t("close")}
            title={t("close")}
            onClick={closeDrawer}
          >
            <X size={17} aria-hidden="true" />
          </button>
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
          {!isGuest && (
            <div>
              <span>{t("prepaidCreditLabel")}</span>
              <strong>{formatGas(prepaidCredit)}</strong>
            </div>
          )}
          {!isGuest && readingFee > 0 && (
            <div>
              <span>{t("feeLabel")}</span>
              <strong>{formatGas(readingFee)}</strong>
            </div>
          )}
          {!isGuest && hasPending && (
            <div>
              <span>{t("oracleFeeLabel")}</span>
              <strong>{formatGas(oracleFee)}</strong>
            </div>
          )}
          {!isGuest && (
            <div>
              <span>{t("readerWalletLabel")}</span>
              <strong>{walletAddress ? shortValue(walletAddress) : t("readerWalletMissing")}</strong>
            </div>
          )}
        </div>

        <section className="tarot-drawer__section">
          <div className="tarot-drawer__section-head">
            <Sparkles size={16} aria-hidden="true" />
            <h4>{t("readingIntentTitle")}</h4>
          </div>
          <div className="tarot-drawer__intent-grid" aria-label={t("quickIntentLabel")}>
            {intentOptions.map((option) => {
              const selected = option.id === intentId;
              return (
                <button
                  key={option.id}
                  type="button"
                  className="mx2-btn tarot-drawer__intent-card"
                  data-selected={selected ? "true" : undefined}
                  aria-pressed={selected}
                  disabled={assetRecoveryActive || hasDrawn || hasPending || busy}
                  onClick={() => runAction("setIntent", option.id)}
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
          {allFlipped && drawn.length === 3 && (
            <p className="tarot-drawer__reading-lead">
              {t("readingLeadLabel")}
              <strong>{activeIntent.question}</strong>
            </p>
          )}
          <ol className="tarot-spread-list" data-empty={drawn.length === 0 ? "true" : undefined}>
            {SPREAD_KEYS.map((key, index) => {
              const card = localizedDrawn[index];
              return (
                <li key={key} data-revealed={card?.flipped ? "true" : undefined}>
                  <span>{t(key)}</span>
                  <strong>{card ? (card.flipped ? card.name : t("hiddenCard")) : t("awaitingDraw")}</strong>
                  <em>{card ? (card.flipped ? (card.reading ?? cardKeywords(card)) : t("sealedReadingHint")) : t("notDrawnYet")}</em>
                </li>
              );
            })}
          </ol>
        </section>

        <section className="tarot-drawer__section">
          <div className="tarot-drawer__section-head">
            <ShieldCheck size={16} aria-hidden="true" />
            <h4>{isGuest ? t("guestVerificationTitle") : t("verificationPanelTitle")}</h4>
          </div>
          <ul className="tarot-drawer__verify">
            <li>{isGuest ? t("guestVerificationPointOne") : t("verificationPointFee")}</li>
            <li>{isGuest ? t("guestVerificationPointTwo") : t("verificationPointRandom")}</li>
            <li>{isGuest ? t("guestVerificationPointThree") : t("verificationPointWallet")}</li>
          </ul>
          <p className="tarot-drawer__route">
            {isGuest ? t("guestRouteLabel") : t("contractRouteLabel")}:{" "}
            <code>{isGuest ? t("guestContractRoute") : t("tarotContractRoute")}</code>
          </p>
          {!isGuest && hasPending && (
            <p className="tarot-drawer__route">
              {t("pendingReadingLabel")}: <code>#{pendingReadingId || "--"}</code>
              {pendingRequestId ? ` · ${t("oracleRequestLabel")} #${pendingRequestId}` : ""}
              {pendingExpiresAt > 0
                ? ` · ${t("expiresLabel")} ${new Date(pendingExpiresAt).toLocaleTimeString()}`
                : ""}
            </p>
          )}
          <p>{isGuest ? t("guestFairnessCopy") : t("fairnessCopy")}</p>
        </section>

        <section className="tarot-drawer__actions" aria-label={t("moreActions")}>
          {allFlipped && (
            <button
              type="button"
              className="mx2-btn mx2-btn--ghost"
              onClick={() => runAction("copyReading")}
            >
              <Copy size={16} aria-hidden="true" />
              <span>{t("copyReading")}</span>
            </button>
          )}
          {hasDrawn && (
            <button
              type="button"
              className="mx2-btn mx2-btn--ghost"
              disabled={busy}
              onClick={() => runAction("reset")}
            >
              <RotateCcw size={16} aria-hidden="true" />
              <span>{allFlipped ? t("newReading") : t("drawAgain")}</span>
            </button>
          )}
          <button
            type="button"
            className="mx2-btn mx2-btn--ghost"
            disabled={busy}
            onClick={() => runAction(hasPending && canRecoverPending ? "recoverExpiredReading" : "refreshReadingState")}
          >
            <RefreshCw size={16} aria-hidden="true" />
            <span>{hasPending && canRecoverPending ? t("recoverReadingFee") : t("refreshReadingState")}</span>
          </button>
        </section>

        <ol className="tarot-drawer__flow" aria-label={t("readingFlowTitle")}>
          <li>
            <strong>{t("readingStepOneShort")}</strong>
            <em>{t("readingStepOneCopy")}</em>
          </li>
          <li>
            <strong>{isGuest ? t("guestStepTwoShort") : t("readingStepTwoShort")}</strong>
            <em>{isGuest ? t("guestStepTwoCopy") : t("readingStepTwoCopy")}</em>
          </li>
          <li>
            <strong>{t("readingStepThreeShort")}</strong>
            <em>{t("readingStepThreeCopy")}</em>
          </li>
        </ol>

        {!isGuest && prepaidCredit > 0 && (
          <section className="tarot-drawer__credit" aria-label={t("prepaidCreditLabel")}>
            <span>
              <small>{t("prepaidCreditHint")}</small>
              <strong>{formatGas(prepaidCredit)}</strong>
            </span>
            <button
              type="button"
              className="mx2-btn mx2-btn--ghost"
              disabled={busy}
              onClick={() => runAction("withdrawCredit")}
            >
              <WalletCards size={16} aria-hidden="true" />
              <span>{t("withdrawCredit")}</span>
            </button>
          </section>
        )}
      </div>
    </div>
  );

  return (
    <div className="tarot-play-area mx2 mx2-cat-game">
      <PlayStage
        category="game"
        className="tarot-phaser-playstage"
        stage={{
          eyebrow:  t("appEyebrow"),
          title:    stageTitle,
          subtitle: isGuest ? t("guestSubtitle") : t("appSubtitle"),
          badges: (
            <>
              <span className="mx2-badge" data-tone="accent">
                <span className="mx2-badge__dot" /> {isGuest ? t("guestBadge") : t("tarotFee")}
              </span>
              <span className="mx2-badge">
                {readingRecorded
                  ? (isGuest ? t("guestDrawnBadge") : t("oracleVerifiedShort"))
                  : isGuest
                    ? t("guestAwaitingBadge")
                    : readingMode === "refunded"
                      ? t("readingFeeRestored")
                      : hasPending
                      ? (canRecoverPending ? t("oracleTimedOut") : t("oraclePendingShort"))
                        : t("awaitingDraw")}
              </span>
            </>
          ),
        }}
        scene={
          <div className="tarot-stage-shell">
            <PhaserGameComponent
              config={GAME_CONFIG}
              loadScene={loadTarotScene}
              state={bridgeState}
              dispatch={dispatch}
              className="tarot-phaser-canvas"
              ariaLabel={t("tarotStageAlt")}
              loadingLabel={t("ritualOpeningTable")}
              errorLabel={t("gameActionFailed")}
              retryLabel={t("retry")}
              continueLabel={t("continue")}
              enableSoundLabel={t("enableGameSound")}
              muteSoundLabel={t("muteGameSound")}
            />
            <div className="tarot-a11y-layer">
              <div
                className="tarot-a11y-intents"
                role="radiogroup"
                aria-label={t("quickIntentLabel")}
              >
                {intentOptions.map((option, index) => {
                  const selected = option.id === activeIntent.id;
                  return (
                    <button
                      key={option.id}
                      ref={(node) => {
                        intentRadioRefs.current[index] = node;
                      }}
                      type="button"
                      role="radio"
                      className="tarot-a11y-hit tarot-a11y-intent"
                      data-index={index}
                      aria-checked={selected}
                      aria-label={`${option.label}: ${option.question}`}
                      tabIndex={selected ? 0 : -1}
                      disabled={assetRecoveryActive || hasDrawn || hasPending || busy}
                      onClick={() => runAction("setIntent", option.id)}
                      onKeyDown={(event) => handleIntentRadioKeyDown(event, index)}
                    >
                      <span>{option.label}</span>
                    </button>
                  );
                })}
              </div>
              <div
                className="tarot-a11y-cards"
                role="group"
                aria-label={t("currentSpreadTitle")}
              >
                {positionLabels.map((position, index) => {
                  const card = localizedDrawn[index];
                  const label = card?.flipped
                    ? `${position}: ${card.name}`
                    : `${t("flipCard")}: ${position}`;
                  return (
                    <button
                      key={position}
                      type="button"
                      className="tarot-a11y-hit tarot-a11y-card"
                      data-index={index}
                      aria-label={label}
                      disabled={assetRecoveryActive || !card || card.flipped || busy}
                      onClick={() => runAction("flipCard", index)}
                    >
                      <span>{label}</span>
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                className="tarot-a11y-hit tarot-a11y-primary"
                aria-label={primaryActionLabel}
                disabled={assetRecoveryActive || busy}
                onClick={() => {
                  if (hasPending && canRecoverPending) runAction("recoverExpiredReading");
                  else if (hasPending) runAction("refreshReadingState");
                  else if (allFlipped) runAction("reset");
                  else if (hasDrawn) runAction("flipTarotReading");
                  else runAction("draw");
                }}
              >
                <span>{primaryActionLabel}</span>
              </button>
            </div>
            {assetRecoveryActive && (
              <div
                className="tarot-asset-recovery-a11y"
                role="alert"
                aria-live="assertive"
              >
                <p>
                  {t("assetErrorTitle")}. {t("assetErrorBody")}
                </p>
                <button
                  type="button"
                  className="tarot-a11y-hit tarot-a11y-asset-retry"
                  onClick={() => runAction("retryTarotAssets")}
                >
                  <span>{t("assetRetry")}</span>
                </button>
              </div>
            )}
            <p className="tarot-a11y-status" aria-live="polite" aria-atomic="true">
              {stageTitle}. {readingStateValue}. {revealCount}/3.
            </p>
            <div className="tarot-stage-hud" aria-label={drawerTitle}>
              <button
                ref={drawerTriggerRef}
                type="button"
                className="tarot-stage-hud__drawer"
                onClick={() => {
                  if (drawerOpen) closeDrawer();
                  else setDrawerOpen(true);
                }}
                aria-expanded={drawerOpen}
                aria-controls={drawerId}
              >
                <span>{t("rulesTitle")}</span>
                <ChevronDown size={15} data-open={drawerOpen ? "true" : undefined} aria-hidden="true" />
              </button>
              <span className="tarot-stage-hud__maintenance">
                {t("gameFiMaintenanceShort")}
              </span>
            </div>
            {drawerOpen && (
              <section id={drawerId} className="tarot-ingame-drawer" aria-label={drawerTitle}>
                {drawerContent}
              </section>
            )}
          </div>
        }
        actions={{}}
      />
    </div>
  );
}
