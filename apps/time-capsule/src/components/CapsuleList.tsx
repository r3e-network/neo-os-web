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
        <span className="empty-state__badge" aria-hidden="true">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="5" y="10" width="14" height="10" rx="2" />
            <path d="M5 12a7 7 0 0 1 14 0" />
            <path d="M12 14v3" />
          </svg>
        </span>
        <span>{emptyText}</span>
      </div>
    </div>
  );
}
