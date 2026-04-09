import "./TarotHero.scss";

interface TarotHeroProps { t: (key: string, params?: Record<string, string | number>) => string; readingsCount: number; cardsDrawnCount: number; hasDrawn: boolean; }

export default function TarotHero({ t, readingsCount, cardsDrawnCount, hasDrawn }: TarotHeroProps) {
  return (
    <div className="hero-container">
      <div className="tarot-scene" aria-hidden="true">
        <div className={`tarot-card-back-hero${hasDrawn ? " tarot-card-back--drawn" : ""}`}>
          <div className="tarot-card-inner-hero"><span className="tarot-symbol">&#10022;</span></div>
        </div>
      </div>
      <div className="hero-stats">
        <div className="hero-stat"><span className="hero-stat-value">{readingsCount}</span><span className="hero-stat-label">{t("readings")}</span></div>
        <div className="hero-stat"><span className="hero-stat-value">{cardsDrawnCount}</span><span className="hero-stat-label">{t("cardsDrawnCount")}</span></div>
      </div>
    </div>
  );
}
