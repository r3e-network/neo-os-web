import "./LoanRequest.scss";

interface LoanRequestProps {
  t?: (key: string, params?: Record<string, string | number>) => string;
  [key: string]: unknown;
}

export default function LoanRequest(props: LoanRequestProps) {
  return (
    <div className="LoanRequest">
      {/* Migrated from LoanRequest.vue */}
    </div>
  );
}
