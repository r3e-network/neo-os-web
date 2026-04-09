import { NeoCard } from "@shared/components-react";
import type { HistoryEvent } from "../../../composables/useLastSurvivor";
import "./HistoryList.scss";

interface HistoryListProps {
  history: HistoryEvent[];
  t: (key: string, ...args: unknown[]) => string;
}

export default function HistoryList({ history, t }: HistoryListProps) {
  return (
    <NeoCard variant="erobo">
      {history.length === 0 ? (
        <div className="empty-state">{t("noHistory")}</div>
      ) : (
        <div className="history-list">
          {history.map((item) => (
            <div key={item.id} className="history-item-glass">
              <div className="history-header">
                <span className="history-title-glass">{item.title}</span>
                <span className="history-date-glass">{item.date}</span>
              </div>
              <span className="history-desc-glass">{item.details}</span>
            </div>
          ))}
        </div>
      )}
    </NeoCard>
  );
}

export type { HistoryEvent };
