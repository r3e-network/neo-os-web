import "./ProofHero.scss";

interface ProofHeroProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  totalProofs: number;
  yourProofs: number;
  latestId: string;
}

export default function ProofHero({ t, totalProofs, yourProofs, latestId }: ProofHeroProps) {
  const hasProofs = totalProofs > 0;

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
          <h2 className="hero-title">{t("title")}</h2>
          <p className="hero-subtitle">{t("docSubtitle")}</p>
        </div>
      </div>

      {hasProofs && (
        <div className="hero-facts">
          <span className="hero-fact">
            <strong>{totalProofs}</strong> {t("totalProofs")}
          </span>
          <span className="hero-fact-divider" aria-hidden="true">&middot;</span>
          <span className="hero-fact">
            <strong>{yourProofs}</strong> {t("yourProofs")}
          </span>
          <span className="hero-fact-divider" aria-hidden="true">&middot;</span>
          <span className="hero-fact">
            {t("latestId")} <strong className="hero-fact-mono">{latestId}</strong>
          </span>
        </div>
      )}
    </div>
  );
}
