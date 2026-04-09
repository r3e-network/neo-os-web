interface VaultHeroProps { t: (key: string) => string; myVaultCount: number; recentVaultCount: number; }

export default function VaultHero({ t, myVaultCount, recentVaultCount }: VaultHeroProps) {
  return (
    <div className="hero-container">
      <div className="hero-stats">
        <div className="hero-stat"><span className="hero-stat-value">{myVaultCount}</span><span className="hero-stat-label">{t("create")}</span></div>
        <div className="hero-stat"><span className="hero-stat-value">{recentVaultCount}</span><span className="hero-stat-label">{t("break")}</span></div>
      </div>
    </div>
  );
}
