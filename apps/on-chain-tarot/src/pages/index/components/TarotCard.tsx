import "./TarotCard.scss";

interface TarotCardProps {
  t?: (key: string, params?: Record<string, string | number>) => string;
  [key: string]: unknown;
}

export default function TarotCard(props: TarotCardProps) {
  return (
    <div className="TarotCard">
      {/* Migrated from TarotCard.vue */}
    </div>
  );
}
