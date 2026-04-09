import "./TreasuryHero.scss";

interface TreasuryHeroProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  totalUsd?: number;
  totalNeo?: number;
  totalGas?: number;
}

export default function TreasuryHero({ t, totalUsd, totalNeo, totalGas }: TreasuryHeroProps) {
  const totalUsdLabel = totalUsd ? `$${totalUsd.toLocaleString()}` : t("notAvailable");
  const totalNeoLabel = totalNeo?.toLocaleString() ?? t("notAvailable");
  const totalGasLabel = totalGas?.toLocaleString() ?? t("notAvailable");

  return (
    <div className="hero-container">
      <div className="hero-stats">
        <div className="hero-stat">
          <span className="hero-stat-value">{totalUsdLabel}</span>
          <span className="hero-stat-label">{t("sidebarTotalUsd")}</span>
        </div>
        <div className="hero-stat">
          <span className="hero-stat-value">{totalNeoLabel}</span>
          <span className="hero-stat-label">{t("tokenNeo")}</span>
        </div>
        <div className="hero-stat">
          <span className="hero-stat-value">{totalGasLabel}</span>
          <span className="hero-stat-label">{t("tokenGas")}</span>
        </div>
      </div>
    </div>
  );
}
