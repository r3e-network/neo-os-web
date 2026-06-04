/**
 * useEventTicket - Business logic for the Event Ticket Pass miniapp.
 *
 * The React app talks to MiniApp OS services instead of hand-encoding contract
 * calls. Storage writes produce host wallet intents when the edge gateway is
 * unavailable, and NFT writes go through the host NFT service when configured.
 */

import { createDerived, createObservable } from "@shared/react/context";
import type { Observable } from "@shared/react/context";
import type { BadgeProxy } from "@shared/services/os/BadgeProxy";
import type { NFTProxy } from "@shared/services/os/NFTProxy";
import type { StorageProxy } from "@shared/services/os/StorageProxy";
import { addressToScriptHash } from "@shared/utils/neo";
import { parseBigInt, parseBool, parseDateInput } from "@shared/utils/parsers";
import type { EventItem, TicketItem } from "../types";

export interface UseEventTicketOptions {
  nftService: NFTProxy;
  storageService: StorageProxy;
  badgeService: BadgeProxy;
  ensureWallet: () => Promise<string>;
  eventBus: { emit: (event: string, payload?: unknown) => void };
  t: (key: string, params?: Record<string, string | number>) => string;
}

interface StoredEvent {
  id: string;
  creator: string;
  name: string;
  venue: string;
  startTime: number;
  endTime: number;
  maxSupply: number | string;
  minted: number | string;
  notes: string;
  active: boolean;
}

interface StoredTicket {
  tokenId: string;
  eventId: string;
  owner: string;
  eventName: string;
  venue: string;
  startTime: number;
  endTime: number;
  seat: string;
  memo: string;
  issuedTime: number;
  used: boolean;
  usedTime: number;
}

type ActionPayload = Record<string, unknown>;

function clean(value: unknown, fallback = "") {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : fallback;
}

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

function makeId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}`;
}

function eventStorageKey(id: string) {
  return `events:${id}`;
}

function ticketStorageKey(tokenId: string) {
  return `tickets:${tokenId}`;
}

function toEventItem(stored: StoredEvent): EventItem {
  return {
    id: String(stored.id),
    creator: String(stored.creator || ""),
    name: String(stored.name || ""),
    venue: String(stored.venue || ""),
    startTime: Number(stored.startTime || 0),
    endTime: Number(stored.endTime || 0),
    maxSupply: parseBigInt(stored.maxSupply),
    minted: parseBigInt(stored.minted),
    notes: String(stored.notes || ""),
    active: parseBool(stored.active),
  };
}

function toTicketItem(stored: StoredTicket): TicketItem {
  return {
    tokenId: String(stored.tokenId),
    eventId: String(stored.eventId || ""),
    owner: String(stored.owner || ""),
    eventName: String(stored.eventName || ""),
    venue: String(stored.venue || ""),
    startTime: Number(stored.startTime || 0),
    endTime: Number(stored.endTime || 0),
    seat: String(stored.seat || ""),
    memo: String(stored.memo || ""),
    issuedTime: Number(stored.issuedTime || 0),
    used: parseBool(stored.used),
    usedTime: Number(stored.usedTime || 0),
  };
}

function eventPayload(event: EventItem) {
  return {
    ...event,
    maxSupply: event.maxSupply.toString(),
    minted: event.minted.toString(),
  };
}

function ticketPayload(ticket: TicketItem) {
  return { ...ticket };
}

function mergeEvent(list: EventItem[], event: EventItem) {
  return [event, ...list.filter((item) => item.id !== event.id)];
}

function mergeTicket(list: TicketItem[], ticket: TicketItem) {
  return [ticket, ...list.filter((item) => item.tokenId !== ticket.tokenId)];
}

export function useEventTicket({
  nftService,
  storageService,
  badgeService,
  ensureWallet,
  eventBus,
  t,
}: UseEventTicketOptions) {
  const events = createObservable<EventItem[]>([]);
  const tickets = createObservable<TicketItem[]>([]);
  const address = createObservable("");
  const selectedEventId = createObservable("");
  const lookup = createObservable<TicketItem | null>(null);
  const latestRequest = createObservable<ActionPayload | null>(null);
  const latestResult = createObservable<ActionPayload | null>(null);
  const workflowStatus = createObservable(t("ready"));
  const lastError = createObservable("");

  const eventName = createObservable("Neo Builder Summit");
  const eventVenue = createObservable("Neo Community Hall");
  const eventStart = createObservable("2026-06-20 09:00");
  const eventEnd = createObservable("2026-06-20 18:00");
  const maxSupply = createObservable("120");
  const notes = createObservable("Workshop pass, badge pickup, and live check-in.");
  const issueRecipient = createObservable("");
  const issueSeat = createObservable("General");
  const issueMemo = createObservable("Standard admission");
  const checkinTokenId = createObservable("");

  const isLoading = createObservable(false);
  const isRefreshing = createObservable(false);
  const isRefreshingTickets = createObservable(false);
  const isCreating = createObservable(false);
  const isIssuing = createObservable(false);
  const isCheckingIn = createObservable(false);
  const isLookingUp = createObservable(false);
  const togglingId = createObservable<string | null>(null);

  const eventsCount = createDerived(() => events.get().length, [events]);
  const ticketsCount = createDerived(() => tickets.get().length, [tickets]);
  const activeEventsCount = createDerived(
    () => events.get().filter((event) => event.active).length,
    [events],
  );
  const selectedEvent = createDerived(
    () => events.get().find((event) => event.id === selectedEventId.get()) ?? null,
    [events, selectedEventId],
  );
  const canIssueTicket = createDerived(
    () => Boolean(selectedEvent.get()?.active && issueRecipient.get().trim()),
    [selectedEvent, issueRecipient],
  );
  const canCheckInTicket = createDerived(
    () => Boolean(checkinTokenId.get().trim()),
    [checkinTokenId],
  );

  async function connectWallet() {
    const wallet = await ensureWallet();
    address.set(wallet);
    workflowStatus.set(t("walletConnected"));
    await Promise.all([refreshEvents({ quiet: true }), refreshTickets({ quiet: true })]);
    return wallet;
  }

  async function refreshEvents(options: { quiet?: boolean } = {}) {
    if (isRefreshing.get()) return events.get();
    isRefreshing.set(true);
    lastError.set("");
    try {
      const eventMap = await storageService.list("events:", 50);
      const items: EventItem[] = [];
      if (eventMap && typeof eventMap === "object") {
        for (const value of Object.values(eventMap)) {
          const stored = value as StoredEvent;
          if (stored?.id) items.push(toEventItem(stored));
        }
      }
      items.sort((a, b) => b.startTime - a.startTime);
      events.set(items);
      if (!selectedEventId.get() && items[0]) selectedEventId.set(items[0].id);
      workflowStatus.set(t("eventsLoaded"));
      return items;
    } catch (error) {
      const message = error instanceof Error ? error.message : t("loadFailed");
      if (!options.quiet) {
        lastError.set(message);
        workflowStatus.set(message);
        throw error;
      }
      return events.get();
    } finally {
      isRefreshing.set(false);
    }
  }

  async function refreshTickets(options: { quiet?: boolean } = {}) {
    if (isRefreshingTickets.get()) return tickets.get();
    isRefreshingTickets.set(true);
    lastError.set("");
    try {
      const ticketMap = await storageService.list("tickets:", 50);
      const items: TicketItem[] = [];
      if (ticketMap && typeof ticketMap === "object") {
        for (const value of Object.values(ticketMap)) {
          const stored = value as StoredTicket;
          if (stored?.tokenId) items.push(toTicketItem(stored));
        }
      }
      items.sort((a, b) => b.issuedTime - a.issuedTime);
      tickets.set(items);
      workflowStatus.set(t("ticketsLoaded"));
      return items;
    } catch (error) {
      const message = error instanceof Error ? error.message : t("loadFailed");
      if (!options.quiet) {
        lastError.set(message);
        workflowStatus.set(message);
        throw error;
      }
      return tickets.get();
    } finally {
      isRefreshingTickets.set(false);
    }
  }

  async function createEvent() {
    if (isCreating.get()) return null;
    const name = clean(eventName.get());
    const venue = clean(eventVenue.get(), t("venueFallback"));
    const startTime = parseDateInput(eventStart.get());
    const endTime = parseDateInput(eventEnd.get());
    const supply = parseBigInt(maxSupply.get());
    if (!name) throw new Error(t("nameRequired"));
    if (!startTime || !endTime || endTime < startTime) {
      throw new Error(t("invalidTime"));
    }
    if (supply <= 0n) throw new Error(t("invalidSupply"));

    isCreating.set(true);
    lastError.set("");
    try {
      const creator = address.get() || await connectWallet();
      const event: EventItem = {
        id: makeId("evt"),
        creator,
        name,
        venue,
        startTime,
        endTime,
        maxSupply: supply,
        minted: 0n,
        notes: clean(notes.get()),
        active: true,
      };
      const request = {
        kind: "event_create",
        service: "os-storage-set",
        key: eventStorageKey(event.id),
        value: eventPayload(event),
      };
      latestRequest.set(request);
      const result = await storageService.set(request.key, request.value);
      events.set(mergeEvent(events.get(), event));
      selectedEventId.set(event.id);
      latestResult.set({ kind: "event_created", event: eventPayload(event), result });
      workflowStatus.set(t("eventCreated"));
      eventBus.emit("event-ticket:eventCreated", { id: event.id, name: event.name });
      badgeService.award("event-organizer", creator).catch(() => {});
      return event;
    } catch (error) {
      const message = error instanceof Error ? error.message : t("contractMissing");
      lastError.set(message);
      workflowStatus.set(message);
      throw error;
    } finally {
      isCreating.set(false);
    }
  }

  function selectEvent(eventId: string) {
    selectedEventId.set(eventId);
    workflowStatus.set(t("eventSelected"));
  }

  function openIssueModal(event: unknown) {
    const evt = event as EventItem;
    if (evt?.id) selectEvent(evt.id);
  }

  async function issueTicket() {
    if (isIssuing.get()) return null;
    const event = selectedEvent.get();
    if (!event) throw new Error(t("selectEventFirst"));
    if (!event.active) throw new Error(t("eventInactive"));
    const recipient = clean(issueRecipient.get());
    if (!recipient || !addressToScriptHash(recipient)) {
      throw new Error(t("invalidRecipient"));
    }

    isIssuing.set(true);
    lastError.set("");
    try {
      const organizer = address.get() || await connectWallet();
      // Read the authoritative minted count from storage so the sold-out guard
      // can't be bypassed by issuing past a stale in-memory count, and so
      // concurrent issuance increments from the real persisted value.
      let baseEvent = event;
      const storedEvent = await storageService.get(eventStorageKey(event.id));
      if (storedEvent && typeof storedEvent === "object") {
        baseEvent = toEventItem(storedEvent as StoredEvent);
      }
      if (baseEvent.minted >= baseEvent.maxSupply) throw new Error(t("soldOut"));
      const tokenId = makeId(`ticket-${event.id}`);
      const ticket: TicketItem = {
        tokenId,
        eventId: event.id,
        owner: recipient,
        eventName: event.name,
        venue: event.venue,
        startTime: event.startTime,
        endTime: event.endTime,
        seat: clean(issueSeat.get(), t("seatFallback")),
        memo: clean(issueMemo.get()),
        issuedTime: nowSeconds(),
        used: false,
        usedTime: 0,
      };
      const metadata = {
        kind: "event_ticket_pass",
        tokenId,
        eventId: event.id,
        eventName: event.name,
        venue: event.venue,
        seat: ticket.seat,
        memo: ticket.memo,
        issuer: organizer,
        owner: recipient,
      };
      const updatedEvent = { ...baseEvent, minted: baseEvent.minted + 1n };
      const request = {
        kind: "ticket_issue",
        mint: { service: "os-nft-mint", metadata },
        storage: { service: "os-storage-set", key: ticketStorageKey(tokenId), value: ticketPayload(ticket) },
        event: { service: "os-storage-set", key: eventStorageKey(event.id), value: eventPayload(updatedEvent) },
      };
      latestRequest.set(request);
      const mintResult = await nftService.mint(metadata);
      // The NFT is now minted on-chain. If any subsequent write fails, burn the
      // freshly minted token so we never orphan an NFT without a ticket record.
      let storageResult: unknown;
      try {
        storageResult = await storageService.set(ticketStorageKey(tokenId), ticketPayload(ticket));
        // Persist the incremented minted count so the sold-out cap survives a refresh.
        await storageService.set(eventStorageKey(event.id), eventPayload(updatedEvent));
      } catch (writeError) {
        await nftService.burn(tokenId).catch(() => {});
        throw writeError;
      }
      tickets.set(mergeTicket(tickets.get(), ticket));
      events.set(mergeEvent(events.get(), updatedEvent));
      latestResult.set({
        kind: "ticket_issued",
        ticket: ticketPayload(ticket),
        mintResult,
        storageResult,
      });
      workflowStatus.set(t("ticketIssued"));
      eventBus.emit("event-ticket:ticketIssued", { tokenId, eventId: event.id });
      return ticket;
    } catch (error) {
      const message = error instanceof Error ? error.message : t("contractMissing");
      lastError.set(message);
      workflowStatus.set(message);
      throw error;
    } finally {
      isIssuing.set(false);
    }
  }

  async function toggleEvent(event: unknown) {
    const evt = event as EventItem;
    if (!evt?.id || togglingId.get()) return null;
    togglingId.set(evt.id);
    lastError.set("");
    try {
      if (!address.get()) await connectWallet();
      const next = { ...evt, active: !evt.active };
      const request = {
        kind: "event_toggle",
        service: "os-storage-set",
        key: eventStorageKey(next.id),
        value: eventPayload(next),
      };
      latestRequest.set(request);
      const result = await storageService.set(request.key, request.value);
      events.set(mergeEvent(events.get(), next));
      latestResult.set({ kind: "event_status_updated", event: eventPayload(next), result });
      workflowStatus.set(next.active ? t("statusActive") : t("statusInactive"));
      return next;
    } catch (error) {
      const message = error instanceof Error ? error.message : t("contractMissing");
      lastError.set(message);
      workflowStatus.set(message);
      throw error;
    } finally {
      togglingId.set(null);
    }
  }

  async function lookupTicket() {
    if (isLookingUp.get()) return lookup.get();
    const tokenId = clean(checkinTokenId.get());
    if (!tokenId) throw new Error(t("invalidTokenId"));
    isLookingUp.set(true);
    lastError.set("");
    try {
      const local = tickets.get().find((ticket) => ticket.tokenId === tokenId);
      if (local) {
        lookup.set(local);
        workflowStatus.set(t("ticketFound"));
        return local;
      }
      const stored = await storageService.get(ticketStorageKey(tokenId));
      if (!stored || typeof stored !== "object") {
        lookup.set(null);
        throw new Error(t("ticketNotFound"));
      }
      const parsed = toTicketItem(stored as StoredTicket);
      lookup.set(parsed);
      workflowStatus.set(t("ticketFound"));
      return parsed;
    } catch (error) {
      const message = error instanceof Error ? error.message : t("ticketNotFound");
      lastError.set(message);
      workflowStatus.set(message);
      throw error;
    } finally {
      isLookingUp.set(false);
    }
  }

  async function checkInTicket() {
    if (isCheckingIn.get()) return null;
    const tokenId = clean(checkinTokenId.get());
    if (!tokenId) throw new Error(t("invalidTokenId"));
    isCheckingIn.set(true);
    lastError.set("");
    try {
      if (!address.get()) await connectWallet();
      const ticket = lookup.get() ?? await lookupTicket();
      if (!ticket) throw new Error(t("ticketNotFound"));
      if (ticket.used) throw new Error(t("ticketAlreadyUsed"));
      const checkedIn = { ...ticket, used: true, usedTime: nowSeconds() };
      const request = {
        kind: "ticket_checkin",
        service: "os-storage-set",
        key: ticketStorageKey(tokenId),
        value: ticketPayload(checkedIn),
      };
      latestRequest.set(request);
      const result = await storageService.set(request.key, request.value);
      lookup.set(checkedIn);
      tickets.set(mergeTicket(tickets.get(), checkedIn));
      latestResult.set({ kind: "ticket_checked_in", ticket: ticketPayload(checkedIn), result });
      workflowStatus.set(t("checkinSuccess"));
      eventBus.emit("event-ticket:checkedIn", { tokenId });
      badgeService.award("event-attendee", checkedIn.owner).catch(() => {});
      return checkedIn;
    } catch (error) {
      const message = error instanceof Error ? error.message : t("contractMissing");
      lastError.set(message);
      workflowStatus.set(message);
      throw error;
    } finally {
      isCheckingIn.set(false);
    }
  }

  async function loadAll() {
    isLoading.set(true);
    try {
      await Promise.all([
        refreshEvents({ quiet: true }),
        refreshTickets({ quiet: true }),
      ]);
    } finally {
      isLoading.set(false);
    }
  }

  return {
    events,
    tickets,
    address,
    selectedEventId,
    selectedEvent,
    lookup,
    latestRequest,
    latestResult,
    workflowStatus,
    lastError,
    eventName,
    eventVenue,
    eventStart,
    eventEnd,
    maxSupply,
    notes,
    issueRecipient,
    issueSeat,
    issueMemo,
    checkinTokenId,
    isLoading,
    isRefreshing,
    isRefreshingTickets,
    isCreating,
    isIssuing,
    isCheckingIn,
    isLookingUp,
    togglingId,
    eventsCount,
    ticketsCount,
    activeEventsCount,
    canIssueTicket,
    canCheckInTicket,
    connectWallet,
    refreshEvents,
    refreshTickets,
    createEvent,
    selectEvent,
    openIssueModal,
    issueTicket,
    toggleEvent,
    lookupTicket,
    checkInTicket,
    loadAll,
  };
}

export type UseEventTicketReturn = ReturnType<typeof useEventTicket>;
