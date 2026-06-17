import { NeoCard } from "@shared/components-react";
import { StateView } from "@shared/components";
import { EmptyStateArt } from "@shared/components-react/illustrations";
import type { HistoryEvent } from "../../../composables/useLastSurvivor";
import "./HistoryList.scss";

interface HistoryListProps {
  history: HistoryEvent[];
  t: (key: string, params?: Record<string, string | number>) => string;
}

export default function HistoryList({ history, t }: HistoryListProps) {
  return (
    <NeoCard variant="erobo">
      {history.length === 0 ? (
        <StateView
          kind="empty"
          icon={<EmptyStateArt size={96} title={t("noHistory")} />}
          title={t("noHistory")}
        />
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
