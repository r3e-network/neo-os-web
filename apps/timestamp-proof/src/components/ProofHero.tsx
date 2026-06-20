import { Fingerprint, Link2, ShieldCheck, Stamp } from "lucide-react";
import "./ProofHero.scss";

interface ProofHeroProps {
  t: (key: string, params?: Record<string, string | number>) => string;
}

export default function ProofHero({ t }: ProofHeroProps) {
  return (
    <section className="proof-hero">
      <div className="proof-hero__content">
        <div className="proof-hero__head">
          <div className="proof-hero__badge" aria-hidden="true">
            <Stamp size={24} />
          </div>
          <div className="proof-hero__copy">
            <span className="proof-hero__eyebrow">{t("proofs")}</span>
            <h2 className="proof-hero__title">{t("title")}</h2>
            <p className="proof-hero__subtitle">{t("docSubtitle")}</p>
          </div>
        </div>
        <p className="proof-hero__description">{t("docDescription")}</p>
        <div className="proof-hero__steps" aria-label={t("proofWorkflow")}>
          <span>
            <Fingerprint size={17} aria-hidden="true" />
            {t("step2")}
          </span>
          <span>
            <ShieldCheck size={17} aria-hidden="true" />
            {t("proofPrivacy")}
          </span>
          <span>
            <Link2 size={17} aria-hidden="true" />
            {t("step3")}
          </span>
        </div>
      </div>
      <figure className="proof-hero__stage">
        <img src="./proof-desk.jpg" alt="" />
        <figcaption>
          <span>{t("proofStageKicker")}</span>
          <strong>{t("proofStageTitle")}</strong>
        </figcaption>
      </figure>
    </section>
  );
}
