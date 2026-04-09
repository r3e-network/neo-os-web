import "./ProofHero.scss";

interface ProofHeroProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  totalProofs: number;
  yourProofs: number;
}

export default function ProofHero({ t, totalProofs, yourProofs }: ProofHeroProps) {
  return (
    <div className="hero-container">
      <div className="stamp-scene" aria-hidden="true">
        <div className="stamp-seal">
          <div className="stamp-ring" />
          <span className="stamp-text">&#x2726;</span>
        </div>
      </div>
      <div className="hero-stats">
        <div className="hero-stat">
          <span className="hero-stat-value">{totalProofs}</span>
          <span className="hero-stat-label">{t("totalProofs")}</span>
        </div>
        <div className="hero-stat">
          <span className="hero-stat-value">{yourProofs}</span>
          <span className="hero-stat-label">{t("yourProofs")}</span>
        </div>
      </div>
    </div>
  );
}
