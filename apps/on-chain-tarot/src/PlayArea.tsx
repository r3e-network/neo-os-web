import { NeoCard } from "@shared/components-react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import TarotHero from "./components/TarotHero";
import TarotActions from "./components/TarotActions";
import type { Card } from "./composables/useTarot";
import "./PlayArea.scss";

interface PlayAreaProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Observable>;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
}

export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { bool, num, val } = useStateBindings(state);

  const isLoading = bool("isLoading");
  const hasDrawn = bool("hasDrawn");
  const allFlipped = bool("allFlipped");
  const readingsCount = num("readingsCount");
  const cardsDrawnCount = num("cardsDrawnCount");
  const drawn = val<Card[]>("drawn") ?? [];

  return (
    <div className="tarot-play-area">
      <TarotHero t={t} readingsCount={readingsCount} cardsDrawnCount={cardsDrawnCount} hasDrawn={hasDrawn} />

      {/* Cards Display */}
      <div className="tarot-cards-row">
        {drawn.map((card: Card, index: number) => (
          <div
            key={card.id}
            className={`tarot-card-slot${card.flipped ? " flipped" : ""}`}
            onClick={() => dispatch("flipCard", index)}
            role="button"
            tabIndex={0}
            aria-label={card.flipped ? card.name : t("flipCard") || "Flip card"}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") dispatch("flipCard", index); }}
          >
            <div className="tarot-card-inner">
              {card.flipped ? (
                <div className="tarot-card-face">
                  <span className="card-icon">{card.icon}</span>
                  <span className="card-name">{card.name}</span>
                </div>
              ) : (
                <div className="tarot-card-back">
                  <span className="tarot-symbol">&#10022;</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Reading Summary */}
      {hasDrawn && allFlipped && drawn.length > 0 && (
        <NeoCard title={t("readingSummary") || "Your Reading"}>
          <div className="reading-summary">
            {drawn.map((card: Card) => (
              <div key={card.id} className="reading-card-line">
                <span className="reading-icon">{card.icon}</span>
                <span className="reading-name">{card.name}</span>
              </div>
            ))}
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
