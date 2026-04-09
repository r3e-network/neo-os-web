interface MultisigHeroProps { t: (key: string) => string; pendingCount: number; completedCount: number; totalCount: number; }

export default function MultisigHero({ t, pendingCount, completedCount, totalCount }: MultisigHeroProps) {
  return (
    <div className="hero-container">
      <div className="hero-stats">
        <div className="hero-stat"><span className="hero-stat-value">{pendingCount}</span><span className="hero-stat-label">{t("statPending")}</span></div>
        <div className="hero-stat"><span className="hero-stat-value">{completedCount}</span><span className="hero-stat-label">{t("statCompleted")}</span></div>
        <div className="hero-stat"><span className="hero-stat-value">{totalCount}</span><span className="hero-stat-label">{t("sidebarTotalTxs")}</span></div>
      </div>
    </div>
  );
}
