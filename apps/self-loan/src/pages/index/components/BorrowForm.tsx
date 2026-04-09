import "./BorrowForm.scss";

interface BorrowFormProps {
  t?: (key: string, params?: Record<string, string | number>) => string;
  [key: string]: unknown;
}

export default function BorrowForm(props: BorrowFormProps) {
  return (
    <div className="BorrowForm">
      {/* Migrated from BorrowForm.vue */}
    </div>
  );
}
