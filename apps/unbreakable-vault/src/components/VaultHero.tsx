interface VaultHeroProps { t: (key: string) => string; }

export default function VaultHero({ t }: VaultHeroProps) {
  return (
    <div className="vault-hero">
      <div className="vault-hero-identity">
        <div className="vault-hero-badge" aria-hidden="true">
          <picture>
            <source srcSet="./logo.avif" type="image/avif" />
            <source srcSet="./logo.webp" type="image/webp" />
            <img src="./logo.jpg" alt="" />
          </picture>
        </div>
        <div className="vault-hero-text">
          <span className="vault-hero-eyebrow">{t("feature1Name")}</span>
          <span className="vault-hero-title">{t("title")}</span>
          <span className="vault-hero-subtitle">{t("docSubtitle")}</span>
        </div>
      </div>
      <picture className="vault-hero-media" aria-hidden="true">
        <source srcSet="./banner.avif" type="image/avif" />
        <source srcSet="./banner.webp" type="image/webp" />
        <img src="./banner.jpg" alt="" />
      </picture>
    </div>
  );
}
