interface VaultHeroProps { t: (key: string) => string; }

export default function VaultHero({ t }: VaultHeroProps) {
  return (
    <div className="vault-hero">
      <div className="vault-hero-badge" aria-hidden="true">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          <circle cx="12" cy="16" r="1.4" fill="currentColor" stroke="none" />
        </svg>
      </div>
      <div className="vault-hero-text">
        <span className="vault-hero-eyebrow">{t("feature1Name")}</span>
        <span className="vault-hero-title">{t("title")}</span>
        <span className="vault-hero-subtitle">{t("docSubtitle")}</span>
      </div>
    </div>
  );
}
