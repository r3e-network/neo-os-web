import "./UserStatsRow.scss";

interface UserStatsRowProps {
  t?: (key: string, params?: Record<string, string | number>) => string;
  [key: string]: unknown;
}

export default function UserStatsRow(props: UserStatsRowProps) {
  return (
    <div className="UserStatsRow">
      {/* Migrated from UserStatsRow.vue */}
    </div>
  );
}
