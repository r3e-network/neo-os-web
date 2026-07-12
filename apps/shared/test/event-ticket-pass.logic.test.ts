import { describe, expect, it, vi } from "vitest";

import { createMiniAppFramework } from "../react";
import { createObservable } from "../react/context";
import { addressToScriptHash } from "../utils/neo";
import { useEventTicket } from "../../event-ticket-pass/src/composables/useEventTicket";
import type { ChainLike } from "../../event-ticket-pass/src/composables/useEventTicket";
import type { EventTicketTransactionOutcome } from "../../event-ticket-pass/src/event-ticket-rpc";
import {
  createEventTicketOperationStore,
  createPendingEventTicketOperation,
} from "../../event-ticket-pass/src/event-ticket-operation-store";

const OWNER = "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs";
const OWNER_HASH = addressToScriptHash(OWNER);
const TOKEN_ID = "1-1";
const TXID_CREATE = `0x${"1".repeat(64)}`;
const TXID_ISSUE = `0x${"2".repeat(64)}`;
const TXID_CHECKIN = `0x${"3".repeat(64)}`;
const TXID_TOGGLE = `0x${"4".repeat(64)}`;
const TXID_TRANSFER = `0x${"5".repeat(64)}`;
const TXID_PENDING_CREATE = `0x${"6".repeat(64)}`;
const TXID_CHECKIN_STALE = `0x${"7".repeat(64)}`;
const TXID_WRONG_TRANSFER = `0x${"8".repeat(64)}`;

/**
 * The little-endian "0x<hex>" form a ByteString Hash160 arrives as over RPC
 * (ownerOf parses to this). parseHash160 reverses it back to the big-endian
 * display hash, so the My Tickets scan can match ticket owners.
 */
function toLittleEndianHash(displayHash: string): string {
  const hex = displayHash.replace(/^0x/, "");
  const reversed = (hex.match(/.{2}/g) ?? []).reverse().join("");
  return `0x${reversed}`;
}

function ownerHash(value: unknown): string {
  const raw = String(value ?? "").trim();
  return /^0x[0-9a-f]{40}$/i.test(raw) ? raw.toLowerCase() : addressToScriptHash(raw);
}

function t(key: string) {
  const messages: Record<string, string> = {
    ready: "Ready",
    venueFallback: "Venue TBD",
    seatFallback: "General",
    walletConnected: "Wallet connected",
    eventsLoaded: "Events loaded",
    ticketsLoaded: "Tickets loaded",
    eventCreated: "Event created",
    ticketIssued: "Ticket issued",
    ticketFound: "Ticket found",
    checkinSuccess: "Ticket checked in",
    eventSelected: "Event selected",
    statusActive: "Active",
    statusInactive: "Inactive",
    nameRequired: "Event name is required",
    invalidTime: "Invalid event time range",
    invalidSupply: "Invalid ticket supply",
    invalidRecipient: "Recipient address required",
    invalidTokenId: "Token ID required",
    selectEventFirst: "Select an event first",
    eventInactive: "Selected event is inactive",
    soldOut: "Sold out",
    ticketNotFound: "Ticket not found",
    ticketAlreadyUsed: "Ticket is already used",
    contractMissing: "Contract address not configured",
    loadFailed: "Failed to load ticket data",
    walletNotConnected: "Wallet not connected",
    transferSuccess: "Ticket transferred",
  };
  return messages[key] ?? key;
}

interface ChainState {
  /** Latest event data the read fakes should return for getEventDetails. */
  event: Record<string, unknown> | null;
  /** Latest ticket data the read fakes should return for getTicketDetails. */
  ticket: Record<string, unknown> | null;
}

function setup(
  initial?: Partial<ChainState>,
  options: {
    transactionOutcomeReader?: () => Promise<EventTicketTransactionOutcome>;
  } = {},
) {
  const chainState: ChainState = {
    event: null,
    ticket: null,
    ...initial,
  };

  const invoke = vi.fn(async (
    operation: string,
    args: unknown[],
    options?: { onTransactionSent?: (txid: string) => void },
  ) => {
    const arg = (index: number) => String((args[index] as { value?: unknown } | undefined)?.value ?? "");
    const txid = {
      createEvent: TXID_CREATE,
      issueTicket: TXID_ISSUE,
      checkIn: TXID_CHECKIN,
      setEventActive: TXID_TOGGLE,
      transfer: TXID_TRANSFER,
    }[operation] ?? `0x${"f".repeat(64)}`;
    options?.onTransactionSent?.(txid);
    switch (operation) {
      case "createEvent":
        // EventCreated(eventId, creator, name)
        chainState.event = {
          id: "1",
          creator: OWNER_HASH,
          name: arg(1),
          venue: arg(2),
          startTime: arg(3),
          endTime: arg(4),
          maxSupply: arg(5),
          minted: "0",
          notes: arg(6),
          active: true,
        };
        return { txid: TXID_CREATE, success: true, verified: true, event: { state: [{ value: "1" }, { value: OWNER_HASH }, { value: arg(1) }] } };
      case "issueTicket":
        // TicketIssued(tokenId, eventId, owner)
        chainState.ticket = {
          tokenId: TOKEN_ID,
          eventId: arg(2),
          owner: arg(1),
          eventName: String(chainState.event?.name ?? ""),
          venue: String(chainState.event?.venue ?? ""),
          startTime: String(chainState.event?.startTime ?? "0"),
          endTime: String(chainState.event?.endTime ?? "0"),
          seat: arg(3),
          memo: arg(4),
          issuedTime: "1781500000",
          used: false,
          usedTime: "0",
          active: true,
        };
        if (chainState.event) chainState.event.minted = "1";
        return { txid: TXID_ISSUE, success: true, verified: true, event: { state: [{ value: btoa(TOKEN_ID) }, { value: arg(2) }, { value: arg(1) }] } };
      case "checkIn":
        if (chainState.ticket) {
          chainState.ticket.used = true;
          chainState.ticket.usedTime = "1781510000";
        }
        return { txid: TXID_CHECKIN, success: true, verified: true, event: { state: [{ value: btoa(TOKEN_ID) }, { value: "1" }, { value: OWNER_HASH }] } };
      case "setEventActive":
        if (chainState.event) chainState.event.active = !chainState.event.active;
        return { txid: TXID_TOGGLE, success: true, verified: true, event: { state: [{ value: "1" }] } };
      case "transfer":
        // NEP-11 Transfer(from, to, amount, tokenId)
        if (chainState.ticket) {
          chainState.ticket.transferred = true;
          chainState.ticket.owner = arg(0);
        }
        return {
          txid: TXID_TRANSFER,
          success: true,
          verified: true,
          event: { state: [{ value: OWNER_HASH }, { value: arg(0) }, { value: "1" }, { value: btoa(TOKEN_ID) }] },
        };
      default:
        return { txid: `0x${operation}`, success: true, verified: true };
    }
  });

  const read = vi.fn(async (operation: string, _args: unknown[] = []) => {
    switch (operation) {
      case "symbol":
        return "TICKET";
      case "decimals":
        return "0";
      case "getCreatorEvents":
        return chainState.event ? [chainState.event.id] : [];
      case "getEventDetails":
        return chainState.event ?? {};
      case "totalEvents":
        return chainState.event ? "1" : "0";
      case "balanceOf":
        // Reconstruction short-circuit: the holder's ticket count.
        return chainState.ticket &&
          ownerHash(chainState.ticket.owner) === OWNER_HASH
          ? 1
          : 0;
      case "ownerOf":
        // Single-item owner read (no iterator). The minted ticket belongs to
        // OWNER until transferred away.
        return chainState.ticket
          ? toLittleEndianHash(ownerHash(chainState.ticket.owner))
          : null;
      case "tokensOf":
        // The real node returns an un-traversable iterator here; the composable
        // must NOT depend on it.
        return { type: "InteropInterface", interface: "IIterator" };
      case "getTicketDetails":
        return chainState.ticket ?? {};
      default:
        return null;
    }
  });

  const chain = {
    address: createObservable<string | null>(OWNER),
    contractAddress: createObservable<string | null>("0x90bad472146aab97de71498e8d736c3124e7c82b"),
    ensureWallet: vi.fn(async () => OWNER),
    detectNetwork: vi.fn(async () => "neo-n3-testnet"),
    waitForEvent: vi.fn(async () => null),
    invoke,
    read,
  } as unknown as ChainLike & {
    invoke: typeof invoke;
    read: typeof read;
    ensureWallet: ReturnType<typeof vi.fn>;
  };

  const bus = { emit: vi.fn() };

  const app = createMiniAppFramework(
    { services: { chain }, t } as never,
    { appId: "miniapp-event-ticket-pass" },
  );
  const stored = new Map<string, unknown>();
  const operationStorage = {
    get<T>(key: string, fallback?: T | null) {
      return (stored.has(key) ? stored.get(key) : (fallback ?? null)) as T | null;
    },
    set(key: string, value: unknown) {
      stored.set(key, value);
    },
    delete(key: string) {
      stored.delete(key);
    },
  };
  const ticket = useEventTicket({
    app,
    bus,
    t,
    operationStorage,
    attestContract: async (_network, contract) => ({
      compatible: true,
      network: "testnet",
      contract: String(contract),
      checksum: 2_976_433_161,
      reason: "ok",
    }),
    ...(options.transactionOutcomeReader
      ? { transactionOutcomeReader: options.transactionOutcomeReader }
      : {}),
  });
  ticket.address.set(OWNER);

  return { ticket, chain, invoke, read, bus, chainState, app, operationStorage, stored };
}

describe("useEventTicket (chain wiring)", () => {
  it("serializes all write modes before opening a second wallet request", async () => {
    const existingEvent = {
      id: "1",
      creator: OWNER_HASH,
      name: "Existing event",
      venue: "Neo Hall",
      startTime: 1787216400,
      endTime: 1787248800,
      maxSupply: "100",
      minted: "0",
      notes: "",
      active: true,
    };
    const { ticket, invoke } = setup({ event: existingEvent });

    const creating = ticket.createEvent();
    await expect(ticket.toggleEvent(existingEvent)).rejects.toThrow("operationInProgress");
    await creating;

    expect(invoke.mock.calls.filter(([operation]) => operation === "createEvent")).toHaveLength(1);
    expect(invoke.mock.calls.some(([operation]) => operation === "setEventActive")).toBe(false);
  });

  it("creates an event, issues a ticket, looks it up, and checks it in on-chain", async () => {
    const { ticket, invoke } = setup();

    const event = await ticket.createEvent();
    expect(event?.name).toBe("Neo Builder Summit");
    expect(invoke).toHaveBeenCalledWith(
      "createEvent",
      [
        { type: "Hash160", value: OWNER_HASH },
        { type: "String", value: "Neo Builder Summit" },
        { type: "String", value: "Neo Community Hall" },
        { type: "Integer", value: expect.any(String) },
        { type: "Integer", value: expect.any(String) },
        { type: "Integer", value: "120" },
        { type: "String", value: expect.any(String) },
      ],
      expect.objectContaining({ waitForEvent: "EventCreated", onTransactionSent: expect.any(Function) }),
    );
    expect(ticket.eventsCount.get()).toBe(1);
    expect(ticket.selectedEventId.get()).toBe("1");

    ticket.issueRecipient.set(OWNER);
    const issued = await ticket.issueTicket();
    expect(issued?.tokenId).toBe(TOKEN_ID);
    expect(issued?.owner).toBe(OWNER_HASH);
    expect(invoke).toHaveBeenCalledWith(
      "issueTicket",
      [
        { type: "Hash160", value: OWNER_HASH },
        { type: "Hash160", value: OWNER_HASH },
        { type: "Integer", value: "1" },
        { type: "String", value: "General" },
        { type: "String", value: "Standard admission" },
      ],
      expect.objectContaining({ waitForEvent: "TicketIssued", onTransactionSent: expect.any(Function) }),
    );
    expect(ticket.ticketsCount.get()).toBe(1);
    // The contract's minted count is reflected back into the selected event.
    expect(ticket.selectedEvent.get()?.minted).toBe(1n);

    ticket.checkinTokenId.set(TOKEN_ID);
    const found = await ticket.lookupTicket();
    expect(found?.used).toBe(false);

    const checkedIn = await ticket.checkInTicket();
    expect(checkedIn?.used).toBe(true);
    expect(ticket.lookup.get()?.used).toBe(true);
    expect(invoke).toHaveBeenCalledWith(
      "checkIn",
      [
        { type: "Hash160", value: OWNER_HASH },
        { type: "ByteArray", value: expect.any(String) },
      ],
      expect.objectContaining({ waitForEvent: "TicketCheckedIn", onTransactionSent: expect.any(Function) }),
    );
  });

  it("honors action payloads before validating and invoking contract operations", async () => {
    const { ticket, invoke } = setup();

    await ticket.createEvent({
      eventName: "Payload Workshop",
      eventVenue: "Gate Studio",
      eventStart: "2026-08-21 13:00",
      eventEnd: "2026-08-21 17:00",
      maxSupply: "80",
      notes: "Reserved pass payload.",
    });

    expect(ticket.eventName.get()).toBe("Payload Workshop");
    expect(ticket.eventVenue.get()).toBe("Gate Studio");
    expect(invoke).toHaveBeenCalledWith(
      "createEvent",
      [
        { type: "Hash160", value: OWNER_HASH },
        { type: "String", value: "Payload Workshop" },
        { type: "String", value: "Gate Studio" },
        { type: "Integer", value: expect.any(String) },
        { type: "Integer", value: expect.any(String) },
        { type: "Integer", value: "80" },
        { type: "String", value: "Reserved pass payload." },
      ],
      expect.objectContaining({ waitForEvent: "EventCreated", onTransactionSent: expect.any(Function) }),
    );

    await ticket.issueTicket({
      eventId: "1",
      recipient: OWNER,
      seat: "VIP",
      memo: "Door one",
    });

    expect(ticket.selectedEventId.get()).toBe("1");
    expect(ticket.issueSeat.get()).toBe("VIP");
    expect(invoke).toHaveBeenCalledWith(
      "issueTicket",
      [
        { type: "Hash160", value: OWNER_HASH },
        { type: "Hash160", value: OWNER_HASH },
        { type: "Integer", value: "1" },
        { type: "String", value: "VIP" },
        { type: "String", value: "Door one" },
      ],
      expect.objectContaining({ waitForEvent: "TicketIssued", onTransactionSent: expect.any(Function) }),
    );

    await ticket.lookupTicket({ tokenId: TOKEN_ID });
    expect(ticket.checkinTokenId.get()).toBe(TOKEN_ID);

    await ticket.checkInTicket({ tokenId: TOKEN_ID });
    expect(invoke).toHaveBeenCalledWith(
      "checkIn",
      [
        { type: "Hash160", value: OWNER_HASH },
        { type: "ByteArray", value: expect.any(String) },
      ],
      expect.objectContaining({ waitForEvent: "TicketCheckedIn", onTransactionSent: expect.any(Function) }),
    );
  });

  it("rejects ticket issuance until an event and valid recipient are present", async () => {
    const { ticket } = setup();

    await expect(ticket.issueTicket()).rejects.toThrow("Select an event first");

    await ticket.createEvent();
    ticket.issueRecipient.set("not-a-neo-address");
    await expect(ticket.issueTicket()).rejects.toThrow("Recipient address required");
  });

  it("rejects a zero-duration event before opening the wallet transaction", async () => {
    const { ticket, invoke } = setup();
    ticket.eventEnd.set(ticket.eventStart.get());

    await expect(ticket.createEvent()).rejects.toThrow("Invalid event time range");
    expect(invoke).not.toHaveBeenCalled();
  });

  it("toggles an event active state through setEventActive", async () => {
    const { ticket, invoke } = setup();

    const event = await ticket.createEvent();
    expect(event?.active).toBe(true);

    const toggled = await ticket.toggleEvent(ticket.selectedEvent.get());
    expect(toggled?.active).toBe(false);
    expect(invoke).toHaveBeenCalledWith(
      "setEventActive",
      [
        { type: "Hash160", value: OWNER_HASH },
        { type: "Integer", value: "1" },
        { type: "Boolean", value: false },
      ],
      expect.objectContaining({ waitForEvent: "EventUpdated", onTransactionSent: expect.any(Function) }),
    );
  });

  it("surfaces a not-found error when checking in an unknown token", async () => {
    const { ticket } = setup();
    ticket.checkinTokenId.set("999-1");
    await expect(ticket.lookupTicket()).rejects.toThrow("Ticket not found");
  });

  it("reconstructs My Tickets without the tokensOf iterator", async () => {
    const { ticket, read } = setup();
    await ticket.createEvent();
    ticket.issueRecipient.set(OWNER);
    await ticket.issueTicket();

    // Re-read holdings from chain (clears the optimistic merge first).
    ticket.tickets.set([]);
    await ticket.refreshTickets();

    // The iterator read must never be the source of truth for the list.
    expect(read).not.toHaveBeenCalledWith("tokensOf", expect.anything());
    expect(ticket.ticketsCount.get()).toBe(1);
    expect(ticket.tickets.get()[0]?.tokenId).toBe(TOKEN_ID);
  });

  it("loads verified public event discovery before prompting for a wallet", async () => {
    const { chain, chainState, app, bus, operationStorage, invoke } = setup();
    chain.address.set(null);
    chainState.event = {
      id: "1",
      creator: OWNER_HASH,
      name: "Community Night",
      venue: "Neo Community Hall",
      startTime: 1787216400,
      endTime: 1787248800,
      maxSupply: "120",
      minted: "4",
      notes: "Invitation passes",
      active: true,
    };
    const publicTicket = useEventTicket({
      app,
      bus,
      t,
      operationStorage,
      launchNetwork: "testnet",
      attestContract: async (_network, contract) => ({
        compatible: true,
        network: "testnet",
        contract: String(contract),
        checksum: 2_976_433_161,
        reason: "ok",
      }),
    });

    await publicTicket.loadAll();

    expect(publicTicket.address.get()).toBe("");
    expect(publicTicket.runtimeStatus.get()).toBe("ready");
    expect(publicTicket.discoveredEvents.get()).toHaveLength(1);
    expect(publicTicket.discoveredEvents.get()[0]?.name).toBe("Community Night");
    expect(invoke).not.toHaveBeenCalled();
  });

  it("transfers a held ticket via the standard NEP-11 transfer(to, tokenId, data)", async () => {
    const { ticket, invoke } = setup();
    await ticket.createEvent();
    ticket.issueRecipient.set(OWNER);
    await ticket.issueTicket();
    expect(ticket.ticketsCount.get()).toBe(1);

    const recipient = "NUVPACMnKFhpuHjsRjhUvXz1XhqfGZYVtY";
    await ticket.transferTicket({ tokenId: TOKEN_ID, recipient });

    expect(invoke).toHaveBeenCalledWith(
      "transfer",
      [
        { type: "Hash160", value: addressToScriptHash(recipient) },
        { type: "ByteArray", value: expect.any(String) },
        { type: "ByteArray", value: "" },
      ],
      expect.objectContaining({ waitForEvent: "Transfer", onTransactionSent: expect.any(Function) }),
    );
    // The ticket leaves this wallet — optimistically removed, and the chain
    // re-read (balanceOf now 0) keeps the list empty.
    expect(ticket.ticketsCount.get()).toBe(0);
  });

  it("rejects a transfer to an invalid recipient", async () => {
    const { ticket } = setup();
    await ticket.createEvent();
    ticket.issueRecipient.set(OWNER);
    await ticket.issueTicket();

    await expect(
      ticket.transferTicket({ tokenId: TOKEN_ID, recipient: "not-an-address" }),
    ).rejects.toThrow("Recipient address required");
  });

  it("does not report or materialize an event when confirmation is unverified", async () => {
    const { ticket, invoke, bus } = setup();
    invoke.mockResolvedValueOnce({
      txid: TXID_PENDING_CREATE,
      success: true,
      verified: false,
      event: null,
    });

    await expect(ticket.createEvent()).rejects.toThrow("transactionUnverified");

    expect(ticket.events.get()).toEqual([]);
    expect(ticket.latestResult.get()).toEqual(
      expect.objectContaining({
        kind: "event_create_pending_confirmation",
        txid: TXID_PENDING_CREATE,
        verified: false,
      }),
    );
    expect(bus.emit).not.toHaveBeenCalledWith(
      "event-ticket:eventCreated",
      expect.anything(),
    );
  });

  it("journals the exact broadcast and recovers it after an event-indexing delay", async () => {
    const { ticket, invoke, chain, chainState, stored } = setup();
    invoke.mockImplementationOnce(async (_operation, _args, options) => {
      options?.onTransactionSent?.(TXID_PENDING_CREATE);
      return {
        txid: TXID_PENDING_CREATE,
        success: true,
        verified: false,
        event: null,
      };
    });

    await expect(ticket.createEvent()).rejects.toThrow("transactionUnverified");
    const pending = ticket.pendingOperation.get();
    expect(pending).toMatchObject({
      phase: "event_create",
      txid: TXID_PENDING_CREATE,
      eventName: "EventCreated",
      account: OWNER.toLowerCase(),
      network: "testnet",
      notes: "Workshop pass, badge pickup, and live check-in.",
    });
    expect(stored.size).toBe(1);

    chainState.event = {
      id: "1",
      creator: OWNER_HASH,
      name: pending?.name,
      venue: pending?.venue,
      startTime: pending?.startTime,
      endTime: pending?.endTime,
      maxSupply: pending?.maxSupply,
      minted: "0",
      notes: "Different recovery notes",
      active: true,
    };
    chain.waitForEvent.mockResolvedValue({
      state: [
        { value: "1" },
        { value: OWNER_HASH },
        { value: pending?.name },
      ],
    });

    await expect(ticket.recoverPending()).rejects.toThrow("pendingStillConfirming");
    expect(ticket.pendingOperation.get()?.txid).toBe(TXID_PENDING_CREATE);

    chainState.event.notes = pending?.notes;
    await expect(ticket.recoverPending()).resolves.toBeNull();
    expect(ticket.pendingOperation.get()).toBeNull();
    expect(ticket.events.get()[0]?.id).toBe("1");
    expect(ticket.latestResult.get()).toMatchObject({
      kind: "event_create_recovered",
      txid: TXID_PENDING_CREATE,
      verified: true,
    });
    expect(stored.size).toBe(0);
  });

  it("fails closed before signing when the wallet network is ambiguous", async () => {
    const { ticket, chain, invoke } = setup();
    chain.detectNetwork.mockResolvedValueOnce("neo-n3");

    await expect(ticket.createEvent()).rejects.toThrow("runtimeNetworkUnknown");
    expect(invoke).not.toHaveBeenCalled();
    expect(ticket.runtimeStatus.get()).toBe("unavailable");
  });

  it("keeps an issued-to-other-wallet pass out of the organizer inventory", async () => {
    const { ticket } = setup();
    await ticket.createEvent();
    const recipient = "NUVPACMnKFhpuHjsRjhUvXz1XhqfGZYVtY";

    const issued = await ticket.issueTicket({
      eventId: "1",
      recipient,
      seat: "VIP",
      memo: "Guest pass",
    });

    expect(issued?.owner).toBe(addressToScriptHash(recipient));
    expect(ticket.tickets.get()).toEqual([]);
    expect(ticket.latestResult.get()).toEqual(
      expect.objectContaining({ kind: "ticket_issued", verified: true }),
    );
  });

  it("does not mark a pass used when check-in readback remains unused", async () => {
    const { ticket, invoke } = setup();
    await ticket.createEvent();
    ticket.issueRecipient.set(OWNER);
    await ticket.issueTicket();
    ticket.checkinTokenId.set(TOKEN_ID);
    await ticket.lookupTicket();

    invoke.mockResolvedValueOnce({
      txid: TXID_CHECKIN_STALE,
      success: true,
      verified: true,
      event: {
        state: [
          { value: btoa(TOKEN_ID) },
          { value: "1" },
          { value: OWNER_HASH },
        ],
      },
    });

    await expect(ticket.checkInTicket()).rejects.toThrow(
      "transactionUnverified",
    );
    expect(ticket.lookup.get()?.used).toBe(false);
    expect(ticket.tickets.get()[0]?.used).toBe(false);
  });

  it("keeps a held pass when the transfer event does not match the recipient", async () => {
    const { ticket, invoke } = setup();
    await ticket.createEvent();
    ticket.issueRecipient.set(OWNER);
    await ticket.issueTicket();
    const recipient = "NUVPACMnKFhpuHjsRjhUvXz1XhqfGZYVtY";

    invoke.mockResolvedValueOnce({
      txid: TXID_WRONG_TRANSFER,
      success: true,
      verified: true,
      event: {
        state: [
          { value: OWNER_HASH },
          { value: OWNER_HASH },
          { value: "1" },
          { value: btoa(TOKEN_ID) },
        ],
      },
    });

    await expect(
      ticket.transferTicket({ tokenId: TOKEN_ID, recipient }),
    ).rejects.toThrow("transactionUnverified");
    expect(ticket.tickets.get().map((item) => item.tokenId)).toEqual([TOKEN_ID]);
  });

  it("invalidates an in-flight organizer read when the wallet disconnects", async () => {
    const staleEvent = {
      id: "1",
      creator: OWNER_HASH,
      name: "Old wallet event",
      venue: "Old hall",
      startTime: 1787216400,
      endTime: 1787248800,
      maxSupply: "100",
      minted: "0",
      notes: "",
      active: true,
    };
    const { ticket, chain, read } = setup({ event: staleEvent });
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    read.mockImplementation(async (operation: string) => {
      if (operation === "symbol") return "TICKET";
      if (operation === "decimals") return "0";
      if (operation === "getCreatorEvents") return ["1"];
      if (operation === "getEventDetails") {
        await gate;
        return staleEvent;
      }
      return null;
    });

    const loading = ticket.refreshEvents();
    await vi.waitFor(() =>
      expect(read.mock.calls.some(([operation]) => operation === "getEventDetails")).toBe(true),
    );
    chain.address.set(null);
    release();
    await loading;

    expect(ticket.address.get()).toBe("");
    expect(ticket.events.get()).toEqual([]);
    expect(ticket.tickets.get()).toEqual([]);
    expect(ticket.lookup.get()).toBeNull();
  });

  it("preserves the last verified event snapshot when any expected detail read fails", async () => {
    const event = {
      id: "1",
      creator: OWNER_HASH,
      name: "Reliable event",
      venue: "Neo Hall",
      startTime: 1787216400,
      endTime: 1787248800,
      maxSupply: "100",
      minted: "0",
      notes: "",
      active: true,
    };
    const { ticket, read } = setup({ event });
    await ticket.refreshEvents();
    expect(ticket.events.get()[0]?.name).toBe("Reliable event");

    read.mockResolvedValueOnce(["1"]);
    read.mockRejectedValueOnce(new Error("RPC detail unavailable"));
    await expect(ticket.refreshEvents()).rejects.toThrow("RPC detail unavailable");

    expect(ticket.events.get()).toHaveLength(1);
    expect(ticket.events.get()[0]?.name).toBe("Reliable event");
  });

  it("loads an organizer gate queue without confusing it with holder inventory", async () => {
    const event = {
      id: "1",
      creator: OWNER_HASH,
      name: "Gate event",
      venue: "Neo Hall",
      startTime: 1787216400,
      endTime: 1787248800,
      maxSupply: "100",
      minted: "2",
      notes: "",
      active: true,
    };
    const { ticket, read } = setup({ event });
    const baseRead = read.getMockImplementation()!;
    read.mockImplementation(async (operation: string, args: unknown[] = []) => {
      if (operation !== "getTicketDetails") return baseRead(operation, args);
      const encoded = String((args[0] as { value?: unknown } | undefined)?.value ?? "");
      const tokenId = atob(encoded);
      return {
        tokenId,
        eventId: "1",
        owner: tokenId === "1-1" ? OWNER : "NUVPACMnKFhpuHjsRjhUvXz1XhqfGZYVtY",
        eventName: "Gate event",
        venue: "Neo Hall",
        startTime: "1787216400",
        endTime: "1787248800",
        seat: tokenId === "1-1" ? "VIP" : "General",
        memo: "",
        issuedTime: tokenId === "1-1" ? "10" : "20",
        used: tokenId === "1-1",
        usedTime: tokenId === "1-1" ? "30" : "0",
        active: true,
      };
    });
    ticket.selectedEventId.set("1");

    await ticket.refreshGateTickets("1");

    expect(ticket.gateTickets.get().map((item) => item.tokenId)).toEqual(["1-2", "1-1"]);
    expect(ticket.gateTicketsExpectedCount.get()).toBe(2);
    expect(ticket.gateTicketsVerification.get()).toBe("verified");
    expect(ticket.tickets.get()).toEqual([]);
  });

  it("discards a ticket lookup when the scanned token changes during the read", async () => {
    const event = {
      id: "1",
      creator: OWNER_HASH,
      name: "Gate event",
      venue: "Neo Hall",
      startTime: 1787216400,
      endTime: 1787248800,
      maxSupply: "100",
      minted: "1",
      notes: "",
      active: true,
    };
    const ticketRecord = {
      tokenId: "1-1",
      eventId: "1",
      owner: OWNER,
      eventName: "Gate event",
      venue: "Neo Hall",
      startTime: "1787216400",
      endTime: "1787248800",
      seat: "VIP",
      memo: "",
      issuedTime: "10",
      used: false,
      usedTime: "0",
      active: true,
    };
    const { ticket, read } = setup({ event, ticket: ticketRecord });
    const baseRead = read.getMockImplementation()!;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    read.mockImplementation(async (operation: string, args: unknown[] = []) => {
      if (operation !== "getTicketDetails") return baseRead(operation, args);
      await gate;
      return ticketRecord;
    });
    ticket.checkinTokenId.set("1-1");

    const loading = ticket.lookupTicket();
    await vi.waitFor(() =>
      expect(read.mock.calls.some(([operation]) => operation === "getTicketDetails")).toBe(true),
    );
    ticket.checkinTokenId.set("1-2");
    ticket.lookup.set(null);
    release();

    await expect(loading).resolves.toBeNull();
    expect(ticket.lookup.get()).toBeNull();
  });

  it("revalidates the live wallet network immediately before invoking", async () => {
    const { ticket, chain, invoke } = setup();
    chain.detectNetwork
      .mockResolvedValueOnce("neo-n3-testnet")
      .mockResolvedValueOnce("neo-n3-testnet")
      .mockResolvedValueOnce("neo-n3-mainnet");

    await expect(ticket.createEvent()).rejects.toThrow("runtimeBindingMismatch");
    expect(invoke).not.toHaveBeenCalled();
  });

  it("clears a terminally faulted saved transaction instead of leaving it pending", async () => {
    const txid = `0x${"a".repeat(64)}`;
    const transactionOutcomeReader = vi.fn(async () => ({
      state: "fault" as const,
      notifications: [],
    }));
    const { ticket, invoke, stored } = setup(undefined, {
      transactionOutcomeReader,
    });
    invoke.mockImplementationOnce(async (_operation, _args, options) => {
      options?.onTransactionSent?.(txid);
      return { txid, success: false, verified: false, event: null };
    });

    await expect(ticket.createEvent()).rejects.toThrow("transactionUnverified");
    expect(ticket.pendingOperation.get()?.txid).toBe(txid);
    await expect(ticket.recoverPending()).rejects.toThrow("transactionFaulted");

    expect(transactionOutcomeReader).toHaveBeenCalledWith(
      "testnet",
      txid,
      "0x90bad472146aab97de71498e8d736c3124e7c82b",
    );
    expect(ticket.pendingOperation.get()).toBeNull();
    expect(ticket.latestResult.get()).toMatchObject({
      kind: "event_create_failed",
      txid,
      verified: false,
    });
    expect(stored.size).toBe(0);
  });

  it("clears a terminal HALT whose expected contract event is absent", async () => {
    const txid = `0x${"c".repeat(64)}`;
    const transactionOutcomeReader = vi.fn(async () => ({
      state: "halt" as const,
      notifications: [],
    }));
    const { ticket, invoke, stored } = setup(undefined, {
      transactionOutcomeReader,
    });
    invoke.mockImplementationOnce(async (_operation, _args, options) => {
      options?.onTransactionSent?.(txid);
      return { txid, success: true, verified: false, event: null };
    });

    await expect(ticket.createEvent()).rejects.toThrow("transactionUnverified");
    await expect(ticket.recoverPending()).rejects.toThrow("pendingMismatch");

    expect(ticket.pendingOperation.get()).toBeNull();
    expect(ticket.latestResult.get()).toMatchObject({
      kind: "event_create_failed",
      txid,
      verified: false,
    });
    expect(stored.size).toBe(0);
  });

  it("refuses to claim durable recovery when the real operation cannot be read back", () => {
    const values = new Map<string, unknown>();
    const storage = {
      get<T>(key: string, fallback?: T | null) {
        if (!key.endsWith("/__probe")) return (fallback ?? null) as T | null;
        return (values.get(key) ?? fallback ?? null) as T | null;
      },
      set(key: string, value: unknown) {
        values.set(key, value);
      },
      delete(key: string) {
        values.delete(key);
      },
    };
    const scope = {
      account: OWNER,
      network: "testnet",
      contract: "0x90bad472146aab97de71498e8d736c3124e7c82b",
    };
    const store = createEventTicketOperationStore(storage);
    expect(store.canPersist(scope)).toBe(true);
    const operation = createPendingEventTicketOperation({
      ...scope,
      phase: "event_create",
      txid: `0x${"b".repeat(64)}`,
      creator: OWNER,
      name: "Durable event",
      venue: "Neo Hall",
      startTime: 1787216400,
      endTime: 1787248800,
      maxSupply: "100",
    });

    expect(() => store.set(operation)).toThrow(
      "Event Ticket recovery record could not be persisted",
    );
  });

  it("keeps a verified operation recoverable until storage deletion is read back", () => {
    const values = new Map<string, unknown>();
    let allowOperationDelete = false;
    const storage = {
      get<T>(key: string, fallback?: T | null) {
        return (values.has(key) ? values.get(key) : (fallback ?? null)) as T | null;
      },
      set(key: string, value: unknown) {
        values.set(key, value);
      },
      delete(key: string) {
        if (key.endsWith("/__probe") || allowOperationDelete) values.delete(key);
      },
    };
    const scope = {
      account: OWNER,
      network: "testnet",
      contract: "0x90bad472146aab97de71498e8d736c3124e7c82b",
    };
    const store = createEventTicketOperationStore(storage);
    const operation = createPendingEventTicketOperation({
      ...scope,
      phase: "ticket_transfer",
      txid: `0x${"d".repeat(64)}`,
      creator: OWNER,
      recipient: "NUVPACMnKFhpuHjsRjhUvXz1XhqfGZYVtY",
      tokenId: TOKEN_ID,
    });
    store.set(operation);

    expect(() => store.clear(scope)).toThrow("could not be cleared");
    expect(store.get(scope)?.txid).toBe(operation.txid);

    allowOperationDelete = true;
    expect(() => store.clear(scope)).not.toThrow();
    expect(store.get(scope)).toBeNull();
  });
});
