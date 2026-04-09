import { NeoButton } from "@shared/components-react";

interface HistoryTabProps { history: unknown[]; forgettingId: string | null; onForget: (item: unknown) => void; t: (key: string) => string; }

export default function HistoryTab({ history, forgettingId, onForget, t }: HistoryTabProps) {
  const getDestructionIcon = (index: number) => {
    const icons = ["\uD83D\uDC80", "\u26B0\uFE0F", "\uD83E\uDEA6", "\u2620\uFE0F", "\uD83D\uDD25"];
    return icons[index % icons.length];
  };

  return (
    <div className="tab-content scrollable">
      <div className="history-header">
        <span className="history-label">{t("recentDestructions")}</span>
        <span className="history-count">{history.length}</span>
      </div>
      {history.length === 0 ? (
        <div className="empty-state"><span className="empty-text">{t("noDestructions")}</span></div>
      ) : (
        <div className="history-list">
          {(history as Array<Record<string, unknown>>).map((item, index) => (
            <div key={String(item.id)} className="history-card">
              <span className="history-icon">{getDestructionIcon(index)}</span>
              <div className="history-info">
                <span className="history-hash">{String(item.hash ?? "").slice(0, 10)}...{String(item.hash ?? "").slice(-6)}</span>
                <span className="history-time">{String(item.time ?? "")}</span>
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
