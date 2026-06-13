import "./ProofHero.scss";

interface ProofHeroProps {
  t: (key: string, params?: Record<string, string | number>) => string;
}

export default function ProofHero({ t }: ProofHeroProps) {
  return (
    <div className="hero-container">
      <div className="hero-head">
        <div className="hero-badge" aria-hidden="true">
          <div className="stamp-seal">
            <div className="stamp-ring" />
            <span className="stamp-mark">&#x2726;</span>
          </div>
        </div>
        <div className="hero-copy">
          <span className="hero-eyebrow">{t("proofs")}</span>
          <h2 className="hero-title">{t("title")}</h2>
          <p className="hero-subtitle">{t("docSubtitle")}</p>
        </div>
      </div>
    </div>
  );
}
