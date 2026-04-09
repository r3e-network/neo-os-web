import "./DiscoverTab.scss";

interface DiscoverTabProps {
  t?: (key: string, params?: Record<string, string | number>) => string;
  [key: string]: unknown;
}

export default function DiscoverTab(props: DiscoverTabProps) {
  return (
    <div className="DiscoverTab">
      {/* Migrated from DiscoverTab.vue */}
    </div>
  );
}
