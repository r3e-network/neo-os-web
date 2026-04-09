import "./TransferModal.scss";

interface TransferModalProps {
  t?: (key: string, params?: Record<string, string | number>) => string;
  [key: string]: unknown;
}

export default function TransferModal(props: TransferModalProps) {
  return (
    <div className="TransferModal">
      {/* Migrated from TransferModal.vue */}
    </div>
  );
}
