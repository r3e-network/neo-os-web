import { NeoButton, NeoCard } from "@shared/components-react";
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
  const { num, str, bool } = useStateBindings(state);

  const eventsCount = num("eventsCount");
  const ticketsCount = num("ticketsCount");
  const activeEventsCount = num("activeEventsCount");
  const events = (state.events?.get() ?? []) as unknown[];
  const tickets = (state.tickets?.get() ?? []) as unknown[];
  const address = str("address", "");
  const isRefreshing = bool("isRefreshing");
  const isLoading = bool("isLoading");
  const togglingId = state.togglingId?.get() as string | null;

  return (
    <div className="ticket-play-area">
      {/* Stats Bar */}
      <div className="hero-stats">
        <div className="hero-stat">
          <span className="hero-stat-value">{eventsCount}</span>
          <span className="hero-stat-label">{t("sidebarEvents") || "Events"}</span>
        </div>
        <div className="hero-stat">
          <span className="hero-stat-value">{ticketsCount}</span>
          <span className="hero-stat-label">{t("sidebarTickets") || "Tickets"}</span>
        </div>
        <div className="hero-stat">
          <span className="hero-stat-value">{activeEventsCount}</span>
          <span className="hero-stat-label">{t("sidebarActive") || "Active"}</span>
        </div>
      </div>

      {/* Loading indicator */}
      {isLoading && (
        <NeoCard variant="default" className="loading-card">
          <span className="loading-text">{t("lookingUp") || "Loading..."}</span>
        </NeoCard>
      )}

      {/* Event list with all actions */}
      <EventList
        address={address || null}
        events={events}
        isRefreshing={isRefreshing}
        togglingId={togglingId}
        onRefresh={() => dispatch("refreshEvents")}
        onConnect={() => dispatch("connectWallet")}
        onIssue={(event: unknown) => dispatch("openIssueModal", event)}
        onToggle={(event: unknown) => dispatch("toggleEvent", event)}
        t={t}
      />

      {/* Tickets summary */}
      {tickets.length > 0 && (
        <NeoCard title={t("ticketsTab") || "My Tickets"} variant="default">
          <div className="tickets-grid">
            {(tickets as Array<Record<string, unknown>>).map((ticket, idx) => (
              <div key={String(ticket.tokenId ?? idx)} className="ticket-item">
                <span className="ticket-name">{String(ticket.eventName || ticket.tokenId || `#${idx + 1}`)}</span>
                <span className={`ticket-badge ${ticket.used ? "used" : "valid"}`}>
                  {ticket.used ? (t("ticketUsed") || "Used") : (t("ticketValid") || "Valid")}
                </span>
              </div>
            ))}
          </div>
        </NeoCard>
      )}

      {/* Wallet connection prompt */}
      {!address && (
        <div className="connect-prompt">
          <NeoButton variant="primary" onClick={() => dispatch("connectWallet")}>
            {t("walletNotConnected") || "Connect Wallet"}
          </NeoButton>
        </div>
      )}
    </div>
  );
}
