import "./ActiveLoans.scss";

interface ActiveLoansProps {
  t?: (key: string, params?: Record<string, string | number>) => string;
  [key: string]: unknown;
}

export default function ActiveLoans(props: ActiveLoansProps) {
  return (
    <div className="ActiveLoans">
      {/* Migrated from ActiveLoans.vue */}
    </div>
  );
}
