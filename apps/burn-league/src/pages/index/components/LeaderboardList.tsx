import "./LeaderboardList.scss";

interface LeaderboardListProps {
  t?: (key: string, params?: Record<string, string | number>) => string;
  [key: string]: unknown;
}

export default function LeaderboardList(props: LeaderboardListProps) {
  return (
    <div className="LeaderboardList">
      {/* Migrated from LeaderboardList.vue */}
    </div>
  );
}
