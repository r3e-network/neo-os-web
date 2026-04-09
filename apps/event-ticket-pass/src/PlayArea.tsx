import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import EventList from "./pages/index/components/EventList";
import "./PlayArea.scss";

interface PlayAreaProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Observable>;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
}

export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { num } = useStateBindings(state);
  const eventsCount = num("eventsCount");
  const ticketsCount = num("ticketsCount");
  const events = (state.events?.get() ?? []) as unknown[];
  const address = state.address?.get() as string | null;
  const isRefreshing = Boolean(state.isRefreshing?.get());
  const togglingId = state.togglingId?.get() as string | null;

  return (
    <div className="ticket-play-area">
      <div className="hero-stats">
        <div className="hero-stat">
          <span className="hero-stat-value">{eventsCount}</span>
          <span className="hero-stat-label">{t("sidebarEvents")}</span>
        </div>
        <div className="hero-stat">
          <span className="hero-stat-value">{ticketsCount}</span>
          <span className="hero-stat-label">{t("sidebarTickets")}</span>
        </div>
      </div>
      <EventList
        address={address}
        events={events}
        isRefreshing={isRefreshing}
        togglingId={togglingId}
        onRefresh={() => dispatch("refreshEvents")}
        onConnect={() => dispatch("connectWallet")}
        onIssue={(event: unknown) => dispatch("openIssueModal", event)}
        onToggle={(event: unknown) => dispatch("toggleEvent", event)}
        t={t}
      />
    </div>
  );
}
