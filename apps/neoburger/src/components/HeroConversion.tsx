import "./HeroConversion.scss";

interface HeroConversionProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  neoBalance: number | null;
  bNeoBalance: number | null;
}

export default function HeroConversion({ t, neoBalance, bNeoBalance }: HeroConversionProps) {
  return (
    <>
      <div className="hero-conversion">
        <div className="hero-convert-token">
          <span className="convert-icon" aria-hidden="true">N</span>
          <span className="convert-label">{t("tokenNeo")}</span>
        </div>
        <span className="convert-arrow">&rarr;</span>
        <div className="hero-convert-token">
          <span className="convert-icon convert-icon--bneo" aria-hidden="true">b</span>
          <span className="convert-label">{t("tokenBneo")}</span>
        </div>
      </div>
      <div className="hero-stats-row">
        <div className="hero-stat">
          <span className="hero-stat-label">{t("sidebarNeoBalance")}</span>
          <span className="hero-stat-value">{neoBalance ?? t("notAvailable")}</span>
        </div>
        <div className="hero-stat-divider" />
        <div className="hero-stat">
          <span className="hero-stat-label">{t("sidebarBneoBalance")}</span>
          <span className="hero-stat-value">{bNeoBalance ?? t("notAvailable")}</span>
        </div>
      </div>
    </>
  );
}
