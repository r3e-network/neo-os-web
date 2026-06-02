import { NeoButton } from "@shared/components-react";
import type { HistoryItem } from "../../../types";

interface HistoryTabProps {
  history: HistoryItem[];
  forgettingId: string | null;
  isLoading: boolean;
  onRefresh: () => void;
  onForget: (item: HistoryItem) => void;
  t: (key: string) => string;
}

export default function HistoryTab({
  history,
  forgettingId,
  isLoading,
  onRefresh,
  onForget,
  t,
}: HistoryTabProps) {
  const memoryTypeLabel = (memoryType?: number) => {
    const labels = [
      "",
      t("memoryTypeSecret"),
      t("memoryTypeRegret"),
      t("memoryTypeWish"),
      t("memoryTypeConfession"),
      t("memoryTypeOther"),
    ];
    return labels[memoryType ?? 0] || t("memoryType");
  };

  return (
    <div className="tab-content scrollable">
      <div className="history-header">
        <span className="history-label">{t("recentDestructions")}</span>
        <div className="history-header-actions">
          <span className="history-count">{history.length}</span>
          <NeoButton size="sm" variant="ghost" loading={isLoading} onClick={onRefresh}>
            {t("refreshRecords")}
          </NeoButton>
        </div>
      </div>
      {history.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon" aria-hidden="true">0</span>
          <span className="empty-text">{t("noDestructions")}</span>
        </div>
      ) : (
        <div className="history-list">
          {history.map((item, index) => (
            <div key={String(item.id)} className="history-card">
              <span className="history-icon" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
              <div className="history-info">
                <span className="history-hash">{item.hash.slice(0, 10)}...{item.hash.slice(-6)}</span>
                <span className="history-time">{memoryTypeLabel(item.memoryType)} · {item.time}</span>
              </div>
              <div className={`history-badge${item.forgotten ? " forgotten" : ""}`}>
                <span className="badge-text">{item.forgotten ? t("forgotten") : t("destroyed")}</span>
              </div>
              {!item.forgotten && (
                <NeoButton size="sm" variant="secondary" loading={forgettingId === String(item.id)} onClick={() => onForget(item)}>
                  {t("forgetAction")}
                </NeoButton>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
