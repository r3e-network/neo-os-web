/**
 * useEventTicket - Business logic for the Event Ticket Pass miniapp.
 *
 * The React app talks DIRECTLY to the standalone MiniAppEventTicketPass contract
 * via the MiniApp framework chain layer (ctx.framework.chain). The earlier path
 * routed event/ticket records through
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
import type { MiniAppFramework } from "@shared/react";
import { eventValue } from "@shared/utils/chain-events";
import { addressToScriptHash, parseHash160 } from "@shared/utils/neo";
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
 * Minimal surface of the underlying chain service (ChainService) the MiniApp
 * framework wraps. Kept as a structural type so tests can build a fake chain and
 * pass it through createMiniAppFramework.
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
  app: MiniAppFramework;
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

// Bounds on the holdings reconstruction so it can never fan out into an
// unbounded number of RPC reads on a large registry.
const EVENT_SCAN_LIMIT = 200;
const TICKET_SCAN_LIMIT = 500;

export function useEventTicket({ app, eventBus, t }: UseEventTicketOptions) {
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
  const eventStart = createObservable("2026-08-20 09:00");
  const eventEnd = createObservable("2026-08-20 18:00");
  const maxSupply = createObservable("120");
  const notes = createObservable("Workshop pass, badge pickup, and live check-in.");
  const issueRecipient = createObservable("");
  const issueSeat = createObservable("General");
  const issueMemo = createObservable("Standard admission");
  const checkinTokenId = createObservable("");
  // Holder-side transfer (gift) of a ticket pass to another wallet.
  const transferTokenId = createObservable("");
  const transferRecipient = createObservable("");

  const isLoading = createObservable(false);
  const isRefreshing = createObservable(false);
  const isRefreshingTickets = createObservable(false);
  const isCreating = createObservable(false);
  const isIssuing = createObservable(false);
  const isCheckingIn = createObservable(false);
  const isLookingUp = createObservable(false);
  const isTransferring = createObservable(false);
  const transferringTokenId = createObservable<string | null>(null);
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
  const canTransferTicket = createDerived(
    () =>
      Boolean(transferTokenId.get().trim()) &&
      Boolean(transferRecipient.get().trim()),
    [transferTokenId, transferRecipient],
  );

  function applyEventDraftInput(input?: unknown) {
    const payload = asRecord(input);
    if (!payload) return;
    if (payload.eventName !== undefined) eventName.set(stringValue(payload.eventName));
    if (payload.eventVenue !== undefined) eventVenue.set(stringValue(payload.eventVenue));
    if (payload.eventStart !== undefined) eventStart.set(stringValue(payload.eventStart));
    if (payload.eventEnd !== undefined) eventEnd.set(stringValue(payload.eventEnd));
    if (payload.maxSupply !== undefined) maxSupply.set(stringValue(payload.maxSupply));
    if (payload.notes !== undefined) notes.set(stringValue(payload.notes));
  }

  function applyIssueDraftInput(input?: unknown) {
    const payload = asRecord(input);
    if (!payload) return;
    const eventId = stringValue(payload.eventId);
    if (eventId) selectedEventId.set(eventId);
    if (payload.recipient !== undefined) issueRecipient.set(stringValue(payload.recipient));
    if (payload.seat !== undefined) issueSeat.set(stringValue(payload.seat));
    if (payload.memo !== undefined) issueMemo.set(stringValue(payload.memo));
  }

  function applyCheckinDraftInput(input?: unknown) {
    const payload = asRecord(input);
    if (!payload) return;
    if (payload.tokenId !== undefined) checkinTokenId.set(stringValue(payload.tokenId));
  }

  function currentAddress(): string {
    return address.get() || stringValue(app.chain.address.get());
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
    const wallet = await app.chain.ensureWallet();
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
    const raw = await app.chain.readRaw("getCreatorEvents", [
      app.chain.arg.hash160(creatorHash),
      app.chain.arg.integer(0),
      app.chain.arg.integer(50),
    ]);
    const list = Array.isArray(raw) ? raw : [];
    return list
      .map((value) => Number.parseInt(stringValue(value), 10))
      .filter((value) => Number.isFinite(value) && value > 0)
      .map((value) => String(value));
  }

  async function loadEventDetails(eventId: string): Promise<EventItem | null> {
    const raw = await app.chain.readRaw("getEventDetails", [
      app.chain.arg.integer(eventId),
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

  /**
   * Token ids a wallet HOLDS, reconstructed without the NEP-11 iterator.
   *
   * tokensOf(owner) returns a session iterator (InteropInterface) and the public
   * RPC has iterator traversal disabled, so it can never be enumerated from the
   * browser — the old read returned [] for every attendee. Token ids are minted
   * deterministically as "<eventId>-<serial>" with serial 1..minted, so the
   * holdings can be reconstructed: walk every event's minted serials, build the
   * token id, and keep the ones ownerOf resolves to this wallet (single-item
   * reads, no iterator). An attendee may hold tickets for events they did not
   * create, so the scan covers all events (totalEvents), not just the creator's.
   */
  async function loadOwnedTokenIds(ownerHash: string): Promise<string[]> {
    // Short-circuit: an attendee with no ticket balance holds nothing to scan.
    const rawBalance = await app.chain.readRaw("balanceOf", [
      app.chain.arg.hash160(ownerHash),
    ]);
    const balance = Number(parseBigInt(rawBalance));
    if (!Number.isFinite(balance) || balance <= 0) return [];

    const totalEvents = Number(parseBigInt(await app.chain.readRaw("totalEvents")));
    const eventCount = Number.isFinite(totalEvents)
      ? Math.min(totalEvents, EVENT_SCAN_LIMIT)
      : 0;
    if (eventCount <= 0) return [];

    const eventIds = Array.from({ length: eventCount }, (_v, i) => i + 1);
    const mintedCounts = await Promise.all(
      eventIds.map(async (eventId) => {
        const record = asRecord(
          await app.chain
            .readRaw("getEventDetails", [app.chain.arg.integer(eventId)])
            .catch(() => null),
        );
        const minted = record ? Number(parseBigInt(record.minted)) : 0;
        return { eventId, minted: Number.isFinite(minted) ? minted : 0 };
      }),
    );

    const candidateTokenIds: string[] = [];
    for (const { eventId, minted } of mintedCounts) {
      for (let serial = 1; serial <= minted; serial += 1) {
        candidateTokenIds.push(`${eventId}-${serial}`);
        if (candidateTokenIds.length >= TICKET_SCAN_LIMIT) break;
      }
      if (candidateTokenIds.length >= TICKET_SCAN_LIMIT) break;
    }

    const ownedTokenIds: string[] = [];
    for (const tokenId of candidateTokenIds) {
      const rawOwner = await app.chain
        .readRaw("ownerOf", [app.chain.arg.byteArray(encodeTokenId(tokenId))])
        .catch(() => null);
      if (parseHash160(rawOwner) === ownerHash) {
        ownedTokenIds.push(tokenId);
        if (ownedTokenIds.length >= balance) break;
      }
    }
    return ownedTokenIds;
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
      const tokenIds = await loadOwnedTokenIds(ownerHash);
      if (tokenIds.length === 0) {
        tickets.set([]);
        workflowStatus.set(t("ticketsLoaded"));
        return tickets.get();
      }
      // Best-effort per-token detail reads: one unreadable ticket must not abort
      // the whole list, so settle every promise and keep the resolvable ones.
      const settled = await Promise.allSettled(
        tokenIds.map((tokenId) =>
          app.chain.readRaw("getTicketDetails", [
            app.chain.arg.byteArray(encodeTokenId(tokenId)),
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

  async function createEvent(input?: unknown) {
    if (isCreating.get()) return null;
    applyEventDraftInput(input);
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
      const result = await app.chain.invoke(
        "createEvent",
        [
          // creator is a raw Neo address; the chain layer resolves it to a
          // script hash, so keep it as-is (arg.hash160 would pre-convert it).
          { type: "Hash160", value: creator },
          app.chain.arg.string(name),
          app.chain.arg.string(venue),
          app.chain.arg.integer(startTime),
          app.chain.arg.integer(endTime),
          app.chain.arg.integer(supply.toString()),
          app.chain.arg.string(clean(notes.get())),
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

  async function issueTicket(input?: unknown) {
    if (isIssuing.get()) return null;
    applyIssueDraftInput(input);
    const eventId = selectedEventId.get();
    const derivedEvent = selectedEvent.get();
    const event =
      derivedEvent && (!eventId || derivedEvent.id === eventId)
        ? derivedEvent
        : events.get().find((item) => item.id === eventId) ?? null;
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
      const result = await app.chain.invoke(
        "issueTicket",
        [
          // organizer / recipient are raw Neo addresses resolved by the chain
          // layer; keep them as-is (arg.hash160 would pre-convert them).
          { type: "Hash160", value: organizer },
          { type: "Hash160", value: recipient },
          app.chain.arg.integer(event.id),
          app.chain.arg.string(seat),
          app.chain.arg.string(memo),
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
      const result = await app.chain.invoke(
        "setEventActive",
        [
          // creator is a raw Neo address resolved by the chain layer; keep as-is.
          { type: "Hash160", value: creator },
          app.chain.arg.integer(next.id),
          app.chain.arg.boolean(next.active),
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

  async function lookupTicket(input?: unknown) {
    if (isLookingUp.get()) return lookup.get();
    applyCheckinDraftInput(input);
    const tokenId = clean(checkinTokenId.get());
    if (!tokenId) throw new Error(t("invalidTokenId"));
    isLookingUp.set(true);
    lastError.set("");
    try {
      const raw = await app.chain.readRaw("getTicketDetails", [
        app.chain.arg.byteArray(encodeTokenId(tokenId)),
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

  async function checkInTicket(input?: unknown) {
    if (isCheckingIn.get()) return null;
    applyCheckinDraftInput(input);
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
        cached && cached.tokenId === tokenId ? cached : await lookupTicket({ tokenId });
      if (!ticket) throw new Error(t("ticketNotFound"));
      if (ticket.used) throw new Error(t("ticketAlreadyUsed"));
      const request = {
        kind: "ticket_checkin",
        method: "checkIn",
        creator,
        tokenId: ticket.tokenId,
      };
      latestRequest.set(request);
      const result = await app.chain.invoke(
        "checkIn",
        [
          // creator is a raw Neo address resolved by the chain layer; keep as-is.
          { type: "Hash160", value: creator },
          app.chain.arg.byteArray(encodeTokenId(ticket.tokenId)),
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

  /**
   * Transfer (gift) a ticket pass to another wallet via the standard NEP-11
   * transfer(to, tokenId, data). The contract resolves `from` from the token and
   * checks the current owner's witness, so the connected wallet must hold the
   * ticket; used tickets are rejected on-chain (and guarded here for a localized
   * message). `data` is left null — the recipient's onNEP11Payment hook gets it.
   */
  async function transferTicket(input?: { tokenId?: string; recipient?: string }) {
    if (isTransferring.get()) return null;
    const tokenId = clean(input?.tokenId ?? transferTokenId.get());
    const recipient = clean(input?.recipient ?? transferRecipient.get());
    if (!tokenId) throw new Error(t("invalidTokenId"));
    if (!recipient || !addressToScriptHash(recipient)) {
      throw new Error(t("invalidRecipient"));
    }
    const held = tickets.get().find((item) => item.tokenId === tokenId);
    if (held?.used) throw new Error(t("ticketAlreadyUsed"));

    isTransferring.set(true);
    transferringTokenId.set(tokenId);
    lastError.set("");
    try {
      const holder = await ensureConnected();
      if (!holder) throw new Error(t("walletNotConnected"));
      const request = {
        kind: "ticket_transfer",
        method: "transfer",
        from: holder,
        recipient,
        tokenId,
      };
      latestRequest.set(request);
      const result = await app.chain.invoke(
        "transfer",
        [
          // recipient is a raw Neo address resolved by the chain layer; keep as-is.
          { type: "Hash160", value: recipient },
          app.chain.arg.byteArray(encodeTokenId(tokenId)),
          // NEP-11 `data` (Any) — an empty ByteArray; the recipient's
          // onNEP11Payment hook receives it. No app-level payload is needed.
          app.chain.arg.byteArray(""),
        ],
        { waitForEvent: "Transfer" },
      );
      latestResult.set({
        kind: "ticket_transferred",
        txid: txidFrom(result),
        tokenId,
        recipient,
      });
      // The ticket left this wallet — drop it from the holder's list optimistically.
      tickets.set(tickets.get().filter((item) => item.tokenId !== tokenId));
      transferTokenId.set("");
      transferRecipient.set("");
      workflowStatus.set(t("transferSuccess"));
      eventBus.emit("event-ticket:transferred", { tokenId, recipient });
      await refreshTickets({ quiet: true });
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : t("contractMissing");
      lastError.set(message);
      workflowStatus.set(message);
      throw error;
    } finally {
      isTransferring.set(false);
      transferringTokenId.set(null);
    }
  }

  function startTransfer(ticket: unknown) {
    const item = ticket as TicketItem;
    if (!item?.tokenId) return;
    transferTokenId.set(item.tokenId);
    transferRecipient.set("");
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
    transferTokenId,
    transferRecipient,
    isLoading,
    isRefreshing,
    isRefreshingTickets,
    isCreating,
    isIssuing,
    isCheckingIn,
    isLookingUp,
    isTransferring,
    transferringTokenId,
    togglingId,
    eventsCount,
    ticketsCount,
    activeEventsCount,
    canIssueTicket,
    canCheckInTicket,
    canTransferTicket,
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
    transferTicket,
    startTransfer,
    loadAll,
  };
}

export type UseEventTicketReturn = ReturnType<typeof useEventTicket>;
