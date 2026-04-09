import "./ManageTab.scss";

interface ManageTabProps {
  t?: (key: string, params?: Record<string, string | number>) => string;
  [key: string]: unknown;
}

export default function ManageTab(props: ManageTabProps) {
  return (
    <div className="ManageTab">
      {/* Migrated from ManageTab.vue */}
    </div>
  );
}
