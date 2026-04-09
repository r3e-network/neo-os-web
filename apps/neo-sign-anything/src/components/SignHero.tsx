import "./SignHero.scss";

interface SignHeroProps {
  t: (key: string, params?: Record<string, string | number>) => string;
}

export default function SignHero({ t }: SignHeroProps) {
  return (
    <>
      <div className="hero-container">
        <div className="sign-scene" aria-hidden="true">
          <div className="pen-graphic" aria-hidden="true">&#x270D;&#xFE0F;</div>
          <div className="checkmark-graphic" aria-hidden="true">&#x2713;</div>
        </div>
      </div>

      <div className="header">
        <span className="title">{t("signTitle")}</span>
        <span className="subtitle">{t("signDesc")}</span>
      </div>
    </>
  );
}
