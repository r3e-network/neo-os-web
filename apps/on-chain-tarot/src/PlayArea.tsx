import { NeoCard } from "@shared/components-react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import TarotHero from "./components/TarotHero";
import TarotActions from "./components/TarotActions";
import type { Card } from "./composables/useTarot";
import { TAROT_CARD_BACK } from "./pages/index/components/tarot-data";
import "./PlayArea.scss";

interface PlayAreaProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Observable>;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
}

export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { bool, num, str, val } = useStateBindings(state);

  const isLoading = bool("isLoading");
  const hasDrawn = bool("hasDrawn");
  const allFlipped = bool("allFlipped");
  const readingsCount = num("readingsCount");
  const cardsDrawnCount = num("cardsDrawnCount");
  const question = str("question");
  const readingMode = str("readingMode", "idle");
  const drawn = val<Card[]>("drawn") ?? [];
  const spreadKeys = ["past", "present", "future"] as const;

  return (
    <div className="tarot-play-area">
      <TarotHero t={t} readingsCount={readingsCount} cardsDrawnCount={cardsDrawnCount} hasDrawn={hasDrawn} />

      {drawn.length === 0 ? (
        <>
          <section className="tarot-deck-preview" aria-label={t("neoDeck")}>
            <div className="tarot-deck-fan" aria-hidden="true">
              {[0, 1, 2, 3, 4].map((offset) => (
                <img key={offset} src={TAROT_CARD_BACK} className={`tarot-fan-card tarot-fan-card--${offset}`} alt="" />
              ))}
            </div>
            <div className="tarot-deck-copy">
              <span className="tarot-deck-eyebrow">{t("neoDeck")}</span>
              <strong>{t("fullDeck")}</strong>
              <p>{t("deckHint")}</p>
            </div>
          </section>
          <label className="tarot-question-field">
            <span>{t("questionLabel")}</span>
            <textarea
              value={question}
              placeholder={t("questionPlaceholder")}
              maxLength={200}
              rows={3}
              onChange={(event) => { void dispatch("setQuestion", event.currentTarget.value); }}
            />
          </label>
        </>
      ) : (
        <div className="tarot-cards-row">
          {drawn.map((card: Card, index: number) => {
            const spreadKey = spreadKeys[index] ?? "present";
            const cardKeywords = card.keywords?.slice(0, 2).join(" / ") || card.suitLabel || card.arcana || "";

            return (
              <button
                key={`${card.id}-${index}`}
                className={`tarot-card-slot${card.flipped ? " flipped" : ""}`}
                onClick={() => dispatch("flipCard", index)}
                type="button"
                aria-label={card.flipped ? card.name : `${t("tapToReveal")} ${t(spreadKey)}`}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    dispatch("flipCard", index);
                  }
                }}
              >
                <span className="tarot-card-position">{t(spreadKey)}</span>
                <span className="tarot-card-inner">
                  <span className="tarot-card-face tarot-card-back">
                    <img src={card.backImage || TAROT_CARD_BACK} alt={t("cardBackAlt")} className="tarot-card-image" />
                    <span className="tarot-card-hint">{t("tapToReveal")}</span>
                  </span>
                  <span className="tarot-card-face tarot-card-front">
                    <img
                      src={card.image}
                      alt={t("cardImageAlt", { name: card.name })}
                      className="tarot-card-image"
                    />
                  </span>
                </span>
                <span className="tarot-card-caption">
                  <span className="card-name">{card.name}</span>
                  <span className="card-keywords">{cardKeywords}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}

      {readingMode === "oracle" && (
        <div className={`tarot-reading-mode tarot-reading-mode--${readingMode}`}>
          {t("oracleVerified")}
        </div>
      )}

      {hasDrawn && allFlipped && drawn.length > 0 && (
        <NeoCard title={t("readingSummary") || "Your Reading"}>
          <div className="reading-summary">
            {drawn.map((card: Card, index: number) => {
              const spreadKey = spreadKeys[index] ?? "present";
              return (
                <div key={`${card.id}-summary-${index}`} className="reading-card-line">
                  <img src={card.image} alt={t("cardImageAlt", { name: card.name })} className="reading-card-thumb" />
                  <span className="reading-card-text">
                    <span className="reading-position">{t(spreadKey)}</span>
                    <span className="reading-name">{card.name}</span>
                    <span className="reading-keywords">{card.keywords?.join(" / ")}</span>
                  </span>
                </div>
              );
            })}
          </div>
        </NeoCard>
      )}

      <TarotActions
        t={t}
        isLoading={isLoading}
        hasDrawn={hasDrawn}
        onDraw={() => dispatch("draw")}
        onReset={() => dispatch("reset")}
      />
    </div>
  );
}
