import "./CapsuleList.scss";

interface CapsuleListProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  totalCapsules: number;
}

export default function CapsuleList({ t, totalCapsules }: CapsuleListProps) {
  const emptyText =
    totalCapsules > 0 ? t("noLocalCapsules") : t("noCapsules");

  return (
    <div className="capsule-list-container">
      <div className="empty-state">
        <span>{emptyText}</span>
      </div>
    </div>
  );
}
