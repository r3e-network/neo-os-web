import "./LeaderboardCard.scss";

interface LeaderboardCardProps {
  t?: (key: string, params?: Record<string, string | number>) => string;
  [key: string]: unknown;
}

export default function LeaderboardCard(props: LeaderboardCardProps) {
  return (
    <div className="LeaderboardCard">
      {/* Migrated from LeaderboardCard.vue */}
    </div>
  );
}
