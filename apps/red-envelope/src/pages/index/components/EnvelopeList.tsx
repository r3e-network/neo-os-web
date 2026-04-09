import "./EnvelopeList.scss";

interface EnvelopeListProps {
  t?: (key: string, params?: Record<string, string | number>) => string;
  [key: string]: unknown;
}

export default function EnvelopeList(props: EnvelopeListProps) {
  return (
    <div className="EnvelopeList">
      {/* Migrated from EnvelopeList.vue */}
    </div>
  );
}
