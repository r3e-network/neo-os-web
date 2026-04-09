import "./OpeningModal.scss";

interface OpeningModalProps {
  t?: (key: string, params?: Record<string, string | number>) => string;
  [key: string]: unknown;
}

export default function OpeningModal(props: OpeningModalProps) {
  return (
    <div className="OpeningModal">
      {/* Migrated from OpeningModal.vue */}
    </div>
  );
}
