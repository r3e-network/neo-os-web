import { NeoCard, NeoButton } from "@shared/components-react";

interface EventListProps {
  address: string | null; events: unknown[]; isRefreshing: boolean; togglingId: string | null;
  onRefresh: () => void; onConnect: () => void; onIssue: (event: unknown) => void; onToggle: (event: unknown) => void;
  t: (key: string) => string;
}

export default function EventList({ address, events, isRefreshing, togglingId, onRefresh, onConnect, onIssue, onToggle, t }: EventListProps) {
  return (
    <NeoCard title={t("yourEvents")}>
      <div className="events-header">
        <NeoButton size="sm" variant="secondary" loading={isRefreshing} onClick={onRefresh}>{t("refresh")}</NeoButton>
      </div>
      {!address ? (
        <div className="empty-state">
          <span>{t("walletNotConnected")}</span>
          <NeoButton size="sm" variant="primary" onClick={onConnect}>{t("connectWallet")}</NeoButton>
        </div>
      ) : events.length === 0 ? (
        <span>{t("emptyEvents")}</span>
      ) : (
        (events as Array<Record<string, unknown>>).map((event) => (
          <div key={String(event.id)} className="event-card">
            <span>{String(event.name || event.id)}</span>
          </div>
        ))
      )}
    </NeoCard>
  );
}
