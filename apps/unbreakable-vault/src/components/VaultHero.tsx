interface VaultHeroProps {
  t: (key: string) => string;
}

export default function VaultHero({ t }: VaultHeroProps) {
  return (
    <section className="vault-hero" aria-labelledby="vault-hero-title">
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
          <h2 id="vault-hero-title" className="vault-hero-title">
            {t("title")}
          </h2>
          <span className="vault-hero-subtitle">{t("docSubtitle")}</span>
          <span className="vault-hero-chip">{t("vaultHeroChip")}</span>
        </div>
      </div>
      <figure className="vault-hero-media">
        <img src="./vault-challenge.jpg" alt={t("vaultHeroImageAlt")} />
        <figcaption>
          <span>{t("vaultHeroVisualLabel")}</span>
          <strong>{t("vaultHeroVisualValue")}</strong>
        </figcaption>
      </figure>
    </section>
  );
}
