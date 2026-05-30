import { NeoCard } from "@shared/components-react";
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
      {/* Hero */}
      <div className="ticket-hero">
        <div className="ticket-hero__top">
          <div className="ticket-hero__badge" aria-hidden="true">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M4 6.5A1.5 1.5 0 0 1 5.5 5h13A1.5 1.5 0 0 1 20 6.5V9a2 2 0 0 0 0 4v2.5A1.5 1.5 0 0 1 18.5 17h-13A1.5 1.5 0 0 1 4 15.5V13a2 2 0 0 0 0-4V6.5Z"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinejoin="round"
              />
              <path d="M13 5v12" stroke="currentColor" strokeWidth="1.6" strokeDasharray="2 2.4" />
            </svg>
          </div>
          <div className="ticket-hero__heading">
            <span className="ticket-hero__eyebrow">{t("eventPass") || "Event Pass"}</span>
            <h2 className="ticket-hero__title">{t("title") || "Event Ticket Pass"}</h2>
            <p className="ticket-hero__subtitle">{t("docSubtitle") || "On-chain tickets with organizer check-in"}</p>
          </div>
        </div>
        <div className="ticket-hero__stats">
          <div className="ticket-hero__stat">
            <span className="ticket-hero__stat-value">{eventsCount}</span>
            <span className="ticket-hero__stat-label">{t("sidebarEvents") || "Events"}</span>
          </div>
          <div className="ticket-hero__stat">
            <span className="ticket-hero__stat-value">{ticketsCount}</span>
            <span className="ticket-hero__stat-label">{t("sidebarTickets") || "Tickets"}</span>
          </div>
          <div className="ticket-hero__stat">
            <span className="ticket-hero__stat-value">{activeEventsCount}</span>
            <span className="ticket-hero__stat-label">{t("sidebarActive") || "Active"}</span>
          </div>
        </div>
      </div>

      {/* Loading indicator */}
      {isLoading && (
        <NeoCard variant="default" className="loading-card">
          <div className="loading-content">
            <div className="loading-spinner" />
            <span className="loading-text">{t("lookingUp") || "Loading..."}</span>
          </div>
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
    </div>
  );
}
