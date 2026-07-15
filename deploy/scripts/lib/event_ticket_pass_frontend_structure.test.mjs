import assert from "node:assert/strict";
import test from "node:test";

import {
  assertAssets,
  assertClasses,
  assertDispatches,
  assertMessageKeys,
  assertModernTypography,
  assertPlayStage,
  exists,
  read,
} from "./frontend_structure_helpers.mjs";

test("Event Ticket Pass ships a resource-led, recoverable organizer and gate desk", () => {
  const playArea = read("apps/event-ticket-pass/src/PlayArea.tsx");
  const styles = read("apps/event-ticket-pass/src/PlayArea.scss");
  const logic = read("apps/event-ticket-pass/src/composables/useEventTicket.ts");
  const operationStore = read("apps/event-ticket-pass/src/event-ticket-operation-store.ts");
  const rpc = read("apps/event-ticket-pass/src/event-ticket-rpc.ts");
  const main = read("apps/event-ticket-pass/src/main.tsx");
  const messages = read("apps/event-ticket-pass/src/locale/messages.ts");
  const neoManifest = JSON.parse(read("apps/event-ticket-pass/neo-manifest.json"));

  assertPlayStage(playArea, "nft", "Event Ticket Pass");
  assertClasses(playArea, [
    "ticket-scene",
    "ticket-pass",
    "ticket-pass__texture",
    "ticket-discovery-strip",
    "ticket-blueprint-picker",
    "ticket-guest-lane",
    "ticket-scanner-console",
    "ticket-gate-queue",
    "ticket-verdict-card",
    "ticket-drawer-shell",
  ], "Event Ticket Pass");
  assertDispatches(playArea, [
    "connectWallet",
    "createEvent",
    "issueTicket",
    "lookupTicket",
    "checkInTicket",
    "refreshGateTickets",
    "recoverPending",
    "transferTicket",
  ], "Event Ticket Pass");

  assert.match(playArea, /const PASS_ART = "pass-artwork\.webp"/);
  assert.match(playArea, /data-provenance=\{displayTicket \? "verified-ticket"/);
  assert.match(playArea, /gateTickets\.slice\(0, 6\)/);
  assert.doesNotMatch(playArea, /<form\b|<svg\b|ticket-recipient-picks|[😀-🙏🌀-🫿]/u);

  assert.match(logic, /let activeWritePhase: EventTicketOperationPhase \| null = null/);
  assert.match(logic, /ensureReadRuntimeBinding/);
  assert.match(logic, /assertReadBindingStable/);
  assert.match(logic, /const gateTickets = createObservable<TicketItem\[\]>\(\[\]\)/);
  assert.match(logic, /ticket\.tokenId === tokenId/);
  assert.match(logic, /pendingEventPayloadMatches/);
  assert.match(logic, /markPendingTerminalFailure/);
  assert.match(logic, /onTransactionSent: \(txid\)/);
  assert.match(logic, /event\.notes !== pending\.notes/);
  assert.match(operationStore, /notes\?: string/);
  assert.match(operationStore, /storage\.get<unknown>\(key, null\)/);
  assert.match(rpc, /getapplicationlog/);
  assert.match(rpc, /2_976_433_161/);
  assert.match(main, /app\.actions\.register\("refreshGateTickets"/);
  assert.match(main, /gateTickets: ticket\.gateTickets/);

  assert.equal(neoManifest.contracts["neo-n3-mainnet"], "0x90bad472146aab97de71498e8d736c3124e7c82b");
  assert.equal(neoManifest.contracts["neo-n3-testnet"], "0x90bad472146aab97de71498e8d736c3124e7c82b");
  assert.equal(neoManifest.features.stateless, false);
  assert.ok(neoManifest.permissions.includes("read:blockchain"));
  assert.ok(neoManifest.permissions.includes("write:blockchain"));

  assertAssets([
    "apps/event-ticket-pass/public/pass-artwork.webp",
    "apps/event-ticket-pass/public/banner.webp",
    "apps/event-ticket-pass/public/logo.webp",
  ]);
  for (const document of [
    "apps/event-ticket-pass/README.md",
    "apps/event-ticket-pass/PRODUCTION_STATUS.md",
    "apps/event-ticket-pass/NETWORK_STATUS.md",
    "apps/event-ticket-pass/ASSET_PROVENANCE.md",
  ]) assert.ok(exists(document), `missing ${document}`);

  assertMessageKeys(messages, [
    "invitationOnlyHint",
    "gateQueueVerified",
    "gateQueuePartial",
    "gateQueueUnavailable",
    "transactionRecoveryUnavailable",
    "transactionRecoveryUnavailableAfterBroadcast",
    "pendingStillConfirming",
    "pendingMismatch",
    "transactionFaulted",
  ], "Event Ticket Pass");
  assert.match(styles, /\.ticket-pass__texture\s*\{[^}]*object-fit:\s*cover/s);
  assert.match(styles, /\.ticket-pass__main\s*\{[^}]*background:\s*#fffef8/s);
  assert.match(styles, /\.ticket-gate-queue__status\[data-state="verified"\]/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.doesNotMatch(styles, /linear-gradient\(|radial-gradient\(/);
  assertModernTypography(styles, "Event Ticket Pass");
});
