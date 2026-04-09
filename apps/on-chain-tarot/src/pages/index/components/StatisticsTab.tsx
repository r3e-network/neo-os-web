import "./StatisticsTab.scss";

interface StatisticsTabProps {
  t?: (key: string, params?: Record<string, string | number>) => string;
  [key: string]: unknown;
}

export default function StatisticsTab(props: StatisticsTabProps) {
  return (
    <div className="StatisticsTab">
      {/* Migrated from StatisticsTab.vue */}
    </div>
  );
}
