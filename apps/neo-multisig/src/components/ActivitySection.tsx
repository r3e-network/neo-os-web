import type { HistoryItem } from "../composables/useMultisigHistory";

interface ActivitySectionProps {
  items: HistoryItem[]; count: number; title: string; emptyTitle: string; emptyDescription: string;
  getStatusIcon: (status: string) => string; statusLabel: (status: string) => string;
  shorten: (str: string) => string; formatDate: (ts: string) => string;
  onSelect: (id: string) => void;
}

export default function ActivitySection({ items, count, title, emptyTitle, emptyDescription, getStatusIcon, statusLabel, shorten, formatDate, onSelect }: ActivitySectionProps) {
  return (
    <div className="activity-section">
      <div className="section-header"><span className="section-title">{title}</span>{count > 0 && <span className="activity-count">{count}</span>}</div>
      {count === 0 ? (
        <div className="empty-state"><span className="empty-title">{emptyTitle}</span><span className="empty-desc">{emptyDescription}</span></div>
      ) : (
        <div className="history-list">
          {items.map((item) => (
            <button key={item.id} type="button" className="history-card" aria-label={shorten(item.scriptHash)} onClick={() => onSelect(item.id)}>
              <div className="history-icon"><span>{getStatusIcon(item.status)}</span></div>
              <div className="history-content">
                <span className="history-hash">{shorten(item.scriptHash)}</span>
                <span className="history-time">{formatDate(item.createdAt)}</span>
              </div>
              <div className={`status-badge ${item.status}`}><span className="status-text">{statusLabel(item.status)}</span></div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
