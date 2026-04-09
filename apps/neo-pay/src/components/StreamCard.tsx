import "./StreamCard.scss";

interface StreamCardProps {
  t?: (key: string, params?: Record<string, string | number>) => string;
  [key: string]: unknown;
}

export default function StreamCard(props: StreamCardProps) {
  return (
    <div className="StreamCard">
      {/* Migrated from StreamCard.vue */}
    </div>
  );
}
