import { describe, expect, it, vi } from "vitest";

import { createObservable } from "../react/context";
import { addressToScriptHash } from "../utils/neo";
import { useEventTicket } from "../../event-ticket-pass/src/composables/useEventTicket";
import type { ChainLike } from "../../event-ticket-pass/src/composables/useEventTicket";

const OWNER = "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs";
const OWNER_HASH = addressToScriptHash(OWNER);
const TOKEN_ID = "1-1";

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
  };
  return messages[key] ?? key;
}

interface ChainState {
  /** Latest event data the read fakes should return for getEventDetails. */
  event: Record<string, unknown> | null;
  /** Latest ticket data the read fakes should return for getTicketDetails. */
  ticket: Record<string, unknown> | null;
}

function setup(initial?: Partial<ChainState>) {
  const chainState: ChainState = {
    event: null,
    ticket: null,
    ...initial,
  };

  const invoke = vi.fn(async (operation: string, _args: unknown[]) => {
    switch (operation) {
      case "createEvent":
        // EventCreated(eventId, creator, name)
        chainState.event = {
          id: "1",
          creator: OWNER_HASH,
          name: "Neo Builder Summit",
          venue: "Neo Community Hall",
          startTime: "1781596800",
          endTime: "1781629200",
          maxSupply: "120",
          minted: "0",
          notes: "Workshop pass, badge pickup, and live check-in.",
          active: true,
        };
        return { txid: "0xcreate", event: { state: [{ value: "1" }, { value: OWNER_HASH }, { value: "Neo Builder Summit" }] } };
      case "issueTicket":
        // TicketIssued(tokenId, eventId, owner)
        chainState.ticket = {
          tokenId: TOKEN_ID,
          eventId: "1",
          owner: OWNER_HASH,
          eventName: "Neo Builder Summit",
          venue: "Neo Community Hall",
          startTime: "1781596800",
          endTime: "1781629200",
          seat: "General",
          memo: "Standard admission",
          issuedTime: "1781500000",
          used: false,
          usedTime: "0",
        };
        if (chainState.event) chainState.event.minted = "1";
        return { txid: "0xissue", event: { state: [{ value: btoa(TOKEN_ID) }, { value: "1" }, { value: OWNER_HASH }] } };
      case "checkIn":
        if (chainState.ticket) {
          chainState.ticket.used = true;
          chainState.ticket.usedTime = "1781510000";
        }
        return { txid: "0xcheckin", event: { state: [{ value: btoa(TOKEN_ID) }, { value: "1" }, { value: OWNER_HASH }] } };
      case "setEventActive":
        if (chainState.event) chainState.event.active = !chainState.event.active;
        return { txid: "0xtoggle", event: { state: [{ value: "1" }] } };
      default:
        return { txid: `0x${operation}` };
    }
  });

  const read = vi.fn(async (operation: string) => {
    switch (operation) {
      case "getCreatorEvents":
        return chainState.event ? [chainState.event.id] : [];
      case "getEventDetails":
        return chainState.event ?? {};
      case "tokensOf":
        return chainState.ticket ? [chainState.ticket.tokenId] : [];
      case "getTicketDetails":
        return chainState.ticket ?? {};
      default:
        return null;
    }
  });

  const chain = {
    address: createObservable<string | null>(OWNER),
    ensureWallet: vi.fn(async () => OWNER),
    invoke,
    read,
  } as unknown as ChainLike & {
    invoke: typeof invoke;
    read: typeof read;
    ensureWallet: ReturnType<typeof vi.fn>;
  };

  const eventBus = { emit: vi.fn() };

  const ticket = useEventTicket({ chain, eventBus, t });
  ticket.address.set(OWNER);

  return { ticket, chain, invoke, read, eventBus, chainState };
}

describe("useEventTicket (chain wiring)", () => {
  it("creates an event, issues a ticket, looks it up, and checks it in on-chain", async () => {
    const { ticket, invoke } = setup();

    const event = await ticket.createEvent();
    expect(event?.name).toBe("Neo Builder Summit");
    expect(invoke).toHaveBeenCalledWith(
      "createEvent",
      [
        { type: "Hash160", value: OWNER },
        { type: "String", value: "Neo Builder Summit" },
        { type: "String", value: "Neo Community Hall" },
        { type: "Integer", value: expect.any(String) },
        { type: "Integer", value: expect.any(String) },
        { type: "Integer", value: "120" },
        { type: "String", value: expect.any(String) },
      ],
      { waitForEvent: "EventCreated" },
    );
    expect(ticket.eventsCount.get()).toBe(1);
    expect(ticket.selectedEventId.get()).toBe("1");

    ticket.issueRecipient.set(OWNER);
    const issued = await ticket.issueTicket();
    expect(issued?.tokenId).toBe(TOKEN_ID);
    expect(issued?.owner).toBe(OWNER);
    expect(invoke).toHaveBeenCalledWith(
      "issueTicket",
      [
        { type: "Hash160", value: OWNER },
        { type: "Hash160", value: OWNER },
        { type: "Integer", value: "1" },
        { type: "String", value: "General" },
        { type: "String", value: "Standard admission" },
      ],
      { waitForEvent: "TicketIssued" },
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
        { type: "Hash160", value: OWNER },
        { type: "ByteArray", value: expect.any(String) },
      ],
      { waitForEvent: "TicketCheckedIn" },
    );
  });

  it("rejects ticket issuance until an event and valid recipient are present", async () => {
    const { ticket } = setup();

    await expect(ticket.issueTicket()).rejects.toThrow("Select an event first");

    await ticket.createEvent();
    ticket.issueRecipient.set("not-a-neo-address");
    await expect(ticket.issueTicket()).rejects.toThrow("Recipient address required");
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
        { type: "Hash160", value: OWNER },
        { type: "Integer", value: "1" },
        { type: "Boolean", value: false },
      ],
      { waitForEvent: "EventUpdated" },
    );
  });

  it("surfaces a not-found error when checking in an unknown token", async () => {
    const { ticket } = setup();
    ticket.checkinTokenId.set("999-1");
    await expect(ticket.lookupTicket()).rejects.toThrow("Ticket not found");
  });
});
