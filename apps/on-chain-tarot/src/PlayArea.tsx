import { useEffect, useRef, useState } from "react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import type { Card } from "./composables/useTarot";
import { TAROT_CARD_BACK } from "./data/tarot-data";
import { PlayStage } from "@shared/components-react/v2";
import { Sparkles } from "lucide-react";
import tableArtUrl from "./tarot-reading-table.webp";
import "./PlayArea.scss";

interface LocalPlayAreaProps {
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

function cardKeywords(card: Card): string {
  return (
    card.keywords?.slice(0, 3).join(" / ") ||
    card.suitLabel ||
    card.arcana ||
    ""
  );
}

export default function PlayArea({ t, state, dispatch }: LocalPlayAreaProps) {
  const { bool, num, str, val } = useStateBindings(state);

  const isLoading = bool("isLoading");
  const hasDrawn = bool("hasDrawn");
  const allFlipped = bool("allFlipped");
  const question = str("question");
  const readingMode = str("readingMode", "idle");
  const drawn = val<Card[]>("drawn") ?? [];
  const prepaidCredit = num("prepaidCredit");

  const [dealPreview, setDealPreview] = useState(false);
  const dealPreviewTimeout = useRef<number | null>(null);
  const oracleReady = readingMode === "oracle";
  const isDealing = isLoading || dealPreview;
  const revealCount = drawn.filter((card) => card.flipped).length;
  const questionText = question.trim();
  const readingStateValue = allFlipped
    ? t("oracleVerifiedShort")
    : hasDrawn
      ? t("oracleSealed")
      : t("awaitingDraw");
  const formatGas = (value: number) =>
    `${value.toLocaleString(undefined, { maximumFractionDigits: 4 })} ${t("tokenGas")}`;

  useEffect(
    () => () => {
      if (dealPreviewTimeout.current !== null) {
        window.clearTimeout(dealPreviewTimeout.current);
      }
    },
    [],
  );

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
    if (isDealing) return;
    startDealPreview();
    await dispatch("draw");
  };

  const revealRemainingCards = () => {
    drawn.forEach((card, index) => {
      if (!card.flipped) void dispatch("flipCard", index);
    });
  };

  const handlePrimaryAction = async () => {
    if (isDealing) return;
    if (hasDrawn && !allFlipped) {
      revealRemainingCards();
      return;
    }
    if (allFlipped) {
      await dispatch("reset");
      return;
    }
    await handleDraw();
  };

  // ----- The scene: a 3-card past/present/future spread -----
  const scene = (
    <div
      className="tarot-scene"
      data-state={
        isDealing ? "dealing" : allFlipped ? "complete" : hasDrawn ? "dealt" : "idle"
      }
    >
      <div className="tarot-scene__cloth" aria-hidden="true" />
      <img
        className="tarot-scene__table-art"
        src={tableArtUrl}
        alt=""
        aria-hidden="true"
        decoding="async"
        draggable={false}
      />
      <div className="tarot-scene__table">
        <div className="tarot-scene__deck-zone">
          <span className="tarot-scene__deck-eyebrow" aria-hidden="true">
            {t("neoTarot")}
          </span>
          {/* The deck / dealing source */}
          <div className="tarot-scene__deck" aria-hidden="true">
            {[0, 1, 2].map((cardIndex) => (
              <img
                key={cardIndex}
                className="tarot-scene__deck-card"
                src={TAROT_CARD_BACK}
                alt=""
                decoding="async"
                draggable={false}
              />
            ))}
          </div>
          <div className="tarot-scene__slip" aria-live="polite">
            <span>{t("questionPreviewLabel")}</span>
            <strong data-empty={!questionText || undefined}>
              {questionText || t("questionPreviewFallback")}
            </strong>
          </div>
        </div>

        <div className="tarot-scene__reading-zone">
          <div className="tarot-scene__deal-paths" aria-hidden="true">
            <span className="tarot-scene__deal-path tarot-scene__deal-path--0" />
            <span className="tarot-scene__deal-path tarot-scene__deal-path--1" />
            <span className="tarot-scene__deal-path tarot-scene__deal-path--2" />
          </div>

          {/* Dealing animation: three cards fly out from the deck to the slots */}
          {isDealing && (
            <div className="tarot-scene__dealing" aria-hidden="true">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className={`tarot-scene__deal-card tarot-scene__deal-card--${i} mx2-deal`}
                >
                  <img
                    className="tarot-scene__deal-card-image"
                    src={TAROT_CARD_BACK}
                    alt=""
                    decoding="async"
                    draggable={false}
                  />
                </span>
              ))}
            </div>
          )}

          {/* The spread slots */}
          <div className="tarot-scene__spread">
            {spreadKeys.map((slotKey, index) => {
              const card = drawn[index];
              const revealed = Boolean(card && card.flipped);
              return (
                <button
                  key={slotKey}
                  type="button"
                  className={[
                    "tarot-scene__slot",
                    revealed ? "tarot-scene__slot--revealed" : null,
                    card && !card.flipped ? "tarot-scene__slot--sealed" : null,
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => card && !card.flipped && void dispatch("flipCard", index)}
                  disabled={!card || card.flipped || isDealing}
                  aria-label={t(slotKey)}
                >
                  <span className="tarot-scene__slot-frame">
                    {card ? (
                      <span
                        className="tarot-scene__card-flip"
                        data-flipped={card.flipped ? "true" : undefined}
                      >
                        <span className="tarot-scene__card-face tarot-scene__card-face--back">
                          <img src={TAROT_CARD_BACK} alt={t("cardBackAlt")} decoding="async" />
                        </span>
                        <span className="tarot-scene__card-face tarot-scene__card-face--front">
                          <img
                            src={card.image || TAROT_CARD_BACK}
                            alt={card.name}
                            decoding="async"
                          />
                        </span>
                      </span>
                    ) : (
                      <span className="tarot-scene__slot-empty">
                        <img
                          className="tarot-scene__slot-empty-card"
                          src={TAROT_CARD_BACK}
                          alt=""
                          decoding="async"
                          draggable={false}
                        />
                        <span className="tarot-scene__slot-index">{index + 1}</span>
                      </span>
                    )}
                  </span>
                  <span className="tarot-scene__slot-label">{t(slotKey)}</span>
                  {revealed && card && (
                    <span className="tarot-scene__slot-name">
                      <strong>{card.name}</strong>
                      <em>{cardKeywords(card)}</em>
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* status caption */}
          <p className="tarot-scene__status" aria-live="polite">
            {isDealing
              ? t("dealingCards")
              : !hasDrawn
                ? t("notDrawnYet")
                : allFlipped
                  ? t("oracleVerifiedShort")
                  : `${t("revealProgress", { count: revealCount, total: 3 })}`}
          </p>
        </div>
      </div>
    </div>
  );

  const stageTitle = isDealing
    ? t("dealingCards")
    : allFlipped
      ? t("oracleVerifiedShort")
      : hasDrawn
        ? t("tapToReveal")
        : t("drawYourCards");

  const secondaryActions = [
    ...(allFlipped
      ? [
          {
            label: t("copyReading"),
            onClick: () => void dispatch("copyReading"),
            hint: t("readingCopied"),
          },
        ]
      : []),
    ...(hasDrawn && !allFlipped
      ? [
          {
            label: t("drawAgain"),
            onClick: () => void dispatch("reset"),
            hint: t("reset"),
          },
        ]
      : []),
  ].slice(0, 3);

  return (
    <div className="tarot-play-area mx2 mx2-cat-game">
      <PlayStage
        category="game"
        stage={{
          eyebrow: t("neoTarot"),
          title: stageTitle,
          subtitle: t("tarotHeroSubtitle"),
          badges: (
            <>
              <span className="mx2-badge" data-tone="accent">
                <span className="mx2-badge__dot" /> {t("tarotFee")}
              </span>
              {oracleReady &&
                (allFlipped ? (
                  <span className="mx2-badge" data-tone="accent">
                    {t("oracleVerifiedShort")}
                  </span>
                ) : (
                  <span className="mx2-badge">{t("oraclePendingShort")}</span>
                ))}
            </>
          ),
        }}
        scene={scene}
        score={hasDrawn ? [
          {
            label: t("readingStateLabel"),
            value: readingStateValue,
            accent: allFlipped,
          },
          { label: t("revealed"), value: `${revealCount}/3` },
          { label: t("cardsDrawnCount"), value: String(drawn.length) },
        ] : undefined}
        actions={{
          primary: {
            label: isDealing
              ? t("drawingCards")
              : hasDrawn
                ? allFlipped
                  ? t("drawAgain")
                  : t("revealAllCards")
                : t("drawCards"),
            onClick: () => void handlePrimaryAction(),
            disabled: isDealing,
            loading: isDealing,
            icon: <Sparkles size={18} aria-hidden="true" />,
            hint: hasDrawn && !allFlipped ? t("tapToReveal") : t("drawCards"),
          },
          secondary: secondaryActions,
        }}
        drawerToggleLabel={t("readingIntentTitle")}
        drawer={{
          title: t("readingIntentTitle"),
          children: (
            <>
              <div className="tarot-drawer__intent-grid" aria-label={t("quickIntentLabel")}>
                {questionPresets.map((preset) => (
                  <button
                    key={preset.valueKey}
                    type="button"
                    className="tarot-drawer__intent-card"
                    onClick={() => void dispatch("setQuestion", t(preset.valueKey))}
                  >
                    <span>{t(preset.labelKey)}</span>
                    <strong>{t(preset.valueKey)}</strong>
                  </button>
                ))}
              </div>
              <label className="tarot-drawer__question-card">
                <span className="tarot-drawer__question-label">{t("questionLabel")}</span>
                <textarea
                  className="tarot-drawer__textarea"
                  value={question}
                  onChange={(e) =>
                    void dispatch("setQuestion", e.target.value.slice(0, 200))
                  }
                  placeholder={t("questionPlaceholder")}
                  maxLength={200}
                  rows={2}
                />
                <span className="tarot-drawer__count">
                  {t("questionCharacterCount", { count: question.length, max: 200 })}
                </span>
              </label>

              <div className="tarot-drawer__flow" aria-label={t("readingFlowTitle")}>
                <span>
                  <strong>{t("readingStepOneShort")}</strong>
                  <em>{t("readingStepOneCopy")}</em>
                </span>
                <span>
                  <strong>{t("readingStepTwoShort")}</strong>
                  <em>{t("readingStepTwoCopy")}</em>
                </span>
                <span>
                  <strong>{t("readingStepThreeShort")}</strong>
                  <em>{t("readingStepThreeCopy")}</em>
                </span>
              </div>

              <div className="tarot-drawer__safety">
                <h4>{t("verificationPanelTitle")}</h4>
                <ul className="tarot-drawer__verify">
                  <li>{t("verificationPointFee")}</li>
                  <li>{t("verificationPointRandom")}</li>
                  <li>{t("verificationPointWallet")}</li>
                </ul>
                <p className="tarot-drawer__route">
                  {t("contractRouteLabel")}: <code>{t("tarotContractRoute")}</code>
                </p>
              </div>

              {prepaidCredit > 0 && (
                <div className="tarot-drawer__credit">
                  <span>
                    {t("prepaidCreditLabel")}:{" "}
                    <strong>{formatGas(prepaidCredit)}</strong>
                    <em>{t("prepaidCreditHint")}</em>
                  </span>
                  <button
                    type="button"
                    className="mx2-btn mx2-btn--ghost"
                    disabled={isDealing}
                    onClick={() => void dispatch("withdrawCredit")}
                  >
                    {t("withdrawCredit")}
                  </button>
                </div>
              )}
            </>
          ),
        }}
      />
    </div>
  );
}
