import "./EnvelopeStats.scss";

interface EnvelopeStatsProps {
  t?: (key: string, params?: Record<string, string | number>) => string;
  [key: string]: unknown;
}

export default function EnvelopeStats(props: EnvelopeStatsProps) {
  return (
    <div className="EnvelopeStats">
      {/* Migrated from EnvelopeStats.vue */}
    </div>
  );
}
