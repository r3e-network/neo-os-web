/**
 * useEventTicket - Business logic for the Event Ticket Pass miniapp.
 *
 * The React app talks DIRECTLY to the standalone MiniAppEventTicketPass contract
 * via ctx.services.chain. The earlier path routed event/ticket records through
 * the Morpheus OS kernel (ctx.os.storage / ctx.os.nft / ctx.os.badge → EdgeClient
 * → /api/edge → Morpheus), which is down/degraded, so the app was broken at
 * runtime and the "tickets" were never real NEP-11 tokens.
 *
 * MiniAppEventTicketPass is self-contained and witness-authorized — there is NO
 * deposit / prepaid-GAS flow. The organizer's connected wallet signs each call
 * and the contract gates on Runtime.CheckWitness(creator). This composable drives
 * it directly so events, tickets, and check-ins are real on-chain state.
 *
 * Contract interaction model (verified against the deployed ABI at
 * 0x90bad472146aab97de71498e8d736c3124e7c82b):
 *
 *   READS (chain.read, default app contract script hash → parsed stack):
 *     getCreatorEvents(creator, offset, limit) -> Integer[]  (creator's event ids)
 *     getEventDetails(eventId)                 -> Map{id,creator,name,venue,
 *                                                  startTime,endTime,maxSupply,
 *                                                  minted,notes,active,...}
 *     tokensOf(owner)                          -> ByteString[] (owned ticket ids)
 *     getTicketDetails(tokenId)                -> Map{tokenId,eventId,owner,
 *                                                  eventName,venue,startTime,
 *                                                  endTime,seat,memo,issuedTime,
 *                                                  used,usedTime,active}
 *
 *   WRITES (chain.invoke — direct, signed by the connected wallet):
 *     createEvent(creator,name,venue,startTime,endTime,maxSupply,notes) -> eventId
 *         (event: EventCreated[eventId,creator,name])
 *     issueTicket(creator,recipient,eventId,seat,memo) -> tokenId
 *         (event: TicketIssued[tokenId,eventId,owner])
 *     checkIn(creator,tokenId)
 *         (event: TicketCheckedIn[tokenId,eventId,operatorAddress])
 *     setEventActive(creator,eventId,active)
 *         (event: EventUpdated[eventId])
 *
 *   UNITS: maxSupply / supply counts are integers (NEP-11 ticket counts, never
 *   ×1e8). startTime / endTime are unix seconds. No GAS/NEO amounts move — the
 *   contract has no payment flow, so there are no deposit memos.
 */

import { createDerived, createObservable } from "@shared/react/context";
import type { Observable } from "@shared/react/context";
import { addressToScriptHash } from "@shared/utils/neo";
import { encodeTokenId, parseBigInt, parseBool, parseDateInput } from "@shared/utils/parsers";
import type { EventItem, TicketItem } from "../types";

type ContractArg = {
  type: "String" | "Integer" | "Boolean" | "Hash160" | "Hash256" | "PublicKey" | "ByteArray" | "Array";
  value: string | number | boolean;
};

type TxResult = {
  txid?: string;
  event?: unknown;
};

/**
 * Minimal surface of ctx.services.chain (ChainService) this composable uses.
 * Kept as a structural type so the composable can be unit-tested with a fake.
 */
export type ChainLike = {
  address: Observable<string | null> | Observable<string>;
  ensureWallet: () => Promise<string>;
  invoke: (
    operation: string,
    args: ContractArg[],
    options?: { waitForEvent?: string; waitTimeoutMs?: number; scriptHash?: string },
  ) => Promise<TxResult>;
  read: (
    operation: string,
    args?: ContractArg[],
    options?: { scriptHash?: string; cache?: boolean; cacheTtlMs?: number },
  ) => Promise<unknown>;
};

export interface UseEventTicketOptions {
  chain: ChainLike;
  eventBus: { emit: (event: string, payload?: unknown) => void };
  t: (key: string, params?: Record<string, string | number>) => string;
}

type ActionPayload = Record<string, unknown>;

function clean(value: unknown, fallback = "") {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : fallback;
}

function stringValue(value: unknown): string {
  return String(value ?? "").trim();
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function txidFrom(result: TxResult | null | undefined): string {
  return stringValue(result?.txid);
}

/**
 * Read the value at `index` of an on-chain notification's `state` array.
 * waitForEvent returns the raw notification ({ state: [{ type, value }, ...] }).
 */
function eventValue(entry: unknown, index: number): unknown {
  if (!entry || typeof entry !== "object") return undefined;
  const state = (entry as { state?: unknown }).state;
  if (!Array.isArray(state)) return undefined;
  const item = state[index];
  if (item && typeof item === "object" && "value" in item) {
    return (item as { value?: unknown }).value;
  }
  return item;
}

/**
 * A token id is emitted as a ByteString; over RPC it arrives base64-encoded.
 * The contract builds ids as ASCII "<eventId>-<serial>", so decode base64 back
 * to that readable form when it isn't already plain text.
 */
function decodeTokenId(raw: unknown): string {
  const value = stringValue(raw);
  if (!value) return "";
  // Already in "<eventId>-<serial>" form (issued by the contract).
  if (/^\d+-\d+$/.test(value)) return value;
  try {
    const decoded = atob(value);
    if (/^\d+-\d+$/.test(decoded)) return decoded;
    return decoded || value;
  } catch (_e) {
    return value;
  }
}

function eventFromRecord(record: Record<string, unknown>, fallbackId: string): EventItem | null {
  const id = stringValue(record.id ?? record.eventId ?? fallbackId);
  if (!id) return null;
  // GetEventDetails returns an empty Map for a missing event → no name/creator.
  if (!record.creator && !record.name && id === fallbackId && Object.keys(record).length === 0) {
    return null;
  }
  return {
    id,
    creator: stringValue(record.creator),
    name: stringValue(record.name),
    venue: stringValue(record.venue),
    startTime: Number.parseInt(stringValue(record.startTime) || "0", 10) || 0,
    endTime: Number.parseInt(stringValue(record.endTime) || "0", 10) || 0,
    maxSupply: parseBigInt(record.maxSupply),
    minted: parseBigInt(record.minted),
    notes: stringValue(record.notes),
    active: parseBool(record.active ?? record.status === "active"),
  };
}

function ticketFromRecord(record: Record<string, unknown>, tokenId: string): TicketItem | null {
  const id = decodeTokenId(record.tokenId ?? tokenId);
  if (!id) return null;
  return {
    tokenId: id,
    eventId: stringValue(record.eventId),
    owner: stringValue(record.owner),
    eventName: stringValue(record.eventName),
    venue: stringValue(record.venue),
    startTime: Number.parseInt(stringValue(record.startTime) || "0", 10) || 0,
    endTime: Number.parseInt(stringValue(record.endTime) || "0", 10) || 0,
    seat: stringValue(record.seat),
    memo: stringValue(record.memo),
    issuedTime: Number.parseInt(stringValue(record.issuedTime) || "0", 10) || 0,
    used: parseBool(record.used),
    usedTime: Number.parseInt(stringValue(record.usedTime) || "0", 10) || 0,
  };
}

function mergeEvent(list: EventItem[], event: EventItem) {
  return [event, ...list.filter((item) => item.id !== event.id)];
}

function mergeTicket(list: TicketItem[], ticket: TicketItem) {
  return [ticket, ...list.filter((item) => item.tokenId !== ticket.tokenId)];
}

export function useEventTicket({ chain, eventBus, t }: UseEventTicketOptions) {
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

  function currentAddress(): string {
    return address.get() || stringValue(chain.address.get());
  }

  function nowSeconds() {
    return Math.floor(Date.now() / 1000);
  }

  async function ensureConnected(): Promise<string> {
    const existing = currentAddress();
    if (existing) {
      if (!address.get()) address.set(existing);
      return existing;
    }
    const wallet = await chain.ensureWallet();
    address.set(wallet);
    return wallet;
  }

  async function connectWallet() {
    const wallet = await ensureConnected();
    workflowStatus.set(t("walletConnected"));
    await Promise.all([refreshEvents({ quiet: true }), refreshTickets({ quiet: true })]);
    return wallet;
  }

  async function loadEventIds(creator: string): Promise<string[]> {
    const creatorHash = addressToScriptHash(creator);
    if (!creatorHash) return [];
    const raw = await chain.read("getCreatorEvents", [
      { type: "Hash160", value: creatorHash },
      { type: "Integer", value: "0" },
      { type: "Integer", value: "50" },
    ]);
    const list = Array.isArray(raw) ? raw : [];
    return list
      .map((value) => Number.parseInt(stringValue(value), 10))
      .filter((value) => Number.isFinite(value) && value > 0)
      .map((value) => String(value));
  }

  async function loadEventDetails(eventId: string): Promise<EventItem | null> {
    const raw = await chain.read("getEventDetails", [
      { type: "Integer", value: eventId },
    ]);
    const record = asRecord(raw);
    if (!record) return null;
    return eventFromRecord(record, eventId);
  }

  async function refreshEvents(options: { quiet?: boolean } = {}) {
    if (isRefreshing.get()) return events.get();
    const creator = currentAddress();
    if (!creator) {
      events.set([]);
      return events.get();
    }
    isRefreshing.set(true);
    lastError.set("");
    try {
      const ids = await loadEventIds(creator);
      const details = await Promise.all(ids.map((id) => loadEventDetails(id).catch(() => null)));
      const items = details.filter((item): item is EventItem => Boolean(item));
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
    const owner = currentAddress();
    if (!owner) {
      tickets.set([]);
      return tickets.get();
    }
    const ownerHash = addressToScriptHash(owner);
    if (!ownerHash) {
      tickets.set([]);
      return tickets.get();
    }
    isRefreshingTickets.set(true);
    lastError.set("");
    try {
      const rawTokens = await chain.read("tokensOf", [
        { type: "Hash160", value: ownerHash },
      ]);
      const tokenIds = (Array.isArray(rawTokens) ? rawTokens : [])
        .map(decodeTokenId)
        .filter((tokenId) => tokenId.length > 0);
      if (tokenIds.length === 0) {
        tickets.set([]);
        workflowStatus.set(t("ticketsLoaded"));
        return tickets.get();
      }
      // Best-effort per-token detail reads: one unreadable ticket must not abort
      // the whole list, so settle every promise and keep the resolvable ones.
      const settled = await Promise.allSettled(
        tokenIds.map((tokenId) =>
          chain.read("getTicketDetails", [
            { type: "ByteArray", value: encodeTokenId(tokenId) },
          ]).then((raw) => ticketFromRecord(asRecord(raw) ?? {}, tokenId)),
        ),
      );
      const items: TicketItem[] = [];
      for (const outcome of settled) {
        if (outcome.status === "fulfilled" && outcome.value) items.push(outcome.value);
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
      const creator = await ensureConnected();
      if (!creator) throw new Error(t("walletNotConnected"));
      const request = {
        kind: "event_create",
        method: "createEvent",
        creator,
        name,
        venue,
        startTime,
        endTime,
        maxSupply: supply.toString(),
        notes: clean(notes.get()),
      };
      latestRequest.set(request);
      const result = await chain.invoke(
        "createEvent",
        [
          { type: "Hash160", value: creator },
          { type: "String", value: name },
          { type: "String", value: venue },
          { type: "Integer", value: String(startTime) },
          { type: "Integer", value: String(endTime) },
          { type: "Integer", value: supply.toString() },
          { type: "String", value: clean(notes.get()) },
        ],
        { waitForEvent: "EventCreated" },
      );
      const eventId = stringValue(eventValue(result.event, 0));
      latestResult.set({
        kind: "event_created",
        txid: txidFrom(result),
        eventId,
      });
      workflowStatus.set(t("eventCreated"));
      eventBus.emit("event-ticket:eventCreated", { id: eventId, name });
      const refreshed = await refreshEvents({ quiet: true });
      if (eventId) selectedEventId.set(eventId);
      return refreshed.find((event) => event.id === eventId) ?? null;
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
    if (event.minted >= event.maxSupply) throw new Error(t("soldOut"));
    const recipient = clean(issueRecipient.get());
    if (!recipient || !addressToScriptHash(recipient)) {
      throw new Error(t("invalidRecipient"));
    }

    isIssuing.set(true);
    lastError.set("");
    try {
      const organizer = await ensureConnected();
      if (!organizer) throw new Error(t("walletNotConnected"));
      const seat = clean(issueSeat.get(), t("seatFallback"));
      const memo = clean(issueMemo.get());
      const request = {
        kind: "ticket_issue",
        method: "issueTicket",
        creator: organizer,
        recipient,
        eventId: event.id,
        seat,
        memo,
      };
      latestRequest.set(request);
      const result = await chain.invoke(
        "issueTicket",
        [
          { type: "Hash160", value: organizer },
          { type: "Hash160", value: recipient },
          { type: "Integer", value: event.id },
          { type: "String", value: seat },
          { type: "String", value: memo },
        ],
        { waitForEvent: "TicketIssued" },
      );
      const tokenId = decodeTokenId(eventValue(result.event, 0));
      latestResult.set({
        kind: "ticket_issued",
        txid: txidFrom(result),
        tokenId,
        eventId: event.id,
      });
      workflowStatus.set(t("ticketIssued"));
      eventBus.emit("event-ticket:ticketIssued", { tokenId, eventId: event.id });
      await Promise.all([
        refreshEvents({ quiet: true }),
        refreshTickets({ quiet: true }),
      ]);
      const ticket: TicketItem = {
        tokenId,
        eventId: event.id,
        owner: recipient,
        eventName: event.name,
        venue: event.venue,
        startTime: event.startTime,
        endTime: event.endTime,
        seat,
        memo,
        issuedTime: nowSeconds(),
        used: false,
        usedTime: 0,
      };
      // Surface the newly issued ticket immediately even if it was minted to a
      // different recipient (so the organizer sees confirmation in the list).
      if (tokenId && !tickets.get().some((item) => item.tokenId === tokenId)) {
        tickets.set(mergeTicket(tickets.get(), ticket));
      }
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
      const creator = await ensureConnected();
      if (!creator) throw new Error(t("walletNotConnected"));
      const next = { ...evt, active: !evt.active };
      const request = {
        kind: "event_toggle",
        method: "setEventActive",
        creator,
        eventId: next.id,
        active: next.active,
      };
      latestRequest.set(request);
      const result = await chain.invoke(
        "setEventActive",
        [
          { type: "Hash160", value: creator },
          { type: "Integer", value: next.id },
          { type: "Boolean", value: next.active },
        ],
        { waitForEvent: "EventUpdated" },
      );
      latestResult.set({
        kind: "event_status_updated",
        txid: txidFrom(result),
        eventId: next.id,
        active: next.active,
      });
      events.set(mergeEvent(events.get(), next));
      workflowStatus.set(next.active ? t("statusActive") : t("statusInactive"));
      await refreshEvents({ quiet: true });
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
      const raw = await chain.read("getTicketDetails", [
        { type: "ByteArray", value: encodeTokenId(tokenId) },
      ]);
      const record = asRecord(raw);
      const parsed = record ? ticketFromRecord(record, tokenId) : null;
      if (!parsed || !parsed.eventId) {
        lookup.set(null);
        throw new Error(t("ticketNotFound"));
      }
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
      const creator = await ensureConnected();
      if (!creator) throw new Error(t("walletNotConnected"));
      // Ignore a cached lookup that disagrees with the current input: a user
      // may have edited the token field after looking up a different ticket,
      // so re-resolve to avoid checking in the wrong ticket.
      const cached = lookup.get();
      const ticket =
        cached && cached.tokenId === tokenId ? cached : await lookupTicket();
      if (!ticket) throw new Error(t("ticketNotFound"));
      if (ticket.used) throw new Error(t("ticketAlreadyUsed"));
      const request = {
        kind: "ticket_checkin",
        method: "checkIn",
        creator,
        tokenId: ticket.tokenId,
      };
      latestRequest.set(request);
      const result = await chain.invoke(
        "checkIn",
        [
          { type: "Hash160", value: creator },
          { type: "ByteArray", value: encodeTokenId(ticket.tokenId) },
        ],
        { waitForEvent: "TicketCheckedIn" },
      );
      const checkedIn = { ...ticket, used: true, usedTime: nowSeconds() };
      lookup.set(checkedIn);
      tickets.set(mergeTicket(tickets.get(), checkedIn));
      latestResult.set({
        kind: "ticket_checked_in",
        txid: txidFrom(result),
        tokenId: checkedIn.tokenId,
      });
      workflowStatus.set(t("checkinSuccess"));
      eventBus.emit("event-ticket:checkedIn", { tokenId: checkedIn.tokenId });
      await refreshTickets({ quiet: true });
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
      const existing = currentAddress();
      if (existing && !address.get()) address.set(existing);
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
