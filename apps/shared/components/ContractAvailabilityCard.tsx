import { NeoCard } from "@shared/components-react";
import "./ContractAvailabilityCard.scss";

export interface ContractAvailabilityCardProps {
  title: string;
  description: string;
  compact?: boolean;
  eyebrowKey?: string;
  t?: (key: string) => string;
  className?: string;
}

export function ContractAvailabilityCard({
  title,
  description,
  compact = false,
  eyebrowKey = "onChainStatus",
  t,
  className,
}: ContractAvailabilityCardProps) {
  const classes = [
    "contract-availability-card",
    compact && "contract-availability-card--compact",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <NeoCard variant="erobo" className={classes} aria-label={title}>
      <span className="contract-availability-card__eyebrow">
        {t ? t(eyebrowKey) : eyebrowKey}
      </span>
      <h3 className="contract-availability-card__title">{title}</h3>
      <p className="contract-availability-card__description">{description}</p>
    </NeoCard>
  );
}

export default ContractAvailabilityCard;
