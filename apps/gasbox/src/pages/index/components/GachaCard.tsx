import "./GachaCard.scss";

interface GachaCardProps {
  t?: (key: string, params?: Record<string, string | number>) => string;
  [key: string]: unknown;
}

export default function GachaCard(props: GachaCardProps) {
  return (
    <div className="GachaCard">
      {/* Migrated from GachaCard.vue */}
    </div>
  );
}
