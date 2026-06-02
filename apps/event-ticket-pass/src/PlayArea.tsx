import {
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  QrCode,
  RefreshCw,
  ScanLine,
  Ticket,
  UserPlus,
} from "lucide-react";
import { NeoButton, NeoInput, NeoSelect } from "@shared/components-react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import type { EventItem, TicketItem } from "./types";
import "./PlayArea.scss";

interface PlayAreaProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Observable>;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
}

function short(value: string) {
  if (!value) return "N/A";
  if (value.length <= 18) return value;
  return `${value.slice(0, 8)}...${value.slice(-8)}`;
}

function formatDate(seconds: number, fallback: string) {
  if (!seconds) return fallback;
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(seconds * 1000));
}

function json(value: unknown) {
  if (!value) return "";
  return JSON.stringify(value, null, 2);
}

export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { num, str, bool, val } = useStateBindings(state);

  const events = val<EventItem[]>("events", []) ?? [];
  const tickets = val<TicketItem[]>("tickets", []) ?? [];
  const selectedEvent = val<EventItem>("selectedEvent");
  const lookup = val<TicketItem>("lookup");
  const latestRequest = val<Record<string, unknown>>("latestRequest");
  const latestResult = val<Record<string, unknown>>("latestResult");
  const eventsCount = num("eventsCount");
  const ticketsCount = num("ticketsCount");
  const activeEventsCount = num("activeEventsCount");
  const address = str("address");
  const selectedEventId = str("selectedEventId");
  const eventName = str("eventName");
  const eventVenue = str("eventVenue");
  const eventStart = str("eventStart");
  const eventEnd = str("eventEnd");
  const maxSupply = str("maxSupply");
  const notes = str("notes");
  const issueRecipient = str("issueRecipient");
  const issueSeat = str("issueSeat");
  const issueMemo = str("issueMemo");
  const checkinTokenId = str("checkinTokenId");
  const workflowStatus = str("workflowStatus", t("ready"));
  const lastError = str("lastError");
  const isLoading = bool("isLoading");
  const isRefreshing = bool("isRefreshing");
  const isRefreshingTickets = bool("isRefreshingTickets");
  const isCreating = bool("isCreating");
  const isIssuing = bool("isIssuing");
  const isLookingUp = bool("isLookingUp");
  const isCheckingIn = bool("isCheckingIn");
  const canIssueTicket = bool("canIssueTicket");
  const canCheckInTicket = bool("canCheckInTicket");
  const togglingId = str("togglingId");
  const requestJson = json(latestRequest);
  const resultJson = json(latestResult);

  return (
    <div className="ticket-play-area">
      <section className="ticket-hero" aria-labelledby="event-ticket-title">
        <div className="ticket-hero__copy">
          <span className="ticket-hero__badge" aria-hidden="true">
            <Ticket size={24} />
          </span>
          <div>
            <span className="ticket-hero__eyebrow">{t("eventPass")}</span>
            <h2 id="event-ticket-title">{t("title")}</h2>
            <p>{t("docSubtitle")}</p>
          </div>
        </div>
        <div className="ticket-hero__stats">
          <div>
            <span>{t("sidebarEvents")}</span>
            <strong>{eventsCount}</strong>
          </div>
          <div>
            <span>{t("sidebarTickets")}</span>
            <strong>{ticketsCount}</strong>
          </div>
          <div>
            <span>{t("sidebarActive")}</span>
            <strong>{activeEventsCount}</strong>
          </div>
        </div>
      </section>

      <section className="ticket-flow" aria-label={t("workflow")}>
        <div><CalendarDays size={18} aria-hidden="true" /><span>{t("flowCreate")}</span></div>
        <div><UserPlus size={18} aria-hidden="true" /><span>{t("flowIssue")}</span></div>
        <div><ScanLine size={18} aria-hidden="true" /><span>{t("flowCheckin")}</span></div>
      </section>

      <section className="ticket-status" aria-label={t("serviceStatus")}>
        <div>
          <span>{t("wallet")}</span>
          <strong>{address ? short(address) : t("walletNotConnected")}</strong>
        </div>
        <div>
          <span>{t("serviceStatus")}</span>
          <strong>{isLoading ? t("lookingUp") : workflowStatus}</strong>
        </div>
        <NeoButton variant="secondary" onClick={() => dispatch("connectWallet")}>
          <CheckCircle2 size={17} aria-hidden="true" />
          <span>{address ? t("refresh") : t("connectWallet")}</span>
        </NeoButton>
      </section>

      {lastError ? <div className="ticket-alert" role="alert">{lastError}</div> : null}

      <section className="ticket-workspace">
        <form
          className="ticket-panel ticket-panel--create"
          aria-label={t("createEvent")}
          onSubmit={(event) => {
            event.preventDefault();
            void dispatch("createEvent");
          }}
        >
          <div className="ticket-panel__head">
            <div>
              <span>{t("createTab")}</span>
              <strong>{t("createEvent")}</strong>
            </div>
            <CalendarDays size={20} aria-hidden="true" />
          </div>
          <NeoInput
            value={eventName}
            label={t("eventName")}
            placeholder={t("eventNamePlaceholder")}
            onChange={(value) => state.eventName?.set(value)}
          />
          <NeoInput
            value={eventVenue}
            label={t("eventVenue")}
            placeholder={t("eventVenuePlaceholder")}
            onChange={(value) => state.eventVenue?.set(value)}
          />
          <div className="ticket-form-grid">
            <NeoInput
              value={eventStart}
              label={t("eventStart")}
              placeholder={t("eventStartPlaceholder")}
              onChange={(value) => state.eventStart?.set(value)}
            />
            <NeoInput
              value={eventEnd}
              label={t("eventEnd")}
              placeholder={t("eventEndPlaceholder")}
              onChange={(value) => state.eventEnd?.set(value)}
            />
          </div>
          <NeoInput
            value={maxSupply}
            type="number"
            label={t("maxSupply")}
            placeholder={t("maxSupplyPlaceholder")}
            min={1}
            onChange={(value) => state.maxSupply?.set(value)}
          />
          <NeoInput
            value={notes}
            type="textarea"
            label={t("notes")}
            placeholder={t("notesPlaceholder")}
            onChange={(value) => state.notes?.set(value)}
          />
          <NeoButton variant="primary" loading={isCreating} onClick={() => dispatch("createEvent")}>
            <CheckCircle2 size={17} aria-hidden="true" />
            <span>{t("createEvent")}</span>
          </NeoButton>
        </form>

        <section className="ticket-panel ticket-panel--events" aria-label={t("yourEvents")}>
          <div className="ticket-panel__head ticket-panel__head--row">
            <div>
              <span>{t("yourEvents")}</span>
              <strong>{events.length ? t("eventSelected") : t("emptyEvents")}</strong>
            </div>
            <NeoButton variant="ghost" size="sm" loading={isRefreshing} onClick={() => dispatch("refreshEvents")}>
              <RefreshCw size={15} aria-hidden="true" />
              <span>{t("refresh")}</span>
            </NeoButton>
          </div>
          {events.length ? (
            <div className="ticket-event-list">
              {events.map((event) => {
                const active = event.id === selectedEventId;
                const soldOut = event.minted >= event.maxSupply;
                return (
                  <article key={event.id} className={`ticket-event${active ? " is-selected" : ""}`}>
                    <button
                      type="button"
                      className="ticket-event__main"
                      onClick={() => dispatch("selectEvent", event.id)}
                    >
                      <span>{event.name || event.id}</span>
                      <strong>{event.venue || t("venueFallback")}</strong>
                    </button>
                    <div className="ticket-event__meta">
                      <span>{formatDate(event.startTime, t("dateUnknown"))}</span>
                      <span>{event.minted.toString()} / {event.maxSupply.toString()} {t("minted")}</span>
                      <span className={event.active ? "is-live" : "is-muted"}>
                        {event.active ? t("statusActive") : t("statusInactive")}
                      </span>
                    </div>
                    <div className="ticket-event__actions">
                      <NeoButton variant="secondary" size="sm" disabled={soldOut} onClick={() => dispatch("openIssueModal", event)}>
                        <UserPlus size={15} aria-hidden="true" />
                        <span>{t("issueTicket")}</span>
                      </NeoButton>
                      <NeoButton
                        variant="ghost"
                        size="sm"
                        loading={togglingId === event.id}
                        onClick={() => dispatch("toggleEvent", event)}
                      >
                        <span>{event.active ? t("deactivate") : t("activate")}</span>
                      </NeoButton>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="ticket-empty">
              {t("emptyEventsHint")}
            </div>
          )}
        </section>
      </section>

      <section className="ticket-workspace ticket-workspace--lower">
        <form
          className="ticket-panel ticket-panel--issue"
          aria-label={t("issueTicketTitle")}
          onSubmit={(event) => {
            event.preventDefault();
            void dispatch("issueTicket");
          }}
        >
          <div className="ticket-panel__head">
            <div>
              <span>{t("issueTicketTitle")}</span>
              <strong>{selectedEvent?.name || t("selectEventFirst")}</strong>
            </div>
            <UserPlus size={20} aria-hidden="true" />
          </div>
          <NeoSelect
            value={selectedEventId}
            label={t("eventName")}
            placeholder={t("selectEventFirst")}
            options={events.map((event) => ({ value: event.id, label: event.name || event.id }))}
            onChange={(value) => dispatch("selectEvent", value)}
          />
          <NeoInput
            value={issueRecipient}
            label={t("issueRecipient")}
            placeholder={t("issueRecipientPlaceholder")}
            onChange={(value) => state.issueRecipient?.set(value)}
          />
          <div className="ticket-form-grid">
            <NeoInput
              value={issueSeat}
              label={t("issueSeat")}
              placeholder={t("issueSeatPlaceholder")}
              onChange={(value) => state.issueSeat?.set(value)}
            />
            <NeoInput
              value={issueMemo}
              label={t("issueMemo")}
              placeholder={t("issueMemoPlaceholder")}
              onChange={(value) => state.issueMemo?.set(value)}
            />
          </div>
          <NeoButton variant="primary" loading={isIssuing} disabled={!canIssueTicket} onClick={() => dispatch("issueTicket")}>
            <Ticket size={17} aria-hidden="true" />
            <span>{t("issue")}</span>
          </NeoButton>
        </form>

        <form
          className="ticket-panel ticket-panel--checkin"
          aria-label={t("checkinTab")}
          onSubmit={(event) => {
            event.preventDefault();
            void dispatch("lookupTicket");
          }}
        >
          <div className="ticket-panel__head">
            <div>
              <span>{t("checkinTab")}</span>
              <strong>{lookup ? t("ticketFound") : t("lookup")}</strong>
            </div>
            <ClipboardCheck size={20} aria-hidden="true" />
          </div>
          <NeoInput
            value={checkinTokenId}
            label={t("checkinTokenId")}
            placeholder={t("checkinTokenIdPlaceholder")}
            onChange={(value) => state.checkinTokenId?.set(value)}
          />
          {lookup ? (
            <div className="ticket-lookup">
              <div><span>{t("ticketTokenId")}</span><strong>{short(lookup.tokenId)}</strong></div>
              <div><span>{t("eventName")}</span><strong>{lookup.eventName || lookup.eventId}</strong></div>
              <div><span>{t("ticketSeat")}</span><strong>{lookup.seat || t("seatFallback")}</strong></div>
              <div><span>{t("ticketOwner")}</span><strong>{short(lookup.owner)}</strong></div>
              <span className={`ticket-badge ${lookup.used ? "used" : "valid"}`}>
                {lookup.used ? t("ticketUsed") : t("ticketValid")}
              </span>
            </div>
          ) : (
            <div className="ticket-empty ticket-empty--compact">
              <QrCode size={28} aria-hidden="true" />
              <span>{t("checkinHint")}</span>
            </div>
          )}
          <div className="ticket-actions">
            <NeoButton variant="secondary" loading={isLookingUp} disabled={!canCheckInTicket} onClick={() => dispatch("lookupTicket")}>
              <ScanLine size={17} aria-hidden="true" />
              <span>{t("lookup")}</span>
            </NeoButton>
            <NeoButton variant="primary" loading={isCheckingIn} disabled={!lookup || lookup.used} onClick={() => dispatch("checkInTicket")}>
              <CheckCircle2 size={17} aria-hidden="true" />
              <span>{t("checkIn")}</span>
            </NeoButton>
          </div>
        </form>
      </section>

      <section className="ticket-panel ticket-panel--tickets" aria-label={t("ticketsTab")}>
        <div className="ticket-panel__head ticket-panel__head--row">
          <div>
            <span>{t("ticketsTab")}</span>
            <strong>{tickets.length ? t("ticketsLoaded") : t("emptyTickets")}</strong>
          </div>
          <NeoButton variant="ghost" size="sm" loading={isRefreshingTickets} onClick={() => dispatch("refreshTickets")}>
            <RefreshCw size={15} aria-hidden="true" />
            <span>{t("refresh")}</span>
          </NeoButton>
        </div>
        {tickets.length ? (
          <div className="ticket-grid">
            {tickets.map((ticket) => (
              <article key={ticket.tokenId} className="ticket-pass">
                <div>
                  <span>{ticket.eventName || ticket.eventId}</span>
                  <strong>{ticket.seat || t("seatFallback")}</strong>
                </div>
                <span className={`ticket-badge ${ticket.used ? "used" : "valid"}`}>
                  {ticket.used ? t("ticketUsed") : t("ticketValid")}
                </span>
                <code>{ticket.tokenId}</code>
              </article>
            ))}
          </div>
        ) : (
          <div className="ticket-empty">{t("emptyTicketsHint")}</div>
        )}
      </section>

      <section className="ticket-evidence" aria-label={t("evidence")}>
        <div className="ticket-panel">
          <div className="ticket-panel__head">
            <span>{t("latestRequest")}</span>
            <strong>{requestJson ? t("latestResult") : t("payloadEmpty")}</strong>
          </div>
          {requestJson ? <pre>{requestJson}</pre> : <div className="ticket-empty ticket-empty--compact">{t("requestEmpty")}</div>}
        </div>
        <div className="ticket-panel">
          <div className="ticket-panel__head">
            <span>{t("latestResult")}</span>
            <strong>{resultJson ? t("serviceStatus") : t("payloadEmpty")}</strong>
          </div>
          {resultJson ? <pre>{resultJson}</pre> : <div className="ticket-empty ticket-empty--compact">{t("resultEmpty")}</div>}
        </div>
      </section>
    </div>
  );
}
