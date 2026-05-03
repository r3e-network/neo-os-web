import { TAROT_CARD_BACK } from "../pages/index/components/tarot-data";
import "./TarotHero.scss";

interface TarotHeroProps { t: (key: string, params?: Record<string, string | number>) => string; readingsCount: number; cardsDrawnCount: number; hasDrawn: boolean; }

export default function TarotHero({ t, readingsCount, cardsDrawnCount, hasDrawn }: TarotHeroProps) {
  return (
    <div className="hero-container">
      <div className="tarot-scene" aria-hidden="true">
        <img className={`tarot-card-back-hero tarot-card-back-hero--left${hasDrawn ? " tarot-card-back--drawn" : ""}`} src={TAROT_CARD_BACK} alt="" />
        <img className={`tarot-card-back-hero tarot-card-back-hero--center${hasDrawn ? " tarot-card-back--drawn" : ""}`} src={TAROT_CARD_BACK} alt="" />
        <img className={`tarot-card-back-hero tarot-card-back-hero--right${hasDrawn ? " tarot-card-back--drawn" : ""}`} src={TAROT_CARD_BACK} alt="" />
      </div>
      <div className="hero-stats">
        <div className="hero-stat"><span className="hero-stat-value">{readingsCount}</span><span className="hero-stat-label">{t("readings")}</span></div>
        <div className="hero-stat"><span className="hero-stat-value">{cardsDrawnCount}</span><span className="hero-stat-label">{t("cardsDrawnCount")}</span></div>
      </div>
    </div>
  );
}
