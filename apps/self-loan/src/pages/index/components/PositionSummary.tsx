import "./PositionSummary.scss";

interface PositionSummaryProps {
  t?: (key: string, params?: Record<string, string | number>) => string;
  [key: string]: unknown;
}

export default function PositionSummary(props: PositionSummaryProps) {
  return (
    <div className="PositionSummary">
      {/* Migrated from PositionSummary.vue */}
    </div>
  );
}
