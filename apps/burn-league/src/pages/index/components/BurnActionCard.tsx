import "./BurnActionCard.scss";

interface BurnActionCardProps {
  t?: (key: string, params?: Record<string, string | number>) => string;
  [key: string]: unknown;
}

export default function BurnActionCard(props: BurnActionCardProps) {
  return (
    <div className="BurnActionCard">
      {/* Migrated from BurnActionCard.vue */}
    </div>
  );
}
