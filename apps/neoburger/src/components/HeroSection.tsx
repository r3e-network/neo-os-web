import "./HeroSection.scss";

interface HeroSectionProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  totalStakedDisplay: string;
  totalStakedUsdText: string;
  aprDisplay: string;
}

export default function HeroSection({ t, totalStakedDisplay, totalStakedUsdText, aprDisplay }: HeroSectionProps) {
  return (
    <div className="hero fade-up">
      <div className="hero-content">
        <span className="hero-title">{t("heroTitle")}</span>
        <span className="hero-subtitle">{t("heroSubtitle")}</span>
        <div className="hero-bubbles">
          <div className="hero-bubble">
            <span className="bubble-title">{t("totalBneoSupply")}</span>
            <span className="bubble-value">{totalStakedDisplay}</span>
            <span className="bubble-subvalue">{totalStakedUsdText}</span>
          </div>
          <div className="hero-bubble">
            <span className="bubble-title">{t("apr")}</span>
            <span className="bubble-value">{aprDisplay}</span>
            <span className="bubble-subvalue">{t("aprTag")}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
