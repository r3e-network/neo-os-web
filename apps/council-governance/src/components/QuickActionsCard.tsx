import "./QuickActionsCard.scss";

interface QuickActionsCardProps {
  t?: (key: string, params?: Record<string, string | number>) => string;
  [key: string]: unknown;
}

export default function QuickActionsCard(props: QuickActionsCardProps) {
  return (
    <div className="QuickActionsCard">
      {/* Migrated from QuickActionsCard.vue */}
    </div>
  );
}
