import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const appsRoot = process.cwd().endsWith(`${path.sep}apps${path.sep}shared`)
  ? path.resolve(process.cwd(), "..")
  : path.resolve(process.cwd(), "apps");
const appRoot = path.join(appsRoot, "event-ticket-pass");

function source(file: string) {
  return fs.readFileSync(path.join(appRoot, file), "utf8");
}

describe("Event Ticket Pass production contract", () => {
  it("keeps the hero ticket explicit about preview versus verified provenance", () => {
    const playArea = source("src/PlayArea.tsx");
    expect(playArea).toContain('data-provenance={displayTicket ? "verified-ticket"');
    expect(playArea).toContain('t("passPreview")');
    expect(playArea).toContain('t("verifiedTicket")');
    expect(playArea).not.toContain('"1-001"');
    expect(fs.existsSync(path.join(appRoot, "public/pass-artwork.webp"))).toBe(true);
  });

  it("requires verified, request-bound events and authoritative state readback", () => {
    const logic = source("src/composables/useEventTicket.ts");
    expect(logic).toContain("result.verified !== true");
    expect(logic).toContain("requireVerifiedEvent(\"event_create\"");
    expect(logic).toContain("requireVerifiedEvent(\"ticket_issue\"");
    expect(logic).toContain("requireVerifiedEvent(\"ticket_checkin\"");
    expect(logic).toContain("requireVerifiedEvent(\"ticket_transfer\"");
    expect(logic).toContain("await loadEventDetails(eventId)");
    expect(logic).toContain("await loadTicketDetails(tokenId)");
    expect(logic).toContain("ticketsVerification.set(complete ? \"verified\" : \"partial\")");
    expect(logic).toContain("onTransactionSent: (txid)");
    expect(logic).toContain("await app.events.waitFor(");
    expect(logic).toContain("transactionOutcomeReader(");
    expect(logic).toContain("outcome.state === \"fault\"");
    expect(logic).toContain("clearPending(binding)");
    expect(logic).toContain("pendingEventPayloadMatches");
    expect(logic).toContain("markPendingTerminalFailure");
    expect(logic).toContain("pending.notes !== undefined");
    expect(logic).not.toContain("Surface the newly issued ticket immediately");
  });

  it("keeps organizer gate records separate from holder inventory and stale lookups", () => {
    const playArea = source("src/PlayArea.tsx");
    const logic = source("src/composables/useEventTicket.ts");
    expect(logic).toContain("const gateTickets = createObservable<TicketItem[]>([])");
    expect(logic).toContain("GATE_QUEUE_SCAN_LIMIT");
    expect(logic).toContain("ticket.tokenId === tokenId");
    expect(logic).toContain("event?.id === eventId");
    expect(logic).toContain("let activeWritePhase: EventTicketOperationPhase | null = null");
    expect(logic).toContain("checkinTokenId.get().trim() !== tokenId");
    expect(playArea).toContain("gateTickets.slice(0, 6)");
    expect(playArea).not.toContain("Recent guest wallets");
    expect(playArea).not.toContain("ticket-recipient-picks");
  });

  it("keeps public discovery and unsupported purchase or self-claim honest", () => {
    const playArea = source("src/PlayArea.tsx");
    const logic = source("src/composables/useEventTicket.ts");
    const messages = source("src/locale/messages.ts");
    expect(logic).toContain("const discoveredEvents = createObservable<EventItem[]>([])");
    expect(logic).toContain('app.chain.readRaw("totalEvents")');
    expect(playArea).toContain('t("discoverEvents")');
    expect(playArea).toContain('t("invitationOnlyHint")');
    expect(messages).toContain("has no purchase or self-claim method");
  });

  it("attests network, hash, checksum, NEP-11 and exact ticket ABI before writes", () => {
    const rpc = source("src/event-ticket-rpc.ts");
    const logic = source("src/composables/useEventTicket.ts");
    expect(rpc).toContain("2_976_433_161");
    expect(rpc).toContain('includes("NEP-11")');
    expect(rpc).toContain('["TicketCheckedIn", ["ByteArray", "Integer", "Hash160"]]');
    expect(logic).toContain('stringValue(symbol) !== "TICKET"');
    expect(logic).toContain("parseBigInt(decimals) !== 0n");
    expect(logic).toContain("operationStore.canPersist(binding.scope)");
    expect(logic).toContain("await assertWriteBindingStable(binding)");
    expect(logic).toContain("app.chain.address.subscribe(");
  });

  it("declares the direct-chain, no-payment runtime truthfully", () => {
    const appManifest = source("src/manifest.ts");
    const manifest = JSON.parse(source("neo-manifest.json")) as {
      permissions: string[];
      stateSource: { type: string; endpoints: string[] };
      deployment: Record<string, { status?: string; reason?: string }>;
    };
    expect(appManifest).toContain("payments: false");
    expect(appManifest).toContain('shell: "market"');
    expect(appManifest).toContain("tabs: []");
    expect(appManifest).toContain("walletRequired: false");
    expect(manifest.permissions).toContain("read:blockchain");
    expect(manifest.permissions).toContain("write:blockchain");
    expect(manifest.permissions).not.toContain("invoke:shared-runtime");
    expect(manifest.stateSource).toEqual({
      chain: "neo-n3-mainnet",
      endpoints: ["https://api.n3index.dev"],
      type: "n3index",
    });
    expect(manifest.deployment["neo-n3-testnet"]?.status).toBe("deployed");
    expect(manifest.deployment["neo-n3-testnet"]?.reason).toContain("write workflows were not replayed");
  });
});
