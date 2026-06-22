import { useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  Copy,
  MapPin,
  QrCode,
  RefreshCw,
  ScanLine,
  Send,
  Sparkles,
  Ticket,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { NeoButton, NeoInput } from "@shared/components-react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import TokenQr from "./components/TokenQr";
import { explorerTxUrl } from "./utils/explorer";
import type { EventItem, TicketItem } from "./types";
import "./PlayArea.scss";

interface PlayAreaProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Observable>;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
}

function short(value: string) {
  if (!value) return "—";
  if (value.length <= 18) return value;
  return `${value.slice(0, 8)}…${value.slice(-8)}`;
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
  const [deskTab, setDeskTab] = useState<"issue" | "checkin">("issue");

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
  const transferTokenId = str("transferTokenId");
  const transferRecipient = str("transferRecipient");
  const workflowStatus = str("workflowStatus", t("ready"));
  const lastError = str("lastError");
  const isLoading = bool("isLoading");
  const isRefreshing = bool("isRefreshing");
  const isRefreshingTickets = bool("isRefreshingTickets");
  const isCreating = bool("isCreating");
  const isIssuing = bool("isIssuing");
  const isLookingUp = bool("isLookingUp");
  const isCheckingIn = bool("isCheckingIn");
  const isTransferring = bool("isTransferring");
  const transferringTokenId = str("transferringTokenId");
  const canIssueTicket = bool("canIssueTicket");
  const canCheckInTicket = bool("canCheckInTicket");
  const canTransferTicket = bool("canTransferTicket");
  const togglingId = str("togglingId");
  const requestJson = json(latestRequest);
  const resultJson = json(latestResult);
  const resultTxid = String(
    (latestResult as { txid?: unknown } | undefined)?.txid ?? "",
  ).trim();
  const eventSchedulePreview =
    eventStart && eventEnd
      ? `${eventStart} - ${eventEnd}`
      : eventStart || eventEnd || t("eventStartPlaceholder");
  const ticketSupplyPreview = maxSupply || t("maxSupplyPlaceholder");
  const issuePassTitle = selectedEvent?.name || eventName || t("eventNamePlaceholder");
  const issuePassSeat = issueSeat || t("seatFallback");
  const issuePassHolder = issueRecipient ? short(issueRecipient) : t("issueRecipientPlaceholder");

  const hasMetrics =
    eventsCount > 0 || ticketsCount > 0 || activeEventsCount > 0;
  const hasEvidence = Boolean(requestJson || resultJson);

  return (
    <div className="ticket-play-area">
      <section className="ticket-hero" aria-labelledby="event-ticket-title">
        <img
          className="ticket-hero__image"
          src="./event-pass-stage.jpg"
          alt=""
          loading="eager"
          decoding="async"
        />
        <div className="ticket-hero__shade" aria-hidden="true" />
        <div className="ticket-hero__copy">
          <span className="ticket-hero__badge" aria-hidden="true">
            <Ticket size={24} />
          </span>
          <div>
            <span className="ticket-hero__eyebrow">{t("heroTagline")}</span>
            <h2 id="event-ticket-title">{t("title")}</h2>
            <p>{t("docSubtitle")}</p>
            <div className="ticket-hero__flow" aria-label={t("workflow")}>
              <span>
                <CalendarDays size={14} aria-hidden="true" />
                {t("flowCreate")}
              </span>
              <span>
                <UserPlus size={14} aria-hidden="true" />
                {t("flowIssue")}
              </span>
              <span>
                <ScanLine size={14} aria-hidden="true" />
                {t("flowCheckin")}
              </span>
            </div>
          </div>
        </div>
        <div className="ticket-hero__side">
          <div className="ticket-hero__mini-pass" aria-label={t("eventPass")}>
            <div className="ticket-hero__mini-art" aria-hidden="true" />
            <div>
              <span>{t("eventPass")}</span>
              <strong>
                {selectedEvent?.name || eventName || t("eventNamePlaceholder")}
              </strong>
              <small>
                {selectedEvent?.venue ||
                  eventVenue ||
                  t("eventVenuePlaceholder")}
              </small>
            </div>
          </div>
          <div className="ticket-hero__wallet">
            <span>{t("wallet")}</span>
            <strong>
              {address ? short(address) : t("walletNotConnected")}
            </strong>
            <small>{isLoading ? t("lookingUp") : workflowStatus}</small>
          </div>
          <NeoButton
            variant="secondary"
            onClick={() => dispatch("connectWallet")}
          >
            <CheckCircle2 size={17} aria-hidden="true" />
            <span>{address ? t("refresh") : t("connectWallet")}</span>
          </NeoButton>
        </div>
      </section>

      {hasMetrics ? (
        <section className="ticket-metrics" aria-label={t("serviceStatus")}>
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
        </section>
      ) : null}

      {lastError ? (
        <div className="ticket-alert" role="alert">
          {lastError}
        </div>
      ) : null}

      <section className="ticket-studio" aria-label={t("studioTitle")}>
        <div className="ticket-studio__head">
          <div>
            <span>{t("studioEyebrow")}</span>
            <strong>{t("studioTitle")}</strong>
            <p>{t("studioSubtitle")}</p>
          </div>
          <div className="ticket-studio__steps" aria-label={t("workflow")}>
            <span>
              <CalendarDays size={14} aria-hidden="true" />
              {t("studioStepCreate")}
            </span>
            <span>
              <UserPlus size={14} aria-hidden="true" />
              {t("studioStepIssue")}
            </span>
            <span>
              <ScanLine size={14} aria-hidden="true" />
              {t("studioStepCheckin")}
            </span>
          </div>
        </div>

        <div
          className={`ticket-studio__grid${
            events.length ? " ticket-studio__grid--has-events" : ""
          }`}
        >
          <form
            className="ticket-stage"
            aria-label={t("createEvent")}
            onSubmit={(event) => {
              event.preventDefault();
              void dispatch("createEvent");
            }}
          >
            <section
              className="ticket-create-preview ticket-create-preview--stage"
              aria-label={t("eventPass")}
            >
              <div className="ticket-create-preview__art" aria-hidden="true" />
              <div className="ticket-create-preview__body">
                <span>
                  <Sparkles size={14} aria-hidden="true" />
                  {t("eventPass")}
                </span>
                <strong>{eventName || t("eventNamePlaceholder")}</strong>
                <p>{eventVenue || t("eventVenuePlaceholder")}</p>
                <div className="ticket-create-preview__meta">
                  <div>
                    <CalendarDays size={14} aria-hidden="true" />
                    <span>{eventSchedulePreview}</span>
                  </div>
                  <div>
                    <Ticket size={14} aria-hidden="true" />
                    <span>
                      {ticketSupplyPreview} {t("sidebarTickets")}
                    </span>
                  </div>
                </div>
              </div>
            </section>

            <div className="ticket-stage__controls">
              <div className="ticket-panel__head">
                <div>
                  <span>{t("createTab")}</span>
                  <strong>{t("createEvent")}</strong>
                </div>
                <CalendarDays size={20} aria-hidden="true" />
              </div>

              <div
                className="ticket-create-fields ticket-create-fields--identity"
                aria-label={t("eventIdentity")}
              >
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
              </div>

              <div
                className="ticket-create-fields ticket-create-fields--schedule"
                aria-label={t("eventDetails")}
              >
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
                <NeoInput
                  value={maxSupply}
                  type="number"
                  label={t("maxSupply")}
                  placeholder={t("maxSupplyPlaceholder")}
                  min={1}
                  onChange={(value) => state.maxSupply?.set(value)}
                />
              </div>

              <details className="ticket-create-advanced">
                <summary>
                  <span>
                    <ClipboardCheck size={15} aria-hidden="true" />
                    {t("notes")}
                  </span>
                  <small>{t("notesPlaceholder")}</small>
                  <ChevronDown size={16} aria-hidden="true" />
                </summary>
                <NeoInput
                  value={notes}
                  type="textarea"
                  label={t("notes")}
                  placeholder={t("notesPlaceholder")}
                  onChange={(value) => state.notes?.set(value)}
                />
              </details>

              <NeoButton
                variant="primary"
                loading={isCreating}
                onClick={() => dispatch("createEvent")}
              >
                <CheckCircle2 size={17} aria-hidden="true" />
                <span>{t("createEvent")}</span>
              </NeoButton>
            </div>
          </form>

          <section className="ticket-gate" aria-label={t("gateDesk")}>
            <div className="ticket-gate__head">
              <div>
                <span>{t("gateDesk")}</span>
                <strong>
                  {events.length
                    ? selectedEvent?.name ||
                      t("eventsCountLabel", { count: events.length })
                    : t("emptyEvents")}
                </strong>
                <p>{t("gateDeskSubtitle")}</p>
              </div>
              <NeoButton
                variant="ghost"
                size="sm"
                loading={isRefreshing}
                onClick={() => dispatch("refreshEvents")}
              >
                <RefreshCw size={15} aria-hidden="true" />
                <span>{t("refresh")}</span>
              </NeoButton>
            </div>

            {events.length ? (
              <div className="ticket-event-list ticket-event-list--rail">
                {events.map((event) => {
                  const active = event.id === selectedEventId;
                  const soldOut = event.minted >= event.maxSupply;
                  return (
                    <article
                      key={event.id}
                      className={`ticket-event${active ? " is-selected" : ""}`}
                    >
                      <button
                        type="button"
                        className="ticket-event__main"
                        onClick={() => dispatch("selectEvent", event.id)}
                      >
                        <span>{event.name || event.id}</span>
                        <strong>
                          <MapPin size={14} aria-hidden="true" />
                          {event.venue || t("venueFallback")}
                        </strong>
                      </button>
                      <div className="ticket-event__meta">
                        <span>
                          <CalendarDays size={13} aria-hidden="true" />
                          {formatDate(event.startTime, t("dateUnknown"))}
                        </span>
                        <span>
                          <Users size={13} aria-hidden="true" />
                          {event.minted.toString()} /{" "}
                          {event.maxSupply.toString()} {t("minted")}
                        </span>
                        <span className={event.active ? "is-live" : "is-muted"}>
                          {event.active
                            ? t("statusActive")
                            : t("statusInactive")}
                        </span>
                      </div>
                      <div className="ticket-event__actions">
                        <NeoButton
                          variant="secondary"
                          size="sm"
                          disabled={soldOut}
                          onClick={() => dispatch("openIssueModal", event)}
                        >
                          <UserPlus size={15} aria-hidden="true" />
                          <span>{t("issueTicket")}</span>
                        </NeoButton>
                        <NeoButton
                          variant="ghost"
                          size="sm"
                          loading={togglingId === event.id}
                          onClick={() => dispatch("toggleEvent", event)}
                        >
                          <span>
                            {event.active ? t("deactivate") : t("activate")}
                          </span>
                        </NeoButton>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="ticket-empty ticket-empty--gate">
                <CalendarDays size={28} aria-hidden="true" />
                <span>{t("emptyEventsHint")}</span>
              </div>
            )}

            <div className="ticket-tabs" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={deskTab === "issue"}
                className={`ticket-tab${deskTab === "issue" ? " is-active" : ""}`}
                onClick={() => setDeskTab("issue")}
              >
                <UserPlus size={16} aria-hidden="true" />
                <span>{t("issueTicketTitle")}</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={deskTab === "checkin"}
                className={`ticket-tab${deskTab === "checkin" ? " is-active" : ""}`}
                onClick={() => setDeskTab("checkin")}
              >
                <ClipboardCheck size={16} aria-hidden="true" />
                <span>{t("checkinTab")}</span>
              </button>
            </div>

            {deskTab === "issue" ? (
              <form
                className="ticket-desk__panel ticket-desk__panel--issue"
                aria-label={t("issueTicketTitle")}
                onSubmit={(event) => {
                  event.preventDefault();
                  void dispatch("issueTicket");
                }}
              >
                {events.length ? (
                  <>
                    <section
                      className={`ticket-issue-runway${canIssueTicket ? " is-ready" : ""}${isIssuing ? " is-issuing" : ""}`}
                      aria-label={t("issuePreview")}
                    >
                      <span className="ticket-issue-runway__rail" aria-hidden="true" />
                      <span className="ticket-issue-runway__ticket" aria-hidden="true" />
                      <div className="ticket-issue-runway__node ticket-issue-runway__node--event">
                        <span className="ticket-issue-runway__art" aria-hidden="true" />
                        <small>{t("eventPass")}</small>
                        <strong>{issuePassTitle}</strong>
                      </div>
                      <div className="ticket-issue-runway__node ticket-issue-runway__node--mint">
                        <Ticket size={18} aria-hidden="true" />
                        <small>{t("issuePreview")}</small>
                        <strong>{issuePassSeat}</strong>
                      </div>
                      <div className="ticket-issue-runway__node ticket-issue-runway__node--holder">
                        <Users size={18} aria-hidden="true" />
                        <small>{t("ticketOwner")}</small>
                        <strong>{issuePassHolder}</strong>
                      </div>
                      <div className="ticket-issue-runway__caption">
                        <Sparkles size={14} aria-hidden="true" />
                        <div>
                          <span>{canIssueTicket ? t("issueTicketTitle") : t("selectEventFirst")}</span>
                          <strong>{issuePassSeat} · {issuePassHolder}</strong>
                        </div>
                      </div>
                    </section>
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
                    <NeoButton
                      variant="primary"
                      loading={isIssuing}
                      disabled={!canIssueTicket}
                      onClick={() => dispatch("issueTicket")}
                    >
                      <Ticket size={17} aria-hidden="true" />
                      <span>{t("issue")}</span>
                    </NeoButton>
                    <p className="ticket-free-note">{t("freePassesNote")}</p>
                  </>
                ) : (
                  <div className="ticket-empty ticket-empty--compact">
                    <CalendarDays size={28} aria-hidden="true" />
                    <span>{t("selectEventFirst")}</span>
                  </div>
                )}
              </form>
            ) : (
              <form
                className="ticket-desk__panel ticket-desk__panel--scan"
                aria-label={t("checkinTab")}
                onSubmit={(event) => {
                  event.preventDefault();
                  void dispatch("lookupTicket");
                }}
              >
                <div className="ticket-scan-frame">
                  <QrCode size={34} aria-hidden="true" />
                  <span>{t("doorScanner")}</span>
                  <strong>{checkinTokenId || t("checkinTokenIdPlaceholder")}</strong>
                </div>
                <NeoInput
                  value={checkinTokenId}
                  label={t("checkinTokenId")}
                  placeholder={t("checkinTokenIdPlaceholder")}
                  onChange={(value) => {
                    state.checkinTokenId?.set(value);
                    // Clear any prior lookup so the check-in button reflects the
                    // current token id and can't act on a stale ticket.
                    if (lookup) state.lookup?.set(null);
                  }}
                />
                {lookup ? (
                  <div className="ticket-lookup">
                    <div>
                      <span>{t("ticketTokenId")}</span>
                      <strong>{short(lookup.tokenId)}</strong>
                    </div>
                    <div>
                      <span>{t("eventName")}</span>
                      <strong>{lookup.eventName || lookup.eventId}</strong>
                    </div>
                    <div>
                      <span>{t("ticketSeat")}</span>
                      <strong>{lookup.seat || t("seatFallback")}</strong>
                    </div>
                    <div>
                      <span>{t("ticketOwner")}</span>
                      <strong>{short(lookup.owner)}</strong>
                    </div>
                    <span
                      className={`ticket-badge ${lookup.used ? "used" : "valid"}`}
                    >
                      {lookup.used ? t("ticketUsed") : t("ticketValid")}
                    </span>
                  </div>
                ) : (
                  <div className="ticket-empty ticket-empty--compact">
                    <ScanLine size={28} aria-hidden="true" />
                    <span>{t("checkinHint")}</span>
                  </div>
                )}
                <div className="ticket-actions">
                  <NeoButton
                    variant="secondary"
                    loading={isLookingUp}
                    disabled={!canCheckInTicket}
                    onClick={() => dispatch("lookupTicket")}
                  >
                    <ScanLine size={17} aria-hidden="true" />
                    <span>{t("lookup")}</span>
                  </NeoButton>
                  <NeoButton
                    variant="primary"
                    loading={isCheckingIn}
                    disabled={!lookup || lookup.used}
                    onClick={() => dispatch("checkInTicket")}
                  >
                    <CheckCircle2 size={17} aria-hidden="true" />
                    <span>{t("checkIn")}</span>
                  </NeoButton>
                </div>
              </form>
            )}
          </section>
        </div>
      </section>

      <section
        className="ticket-panel ticket-panel--tickets"
        aria-label={t("ticketsTab")}
      >
        <div className="ticket-panel__head ticket-panel__head--row">
          <div>
            <span>{t("ticketsTab")}</span>
            <strong>
              {tickets.length ? t("ticketsLoaded") : t("emptyTickets")}
            </strong>
          </div>
          <NeoButton
            variant="ghost"
            size="sm"
            loading={isRefreshingTickets}
            onClick={() => dispatch("refreshTickets")}
          >
            <RefreshCw size={15} aria-hidden="true" />
            <span>{t("refresh")}</span>
          </NeoButton>
        </div>
        {tickets.length ? (
          <div className="ticket-grid">
            {tickets.map((ticket) => {
              const isTransferTarget = transferTokenId === ticket.tokenId;
              const isThisTransferring = transferringTokenId === ticket.tokenId;
              return (
                <article
                  key={ticket.tokenId}
                  className={`ticket-pass${ticket.used ? " ticket-pass--used" : ""}`}
                >
                  <div className="ticket-pass__art" aria-hidden="true" />
                  <div className="ticket-pass__stub">
                    <Ticket size={18} aria-hidden="true" />
                    <span>{t("sampleAdmitOne")}</span>
                  </div>
                  <div className="ticket-pass__body">
                    <div className="ticket-pass__head">
                      <div>
                        <span>{ticket.eventName || ticket.eventId}</span>
                        <strong>{ticket.seat || t("seatFallback")}</strong>
                      </div>
                      <span
                        className={`ticket-badge ${ticket.used ? "used" : "valid"}`}
                      >
                        {ticket.used ? t("ticketUsed") : t("ticketValid")}
                      </span>
                    </div>

                    {/* Show the token-ID QR the door/check-in flow expects, so an
                        attendee can present it instead of reading the id aloud. */}
                    <div className="ticket-pass__qr">
                      <TokenQr
                        value={ticket.tokenId}
                        label={t("ticketQrLabel")}
                      />
                    </div>

                    <div className="ticket-pass__id">
                      <code>{ticket.tokenId}</code>
                      <button
                        type="button"
                        className="ticket-icon-button"
                        aria-label={t("copyTokenId")}
                        title={t("copyTokenId")}
                        onClick={() => dispatch("copyTokenId", ticket.tokenId)}
                      >
                        <Copy size={14} aria-hidden="true" />
                      </button>
                    </div>

                    {!ticket.used && (
                      <div className="ticket-pass__transfer">
                        {isTransferTarget ? (
                          <form
                            className="ticket-transfer-form"
                            onSubmit={(event) => {
                              event.preventDefault();
                              void dispatch("transferTicket", {
                                tokenId: ticket.tokenId,
                                recipient: transferRecipient,
                              });
                            }}
                          >
                            <NeoInput
                              value={transferRecipient}
                              label={t("transferRecipient")}
                              placeholder={t("transferRecipientPlaceholder")}
                              onChange={(value) =>
                                state.transferRecipient?.set(value)
                              }
                            />
                            <div className="ticket-transfer-form__actions">
                              <NeoButton
                                variant="primary"
                                size="sm"
                                loading={isThisTransferring}
                                disabled={!canTransferTicket || isTransferring}
                                onClick={() =>
                                  dispatch("transferTicket", {
                                    tokenId: ticket.tokenId,
                                    recipient: transferRecipient,
                                  })
                                }
                              >
                                <Send size={14} aria-hidden="true" />
                                <span>{t("transferTicket")}</span>
                              </NeoButton>
                              <NeoButton
                                variant="ghost"
                                size="sm"
                                disabled={isThisTransferring}
                                onClick={() => state.transferTokenId?.set("")}
                              >
                                <X size={14} aria-hidden="true" />
                                <span>{t("cancel")}</span>
                              </NeoButton>
                            </div>
                          </form>
                        ) : (
                          <NeoButton
                            variant="secondary"
                            size="sm"
                            disabled={isTransferring}
                            onClick={() => dispatch("startTransfer", ticket)}
                          >
                            <Send size={14} aria-hidden="true" />
                            <span>{t("transferTicket")}</span>
                          </NeoButton>
                        )}
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="ticket-empty-state">
            <div
              className="ticket-sample"
              aria-label={t("samplePreviewHeading")}
            >
              <span className="ticket-sample__flag">
                {t("samplePreviewLabel")}
              </span>
              <article
                className="ticket-pass ticket-pass--sample"
                aria-hidden="true"
              >
                <div className="ticket-pass__art" aria-hidden="true" />
                <div className="ticket-pass__stub">
                  <Ticket size={18} aria-hidden="true" />
                  <span>{t("sampleAdmitOne")}</span>
                </div>
                <div className="ticket-pass__body">
                  <div className="ticket-pass__head">
                    <div>
                      <span>{t("sampleVenue")}</span>
                      <strong>{t("sampleEventName")}</strong>
                    </div>
                    <span className="ticket-badge valid">
                      {t("ticketValid")}
                    </span>
                  </div>
                  <div className="ticket-pass__sample-rows">
                    <div>
                      <span>{t("ticketSeat")}</span>
                      <strong>{t("sampleSeat")}</strong>
                    </div>
                    <div>
                      <span>{t("sampleHolder")}</span>
                      <strong>{t("sampleHolderName")}</strong>
                    </div>
                  </div>
                  <div className="ticket-pass__sample-foot">
                    <TokenQr
                      value="sample-pass-1042"
                      label={t("ticketQrLabel")}
                    />
                    <code>1-1042</code>
                  </div>
                </div>
              </article>
            </div>
            <div className="ticket-empty-state__copy">
              <strong>{t("samplePreviewHeading")}</strong>
              <p>{t("samplePreviewCaption")}</p>
            </div>
          </div>
        )}
      </section>

      <section className="ticket-evidence" aria-label={t("evidence")}>
        <details className="ticket-evidence__details" open={hasEvidence}>
          <summary>
            <span>{t("evidence")}</span>
            <ChevronDown size={16} aria-hidden="true" />
          </summary>
          <div className="ticket-evidence__grid">
            <div className="ticket-evidence__col">
              <div className="ticket-evidence__head">
                <span>{t("latestRequest")}</span>
                <strong>
                  {requestJson ? t("latestResult") : t("payloadEmpty")}
                </strong>
              </div>
              {requestJson ? (
                <pre>{requestJson}</pre>
              ) : (
                <div className="ticket-empty ticket-empty--line">
                  {t("requestEmpty")}
                </div>
              )}
            </div>
            <div className="ticket-evidence__col">
              <div className="ticket-evidence__head">
                <span>{t("latestResult")}</span>
                <strong>
                  {resultJson ? t("serviceStatus") : t("payloadEmpty")}
                </strong>
              </div>
              {resultTxid ? (
                <a
                  className="ticket-evidence__txlink"
                  href={explorerTxUrl(resultTxid)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t("viewOnExplorer")}
                </a>
              ) : null}
              {resultJson ? (
                <pre>{resultJson}</pre>
              ) : (
                <div className="ticket-empty ticket-empty--line">
                  {t("resultEmpty")}
                </div>
              )}
            </div>
          </div>
        </details>
      </section>
    </div>
  );
}
