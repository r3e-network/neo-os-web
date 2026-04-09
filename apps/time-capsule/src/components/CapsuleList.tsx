import "./CapsuleList.scss";

interface CapsuleListProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  totalCapsules: number;
}

export default function CapsuleList({ t, totalCapsules }: CapsuleListProps) {
  return (
    <div className="capsule-list-container">
      {totalCapsules === 0 && (
        <div className="empty-state">
          <span>{t("noCapsules")}</span>
        </div>
      )}
    </div>
  );
}
