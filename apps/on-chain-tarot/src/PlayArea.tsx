import { useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  Eye,
  RotateCcw,
  Send,
  Sparkles,
  WalletCards,
} from "lucide-react";
import { NeoButton, NeoCard } from "@shared/components-react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import type { Card } from "./composables/useTarot";
import { TAROT_CARD_BACK } from "./pages/index/components/tarot-data";
import "./PlayArea.scss";

interface PlayAreaProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Observable>;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
}

const spreadKeys = ["past", "present", "future"] as const;
const questionPresets = [
  { valueKey: "questionPresetClarity", labelKey: "intentClarityLabel" },
  { valueKey: "questionPresetDecision", labelKey: "intentDecisionLabel" },
  { valueKey: "questionPresetMomentum", labelKey: "intentMomentumLabel" },
] as const;
const verificationKeys = [
  "verificationPointFee",
  "verificationPointRandom",
  "verificationPointWallet",
] as const;

function cardKeywords(card: Card): string {
  return (
    card.keywords?.slice(0, 3).join(" / ") ||
    card.suitLabel ||
    card.arcana ||
    ""
  );
}

export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { bool, num, str, val } = useStateBindings(state);

  const isLoading = bool("isLoading");
  const hasDrawn = bool("hasDrawn");
  const allFlipped = bool("allFlipped");
  const question = str("question");
  const readingMode = str("readingMode", "idle");
  const drawn = val<Card[]>("drawn") ?? [];
  const prepaidCredit = num("prepaidCredit");
  const [dealPreview, setDealPreview] = useState(false);
  const [intentPulse, setIntentPulse] = useState(false);
  const dealPreviewTimeout = useRef<number | null>(null);
  const intentPulseTimeout = useRef<number | null>(null);
  const revealCount = drawn.filter((card) => card.flipped).length;
  const oracleReady = readingMode === "oracle";
  const isDealing = isLoading || dealPreview;
  const questionText = question.trim();
  const playStateClass = [
    questionText ? "tarot-play-area--question-ready" : "",
    intentPulse ? "tarot-play-area--intent-pulse" : "",
    isDealing ? "tarot-play-area--dealing" : "",
    hasDrawn ? "tarot-play-area--drawn" : "",
    allFlipped ? "tarot-play-area--complete" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const questionMeter = t("questionCharacterCount", {
    count: question.length,
    max: 200,
  });
  const formatGas = (value: number) =>
    `${value.toLocaleString(undefined, { maximumFractionDigits: 4 })} ${t("tokenGas")}`;

  useEffect(
    () => () => {
      if (dealPreviewTimeout.current !== null) {
        window.clearTimeout(dealPreviewTimeout.current);
      }
      if (intentPulseTimeout.current !== null) {
        window.clearTimeout(intentPulseTimeout.current);
      }
    },
    [],
  );

  const triggerIntentPulse = () => {
    if (intentPulseTimeout.current !== null) {
      window.clearTimeout(intentPulseTimeout.current);
    }
    setIntentPulse(true);
    intentPulseTimeout.current = window.setTimeout(() => {
      setIntentPulse(false);
      intentPulseTimeout.current = null;
    }, 780);
  };

  const selectIntent = (valueKey: string) => {
    triggerIntentPulse();
    void dispatch("setQuestion", t(valueKey));
  };

  const startDealPreview = () => {
    if (dealPreviewTimeout.current !== null) {
      window.clearTimeout(dealPreviewTimeout.current);
    }
    setDealPreview(true);
    dealPreviewTimeout.current = window.setTimeout(() => {
      setDealPreview(false);
      dealPreviewTimeout.current = null;
    }, 1300);
  };

  const handleDraw = async () => {
    startDealPreview();
    await dispatch("draw");
  };

  return (
    <div className={`tarot-play-area ${playStateClass}`.trim()}>
      <div className="tarot-shell">
        <section className="tarot-main" aria-label={t("tarotHeroTitle")}>
          <div className="tarot-hero">
            <div className="tarot-hero-copy">
              <div className="tarot-hero-intro">
                <span className="tarot-hero-badge" aria-hidden="true">
                  <Sparkles size={23} />
                </span>
                <div className="tarot-hero-heading">
                  <span className="tarot-hero-eyebrow">
                    {t("oracleRequestTitle")}
                  </span>
                  <h2>{t("tarotHeroTitle")}</h2>
                </div>
              </div>
              <p>{t("tarotHeroSubtitle")}</p>
              <div className="tarot-hero-meta">
                <span>
                  {t("feeLabel")} · <strong>{t("tarotFee")}</strong>
                </span>
                <span>
                  {t("contractRouteLabel")} ·{" "}
                  <strong>{t("tarotContractRoute")}</strong>
                </span>
                <span className={hasDrawn ? "tarot-hero-progress" : undefined}>
                  {hasDrawn
                    ? `${revealCount}/3 ${t("revealed")}`
                    : t("requestReady")}
                </span>
              </div>
            </div>
            <figure className="tarot-hero-stage">
              <img
                src="./tarot-reading-table.jpg"
                alt={t("tarotStageAlt")}
                loading="eager"
                decoding="async"
              />
              <figcaption>
                <span>{t("dealTableLabel")}</span>
                <strong>
                  {hasDrawn
                    ? `${revealCount}/3 ${t("revealed")}`
                    : t("dealTableReady")}
                </strong>
              </figcaption>
            </figure>
          </div>

          <div className="tarot-workspace">
            <NeoCard variant="erobo" className="tarot-question-panel">
              <div className="tarot-section-heading">
                <span>{t("readingIntentTitle")}</span>
                <strong>
                  {hasDrawn ? t("oracleVerifiedShort") : t("requestReady")}
                </strong>
              </div>
              <p className="tarot-intent-copy">{t("readingIntentCopy")}</p>
              <div
                className="tarot-question-presets"
                aria-label={t("quickIntentLabel")}
              >
                {questionPresets.map(({ valueKey, labelKey }) => (
                  <button
                    key={valueKey}
                    type="button"
                    className={question === t(valueKey) ? "is-active" : ""}
                    aria-label={t(valueKey)}
                    title={t(valueKey)}
                    onClick={() => selectIntent(valueKey)}
                  >
                    <span className="tarot-intent-card__mini" aria-hidden="true">
                      <img src={TAROT_CARD_BACK} alt="" />
                    </span>
                    <span className="tarot-intent-card__copy">
                      <strong>{t(labelKey)}</strong>
                      <small>{t(valueKey)}</small>
                    </span>
                  </button>
                ))}
              </div>
              <div
                className={[
                  "tarot-oracle-lane",
                  questionText ? "tarot-oracle-lane--intent" : "",
                  hasDrawn ? "tarot-oracle-lane--drawn" : "",
                  allFlipped ? "tarot-oracle-lane--revealed" : "",
                  isDealing ? "tarot-oracle-lane--dealing" : "",
                ].filter(Boolean).join(" ")}
                aria-label={t("oracleLaneLabel")}
              >
                <span className={`tarot-oracle-lane__step${questionText ? " is-ready" : ""}`}>
                  <span className="tarot-oracle-lane__card" aria-hidden="true">
                    <img src={TAROT_CARD_BACK} alt="" loading="lazy" decoding="async" />
                  </span>
                  <small>{t("oracleLaneIntent")}</small>
                </span>
                <span className={`tarot-oracle-lane__step${hasDrawn ? " is-ready" : ""}`}>
                  <span className="tarot-oracle-lane__card" aria-hidden="true">
                    <img src={TAROT_CARD_BACK} alt="" loading="lazy" decoding="async" />
                  </span>
                  <small>{t("oracleLaneDraw")}</small>
                </span>
                <span className={`tarot-oracle-lane__step${allFlipped ? " is-ready" : ""}`}>
                  <span className="tarot-oracle-lane__card" aria-hidden="true">
                    <img src={TAROT_CARD_BACK} alt="" loading="lazy" decoding="async" />
                  </span>
                  <small>{t("oracleLaneReveal")}</small>
                </span>
              </div>
              <div
                className={`tarot-intention-board${questionText ? " is-ready" : ""}`}
                aria-label={t("questionPreviewLabel")}
              >
                <div
                  className="tarot-intention-deck"
                  aria-label={t("intentionDeckLabel")}
                >
                  {[0, 1, 2].map((item) => (
                    <span
                      key={item}
                      className={`tarot-intention-deck__card tarot-intention-deck__card--${item + 1}`}
                      aria-hidden="true"
                    >
                      <img src={TAROT_CARD_BACK} alt="" />
                    </span>
                  ))}
                </div>
                <label className="tarot-intention-slip tarot-question-field">
                  <span>{t("questionPreviewLabel")}</span>
                  <textarea
                    value={question}
                    placeholder={t("questionPreviewFallback")}
                    maxLength={200}
                    rows={2}
                    aria-label={t("oraclePromptLabel")}
                    onChange={(event) => {
                      void dispatch("setQuestion", event.currentTarget.value);
                    }}
                  />
                  <small>{questionMeter}</small>
                </label>
              </div>
              <div className="tarot-action-row">
                {!hasDrawn ? (
                  <>
                    <NeoButton
                      variant="primary"
                      loading={isLoading}
                      disabled={isLoading}
                      onClick={handleDraw}
                    >
                      {isLoading ? t("drawingCards") : t("drawCards")}
                    </NeoButton>
                    <p className="tarot-draw-hint">{t("drawValueHint")}</p>
                  </>
                ) : (
                  <NeoButton
                    variant="secondary"
                    disabled={isLoading}
                    onClick={() => dispatch("reset")}
                  >
                    <RotateCcw size={15} aria-hidden="true" />
                    {t("drawAgain")}
                  </NeoButton>
                )}
              </div>
              <div
                className="tarot-route-strip"
                aria-label={t("readingFlowTitle")}
              >
                <span className={question.trim() ? "is-ready" : ""}>
                  <Send size={16} aria-hidden="true" />
                  <small>{t("readingStepOneShort")}</small>
                </span>
                <span className={hasDrawn ? "is-ready" : ""}>
                  <WalletCards size={16} aria-hidden="true" />
                  <small>{t("readingStepTwoShort")}</small>
                </span>
                <span className={allFlipped ? "is-ready" : ""}>
                  <Eye size={16} aria-hidden="true" />
                  <small>{t("readingStepThreeShort")}</small>
                </span>
              </div>
            </NeoCard>

            <NeoCard variant="erobo" className="tarot-spread-panel">
              <div className="tarot-section-heading">
                <span>{t("spreadPanelTitle")}</span>
                <strong>
                  {hasDrawn
                    ? allFlipped
                      ? t("allRevealed")
                      : t("tapToReveal")
                    : t("awaitingCards")}
                </strong>
              </div>
              <div
                className={`tarot-spread-table${questionText ? " tarot-spread-table--ready" : ""}${isDealing && !hasDrawn ? " tarot-spread-table--dealing" : ""}${hasDrawn ? " tarot-spread-table--drawn" : ""}${allFlipped ? " tarot-spread-table--complete" : ""}`}
              >
                <img
                  className="tarot-spread-table__mat"
                  src="./tarot-reading-table.jpg"
                  alt=""
                  aria-hidden="true"
                  loading="lazy"
                  decoding="async"
                />
                {isDealing && !hasDrawn && (
                  <div className="tarot-dealing-layer" aria-hidden="true">
                    <span className="tarot-dealing-deck">
                      {[0, 1, 2].map((item) => (
                        <img
                          key={item}
                          className={`tarot-dealing-deck__card tarot-dealing-deck__card--${item + 1}`}
                          src={TAROT_CARD_BACK}
                          alt=""
                        />
                      ))}
                    </span>
                    {[0, 1, 2].map((item) => (
                      <img
                        key={item}
                        className={`tarot-dealing-card tarot-dealing-card--${item + 1}`}
                        src={TAROT_CARD_BACK}
                        alt=""
                      />
                    ))}
                  </div>
                )}
                <div className="tarot-reading-grid">
                  {spreadKeys.map((spreadKey, index) => {
                    const card = drawn[index];
                    return card ? (
                      <button
                        key={`${card.id}-${index}`}
                        className={`tarot-card-slot${card.flipped ? " tarot-card-slot--flipped tarot-card-slot--revealed" : " tarot-card-slot--sealed"}`}
                        onClick={() => dispatch("flipCard", index)}
                        type="button"
                        aria-label={
                          card.flipped
                            ? card.name
                            : `${t("tapToReveal")} ${t(spreadKey)}`
                        }
                      >
                        <span className="tarot-card-position">
                          {t(spreadKey)}
                        </span>
                        <span className="tarot-card-frame">
                          <span className="tarot-card-face tarot-card-back">
                            <img
                              src={card.backImage || TAROT_CARD_BACK}
                              alt={t("cardBackAlt")}
                            />
                            <span>{t("tapToReveal")}</span>
                          </span>
                          <span className="tarot-card-face tarot-card-front">
                            <img
                              src={card.image}
                              alt={t("cardImageAlt", { name: card.name })}
                            />
                          </span>
                        </span>
                        <span className="tarot-card-caption">
                          <span>
                            {card.flipped ? card.name : t("hiddenCard")}
                          </span>
                          <small>
                            {card.flipped
                              ? cardKeywords(card)
                              : t("oracleSealed")}
                          </small>
                        </span>
                      </button>
                    ) : (
                      <div
                        key={spreadKey}
                        className="tarot-card-slot tarot-card-slot--empty"
                      >
                        <span className="tarot-card-position">
                          {t(spreadKey)}
                        </span>
                        <span className="tarot-card-frame">
                          <span className="tarot-card-face tarot-card-back">
                            <img src={TAROT_CARD_BACK} alt={t("cardBackAlt")} />
                          </span>
                        </span>
                        <span className="tarot-card-caption tarot-card-caption--empty">
                          <span aria-hidden="true">—</span>
                        </span>
                      </div>
                    );
                  })}
                </div>
                {!hasDrawn && (
                  <p className="tarot-spread-empty-hint">
                    {isDealing
                      ? t("dealingCards")
                      : questionText
                        ? t("awaitingDraw")
                        : t("submitQuestionFirst")}
                  </p>
                )}
              </div>
            </NeoCard>
          </div>

          {oracleReady && (
            <div className="tarot-reading-mode tarot-reading-mode--oracle">
              {t("oracleVerified")}
            </div>
          )}

          {hasDrawn && allFlipped && drawn.length > 0 && (
            <NeoCard variant="erobo" className="tarot-reading-summary">
              <div className="tarot-section-heading">
                <span>{t("readingSummary")}</span>
                <NeoButton
                  variant="secondary"
                  onClick={() => dispatch("copyReading")}
                >
                  {t("copyReading")}
                </NeoButton>
              </div>
              <div className="tarot-summary-list">
                {drawn.map((card, index) => {
                  const spreadKey = spreadKeys[index] ?? "present";
                  return (
                    <div
                      key={`${card.id}-summary-${index}`}
                      className="tarot-summary-row"
                    >
                      <img
                        src={card.image}
                        alt={t("cardImageAlt", { name: card.name })}
                      />
                      <span>
                        <small>{t(spreadKey)}</small>
                        <strong>{card.name}</strong>
                        <em>{card.keywords?.join(" / ")}</em>
                      </span>
                    </div>
                  );
                })}
              </div>
            </NeoCard>
          )}
        </section>

        <aside className="tarot-side" aria-label={t("verificationPanelTitle")}>
          <NeoCard variant="erobo" className="tarot-verification-panel">
            <div className="tarot-section-heading">
              <span>{t("verificationPanelTitle")}</span>
              <strong>
                {oracleReady
                  ? t("oracleVerifiedShort")
                  : t("oraclePendingShort")}
              </strong>
            </div>
            <p>{t("verificationPanelCopy")}</p>
            <ul className="tarot-verification-list">
              {verificationKeys.map((key) => (
                <li key={key}>
                  <CheckCircle2 size={15} aria-hidden="true" />
                  <span>{t(key)}</span>
                </li>
              ))}
            </ul>
          </NeoCard>

          {/* Recovery — unused prepaid draw-credit from a deposit whose draw
              didn't complete. The contract reuses it on the next draw, or the
              player can withdraw it back to the wallet here. */}
          {prepaidCredit > 0 && (
            <NeoCard variant="erobo" className="tarot-recovery-panel">
              <div className="tarot-section-heading">
                <span>{t("prepaidCreditLabel")}</span>
                <strong>{formatGas(prepaidCredit)}</strong>
              </div>
              <p>{t("prepaidCreditHint")}</p>
              <NeoButton
                variant="secondary"
                disabled={isLoading}
                onClick={() => dispatch("withdrawCredit")}
                aria-label={t("withdrawCredit")}
              >
                {t("withdrawCredit")}
              </NeoButton>
            </NeoCard>
          )}
        </aside>
      </div>
    </div>
  );
}
