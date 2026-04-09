import "./ProofQuickStats.scss";

interface ProofQuickStatsProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  totalProofs: number;
  yourProofs: number;
}

export default function ProofQuickStats({ t, totalProofs, yourProofs }: ProofQuickStatsProps) {
  return (
    <div className="mobile-stats">
      <div className="stat-item">
        <span className="stat-value">{totalProofs}</span>
        <span className="stat-label">{t("totalProofs")}</span>
      </div>
      <div className="stat-item">
        <span className="stat-value">{yourProofs}</span>
        <span className="stat-label">{t("yourProofs")}</span>
      </div>
    </div>
  );
}
