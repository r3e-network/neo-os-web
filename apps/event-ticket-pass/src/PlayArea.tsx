/**
 * PlayArea.tsx -- Event Ticket Pass
 *
 * The pass is the product: organizers design a keepsake ticket, issue it to a
 * guest wallet, then run the same pass through the door scanner. Secondary
 * event setup, transfer, evidence, and lists stay in the drawer.
 */
import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  DoorOpen,
  IdCard,
  MapPin,
  QrCode,
  RefreshCw,
  Send,
  Ticket,
  UserPlus,
  WalletCards,
  Wand2,
  type LucideIcon,
} from "lucide-react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import { OpenUiNotice, OpenUiPanel, OpenUiProvider, OpenUiSegmented, OpenUiTextArea, OpenUiTextField, PlayStage } from "@shared/components-react/v2";
import TokenQr from "./components/TokenQr";
import "./PlayArea.scss";

interface PlayAreaProps {
  t: (key: string, p?: Record<string, string | number>) => string;
  state: Record<string, Observable>;
  dispatch: (n: string, ...a: unknown[]) => Promise<void>;
}

interface EventItem {
  id: string;
  name?: string;
  venue?: string;
  startTime?: number;
  endTime?: number;
  maxSupply?: bigint | number | string;
  minted?: bigint | number | string;
  active?: boolean;
  [k: string]: unknown;
}

interface TicketItem {
  id?: string;
  tokenId?: string;
  eventName?: string;
  venue?: string;
  seat?: string;
  owner?: string;
  used?: boolean;
  checkedIn?: boolean;
  [k: string]: unknown;
}

type DeskMode = "create" | "issue" | "checkin";
type DrawerMode = "event" | "issue" | "tickets" | "events" | "transfer" | "evidence";

const PASS_ART = "pass-artwork.webp";
const SEAT_PRESETS = ["General", "VIP", "Row A", "Backstage"];

interface EventBlueprint {
  key: string;
  nameKey: string;
  venueKey: string;
  startKey: string;
  endKey: string;
  notesKey: string;
  supply: string;
  Icon: LucideIcon;
}

const EVENT_BLUEPRINTS: EventBlueprint[] = [
  {
    key: "summit",
    nameKey: "blueprintSummitName",
    venueKey: "blueprintSummitVenue",
    startKey: "blueprintSummitStart",
    endKey: "blueprintSummitEnd",
    notesKey: "blueprintSummitNotes",
    supply: "500",
    Icon: Ticket,
  },
  {
    key: "workshop",
    nameKey: "blueprintWorkshopName",
    venueKey: "blueprintWorkshopVenue",
    startKey: "blueprintWorkshopStart",
    endKey: "blueprintWorkshopEnd",
    notesKey: "blueprintWorkshopNotes",
    supply: "120",
    Icon: CalendarDays,
  },
  {
    key: "backstage",
    nameKey: "blueprintBackstageName",
    venueKey: "blueprintBackstageVenue",
    startKey: "blueprintBackstageStart",
    endKey: "blueprintBackstageEnd",
    notesKey: "blueprintBackstageNotes",
    supply: "80",
    Icon: DoorOpen,
  },
];

function displayCount(value: unknown, fallback = "0") {
  if (typeof value === "bigint") return value.toString();
  const text = String(value ?? "").trim();
  return text || fallback;
}

function formatEventDate(value: unknown, fallback: string) {
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0) return fallback;
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(seconds * 1000);
}

function compactAddress(value: string) {
  const text = value.trim();
  return text.length > 14 ? `${text.slice(0, 6)}...${text.slice(-5)}` : text;
}

function eventTitle(event: EventItem | null | undefined, fallback: string) {
  return String(event?.name ?? event?.id ?? fallback);
}

function ticketId(ticket: TicketItem | null | undefined) {
  return String(ticket?.tokenId ?? ticket?.id ?? "");
}

export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { str, bool, num, val } = useStateBindings(state);

  const eventsCount = num("eventsCount");
  const ticketsCount = num("ticketsCount");
  const activeEventsCount = num("activeEventsCount");
  const address = str("address");
  const selectedEventId = str("selectedEventId", "");
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
  const isCreating = bool("isCreating");
  const isIssuing = bool("isIssuing");
  const isCheckingIn = bool("isCheckingIn");
  const isLookingUp = bool("isLookingUp");
  const isTransferring = bool("isTransferring");
  const canIssueTicket = bool("canIssueTicket");
  const canCheckInTicket = bool("canCheckInTicket");
  const canTransferTicket = bool("canTransferTicket");
  const selectedEvent = val<EventItem | null>("selectedEvent");
  const lookupValue = val<TicketItem | null>("lookup");
  const latestRequest = val<Record<string, unknown> | null>("latestRequest");
  const latestResult = val<Record<string, unknown> | null>("latestResult");
  const eventsValue = val("events");
  const ticketsValue = val("tickets");
  const events = useMemo(() => (eventsValue ?? []) as EventItem[], [eventsValue]);
  const tickets = useMemo(() => (ticketsValue ?? []) as TicketItem[], [ticketsValue]);
  const lookupTicket = lookupValue && typeof lookupValue === "object" ? lookupValue : null;

  const [mode, setMode] = useState<DeskMode>(() => (events.length > 0 ? "issue" : "create"));
  const [drawerMode, setDrawerMode] = useState<DrawerMode>(() => (events.length > 0 ? "issue" : "event"));
  const [activeBlueprint, setActiveBlueprint] = useState("");
  const [customDetailsOpen, setCustomDetailsOpen] = useState(false);

  const selectedEventMatchesId = selectedEvent && (!selectedEventId || String(selectedEvent.id) === selectedEventId);
  const activeEvent = (selectedEventMatchesId ? selectedEvent : events.find((event) => String(event.id) === selectedEventId)) ?? events[0] ?? null;
  const activeTicket = tickets[0] ?? null;
  const checkinTicket = lookupTicket ?? tickets.find((ticket) => ticketId(ticket) === checkinTokenId) ?? null;
  const guestWallets = useMemo(() => {
    const seen = new Set<string>();
    const wallets: string[] = [];
    for (const ticket of tickets) {
      const owner = String(ticket.owner ?? "").trim();
      if (!owner || seen.has(owner)) continue;
      seen.add(owner);
      wallets.push(owner);
      if (wallets.length >= 4) break;
    }
    return wallets;
  }, [tickets]);
  const busy = isLoading || isCreating || isIssuing || isCheckingIn || isLookingUp || isTransferring;
  const passName = eventTitle(activeEvent, eventName || t("eventNamePlaceholder"));
  const passVenue = String(activeEvent?.venue ?? eventVenue ?? t("eventVenuePlaceholder"));
  const passDate = formatEventDate(activeEvent?.startTime, eventStart || t("eventStartPlaceholder"));
  const selectedToken = ticketId(activeTicket) || checkinTokenId || "1-001";
  const sceneState = isCheckingIn || isLookingUp ? "scanning" : isIssuing ? "issuing" : isCreating ? "publishing" : "idle";
  const hasLiveEvent = Boolean(activeEvent);
  const hasTransferContext = tickets.length > 0 || transferTokenId.trim().length > 0 || transferRecipient.trim().length > 0;
  const eventDraftPayload = {
    eventName: eventName.trim(),
    eventVenue: eventVenue.trim(),
    eventStart: eventStart.trim(),
    eventEnd: eventEnd.trim(),
    maxSupply: maxSupply.trim(),
    notes: notes.trim(),
  };
  const issuePayload = {
    eventId: String(activeEvent?.id ?? selectedEventId ?? "").trim(),
    recipient: issueRecipient.trim(),
    seat: issueSeat.trim(),
    memo: issueMemo.trim(),
  };
  const checkinPayload = {
    tokenId: checkinTokenId.trim(),
  };

  useEffect(() => {
    if (events.length === 0) return;
    if (!selectedEventId && events[0]?.id) {
      state.selectedEventId?.set(String(events[0].id));
      void dispatch("selectEvent", events[0].id);
    }
  }, [dispatch, events, selectedEventId, state.selectedEventId]);

  useEffect(() => {
    setDrawerMode(mode === "create" ? "event" : mode === "issue" ? "issue" : "tickets");
  }, [mode]);

  const selectEvent = (event: EventItem) => {
    state.selectedEventId?.set(String(event.id));
    void dispatch("selectEvent", event.id);
    if (mode === "create") setMode("issue");
  };

  const selectTicketForGate = (ticket: TicketItem) => {
    const id = ticketId(ticket);
    if (!id) return;
    state.checkinTokenId?.set(id);
    setMode("checkin");
  };

  const updateEventDraft = (
    key: "eventName" | "eventVenue" | "eventStart" | "eventEnd" | "maxSupply" | "notes",
    value: string,
  ) => {
    setActiveBlueprint("");
    state[key]?.set(value);
  };

  const applyEventBlueprint = (blueprint: EventBlueprint) => {
    setActiveBlueprint(blueprint.key);
    state.eventName?.set(t(blueprint.nameKey));
    state.eventVenue?.set(t(blueprint.venueKey));
    state.eventStart?.set(t(blueprint.startKey));
    state.eventEnd?.set(t(blueprint.endKey));
    state.maxSupply?.set(blueprint.supply);
    state.notes?.set(t(blueprint.notesKey));
    setCustomDetailsOpen(false);
  };

  const primaryAction = (() => {
    if (mode === "create") {
      return {
        label: isCreating ? t("creatingEvent") : t("createEvent"),
        onClick: () => void dispatch("createEvent", eventDraftPayload),
        disabled: isCreating || isLoading,
        loading: isCreating,
      };
    }
    if (mode === "checkin") {
      return {
        label: isCheckingIn ? t("checkingIn") : t("checkIn"),
        onClick: () => void dispatch("checkInTicket", checkinPayload),
        disabled: busy || !canCheckInTicket,
        loading: isCheckingIn,
      };
    }
    return {
      label: isIssuing ? t("issuing") : t("issueTicket"),
      onClick: () => void dispatch("issueTicket", issuePayload),
      disabled: busy || !canIssueTicket,
      loading: isIssuing,
    };
  })();

  const scene = (
    <div className="ticket-scene" data-state={sceneState}>
      <div className="ticket-scene__phone" aria-hidden="true">
        <QrCode size={34} />
        <span>{selectedToken}</span>
      </div>

      <article className="ticket-pass" aria-label={passName}>
        <img className="ticket-pass__texture" src={PASS_ART} alt="" aria-hidden="true" loading="eager" decoding="async" />
        <div className="ticket-pass__main">
          <span className="ticket-pass__eyebrow">{t("eventPass")}</span>
          <strong>{passName}</strong>
          <span><MapPin size={14} /> {passVenue}</span>
          <span><CalendarDays size={14} /> {passDate}</span>
        </div>
        <div className="ticket-pass__stub">
          <span>{t("sampleAdmitOne")}</span>
          <strong>{issueSeat || activeTicket?.seat || t("seatFallback")}</strong>
        </div>
        <span className="ticket-pass__scanline" aria-hidden="true" />
      </article>

      <div className="ticket-gate" aria-label={t("lifecycleTitle")}>
        <span className="ticket-gate__step ticket-gate__step--active"><Wand2 size={15} />{t("studioStepCreate")}</span>
        <span className={["ticket-gate__beam", isIssuing ? "ticket-gate__beam--active" : null].filter(Boolean).join(" ")} />
        <span className={["ticket-gate__step", mode !== "create" ? "ticket-gate__step--active" : null].filter(Boolean).join(" ")}><WalletCards size={15} />{t("studioStepIssue")}</span>
        <span className={["ticket-gate__beam", isCheckingIn || mode === "checkin" ? "ticket-gate__beam--active" : null].filter(Boolean).join(" ")} />
        <span className={["ticket-gate__step", mode === "checkin" ? "ticket-gate__step--active" : null].filter(Boolean).join(" ")}><DoorOpen size={15} />{t("studioStepCheckin")}</span>
      </div>

      <p className="ticket-scene__status" aria-live="polite">{workflowStatus}</p>
    </div>
  );

  const eventCards = (
    <div className="ticket-event-rail" aria-label={t("eventsCountLabel", { count: eventsCount })}>
      {events.slice(0, 6).map((event) => {
        const active = String(activeEvent?.id) === String(event.id);
        return (
          <button
            key={event.id}
            type="button"
            className={["ticket-event-card", active ? "ticket-event-card--active" : null].filter(Boolean).join(" ")}
            onClick={() => selectEvent(event)}
            disabled={busy}
            aria-pressed={active}
          >
            <span className="ticket-event-card__icon"><Ticket size={18} /></span>
            <span className="ticket-event-card__copy">
              <strong>{eventTitle(event, t("eventNamePlaceholder"))}</strong>
              <em>{String(event.venue ?? t("venueFallback"))}</em>
            </span>
            <span className={["ticket-event-card__status", event.active ? "ticket-event-card__status--live" : null].filter(Boolean).join(" ")}>
              {event.active ? t("statusActive") : t("statusInactive")}
            </span>
          </button>
        );
      })}
      {events.length === 0 && (
        <button type="button" className="ticket-event-card ticket-event-card--empty" onClick={() => setMode("create")}>
          <span className="ticket-event-card__icon"><Wand2 size={18} /></span>
          <span className="ticket-event-card__copy">
            <strong>{t("modeCreateTitle")}</strong>
            <em>{t("modeCreateHint")}</em>
          </span>
        </button>
      )}
    </div>
  );

  const modePanel = (
    <div className="ticket-desk">
      {lastError && <p className="ticket-desk__error" role="alert">{lastError}</p>}
      <OpenUiSegmented
        className="ticket-mode-switch"
        label={t("studioModeLabel")}
        onChange={(value) => setMode(value === "issue" ? "issue" : value === "checkin" ? "checkin" : "create")}
        options={([
          ["create", Wand2, t("studioStepCreate")],
          ["issue", UserPlus, t("studioStepIssue")],
          ["checkin", DoorOpen, t("studioStepCheckin")],
        ] as const).map(([id, Icon, label]) => ({
          value: id,
          label: (
            <span className="ticket-mode-label">
              <Icon size={16} />
              <span>{label}</span>
            </span>
          ),
        }))}
        segmentedClassName="ticket-mode-segmented"
        value={mode}
      />

      {mode === "create" && (
        <div className="ticket-work-card ticket-work-card--create">
          <div className="ticket-work-card__icon"><Wand2 size={19} /></div>
          <div className="ticket-work-card__copy">
            <strong>{t("modeCreateTitle")}</strong>
            <span>{t("modeCreateHint")}</span>
          </div>

          <div className="ticket-blueprint-picker">
            <span className="ticket-blueprint-picker__label">{t("eventBlueprintsLabel")}</span>
            <div className="ticket-blueprint-row" role="list" aria-label={t("eventBlueprintsLabel")}>
              {EVENT_BLUEPRINTS.map((blueprint) => {
                const Icon = blueprint.Icon;
                const active = activeBlueprint === blueprint.key;
                return (
                  <button
                    key={blueprint.key}
                    type="button"
                    className={["ticket-blueprint-card", active ? "ticket-blueprint-card--active" : null].filter(Boolean).join(" ")}
                    onClick={() => applyEventBlueprint(blueprint)}
                    disabled={busy}
                    aria-pressed={active}
                  >
                    <span className="ticket-blueprint-card__icon"><Icon size={18} strokeWidth={2.35} /></span>
                    <span className="ticket-blueprint-card__copy">
                      <strong>{t(blueprint.nameKey)}</strong>
                      <em>{t(blueprint.venueKey)}</em>
                      <small>{blueprint.supply} {t("ticketsCount").toLowerCase()}</small>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="ticket-pass-dossier">
            <div>
              <span>{t("eventIdentity")}</span>
              <strong>{eventName || t("eventNamePlaceholder")}</strong>
              <em>{eventVenue || t("eventVenuePlaceholder")}</em>
            </div>
            <button
              type="button"
              className="ticket-detail-toggle"
              onClick={() => setCustomDetailsOpen((value) => !value)}
              aria-expanded={customDetailsOpen}
              disabled={busy}
            >
              {t("eventDetails")}
            </button>
          </div>
          {customDetailsOpen && (
            <div className="ticket-quick-fields">
              <OpenUiTextField
                className="ticket-field"
                label={t("eventName")}
                value={eventName}
                onChange={(e) => updateEventDraft("eventName", e.target.value)}
                placeholder={t("eventNamePlaceholder")}
                disabled={busy}
              />
              <OpenUiTextField
                className="ticket-field"
                label={t("eventVenue")}
                value={eventVenue}
                onChange={(e) => updateEventDraft("eventVenue", e.target.value)}
                placeholder={t("eventVenuePlaceholder")}
                disabled={busy}
              />
            </div>
          )}
        </div>
      )}

      {mode === "issue" && (
        <div className="ticket-work-card ticket-work-card--issue">
          <div className="ticket-work-card__icon"><UserPlus size={19} /></div>
          <div className="ticket-work-card__copy">
            <strong>{t("issueTicketTitle")}</strong>
            <span>{activeEvent ? eventTitle(activeEvent, t("eventNamePlaceholder")) : t("modeOperateDisabled")}</span>
          </div>
          {activeEvent ? (
            <div className="ticket-guest-lane" aria-label={t("guestLaneLabel")}>
              <OpenUiTextField
                className="ticket-address-strip"
                label={<span className="ticket-address-strip__meta"><WalletCards size={15} />{t("issueRecipient")}</span>}
                value={issueRecipient}
                onChange={(e) => state.issueRecipient?.set(e.target.value)}
                placeholder={t("issueRecipientPlaceholder")}
                disabled={busy}
              />
              {guestWallets.length > 0 && (
                <div className="ticket-recipient-picks" aria-label={t("recentGuests")}>
                  <span>{t("recentGuests")}</span>
                  <div>
                    {guestWallets.map((wallet) => (
                      <button
                        key={wallet}
                        type="button"
                        className={issueRecipient === wallet ? "ticket-recipient-chip ticket-recipient-chip--active" : "ticket-recipient-chip"}
                        onClick={() => state.issueRecipient?.set(wallet)}
                        disabled={busy}
                      >
                        {compactAddress(wallet)}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="ticket-seat-board">
                <span className="ticket-seat-board__label">{t("seatLaneLabel")}</span>
                <div className="ticket-seat-picks" aria-label={t("issueSeat")}>
                  {SEAT_PRESETS.map((seat) => (
                    <button
                      key={seat}
                      type="button"
                      className={["ticket-seat", issueSeat === seat ? "ticket-seat--active" : null].filter(Boolean).join(" ")}
                      onClick={() => state.issueSeat?.set(seat)}
                      disabled={busy}
                    >
                      {seat}
                    </button>
                  ))}
                </div>
              </div>
              <OpenUiTextField
                className="ticket-memo-chip"
                label={t("issueMemo")}
                value={issueMemo}
                onChange={(e) => state.issueMemo?.set(e.target.value)}
                placeholder={t("issueMemoPlaceholder")}
                disabled={busy}
              />
            </div>
          ) : (
            <div className="ticket-empty-prompt">
              <span className="ticket-empty-prompt__icon"><Ticket size={17} /></span>
              <div>
                <strong>{t("modeCreateTitle")}</strong>
                <p>{t("modeCreateHint")}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {mode === "checkin" && (
        <div className="ticket-work-card ticket-work-card--checkin">
          <div className="ticket-work-card__icon"><QrCode size={19} /></div>
          <div className="ticket-work-card__copy">
            <strong>{t("doorScanner")}</strong>
            <span>{t("checkinHint")}</span>
          </div>
          <div className="ticket-scanner-console" aria-label={t("scannerSlotLabel")}>
            <span className="ticket-scanner-console__sensor"><QrCode size={18} /></span>
            <OpenUiTextField
              className="ticket-scan-slot"
              label={t("checkinTokenId")}
              value={checkinTokenId}
              onChange={(e) => state.checkinTokenId?.set(e.target.value)}
              placeholder={t("checkinTokenIdPlaceholder")}
              disabled={busy}
            />
            <button type="button" className="ticket-secondary-action" onClick={() => void dispatch("lookupTicket", checkinPayload)} disabled={busy || !checkinTokenId.trim()}>
              <RefreshCw size={15} />
              {isLookingUp ? t("lookingUp") : t("lookup")}
            </button>
          </div>
          {tickets.length > 0 ? (
            <div className="ticket-gate-queue" aria-label={t("gateQueueLabel")}>
              <span className="ticket-gate-queue__label">{t("gateQueueLabel")}</span>
              <div className="ticket-gate-queue__list">
                {tickets.slice(0, 4).map((ticket) => {
                  const id = ticketId(ticket);
                  const used = Boolean(ticket.used ?? ticket.checkedIn);
                  const active = id === checkinTokenId;
                  return (
                    <button
                      key={id || String(ticket.eventName)}
                      type="button"
                      className={["ticket-gate-pass", active ? "ticket-gate-pass--active" : null].filter(Boolean).join(" ")}
                      onClick={() => selectTicketForGate(ticket)}
                      disabled={busy || !id}
                      aria-pressed={active}
                    >
                      <span className="ticket-gate-pass__mark"><Ticket size={14} /></span>
                      <span className="ticket-gate-pass__copy">
                        <strong>{String(ticket.eventName ?? id)}</strong>
                        <em>{String(ticket.seat ?? t("seatFallback"))} · {used ? t("ticketUsed") : t("ticketValid")}</em>
                      </span>
                      <span className="ticket-gate-pass__id">{id}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="ticket-empty-prompt ticket-empty-prompt--gate">
              <span className="ticket-empty-prompt__icon"><IdCard size={17} /></span>
              <div>
                <strong>{t("emptyTickets")}</strong>
                <p>{t("emptyTicketsHint")}</p>
              </div>
            </div>
          )}
          {checkinTicket && (
            <div className={["ticket-verdict-card", checkinTicket.used || checkinTicket.checkedIn ? "ticket-verdict-card--used" : null].filter(Boolean).join(" ")}>
              <span className="ticket-verdict-card__icon">
                <CheckCircle2 size={18} />
              </span>
              <div className="ticket-verdict-card__copy">
                <strong>{t("ticketFound")}</strong>
                <span>{String(checkinTicket.eventName ?? ticketId(checkinTicket))}</span>
              </div>
              <dl>
                <div>
                  <dt>{t("ticketSeat")}</dt>
                  <dd>{String(checkinTicket.seat ?? t("seatFallback"))}</dd>
                </div>
                <div>
                  <dt>{t("ticketOwner")}</dt>
                  <dd>{compactAddress(String(checkinTicket.owner ?? "")) || "-"}</dd>
                </div>
                <div>
                  <dt>{t("statusActive")}</dt>
                  <dd>{checkinTicket.used || checkinTicket.checkedIn ? t("ticketUsed") : t("ticketValid")}</dd>
                </div>
              </dl>
            </div>
          )}
        </div>
      )}
    </div>
  );

  const drawerNotice = (Icon: LucideIcon, title: string, copy: string) => (
    <OpenUiNotice className="ticket-drawer-notice" icon={<Icon size={17} />} title={title}>
      {copy}
    </OpenUiNotice>
  );

  const drawerTabs: Array<{ id: DrawerMode; label: string; Icon: LucideIcon }> = [
    { id: "event", label: t("eventIdentity"), Icon: Wand2 },
    { id: "issue", label: t("issueTicketTitle"), Icon: UserPlus },
    { id: "tickets", label: t("ticketsTab"), Icon: WalletCards },
    { id: "events", label: t("sidebarEvents"), Icon: Ticket },
    { id: "transfer", label: t("transferTicket"), Icon: Send },
    { id: "evidence", label: t("evidenceShort"), Icon: IdCard },
  ];

  const eventDrawerPanel = (
    <OpenUiPanel
      className="ticket-drawer-panel ticket-drawer-panel--event"
      icon={<Wand2 size={16} />}
      title={t("eventIdentity")}
      subtitle={passName}
      titleId="ticket-drawer-event"
    >
      <div className="ticket-drawer-fields">
        <OpenUiTextField
          className="ticket-drawer-field ticket-drawer-field--wide"
          label={t("eventName")}
          value={eventName}
          onChange={(e) => updateEventDraft("eventName", e.target.value)}
          placeholder={t("eventNamePlaceholder")}
          disabled={busy}
        />
        <OpenUiTextField
          className="ticket-drawer-field ticket-drawer-field--wide"
          label={t("eventVenue")}
          value={eventVenue}
          onChange={(e) => updateEventDraft("eventVenue", e.target.value)}
          placeholder={t("eventVenuePlaceholder")}
          disabled={busy}
        />
        <div className="ticket-drawer-grid">
          <OpenUiTextField
            className="ticket-drawer-field"
            label={t("eventStart")}
            value={eventStart}
            onChange={(e) => updateEventDraft("eventStart", e.target.value)}
            placeholder={t("eventStartPlaceholder")}
            disabled={busy}
          />
          <OpenUiTextField
            className="ticket-drawer-field"
            label={t("eventEnd")}
            value={eventEnd}
            onChange={(e) => updateEventDraft("eventEnd", e.target.value)}
            placeholder={t("eventEndPlaceholder")}
            disabled={busy}
          />
        </div>
        <OpenUiTextField
          className="ticket-drawer-field"
          label={t("maxSupply")}
          value={maxSupply}
          onChange={(e) => updateEventDraft("maxSupply", e.target.value)}
          placeholder={t("maxSupplyPlaceholder")}
          inputMode="numeric"
          pattern="[0-9]*"
          disabled={busy}
        />
        <OpenUiTextArea
          className="ticket-drawer-field ticket-drawer-field--wide mx2-open-field--compact"
          label={t("notes")}
          value={notes}
          onChange={(e) => updateEventDraft("notes", e.target.value)}
          placeholder={t("notesPlaceholder")}
          disabled={busy}
          rows={2}
        />
      </div>
    </OpenUiPanel>
  );

  const issueDrawerPanel = (
    <OpenUiPanel
      className="ticket-drawer-panel ticket-drawer-panel--issue"
      icon={<UserPlus size={16} />}
      title={t("issueTicketTitle")}
      subtitle={activeEvent ? eventTitle(activeEvent, t("eventNamePlaceholder")) : t("modeOperateDisabled")}
      titleId="ticket-drawer-issue"
    >
      {hasLiveEvent ? (
        <div className="ticket-drawer-fields">
          <OpenUiTextField
            className="ticket-drawer-field ticket-drawer-field--wide"
            label={t("issueRecipient")}
            value={issueRecipient}
            onChange={(e) => state.issueRecipient?.set(e.target.value)}
            placeholder={t("issueRecipientPlaceholder")}
            disabled={busy}
          />
          <OpenUiTextField
            className="ticket-drawer-field"
            label={t("issueSeat")}
            value={issueSeat}
            onChange={(e) => state.issueSeat?.set(e.target.value)}
            placeholder={t("issueSeatPlaceholder")}
            disabled={busy}
          />
          <OpenUiTextField
            className="ticket-drawer-field"
            label={t("issueMemo")}
            value={issueMemo}
            onChange={(e) => state.issueMemo?.set(e.target.value)}
            placeholder={t("issueMemoPlaceholder")}
            disabled={busy}
          />
        </div>
      ) : drawerNotice(Ticket, t("modeCreateTitle"), t("modeCreateHint"))}
    </OpenUiPanel>
  );

  const ticketsDrawerPanel = (
    <OpenUiPanel
      className="ticket-drawer-panel ticket-drawer-panel--tickets"
      icon={<WalletCards size={16} />}
      title={t("ticketsTab")}
      subtitle={`${tickets.length} ${t("ticketsCount")}`}
      titleId="ticket-drawer-tickets"
    >
      {tickets.length > 0 ? (
        <ul className="ticket-list">
          {tickets.slice(0, 8).map((ticket) => {
            const id = ticketId(ticket);
            const used = Boolean(ticket.used ?? ticket.checkedIn);
            return (
              <li key={id || String(ticket.eventName)} className="ticket-list__item">
                <div>
                  <strong>{String(ticket.eventName ?? id)}</strong>
                  <span>{String(ticket.seat ?? t("seatFallback"))} · {used ? t("ticketUsed") : t("ticketValid")}</span>
                </div>
                {id && <TokenQr value={id} size={64} label={t("ticketQrLabel")} />}
                <button type="button" className="mx2-btn mx2-btn--ghost" onClick={() => void dispatch("copyTokenId", id)} disabled={!id}>{t("copyTokenId")}</button>
              </li>
            );
          })}
        </ul>
      ) : <p className="ticket-drawer-empty">{t("emptyTickets")}</p>}
    </OpenUiPanel>
  );

  const eventsDrawerPanel = (
    <OpenUiPanel
      className="ticket-drawer-panel ticket-drawer-panel--events"
      icon={<Ticket size={16} />}
      title={t("eventsCountLabel", { count: events.length })}
      subtitle={activeEvent ? eventTitle(activeEvent, t("eventNamePlaceholder")) : t("emptyEvents")}
      titleId="ticket-drawer-events"
    >
      {eventCards}
      {events.length > 0 ? (
        <ul className="mx2-history ticket-drawer-history">
          {events.slice(0, 8).map((event) => (
            <li key={event.id} className="mx2-history__item">
              <button type="button" className="ticket-event-list__select" onClick={() => selectEvent(event)}>
                <span className="mx2-history__face">{eventTitle(event, t("eventNamePlaceholder"))}</span>
                <span className="mx2-history__stake">{displayCount(event.minted)} / {displayCount(event.maxSupply)}</span>
              </button>
              <button type="button" className="mx2-btn mx2-btn--ghost" onClick={() => void dispatch("toggleEvent", event)}>
                {event.active ? t("deactivate") : t("activate")}
              </button>
            </li>
          ))}
        </ul>
      ) : <p className="ticket-drawer-empty">{t("emptyEvents")}</p>}
    </OpenUiPanel>
  );

  const transferDrawerPanel = (
    <OpenUiPanel
      className="ticket-drawer-panel ticket-drawer-panel--transfer"
      icon={<Send size={16} />}
      title={t("transferTicket")}
      subtitle={hasTransferContext ? transferTokenId || t("ticketTokenId") : t("emptyTickets")}
      titleId="ticket-drawer-transfer"
    >
      {hasTransferContext ? (
        <>
          <div className="ticket-drawer-fields">
            <OpenUiTextField
              className="ticket-drawer-field"
              label={t("ticketTokenId")}
              value={transferTokenId}
              onChange={(e) => state.transferTokenId?.set(e.target.value)}
              placeholder={t("ticketTokenId")}
              disabled={busy}
            />
            <OpenUiTextField
              className="ticket-drawer-field"
              label={t("transferRecipient")}
              value={transferRecipient}
              onChange={(e) => state.transferRecipient?.set(e.target.value)}
              placeholder={t("transferRecipientPlaceholder")}
              disabled={busy}
            />
          </div>
          <button type="button" className="mx2-btn mx2-btn--ghost ticket-drawer-action" onClick={() => void dispatch("transferTicket", { tokenId: transferTokenId, recipient: transferRecipient })} disabled={busy || !canTransferTicket}>
            <Send size={14} />
            {isTransferring ? t("lifecycleTransfer") : t("transferTicket")}
          </button>
        </>
      ) : drawerNotice(WalletCards, t("emptyTickets"), t("emptyTicketsHint"))}
    </OpenUiPanel>
  );

  const evidenceDrawerPanel = (
    <OpenUiPanel
      className="ticket-drawer-panel ticket-drawer-panel--evidence"
      icon={<IdCard size={16} />}
      title={t("evidence")}
      subtitle={workflowStatus}
      titleId="ticket-drawer-evidence"
    >
      <div className="ticket-evidence-grid">
        <div className="ticket-evidence">
          <span><IdCard size={14} />{t("latestRequest")}</span>
          <code>{latestRequest ? JSON.stringify(latestRequest) : t("requestEmpty")}</code>
        </div>
        <div className="ticket-evidence">
          <span><CheckCircle2 size={14} />{t("latestResult")}</span>
          <code>{latestResult ? JSON.stringify(latestResult) : t("resultEmpty")}</code>
        </div>
      </div>
    </OpenUiPanel>
  );

  const activeDrawerPanel = {
    event: eventDrawerPanel,
    issue: issueDrawerPanel,
    tickets: ticketsDrawerPanel,
    events: eventsDrawerPanel,
    transfer: transferDrawerPanel,
    evidence: evidenceDrawerPanel,
  }[drawerMode];

  const drawerContent = (
    <div className="ticket-drawer-shell" data-mode={drawerMode}>
      <OpenUiSegmented
        className="ticket-drawer-tabs"
        label={t("detailsLabel")}
        onChange={(value) => {
          if (["event", "issue", "tickets", "events", "transfer", "evidence"].includes(value)) {
            setDrawerMode(value as DrawerMode);
          }
        }}
        options={drawerTabs.map(({ id, label, Icon }) => ({
          value: id,
          label: (
            <span className="ticket-drawer-tab-label">
              <Icon size={15} />
              <span>{label}</span>
            </span>
          ),
        }))}
        segmentedClassName="ticket-drawer-segmented"
        value={drawerMode}
      />
      <div className="ticket-drawer-active-panel">
        {activeDrawerPanel}
      </div>
    </div>
  );

  return (
    <div className="event-ticket-pass-play-area mx2 mx2-cat-nft">
      <OpenUiProvider>
        <PlayStage
          category="nft"
          stage={{
            eyebrow: t("studioEyebrow"),
            title: mode === "checkin" ? t("gateDesk") : mode === "issue" ? t("modeOperateTitle") : t("studioTitle"),
            subtitle: mode === "checkin" ? t("gateDeskSubtitle") : t("studioSubtitle"),
            badges: (
              <>
                <span className="mx2-badge" data-tone="accent"><span className="mx2-badge__dot" /> {eventsCount} {t("sidebarEvents")}</span>
                <span className="mx2-badge">{address ? compactAddress(address) : t("walletNotConnected")}</span>
              </>
            ),
          }}
          scene={<div className="ticket-stage-stack">{scene}{modePanel}</div>}
          score={[
            { label: t("sidebarEvents"), value: String(eventsCount), accent: true },
            { label: t("ticketsCount"), value: String(ticketsCount) },
            { label: t("active"), value: String(activeEventsCount) },
          ]}
          actions={{ primary: primaryAction }}
          drawerToggleLabel={t("detailsLabel")}
          drawer={{
            title: t("gateDesk"),
            children: drawerContent,
          }}
        />
      </OpenUiProvider>
    </div>
  );
}
