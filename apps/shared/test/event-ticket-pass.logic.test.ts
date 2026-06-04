import { describe, expect, it, vi } from "vitest";

import { useEventTicket } from "../../event-ticket-pass/src/composables/useEventTicket";
import type { BadgeProxy } from "../services/os/BadgeProxy";
import type { NFTProxy } from "../services/os/NFTProxy";
import type { StorageProxy } from "../services/os/StorageProxy";

const OWNER = "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs";

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
  };
  return messages[key] ?? key;
}

function setup() {
  const storage = {
    list: vi.fn(async () => ({})),
    set: vi.fn(async (_key: string, value: unknown) => ({ ok: true, value })),
    get: vi.fn(async () => null),
  } as unknown as StorageProxy & {
    list: ReturnType<typeof vi.fn>;
    set: ReturnType<typeof vi.fn>;
    get: ReturnType<typeof vi.fn>;
  };
  const nft = {
    mint: vi.fn(async (metadata: Record<string, unknown>) => ({ txid: "0xmint", metadata })),
  } as unknown as NFTProxy & { mint: ReturnType<typeof vi.fn> };
  const badge = {
    award: vi.fn(async () => undefined),
  } as unknown as BadgeProxy & { award: ReturnType<typeof vi.fn> };

  const ticket = useEventTicket({
    nftService: nft,
    storageService: storage,
    badgeService: badge,
    ensureWallet: vi.fn(async () => OWNER),
    eventBus: { emit: vi.fn() },
    t,
  });

  ticket.address.set(OWNER);
  return { ticket, storage, nft, badge };
}

describe("useEventTicket", () => {
  it("creates an event, issues a ticket, looks it up, and checks it in", async () => {
    const { ticket, storage, nft } = setup();

    const event = await ticket.createEvent();
    expect(event?.name).toBe("Neo Builder Summit");
    expect(storage.set).toHaveBeenCalledWith(
      expect.stringMatching(/^events:/),
      expect.objectContaining({
        name: "Neo Builder Summit",
        maxSupply: "120",
        active: true,
      }),
    );
    expect(ticket.eventsCount.get()).toBe(1);

    ticket.issueRecipient.set(OWNER);
    const issued = await ticket.issueTicket();
    expect(issued?.owner).toBe(OWNER);
    expect(nft.mint).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "event_ticket_pass",
        eventName: "Neo Builder Summit",
        owner: OWNER,
      }),
    );
    expect(ticket.ticketsCount.get()).toBe(1);

    // The incremented minted count must be persisted back to storage so the
    // sold-out cap survives a refresh (regression: minted was in-memory only).
    expect(storage.set).toHaveBeenCalledWith(
      `events:${event!.id}`,
      expect.objectContaining({ minted: "1", maxSupply: "120" }),
    );
    expect(ticket.selectedEvent.get()?.minted).toBe(1n);

    ticket.checkinTokenId.set(issued!.tokenId);
    const found = await ticket.lookupTicket();
    expect(found?.used).toBe(false);

    const checkedIn = await ticket.checkInTicket();
    expect(checkedIn?.used).toBe(true);
    expect(ticket.lookup.get()?.used).toBe(true);
  });

  it("burns the freshly minted NFT when the ticket storage write fails", async () => {
    const { ticket, storage, nft } = setup();
    const burn = vi.fn(async () => undefined);
    (nft as unknown as { burn: typeof burn }).burn = burn;

    await ticket.createEvent();
    ticket.issueRecipient.set(OWNER);

    // The mint succeeds but the ticket storage write fails; the NFT must be
    // compensated with a burn so it is not orphaned without a ticket record.
    // createEvent already consumed one storage.set; fail the next (ticket write).
    storage.set.mockRejectedValueOnce(new Error("gateway down"));

    await expect(ticket.issueTicket()).rejects.toThrow("gateway down");
    expect(nft.mint).toHaveBeenCalledTimes(1);
    expect(burn).toHaveBeenCalledTimes(1);
    // No ticket should be recorded locally after the rolled-back issuance.
    expect(ticket.ticketsCount.get()).toBe(0);
  });

  it("rejects ticket issuance until an event and valid recipient are present", async () => {
    const { ticket } = setup();

    await expect(ticket.issueTicket()).rejects.toThrow("Select an event first");

    await ticket.createEvent();
    ticket.issueRecipient.set("not-a-neo-address");
    await expect(ticket.issueTicket()).rejects.toThrow("Recipient address required");
  });
});
