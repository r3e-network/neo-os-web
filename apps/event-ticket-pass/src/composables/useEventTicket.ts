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
import { addressToScriptHash, normalizeScriptHash, parseHash160 } from "@shared/utils/neo";
import { encodeTokenId, parseBigInt, parseBool, parseDateInput } from "@shared/utils/parsers";
import type { EventItem, TicketItem } from "../types";
import {
  attestEventTicketContract,
  findEventTicketNotification,
  normalizeEventTicketNetwork,
  readEventTicketTransactionOutcome,
  type EventTicketAttestation,
  type EventTicketNetwork,
} from "../event-ticket-rpc";
import {
  createEventTicketOperationStore,
  createPendingEventTicketOperation,
  type EventTicketOperationPhase,
  type EventTicketOperationScope,
  type EventTicketOperationStorage,
  type PendingEventTicketOperation,
} from "../event-ticket-operation-store";

type ContractArg = {
  type: "String" | "Integer" | "Boolean" | "Hash160" | "Hash256" | "PublicKey" | "ByteArray" | "Array";
  value: string | number | boolean;
};

type TxResult = {
  txid?: string;
  event?: unknown;
  success?: boolean;
  verified?: boolean;
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
    options?: {
      waitForEvent?: string;
      waitTimeoutMs?: number;
      scriptHash?: string;
      onTransactionSent?: (txid: string) => void;
    },
  ) => Promise<TxResult>;
  read: (
    operation: string,
    args?: ContractArg[],
    options?: { scriptHash?: string; cache?: boolean; cacheTtlMs?: number },
  ) => Promise<unknown>;
  detectNetwork: () => Promise<string>;
  contractAddress: Observable<string | null> | Observable<string>;
  waitForEvent: (
    txid: string,
    eventName: string,
    timeoutMs?: number,
  ) => Promise<unknown>;
};

export interface UseEventTicketOptions {
  app: MiniAppFramework;
  bus: { emit: (event: string, payload?: unknown) => void };
  t: (key: string, params?: Record<string, string | number>) => string;
  attestContract?: (
    network: unknown,
    contract: unknown,
  ) => Promise<EventTicketAttestation>;
  operationStorage?: EventTicketOperationStorage;
  launchNetwork?: unknown;
  /** Test/integration seam; production reads the canonical application log. */
  transactionOutcomeReader?: typeof readEventTicketTransactionOutcome;
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

function hashValueMatches(value: unknown, address: string): boolean {
  const expected = addressToScriptHash(address).toLowerCase();
  if (!expected) return false;
  const direct = stringValue(value).toLowerCase();
  if (direct === address.trim().toLowerCase() || direct === expected) return true;
  return parseHash160(value).toLowerCase() === expected;
}

function isTicketTokenId(value: unknown): boolean {
  return /^\d+-\d+$/.test(stringValue(value));
}

async function mapWithConcurrency<T, R>(
  values: readonly T[],
  limit: number,
  worker: (value: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(values.length);
  let cursor = 0;
  const runners = Array.from(
    { length: Math.min(Math.max(1, limit), values.length) },
    async () => {
      while (cursor < values.length) {
        const index = cursor;
        cursor += 1;
        results[index] = await worker(values[index]!, index);
      }
    },
  );
  await Promise.all(runners);
  return results;
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
    active: parseBool(record.active),
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
const GATE_QUEUE_SCAN_LIMIT = 200;
const OWNER_LOOKUP_CONCURRENCY = 10;
const DETAIL_READ_CONCURRENCY = 8;
const MAX_EVENT_NAME_LENGTH = 60;
const MAX_VENUE_LENGTH = 60;
const MAX_NOTES_LENGTH = 240;
const MAX_SEAT_LENGTH = 24;
const MAX_MEMO_LENGTH = 160;
const MAX_EVENT_SUPPLY = 100_000n;

type TicketVerification = "wallet" | "loading" | "verified" | "partial" | "unavailable";
type GateTicketVerification = "event" | "loading" | "verified" | "partial" | "unavailable";
type RuntimeStatus = "wallet" | "checking" | "ready" | "unavailable";

interface RuntimeBinding {
  network: EventTicketNetwork;
  contract: string;
  scope: EventTicketOperationScope | null;
}

type RuntimeWriteBinding = RuntimeBinding & { scope: EventTicketOperationScope };
type EventTicketJournalInput = Omit<
  Parameters<typeof createPendingEventTicketOperation>[0],
  keyof EventTicketOperationScope | "txid"
>;

interface OwnedTokenScan {
  tokenIds: string[];
  expectedBalance: number;
  complete: boolean;
}

export function useEventTicket({
  app,
  bus,
  t,
  attestContract = attestEventTicketContract,
  operationStorage,
  launchNetwork,
  transactionOutcomeReader = readEventTicketTransactionOutcome,
}: UseEventTicketOptions) {
  const events = createObservable<EventItem[]>([]);
  const discoveredEvents = createObservable<EventItem[]>([]);
  const tickets = createObservable<TicketItem[]>([]);
  const gateTickets = createObservable<TicketItem[]>([]);
  const address = createObservable("");
  const selectedEventId = createObservable("");
  const lookup = createObservable<TicketItem | null>(null);
  const latestRequest = createObservable<ActionPayload | null>(null);
  const latestResult = createObservable<ActionPayload | null>(null);
  const workflowStatus = createObservable(t("ready"));
  const lastError = createObservable("");
  const ticketsVerification = createObservable<TicketVerification>("wallet");
  const ticketsExpectedCount = createObservable(0);
  const gateTicketsVerification = createObservable<GateTicketVerification>("event");
  const gateTicketsExpectedCount = createObservable(0);
  const runtimeStatus = createObservable<RuntimeStatus>("wallet");
  const runtimeMessage = createObservable(t("runtimeConnectWallet"));
  const activeNetwork = createObservable<EventTicketNetwork | "">("");
  const pendingOperation = createObservable<PendingEventTicketOperation | null>(null);

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
  const isConnecting = createObservable(false);
  const isRefreshing = createObservable(false);
  const isRefreshingTickets = createObservable(false);
  const isRefreshingGateTickets = createObservable(false);
  const isRefreshingDiscovery = createObservable(false);
  const isRecovering = createObservable(false);
  const isCreating = createObservable(false);
  const isIssuing = createObservable(false);
  const isCheckingIn = createObservable(false);
  const isLookingUp = createObservable(false);
  const isTransferring = createObservable(false);
  const transferringTokenId = createObservable<string | null>(null);
  const togglingId = createObservable<string | null>(null);
  const operationStore = createEventTicketOperationStore(
    operationStorage ?? app.storage.local,
  );
  let walletGeneration = 0;
  let runtimeGeneration = 0;
  let eventsGeneration = 0;
  let discoveryGeneration = 0;
  let ticketsGeneration = 0;
  let gateTicketsGeneration = 0;
  let lookupGeneration = 0;
  let recoveryGeneration = 0;
  let activeWritePhase: EventTicketOperationPhase | null = null;

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
    () =>
      Boolean(selectedEvent.get()?.active) &&
      Boolean(addressToScriptHash(issueRecipient.get().trim())),
    [selectedEvent, issueRecipient],
  );
  const canCheckInTicket = createDerived(
    () => {
      const tokenId = checkinTokenId.get().trim();
      const ticket = lookup.get();
      return Boolean(
        isTicketTokenId(tokenId) &&
        ticket?.tokenId === tokenId &&
        ticket.active &&
        !ticket.used,
      );
    },
    [checkinTokenId, lookup],
  );
  const canTransferTicket = createDerived(
    () => {
      const tokenId = transferTokenId.get().trim();
      const recipient = transferRecipient.get().trim();
      const held = tickets.get().find((item) => item.tokenId === tokenId);
      return Boolean(
        isTicketTokenId(tokenId) &&
        held &&
        !held.used &&
        addressToScriptHash(recipient) &&
        !hashValueMatches(held.owner, recipient),
      );
    },
    [tickets, transferTokenId, transferRecipient],
  );

  function beginWrite(phase: EventTicketOperationPhase): void {
    if (activeWritePhase || isConnecting.get() || isRecovering.get()) {
      throw new Error(t("operationInProgress"));
    }
    activeWritePhase = phase;
  }

  function finishWrite(phase: EventTicketOperationPhase) {
    if (activeWritePhase === phase) activeWritePhase = null;
  }

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
    // The injected wallet observable is authoritative. The local value only
    // covers hosts whose ensureWallet() returns before updating that observable.
    return stringValue(app.chain.address.get()) || address.get();
  }

  function accountKey(value: unknown): string {
    return stringValue(value).toLowerCase();
  }

  function walletRequestIsCurrent(generation: number, accountValue: unknown): boolean {
    return (
      generation === walletGeneration &&
      accountKey(currentAddress()) === accountKey(accountValue)
    );
  }

  function bindingIsCurrent(binding: RuntimeWriteBinding): boolean {
    return (
      accountKey(currentAddress()) === accountKey(binding.scope.account) &&
      normalizeScriptHash(app.chain.contractAddress.get() ?? "") === binding.contract
    );
  }

  async function ensureConnected(): Promise<string> {
    const existing = currentAddress();
    if (existing) {
      if (!address.get()) address.set(existing);
      return existing;
    }
    const requested = await app.chain.ensureWallet();
    const wallet = stringValue(app.chain.address.get()) || stringValue(requested);
    if (!wallet) throw new Error(t("walletNotConnected"));
    address.set(wallet);
    return wallet;
  }

  function setRuntimeUnavailable(
    message = t("runtimeUnavailable"),
    generation?: number,
  ) {
    if (generation !== undefined && generation !== runtimeGeneration) return;
    runtimeStatus.set("unavailable");
    runtimeMessage.set(message);
    activeNetwork.set("");
  }

  async function refreshRuntimeReadiness(
    accountValue = currentAddress(),
    networkOverride?: EventTicketNetwork,
  ): Promise<RuntimeBinding | null> {
    const generation = ++runtimeGeneration;
    const account = stringValue(accountValue);
    const launch = normalizeEventTicketNetwork(launchNetwork);
    if (!account && !launch) {
      runtimeStatus.set("wallet");
      runtimeMessage.set(t("runtimeConnectWallet"));
      activeNetwork.set("");
      pendingOperation.set(null);
      return null;
    }
    runtimeStatus.set("checking");
    runtimeMessage.set(t("runtimeChecking"));
    try {
      const detected = normalizeEventTicketNetwork(await app.chain.detectNetwork());
      if (
        generation !== runtimeGeneration ||
        accountKey(currentAddress()) !== accountKey(account)
      ) return null;
      const network = networkOverride ?? detected ?? (!account ? launch : null);
      const contract = normalizeScriptHash(app.chain.contractAddress.get() ?? "");
      if (!network) {
        setRuntimeUnavailable(t("runtimeNetworkUnknown"), generation);
        return null;
      }
      if (!contract) {
        setRuntimeUnavailable(t("contractMissing"), generation);
        return null;
      }
      if (launch && detected && launch !== detected) {
        setRuntimeUnavailable(t("runtimeBindingMismatch"), generation);
        return null;
      }
      const attestation = await attestContract(network, contract);
      if (
        generation !== runtimeGeneration ||
        accountKey(currentAddress()) !== accountKey(account)
      ) return null;
      if (!attestation.compatible) {
        setRuntimeUnavailable(t("runtimeBindingMismatch"), generation);
        return null;
      }

      // The RPC attestation proves the published deployment. Exercise the
      // wallet bridge against the configured app binding as a second source of
      // truth so a stale host cannot silently target another contract.
      const [symbol, decimals] = await Promise.all([
        app.chain.readRaw("symbol"),
        app.chain.readRaw("decimals"),
      ]);
      if (
        generation !== runtimeGeneration ||
        accountKey(currentAddress()) !== accountKey(account) ||
        normalizeScriptHash(app.chain.contractAddress.get() ?? "") !== contract
      ) return null;
      if (stringValue(symbol) !== "TICKET" || parseBigInt(decimals) !== 0n) {
        setRuntimeUnavailable(t("runtimeBindingMismatch"), generation);
        return null;
      }

      const scope = account ? { account, network, contract } : null;
      pendingOperation.set(scope ? operationStore.get(scope) : null);
      activeNetwork.set(network);
      runtimeStatus.set("ready");
      runtimeMessage.set(t("runtimeReady", { network }));
      return { network, contract, scope };
    } catch {
      if (
        generation === runtimeGeneration &&
        accountKey(currentAddress()) === accountKey(account)
      ) setRuntimeUnavailable(t("runtimeUnavailable"), generation);
      return null;
    }
  }

  async function assertWriteBindingStable(binding: RuntimeWriteBinding) {
    if (!bindingIsCurrent(binding)) {
      throw new Error(t("walletChangedDuringAction"));
    }
    const [network, contract] = await Promise.all([
      app.chain.detectNetwork().then(normalizeEventTicketNetwork),
      Promise.resolve(normalizeScriptHash(app.chain.contractAddress.get() ?? "")),
    ]);
    const launch = normalizeEventTicketNetwork(launchNetwork);
    if (
      !bindingIsCurrent(binding) ||
      !network ||
      network !== binding.network ||
      contract !== binding.contract ||
      (launch && launch !== network)
    ) {
      setRuntimeUnavailable(t("runtimeBindingMismatch"));
      throw new Error(t("runtimeBindingMismatch"));
    }
  }

  function currentReadBinding(accountValue = currentAddress()): RuntimeBinding | null {
    const network = activeNetwork.get();
    const contract = normalizeScriptHash(app.chain.contractAddress.get() ?? "");
    const account = stringValue(accountValue);
    if (runtimeStatus.get() !== "ready" || !network || !contract) return null;
    return {
      network,
      contract,
      scope: account ? { account, network, contract } : null,
    };
  }

  async function assertReadBindingStable(
    binding: RuntimeBinding,
    accountValue = currentAddress(),
  ) {
    const expectedAccount = accountKey(accountValue);
    const detected = normalizeEventTicketNetwork(await app.chain.detectNetwork());
    const launch = normalizeEventTicketNetwork(launchNetwork);
    const contract = normalizeScriptHash(app.chain.contractAddress.get() ?? "");
    if (accountKey(currentAddress()) !== expectedAccount) {
      throw new Error(t("walletChangedDuringAction"));
    }
    if (
      !detected ||
      detected !== binding.network ||
      contract !== binding.contract ||
      activeNetwork.get() !== binding.network ||
      (launch && launch !== detected)
    ) {
      setRuntimeUnavailable(t("runtimeBindingMismatch"));
      throw new Error(t("runtimeBindingMismatch"));
    }
  }

  async function ensureReadRuntimeBinding(
    accountValue = currentAddress(),
  ): Promise<RuntimeBinding> {
    const account = stringValue(accountValue);
    const binding = currentReadBinding(account) ?? await refreshRuntimeReadiness(account);
    if (!binding) throw new Error(runtimeMessage.get() || t("runtimeUnavailable"));
    await assertReadBindingStable(binding, account);
    return binding;
  }

  async function assertRuntimeReady(account: string): Promise<RuntimeWriteBinding> {
    const detected = normalizeEventTicketNetwork(await app.chain.detectNetwork());
    if (!detected) {
      setRuntimeUnavailable(t("runtimeNetworkUnknown"));
      throw new Error(t("runtimeNetworkUnknown"));
    }
    const launch = normalizeEventTicketNetwork(launchNetwork);
    if (launch && launch !== detected) {
      setRuntimeUnavailable(t("runtimeBindingMismatch"));
      throw new Error(t("runtimeBindingMismatch"));
    }
    const binding = await refreshRuntimeReadiness(account, detected);
    if (!binding) throw new Error(runtimeMessage.get() || t("runtimeUnavailable"));
    if (!binding.scope) throw new Error(t("runtimeUnavailable"));
    if (pendingOperation.get()) {
      throw new Error(t("pendingOperationBlocksAction"));
    }
    if (!operationStore.canPersist(binding.scope)) {
      throw new Error(t("transactionRecoveryUnavailable"));
    }
    return binding as RuntimeWriteBinding;
  }

  function journalBroadcast(
    binding: RuntimeWriteBinding,
    input: EventTicketJournalInput,
    txid: string,
  ) {
    if (!txid) return;
    let record: PendingEventTicketOperation;
    try {
      record = createPendingEventTicketOperation({
        ...binding.scope,
        ...input,
        txid,
      });
    } catch {
      throw new Error(t("transactionIdInvalid"));
    }
    try {
      const operation = operationStore.set(record);
      if (bindingIsCurrent(binding)) {
        pendingOperation.set(operation);
        workflowStatus.set(t("transactionPending"));
      }
    } catch {
      // The broadcast cannot be undone. Keep the same-session copy visible,
      // but report that refresh-safe recovery could not be guaranteed.
      if (bindingIsCurrent(binding)) {
        pendingOperation.set(operationStore.get(binding.scope));
      }
      throw new Error(t("transactionRecoveryUnavailableAfterBroadcast"));
    }
  }

  function ensureBroadcastJournal(
    binding: RuntimeWriteBinding,
    input: EventTicketJournalInput,
    result: TxResult,
  ) {
    const txid = txidFrom(result);
    if (!txid || operationStore.get(binding.scope)) return;
    // Some wallet bridges return the txid without firing onTransactionSent.
    // Persist that exact broadcast before event/readback verification so a
    // refresh cannot lose an otherwise recoverable transaction.
    journalBroadcast(binding, input, txid);
  }

  function clearPending(binding: RuntimeWriteBinding) {
    try {
      operationStore.clear(binding.scope);
      pendingOperation.set(null);
    } catch {
      pendingOperation.set(operationStore.get(binding.scope));
      throw new Error(t("transactionRecoveryCleanupUnavailable"));
    }
  }

  async function connectWallet() {
    if (isConnecting.get() || activeWritePhase || isRecovering.get()) {
      throw new Error(t("operationInProgress"));
    }
    isConnecting.set(true);
    try {
      const wallet = await ensureConnected();
      const binding = await refreshRuntimeReadiness(wallet);
      if (!binding) throw new Error(runtimeMessage.get() || t("runtimeUnavailable"));
      await Promise.all([
        refreshDiscovery({ quiet: true }),
        refreshEvents({ quiet: true }),
        refreshTickets({ quiet: true }),
      ]);
      if (selectedEventId.get()) {
        await refreshGateTickets(selectedEventId.get(), { quiet: true });
      }
      if (pendingOperation.get()) await recoverPending({ quiet: true });
      if (accountKey(currentAddress()) !== accountKey(wallet)) {
        throw new Error(t("walletChangedDuringAction"));
      }
      workflowStatus.set(t("walletConnected"));
      return wallet;
    } finally {
      isConnecting.set(false);
    }
  }

  async function loadEventIds(creator: string): Promise<string[]> {
    // arg.hash160 converts the connected wallet address to a script hash —
    // no hand-rolled addressToScriptHash preamble needed.
    const raw = await app.chain.readRaw("getCreatorEvents", [
      app.chain.arg.hash160(creator),
      app.chain.arg.integer(0),
      // The contract caps each creator at 100 events. Read the complete bounded
      // set so the organizer view never silently drops events 51-100.
      app.chain.arg.integer(100),
    ]);
    const list = Array.isArray(raw) ? raw : [];
    return list
      .map(stringValue)
      .filter((value) => /^\d+$/.test(value) && BigInt(value) > 0n)
      .map((value) => BigInt(value).toString());
  }

  async function loadEventDetails(eventId: string): Promise<EventItem | null> {
    const raw = await app.chain.readRaw("getEventDetails", [
      app.chain.arg.integer(eventId),
    ]);
    const record = asRecord(raw);
    if (!record) return null;
    const event = eventFromRecord(record, eventId);
    return event?.id === eventId ? event : null;
  }

  async function loadTicketDetails(tokenId: string): Promise<TicketItem | null> {
    if (!isTicketTokenId(tokenId)) return null;
    const raw = await app.chain.readRaw("getTicketDetails", [
      app.chain.arg.byteArray(encodeTokenId(tokenId)),
    ]);
    const record = asRecord(raw);
    if (!record) return null;
    const ticket = ticketFromRecord(record, tokenId);
    return ticket?.eventId && ticket.tokenId === tokenId ? ticket : null;
  }

  function markUnverifiedResult(kind: string, result: TxResult): never {
    latestResult.set({
      kind: `${kind}_pending_confirmation`,
      txid: txidFrom(result),
      verified: false,
    });
    throw new Error(t("transactionUnverified"));
  }

  function requireVerifiedEvent(
    kind: string,
    result: TxResult,
    matches: (event: unknown) => boolean,
  ) {
    if (
      result.success === false ||
      !txidFrom(result) ||
      result.verified !== true ||
      !result.event ||
      !matches(result.event)
    ) {
      markUnverifiedResult(kind, result);
    }
    return result.event;
  }

  async function refreshEvents(options: { quiet?: boolean } = {}) {
    const generation = ++eventsGeneration;
    const requestWalletGeneration = walletGeneration;
    const creator = currentAddress();
    if (!creator) {
      events.set([]);
      return events.get();
    }
    isRefreshing.set(true);
    lastError.set("");
    try {
      const binding = await ensureReadRuntimeBinding(creator);
      const ids = await loadEventIds(creator);
      const details = await mapWithConcurrency(ids, DETAIL_READ_CONCURRENCY, async (id) => {
        const event = await loadEventDetails(id);
        if (!event) throw new Error(t("loadFailed"));
        return event;
      });
      await assertReadBindingStable(binding, creator);
      if (
        generation !== eventsGeneration ||
        !walletRequestIsCurrent(requestWalletGeneration, creator)
      ) return events.get();
      const items = details;
      items.sort((a, b) => b.startTime - a.startTime);
      events.set(items);
      if (!selectedEventId.get() && items[0]) selectedEventId.set(items[0].id);
      workflowStatus.set(t("eventsLoaded"));
      return items;
    } catch (error) {
      const message = app.errors.messageOf(error, t("loadFailed"));
      if (
        generation === eventsGeneration &&
        walletRequestIsCurrent(requestWalletGeneration, creator) &&
        !options.quiet
      ) {
        lastError.set(message);
        workflowStatus.set(message);
        throw error;
      }
      return events.get();
    } finally {
      if (generation === eventsGeneration) isRefreshing.set(false);
    }
  }

  async function refreshDiscovery(options: { quiet?: boolean } = {}) {
    const generation = ++discoveryGeneration;
    const account = currentAddress();
    isRefreshingDiscovery.set(true);
    if (!options.quiet) lastError.set("");
    try {
      const binding = await ensureReadRuntimeBinding(account);
      const { network, contract } = binding;
      const total = parseBigInt(await app.chain.readRaw("totalEvents"));
      if (total < 0n) throw new Error(t("loadFailed"));
      const count = Number(total > BigInt(EVENT_SCAN_LIMIT) ? EVENT_SCAN_LIMIT : total);
      if (count === 0) {
        await assertReadBindingStable(binding, account);
        if (
          generation !== discoveryGeneration ||
          network !== activeNetwork.get() ||
          contract !== normalizeScriptHash(app.chain.contractAddress.get() ?? "")
        ) return discoveredEvents.get();
        discoveredEvents.set([]);
        return discoveredEvents.get();
      }
      // When the registry grows beyond the browser read bound, prefer the
      // newest event ids. Scanning 1..200 forever would make every newly
      // created event undiscoverable after the first 200 launches.
      const firstEventId = total - BigInt(count) + 1n;
      const details = await mapWithConcurrency(
        Array.from(
          { length: count },
          (_value, index) => (firstEventId + BigInt(index)).toString(),
        ),
        DETAIL_READ_CONCURRENCY,
        async (eventId) => {
          const event = await loadEventDetails(eventId);
          if (!event) throw new Error(t("loadFailed"));
          return event;
        },
      );
      await assertReadBindingStable(binding, account);
      if (
        generation !== discoveryGeneration ||
        network !== activeNetwork.get() ||
        contract !== normalizeScriptHash(app.chain.contractAddress.get() ?? "")
      ) return discoveredEvents.get();
      const nowSeconds = Math.floor(Date.now() / 1000);
      const upcoming = details
        .filter((event) => event.active)
        .filter((event) => event.endTime <= 0 || event.endTime >= nowSeconds)
        .sort((a, b) => a.startTime - b.startTime);
      discoveredEvents.set(upcoming);
      if (!selectedEventId.get() && upcoming[0]) selectedEventId.set(upcoming[0].id);
      return upcoming;
    } catch (error) {
      if (
        generation === discoveryGeneration &&
        accountKey(currentAddress()) === accountKey(account) &&
        !options.quiet
      ) {
        const message = app.errors.messageOf(error, t("loadFailed"));
        lastError.set(message);
        workflowStatus.set(message);
        throw error;
      }
      return discoveredEvents.get();
    } finally {
      if (generation === discoveryGeneration) isRefreshingDiscovery.set(false);
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
  async function loadOwnedTokenIds(owner: string): Promise<OwnedTokenScan> {
    // arg.hash160 converts the owner address once; its value doubles as the
    // ownerOf comparison key below (same lowercase 0x little-endian form the
    // old addressToScriptHash preamble produced).
    const ownerArg = app.chain.arg.hash160(owner);
    const ownerHash = String(ownerArg.value);
    // Short-circuit: an attendee with no ticket balance holds nothing to scan.
    const rawBalance = await app.chain.readRaw("balanceOf", [ownerArg]);
    const balance = Number(parseBigInt(rawBalance));
    if (!Number.isSafeInteger(balance) || balance < 0) {
      return { tokenIds: [], expectedBalance: 0, complete: false };
    }
    if (balance === 0) {
      return { tokenIds: [], expectedBalance: 0, complete: true };
    }

    const totalEvents = parseBigInt(await app.chain.readRaw("totalEvents"));
    const eventCount = Number(
      totalEvents > BigInt(EVENT_SCAN_LIMIT) ? EVENT_SCAN_LIMIT : totalEvents,
    );
    if (eventCount <= 0) {
      return { tokenIds: [], expectedBalance: balance, complete: false };
    }

    const firstEventId = totalEvents - BigInt(eventCount) + 1n;
    const eventIds = Array.from(
      { length: eventCount },
      (_v, index) => (firstEventId + BigInt(index)).toString(),
    );
    const mintedCounts = await mapWithConcurrency(
      eventIds,
      DETAIL_READ_CONCURRENCY,
      async (eventId) => {
        const record = asRecord(
          await app.chain
            .readRaw("getEventDetails", [app.chain.arg.integer(eventId)])
            .catch(() => null),
        );
        const minted = record ? Number(parseBigInt(record.minted)) : 0;
        return {
          eventId,
          minted: Number.isSafeInteger(minted) && minted > 0 ? minted : 0,
        };
      },
    );

    const candidateTokenIds: string[] = [];
    const candidateLimitReached =
      mintedCounts.reduce((total, item) => total + item.minted, 0) >
      TICKET_SCAN_LIMIT;
    for (const { eventId, minted } of mintedCounts) {
      for (let serial = 1; serial <= minted; serial += 1) {
        candidateTokenIds.push(`${eventId}-${serial}`);
        if (candidateTokenIds.length >= TICKET_SCAN_LIMIT) {
          break;
        }
      }
      if (candidateTokenIds.length >= TICKET_SCAN_LIMIT) break;
    }

    const ownership = await mapWithConcurrency(
      candidateTokenIds,
      OWNER_LOOKUP_CONCURRENCY,
      async (tokenId) => {
        const rawOwner = await app.chain
          .readRaw("ownerOf", [app.chain.arg.byteArray(encodeTokenId(tokenId))])
          .catch(() => null);
        return parseHash160(rawOwner) === ownerHash ? tokenId : "";
      },
    );
    const ownedTokenIds = ownership.filter(Boolean).slice(0, balance);
    return {
      tokenIds: ownedTokenIds,
      expectedBalance: balance,
      complete:
        totalEvents <= BigInt(EVENT_SCAN_LIMIT) &&
        !candidateLimitReached &&
        ownedTokenIds.length === balance,
    };
  }

  async function refreshTickets(options: { quiet?: boolean } = {}) {
    const generation = ++ticketsGeneration;
    const requestWalletGeneration = walletGeneration;
    const owner = currentAddress();
    if (!owner) {
      tickets.set([]);
      ticketsExpectedCount.set(0);
      ticketsVerification.set("wallet");
      return tickets.get();
    }
    isRefreshingTickets.set(true);
    ticketsVerification.set("loading");
    lastError.set("");
    try {
      const binding = await ensureReadRuntimeBinding(owner);
      const scan = await loadOwnedTokenIds(owner);
      await assertReadBindingStable(binding, owner);
      if (
        generation !== ticketsGeneration ||
        !walletRequestIsCurrent(requestWalletGeneration, owner)
      ) return tickets.get();
      const { tokenIds } = scan;
      ticketsExpectedCount.set(scan.expectedBalance);
      if (tokenIds.length === 0) {
        tickets.set([]);
        ticketsVerification.set(scan.complete ? "verified" : "partial");
        workflowStatus.set(
          scan.complete
            ? t("ticketsLoaded")
            : t("ticketsPartial", { verified: 0, total: scan.expectedBalance }),
        );
        return tickets.get();
      }
      // Best-effort per-token detail reads: one unreadable ticket must not abort
      // the whole list, so settle every promise and keep the resolvable ones.
      const resolved = await mapWithConcurrency(
        tokenIds,
        DETAIL_READ_CONCURRENCY,
        (tokenId) => loadTicketDetails(tokenId).catch(() => null),
      );
      await assertReadBindingStable(binding, owner);
      if (
        generation !== ticketsGeneration ||
        !walletRequestIsCurrent(requestWalletGeneration, owner)
      ) return tickets.get();
      const items = resolved.filter((item): item is TicketItem => Boolean(item));
      items.sort((a, b) => b.issuedTime - a.issuedTime);
      tickets.set(items);
      const complete =
        scan.complete &&
        items.length === tokenIds.length &&
        items.length === scan.expectedBalance;
      ticketsVerification.set(complete ? "verified" : "partial");
      workflowStatus.set(
        complete
          ? t("ticketsLoaded")
          : t("ticketsPartial", {
              verified: items.length,
              total: scan.expectedBalance,
            }),
      );
      return items;
    } catch (error) {
      const message = app.errors.messageOf(error, t("loadFailed"));
      const current =
        generation === ticketsGeneration &&
        walletRequestIsCurrent(requestWalletGeneration, owner);
      if (current) ticketsVerification.set("unavailable");
      if (current && !options.quiet) {
        lastError.set(message);
        workflowStatus.set(message);
        throw error;
      }
      return tickets.get();
    } finally {
      if (generation === ticketsGeneration) isRefreshingTickets.set(false);
    }
  }

  /**
   * Build the organizer's door queue from the selected event's deterministic
   * token ids. This is deliberately separate from `tickets`, which is only the
   * connected wallet's holder inventory and must never masquerade as the list
   * of passes the organizer issued to guests.
   */
  async function refreshGateTickets(
    eventIdValue = selectedEventId.get(),
    options: { quiet?: boolean } = {},
  ) {
    const generation = ++gateTicketsGeneration;
    const requestWalletGeneration = walletGeneration;
    const organizer = currentAddress();
    const eventId = stringValue(eventIdValue);
    if (!organizer || !/^\d+$/.test(eventId) || BigInt(eventId) <= 0n) {
      gateTickets.set([]);
      gateTicketsExpectedCount.set(0);
      gateTicketsVerification.set("event");
      return gateTickets.get();
    }

    isRefreshingGateTickets.set(true);
    gateTicketsVerification.set("loading");
    try {
      const binding = await ensureReadRuntimeBinding(organizer);
      const event = await loadEventDetails(eventId);
      if (!event || !hashValueMatches(event.creator, organizer)) {
        if (
          generation === gateTicketsGeneration &&
          walletRequestIsCurrent(requestWalletGeneration, organizer)
        ) {
          gateTickets.set([]);
          gateTicketsExpectedCount.set(0);
          gateTicketsVerification.set("event");
        }
        return gateTickets.get();
      }

      const expectedCount = Number(event.minted);
      if (!Number.isSafeInteger(expectedCount) || expectedCount < 0) {
        throw new Error(t("loadFailed"));
      }
      const count = Math.min(expectedCount, GATE_QUEUE_SCAN_LIMIT);
      const firstSerial = expectedCount - count + 1;
      const tokenIds = Array.from(
        { length: count },
        (_value, index) => `${event.id}-${expectedCount - index}`,
      ).filter((_tokenId, index) => expectedCount - index >= firstSerial);
      let failedReads = 0;
      const resolved = await mapWithConcurrency(
        tokenIds,
        DETAIL_READ_CONCURRENCY,
        async (tokenId) => {
          const ticket = await loadTicketDetails(tokenId).catch(() => null);
          if (!ticket || ticket.eventId !== event.id) failedReads += 1;
          return ticket?.eventId === event.id ? ticket : null;
        },
      );
      await assertReadBindingStable(binding, organizer);
      if (
        generation !== gateTicketsGeneration ||
        !walletRequestIsCurrent(requestWalletGeneration, organizer) ||
        selectedEventId.get() !== eventId
      ) return gateTickets.get();

      const items = resolved.filter((item): item is TicketItem => Boolean(item));
      items.sort((left, right) => {
        if (left.used !== right.used) return left.used ? 1 : -1;
        return right.issuedTime - left.issuedTime;
      });
      const complete =
        expectedCount <= GATE_QUEUE_SCAN_LIMIT &&
        failedReads === 0 &&
        items.length === expectedCount;
      gateTickets.set(items);
      gateTicketsExpectedCount.set(expectedCount);
      gateTicketsVerification.set(complete ? "verified" : "partial");
      return items;
    } catch (error) {
      const current =
        generation === gateTicketsGeneration &&
        walletRequestIsCurrent(requestWalletGeneration, organizer);
      if (current) gateTicketsVerification.set("unavailable");
      if (current && !options.quiet) {
        const message = app.errors.messageOf(error, t("loadFailed"));
        lastError.set(message);
        workflowStatus.set(message);
        throw error;
      }
      return gateTickets.get();
    } finally {
      if (generation === gateTicketsGeneration) isRefreshingGateTickets.set(false);
    }
  }

  async function createEvent(input?: unknown) {
    if (isCreating.get()) return null;
    applyEventDraftInput(input);
    const name = clean(eventName.get());
    const venue = clean(eventVenue.get(), t("venueFallback"));
    const eventNotes = clean(notes.get());
    const startTime = parseDateInput(eventStart.get());
    const endTime = parseDateInput(eventEnd.get());
    const supply = parseBigInt(maxSupply.get());
    if (!name) throw new Error(t("nameRequired"));
    if (name.length > MAX_EVENT_NAME_LENGTH) throw new Error(t("eventNameTooLong"));
    if (venue.length > MAX_VENUE_LENGTH) throw new Error(t("eventVenueTooLong"));
    if (eventNotes.length > MAX_NOTES_LENGTH) throw new Error(t("eventNotesTooLong"));
    if (!startTime || !endTime || endTime <= startTime) {
      throw new Error(t("invalidTime"));
    }
    if (supply <= 0n || supply > MAX_EVENT_SUPPLY) {
      throw new Error(t("invalidSupply"));
    }
    beginWrite("event_create");

    isCreating.set(true);
    lastError.set("");
    try {
      const creator = await ensureConnected();
      if (!creator) throw new Error(t("walletNotConnected"));
      const binding = await assertRuntimeReady(creator);
      const journalInput: EventTicketJournalInput = {
        phase: "event_create",
        creator,
        name,
        venue,
        notes: eventNotes,
        startTime,
        endTime,
        maxSupply: supply.toString(),
      };
      const request = {
        kind: "event_create",
        method: "createEvent",
        creator,
        name,
        venue,
        startTime,
        endTime,
        maxSupply: supply.toString(),
        notes: eventNotes,
      };
      latestRequest.set(request);
      await assertWriteBindingStable(binding);
      const result = await app.chain.invoke(
        "createEvent",
        [
          app.chain.arg.hash160(creator),
          app.chain.arg.string(name),
          app.chain.arg.string(venue),
          app.chain.arg.integer(startTime),
          app.chain.arg.integer(endTime),
          app.chain.arg.integer(supply.toString()),
          app.chain.arg.string(eventNotes),
        ],
        {
          waitForEvent: "EventCreated",
          onTransactionSent: (txid) =>
            journalBroadcast(binding, journalInput, txid),
        },
      );
      ensureBroadcastJournal(binding, journalInput, result);
      await assertWriteBindingStable(binding);
      requireVerifiedEvent("event_create", result, (event) => {
        const eventId = stringValue(eventValue(event, 0));
        return (
          /^\d+$/.test(eventId) &&
          BigInt(eventId) > 0n &&
          hashValueMatches(eventValue(event, 1), creator) &&
          stringValue(eventValue(event, 2)) === name
        );
      });
      const eventId = stringValue(eventValue(result.event, 0));
      const confirmed = await loadEventDetails(eventId).catch(() => null);
      if (
        !confirmed ||
        confirmed.id !== eventId ||
        !hashValueMatches(confirmed.creator, creator) ||
        confirmed.name !== name ||
        confirmed.venue !== venue ||
        confirmed.notes !== eventNotes ||
        confirmed.startTime !== startTime ||
        confirmed.endTime !== endTime ||
        confirmed.maxSupply !== supply ||
        !confirmed.active
      ) {
        markUnverifiedResult("event_create", result);
      }
      if (!bindingIsCurrent(binding)) throw new Error(t("walletChangedDuringAction"));
      clearPending(binding);
      latestResult.set({
        kind: "event_created",
        txid: txidFrom(result),
        eventId,
        verified: true,
      });
      workflowStatus.set(t("eventCreated"));
      bus.emit("event-ticket:eventCreated", { id: eventId, name });
      events.set(mergeEvent(events.get(), confirmed));
      if (eventId) selectedEventId.set(eventId);
      await Promise.all([
        refreshEvents({ quiet: true }),
        refreshGateTickets(eventId, { quiet: true }),
      ]);
      return events.get().find((event) => event.id === eventId) ?? confirmed;
    } catch (error) {
      const message = app.errors.messageOf(error, t("contractMissing"));
      lastError.set(message);
      workflowStatus.set(message);
      throw error;
    } finally {
      isCreating.set(false);
      finishWrite("event_create");
    }
  }

  function selectEvent(eventId: string) {
    selectedEventId.set(eventId);
    gateTickets.set([]);
    gateTicketsExpectedCount.set(0);
    gateTicketsVerification.set(currentAddress() ? "loading" : "event");
    void refreshGateTickets(eventId, { quiet: true });
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
    const recipient = clean(issueRecipient.get());
    // framework-exempt: false-not-throw validity check — addressToScriptHash
    // returns "" for user-typed junk so the localized invalidRecipient copy
    // is thrown here; arg.hash160 would throw its own English error first.
    if (!recipient || !addressToScriptHash(recipient)) {
      throw new Error(t("invalidRecipient"));
    }
    const seat = clean(issueSeat.get(), t("seatFallback"));
    const memo = clean(issueMemo.get());
    if (seat.length > MAX_SEAT_LENGTH) throw new Error(t("seatTooLong"));
    if (memo.length > MAX_MEMO_LENGTH) throw new Error(t("memoTooLong"));
    beginWrite("ticket_issue");

    isIssuing.set(true);
    lastError.set("");
    try {
      const organizer = await ensureConnected();
      if (!organizer) throw new Error(t("walletNotConnected"));
      const binding = await assertRuntimeReady(organizer);
      // Re-read the selected event immediately before asking for a signature.
      // The card can be stale after another organizer action or another tab.
      const authoritativeEvent = await loadEventDetails(event.id);
      if (!authoritativeEvent) throw new Error(t("selectEventFirst"));
      if (!hashValueMatches(authoritativeEvent.creator, organizer)) {
        throw new Error(t("organizerMismatch"));
      }
      if (!authoritativeEvent.active) throw new Error(t("eventInactive"));
      if (authoritativeEvent.minted >= authoritativeEvent.maxSupply) {
        throw new Error(t("soldOut"));
      }
      const journalInput: EventTicketJournalInput = {
        phase: "ticket_issue",
        creator: organizer,
        recipient,
        eventId: authoritativeEvent.id,
        seat,
        memo,
      };
      const request = {
        kind: "ticket_issue",
        method: "issueTicket",
        creator: organizer,
        recipient,
        eventId: authoritativeEvent.id,
        seat,
        memo,
      };
      latestRequest.set(request);
      await assertWriteBindingStable(binding);
      const result = await app.chain.invoke(
        "issueTicket",
        [
          app.chain.arg.hash160(organizer),
          app.chain.arg.hash160(recipient),
          app.chain.arg.integer(authoritativeEvent.id),
          app.chain.arg.string(seat),
          app.chain.arg.string(memo),
        ],
        {
          waitForEvent: "TicketIssued",
          onTransactionSent: (txid) =>
            journalBroadcast(binding, journalInput, txid),
        },
      );
      ensureBroadcastJournal(binding, journalInput, result);
      await assertWriteBindingStable(binding);
      requireVerifiedEvent("ticket_issue", result, (eventPayload) => {
        const tokenId = decodeTokenId(eventValue(eventPayload, 0));
        return (
          isTicketTokenId(tokenId) &&
          stringValue(eventValue(eventPayload, 1)) === authoritativeEvent.id &&
          hashValueMatches(eventValue(eventPayload, 2), recipient)
        );
      });
      const tokenId = decodeTokenId(eventValue(result.event, 0));
      const confirmedTicket = await loadTicketDetails(tokenId).catch(() => null);
      if (
        !confirmedTicket ||
        confirmedTicket.tokenId !== tokenId ||
        confirmedTicket.eventId !== authoritativeEvent.id ||
        !hashValueMatches(confirmedTicket.owner, recipient) ||
        confirmedTicket.seat !== seat ||
        confirmedTicket.memo !== memo ||
        confirmedTicket.used
      ) {
        markUnverifiedResult("ticket_issue", result);
      }
      if (!bindingIsCurrent(binding)) throw new Error(t("walletChangedDuringAction"));
      clearPending(binding);
      latestResult.set({
        kind: "ticket_issued",
        txid: txidFrom(result),
        tokenId,
        eventId: authoritativeEvent.id,
        verified: true,
      });
      workflowStatus.set(t("ticketIssued"));
      bus.emit("event-ticket:ticketIssued", {
        tokenId,
        eventId: authoritativeEvent.id,
      });
      await Promise.all([
        refreshEvents({ quiet: true }),
        refreshTickets({ quiet: true }),
        refreshGateTickets(authoritativeEvent.id, { quiet: true }),
      ]);
      // `tickets` is strictly the connected holder's verified inventory. Never
      // insert a pass minted to somebody else merely to make the UI look busy.
      if (
        hashValueMatches(confirmedTicket.owner, currentAddress()) &&
        !tickets.get().some((item) => item.tokenId === tokenId)
      ) {
        tickets.set(mergeTicket(tickets.get(), confirmedTicket));
      }
      return confirmedTicket;
    } catch (error) {
      const message = app.errors.messageOf(error, t("contractMissing"));
      lastError.set(message);
      workflowStatus.set(message);
      throw error;
    } finally {
      isIssuing.set(false);
      finishWrite("ticket_issue");
    }
  }

  async function toggleEvent(event: unknown) {
    const evt = event as EventItem;
    if (!evt?.id || togglingId.get()) return null;
    beginWrite("event_toggle");
    togglingId.set(evt.id);
    lastError.set("");
    try {
      const creator = await ensureConnected();
      if (!creator) throw new Error(t("walletNotConnected"));
      const binding = await assertRuntimeReady(creator);
      const authoritative = await loadEventDetails(evt.id);
      if (!authoritative) throw new Error(t("selectEventFirst"));
      if (!hashValueMatches(authoritative.creator, creator)) {
        throw new Error(t("organizerMismatch"));
      }
      const nextActive = !authoritative.active;
      const journalInput: EventTicketJournalInput = {
        phase: "event_toggle",
        creator,
        eventId: authoritative.id,
        active: nextActive,
      };
      const request = {
        kind: "event_toggle",
        method: "setEventActive",
        creator,
        eventId: authoritative.id,
        active: nextActive,
      };
      latestRequest.set(request);
      await assertWriteBindingStable(binding);
      const result = await app.chain.invoke(
        "setEventActive",
        [
          app.chain.arg.hash160(creator),
          app.chain.arg.integer(authoritative.id),
          app.chain.arg.boolean(nextActive),
        ],
        {
          waitForEvent: "EventUpdated",
          onTransactionSent: (txid) =>
            journalBroadcast(binding, journalInput, txid),
        },
      );
      ensureBroadcastJournal(binding, journalInput, result);
      await assertWriteBindingStable(binding);
      requireVerifiedEvent(
        "event_toggle",
        result,
        (eventPayload) =>
          stringValue(eventValue(eventPayload, 0)) === authoritative.id,
      );
      const confirmed = await loadEventDetails(authoritative.id).catch(() => null);
      if (
        !confirmed ||
        !hashValueMatches(confirmed.creator, creator) ||
        confirmed.active !== nextActive
      ) {
        markUnverifiedResult("event_toggle", result);
      }
      if (!bindingIsCurrent(binding)) throw new Error(t("walletChangedDuringAction"));
      clearPending(binding);
      latestResult.set({
        kind: "event_status_updated",
        txid: txidFrom(result),
        eventId: confirmed.id,
        active: confirmed.active,
        verified: true,
      });
      events.set(mergeEvent(events.get(), confirmed));
      workflowStatus.set(confirmed.active ? t("statusActive") : t("statusInactive"));
      await refreshEvents({ quiet: true });
      return confirmed;
    } catch (error) {
      const message = app.errors.messageOf(error, t("contractMissing"));
      lastError.set(message);
      workflowStatus.set(message);
      throw error;
    } finally {
      togglingId.set(null);
      finishWrite("event_toggle");
    }
  }

  async function lookupTicket(input?: unknown) {
    if (isLookingUp.get()) return lookup.get();
    applyCheckinDraftInput(input);
    const tokenId = clean(checkinTokenId.get());
    if (!isTicketTokenId(tokenId)) throw new Error(t("invalidTokenId"));
    const generation = ++lookupGeneration;
    const requestWalletGeneration = walletGeneration;
    const account = currentAddress();
    isLookingUp.set(true);
    lastError.set("");
    try {
      const binding = await ensureReadRuntimeBinding(account);
      const parsed = await loadTicketDetails(tokenId);
      await assertReadBindingStable(binding, account);
      if (
        generation !== lookupGeneration ||
        !walletRequestIsCurrent(requestWalletGeneration, account) ||
        checkinTokenId.get().trim() !== tokenId
      ) return lookup.get();
      if (!parsed) {
        lookup.set(null);
        throw new Error(t("ticketNotFound"));
      }
      lookup.set(parsed);
      workflowStatus.set(t("ticketFound"));
      return parsed;
    } catch (error) {
      if (
        generation !== lookupGeneration ||
        !walletRequestIsCurrent(requestWalletGeneration, account) ||
        checkinTokenId.get().trim() !== tokenId
      ) return lookup.get();
      const message = app.errors.messageOf(error, t("ticketNotFound"));
      lastError.set(message);
      workflowStatus.set(message);
      throw error;
    } finally {
      if (generation === lookupGeneration) isLookingUp.set(false);
    }
  }

  async function checkInTicket(input?: unknown) {
    if (isCheckingIn.get()) return null;
    applyCheckinDraftInput(input);
    const tokenId = clean(checkinTokenId.get());
    if (!isTicketTokenId(tokenId)) throw new Error(t("invalidTokenId"));
    beginWrite("ticket_checkin");
    isCheckingIn.set(true);
    lastError.set("");
    try {
      const creator = await ensureConnected();
      if (!creator) throw new Error(t("walletNotConnected"));
      const binding = await assertRuntimeReady(creator);
      // Always re-read at the signature boundary. A green verdict from a prior
      // lookup may be stale after another gate or tab checked the pass in.
      const ticket = await loadTicketDetails(tokenId);
      if (!ticket) throw new Error(t("ticketNotFound"));
      if (ticket.used) throw new Error(t("ticketAlreadyUsed"));
      if (!ticket.active) throw new Error(t("eventInactive"));
      const event = await loadEventDetails(ticket.eventId);
      if (!event || !event.active) throw new Error(t("eventInactive"));
      if (!hashValueMatches(event.creator, creator)) {
        throw new Error(t("organizerMismatch"));
      }
      lookup.set(ticket);
      const journalInput: EventTicketJournalInput = {
        phase: "ticket_checkin",
        creator,
        eventId: ticket.eventId,
        tokenId: ticket.tokenId,
      };
      const request = {
        kind: "ticket_checkin",
        method: "checkIn",
        creator,
        tokenId: ticket.tokenId,
      };
      latestRequest.set(request);
      await assertWriteBindingStable(binding);
      const result = await app.chain.invoke(
        "checkIn",
        [
          app.chain.arg.hash160(creator),
          app.chain.arg.byteArray(encodeTokenId(ticket.tokenId)),
        ],
        {
          waitForEvent: "TicketCheckedIn",
          onTransactionSent: (txid) =>
            journalBroadcast(binding, journalInput, txid),
        },
      );
      ensureBroadcastJournal(binding, journalInput, result);
      await assertWriteBindingStable(binding);
      requireVerifiedEvent("ticket_checkin", result, (eventPayload) => {
        return (
          decodeTokenId(eventValue(eventPayload, 0)) === ticket.tokenId &&
          stringValue(eventValue(eventPayload, 1)) === ticket.eventId &&
          hashValueMatches(eventValue(eventPayload, 2), creator)
        );
      });
      const checkedIn = await loadTicketDetails(ticket.tokenId).catch(() => null);
      if (
        !checkedIn ||
        checkedIn.tokenId !== ticket.tokenId ||
        checkedIn.eventId !== ticket.eventId ||
        !checkedIn.used ||
        checkedIn.usedTime <= 0
      ) {
        markUnverifiedResult("ticket_checkin", result);
      }
      if (!bindingIsCurrent(binding)) throw new Error(t("walletChangedDuringAction"));
      clearPending(binding);
      lookup.set(checkedIn);
      if (tickets.get().some((item) => item.tokenId === checkedIn.tokenId)) {
        tickets.set(mergeTicket(tickets.get(), checkedIn));
      }
      if (gateTickets.get().some((item) => item.tokenId === checkedIn.tokenId)) {
        gateTickets.set(mergeTicket(gateTickets.get(), checkedIn));
      }
      latestResult.set({
        kind: "ticket_checked_in",
        txid: txidFrom(result),
        tokenId: checkedIn.tokenId,
        verified: true,
      });
      workflowStatus.set(t("checkinSuccess"));
      bus.emit("event-ticket:checkedIn", { tokenId: checkedIn.tokenId });
      await refreshTickets({ quiet: true });
      return checkedIn;
    } catch (error) {
      const message = app.errors.messageOf(error, t("contractMissing"));
      lastError.set(message);
      workflowStatus.set(message);
      throw error;
    } finally {
      isCheckingIn.set(false);
      finishWrite("ticket_checkin");
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
    if (!isTicketTokenId(tokenId)) throw new Error(t("invalidTokenId"));
    // framework-exempt: false-not-throw validity check — addressToScriptHash
    // returns "" for user-typed junk so the localized invalidRecipient copy
    // is thrown here; arg.hash160 would throw its own English error first.
    if (!recipient || !addressToScriptHash(recipient)) {
      throw new Error(t("invalidRecipient"));
    }
    const held = tickets.get().find((item) => item.tokenId === tokenId);
    if (!held) throw new Error(t("ticketNotHeld"));
    if (held?.used) throw new Error(t("ticketAlreadyUsed"));
    if (hashValueMatches(held.owner, recipient)) {
      throw new Error(t("recipientIsOwner"));
    }
    beginWrite("ticket_transfer");

    isTransferring.set(true);
    transferringTokenId.set(tokenId);
    lastError.set("");
    try {
      const holder = await ensureConnected();
      if (!holder) throw new Error(t("walletNotConnected"));
      const binding = await assertRuntimeReady(holder);
      const authoritative = await loadTicketDetails(tokenId);
      if (!authoritative) throw new Error(t("ticketNotFound"));
      if (!hashValueMatches(authoritative.owner, holder)) {
        throw new Error(t("ticketNotHeld"));
      }
      if (authoritative.used) throw new Error(t("ticketAlreadyUsed"));
      const journalInput: EventTicketJournalInput = {
        phase: "ticket_transfer",
        creator: holder,
        recipient,
        tokenId,
      };
      const request = {
        kind: "ticket_transfer",
        method: "transfer",
        from: holder,
        recipient,
        tokenId,
      };
      latestRequest.set(request);
      await assertWriteBindingStable(binding);
      const result = await app.chain.invoke(
        "transfer",
        [
          app.chain.arg.hash160(recipient),
          app.chain.arg.byteArray(encodeTokenId(tokenId)),
          // NEP-11 `data` (Any) — an empty ByteArray; the recipient's
          // onNEP11Payment hook receives it. No app-level payload is needed.
          app.chain.arg.byteArray(""),
        ],
        {
          waitForEvent: "Transfer",
          onTransactionSent: (txid) =>
            journalBroadcast(binding, journalInput, txid),
        },
      );
      ensureBroadcastJournal(binding, journalInput, result);
      await assertWriteBindingStable(binding);
      requireVerifiedEvent("ticket_transfer", result, (eventPayload) => {
        return (
          hashValueMatches(eventValue(eventPayload, 0), holder) &&
          hashValueMatches(eventValue(eventPayload, 1), recipient) &&
          parseBigInt(eventValue(eventPayload, 2)) === 1n &&
          decodeTokenId(eventValue(eventPayload, 3)) === tokenId
        );
      });
      const transferred = await loadTicketDetails(tokenId).catch(() => null);
      if (
        !transferred ||
        transferred.tokenId !== tokenId ||
        !hashValueMatches(transferred.owner, recipient)
      ) {
        markUnverifiedResult("ticket_transfer", result);
      }
      if (!bindingIsCurrent(binding)) throw new Error(t("walletChangedDuringAction"));
      clearPending(binding);
      latestResult.set({
        kind: "ticket_transferred",
        txid: txidFrom(result),
        tokenId,
        recipient,
        verified: true,
      });
      // Authoritative owner readback proved that the ticket left this wallet.
      tickets.set(tickets.get().filter((item) => item.tokenId !== tokenId));
      if (gateTickets.get().some((item) => item.tokenId === tokenId)) {
        gateTickets.set(mergeTicket(gateTickets.get(), transferred));
      }
      transferTokenId.set("");
      transferRecipient.set("");
      workflowStatus.set(t("transferSuccess"));
      bus.emit("event-ticket:transferred", { tokenId, recipient });
      await refreshTickets({ quiet: true });
      return result;
    } catch (error) {
      const message = app.errors.messageOf(error, t("contractMissing"));
      lastError.set(message);
      workflowStatus.set(message);
      throw error;
    } finally {
      isTransferring.set(false);
      transferringTokenId.set(null);
      finishWrite("ticket_transfer");
    }
  }

  function pendingEventPayloadMatches(
    pending: PendingEventTicketOperation,
    eventPayload: unknown,
    account: string,
  ): boolean {
    if (pending.phase === "event_create") {
      const eventId = stringValue(eventValue(eventPayload, 0));
      return (
        /^\d+$/.test(eventId) &&
        BigInt(eventId) > 0n &&
        hashValueMatches(eventValue(eventPayload, 1), pending.creator ?? account) &&
        stringValue(eventValue(eventPayload, 2)) === pending.name
      );
    }
    if (pending.phase === "event_toggle") {
      return stringValue(eventValue(eventPayload, 0)) === pending.eventId;
    }
    if (pending.phase === "ticket_issue") {
      return (
        isTicketTokenId(decodeTokenId(eventValue(eventPayload, 0))) &&
        stringValue(eventValue(eventPayload, 1)) === pending.eventId &&
        hashValueMatches(eventValue(eventPayload, 2), pending.recipient ?? "")
      );
    }
    if (pending.phase === "ticket_checkin") {
      return (
        decodeTokenId(eventValue(eventPayload, 0)) === pending.tokenId &&
        stringValue(eventValue(eventPayload, 1)) === pending.eventId &&
        hashValueMatches(eventValue(eventPayload, 2), pending.creator ?? account)
      );
    }
    return (
      hashValueMatches(eventValue(eventPayload, 0), pending.creator ?? account) &&
      hashValueMatches(eventValue(eventPayload, 1), pending.recipient ?? "") &&
      parseBigInt(eventValue(eventPayload, 2)) === 1n &&
      decodeTokenId(eventValue(eventPayload, 3)) === pending.tokenId
    );
  }

  function markPendingTerminalFailure(
    binding: RuntimeWriteBinding,
    pending: PendingEventTicketOperation,
  ) {
    clearPending(binding);
    latestResult.set({
      kind: `${pending.phase}_failed`,
      txid: pending.txid,
      verified: false,
    });
  }

  async function recoverPending(options: { quiet?: boolean } = {}) {
    if (activeWritePhase || isConnecting.get()) {
      throw new Error(t("operationInProgress"));
    }
    if (isRecovering.get()) return pendingOperation.get();
    const generation = ++recoveryGeneration;
    const requestWalletGeneration = walletGeneration;
    const account = currentAddress();
    if (!account) return null;
    isRecovering.set(true);
    try {
      const binding = await refreshRuntimeReadiness(account);
      if (
        generation !== recoveryGeneration ||
        !walletRequestIsCurrent(requestWalletGeneration, account)
      ) return pendingOperation.get();
      if (!binding?.scope) throw new Error(runtimeMessage.get() || t("runtimeUnavailable"));
      const pending = pendingOperation.get();
      if (!pending) return null;

      let eventPayload = await app.events.waitFor(
        pending.txid,
        pending.eventName,
        4_000,
      );
      if (
        generation !== recoveryGeneration ||
        !walletRequestIsCurrent(requestWalletGeneration, account)
      ) return pendingOperation.get();
      if (eventPayload && !pendingEventPayloadMatches(pending, eventPayload, account)) {
        // A bridge-level event with the right name but the wrong request identity
        // is not enough. Fall through to the canonical application log.
        eventPayload = null;
      }
      if (!eventPayload) {
        const outcome = await transactionOutcomeReader(
          binding.network,
          pending.txid,
          binding.contract,
        );
        if (
          generation !== recoveryGeneration ||
          !walletRequestIsCurrent(requestWalletGeneration, account)
        ) return pendingOperation.get();
        if (outcome.state === "fault") {
          markPendingTerminalFailure(binding as RuntimeWriteBinding, pending);
          throw new Error(t("transactionFaulted"));
        }
        if (outcome.state === "halt") {
          const notification = findEventTicketNotification(
            outcome,
            binding.contract,
            pending.eventName,
          );
          if (!notification) {
            markPendingTerminalFailure(binding as RuntimeWriteBinding, pending);
            throw new Error(t("pendingMismatch"));
          }
          const canonicalPayload = { state: notification.state };
          if (!pendingEventPayloadMatches(pending, canonicalPayload, account)) {
            markPendingTerminalFailure(binding as RuntimeWriteBinding, pending);
            throw new Error(t("pendingMismatch"));
          }
          eventPayload = canonicalPayload;
        }
      }
      if (!eventPayload) throw new Error(t("pendingStillConfirming"));

      if (pending.phase === "event_create") {
        const eventId = stringValue(eventValue(eventPayload, 0));
        if (
          !eventId ||
          !hashValueMatches(eventValue(eventPayload, 1), pending.creator ?? account) ||
          stringValue(eventValue(eventPayload, 2)) !== pending.name
        ) throw new Error(t("pendingMismatch"));
        const event = await loadEventDetails(eventId);
        if (
          !event ||
          !hashValueMatches(event.creator, pending.creator ?? account) ||
          event.name !== pending.name ||
          event.venue !== pending.venue ||
          (pending.notes !== undefined && event.notes !== pending.notes) ||
          event.startTime !== pending.startTime ||
          event.endTime !== pending.endTime ||
          event.maxSupply.toString() !== pending.maxSupply ||
          !event.active
        ) throw new Error(t("pendingStillConfirming"));
        events.set(mergeEvent(events.get(), event));
        if (event.endTime <= 0 || event.endTime >= Math.floor(Date.now() / 1000)) {
          discoveredEvents.set(mergeEvent(discoveredEvents.get(), event));
        }
        selectedEventId.set(event.id);
      } else if (pending.phase === "event_toggle") {
        if (stringValue(eventValue(eventPayload, 0)) !== pending.eventId) {
          throw new Error(t("pendingMismatch"));
        }
        const event = await loadEventDetails(pending.eventId ?? "");
        if (
          !event ||
          !hashValueMatches(event.creator, pending.creator ?? account) ||
          event.active !== pending.active
        ) throw new Error(t("pendingStillConfirming"));
        events.set(mergeEvent(events.get(), event));
        discoveredEvents.set(
          event.active &&
            (event.endTime <= 0 || event.endTime >= Math.floor(Date.now() / 1000))
            ? mergeEvent(discoveredEvents.get(), event)
            : discoveredEvents.get().filter((item) => item.id !== event.id),
        );
      } else if (pending.phase === "ticket_issue") {
        const tokenId = decodeTokenId(eventValue(eventPayload, 0));
        if (
          !isTicketTokenId(tokenId) ||
          stringValue(eventValue(eventPayload, 1)) !== pending.eventId ||
          !hashValueMatches(eventValue(eventPayload, 2), pending.recipient ?? "")
        ) throw new Error(t("pendingMismatch"));
        const ticket = await loadTicketDetails(tokenId);
        if (
          !ticket ||
          ticket.eventId !== pending.eventId ||
          !hashValueMatches(ticket.owner, pending.recipient ?? "") ||
          ticket.seat !== (pending.seat ?? "") ||
          ticket.memo !== (pending.memo ?? "") ||
          ticket.used
        ) throw new Error(t("pendingStillConfirming"));
        if (hashValueMatches(ticket.owner, account)) {
          tickets.set(mergeTicket(tickets.get(), ticket));
        }
        if (selectedEventId.get() === ticket.eventId) {
          gateTickets.set(mergeTicket(gateTickets.get(), ticket));
        }
      } else if (pending.phase === "ticket_checkin") {
        if (
          decodeTokenId(eventValue(eventPayload, 0)) !== pending.tokenId ||
          stringValue(eventValue(eventPayload, 1)) !== pending.eventId ||
          !hashValueMatches(eventValue(eventPayload, 2), pending.creator ?? account)
        ) throw new Error(t("pendingMismatch"));
        const ticket = await loadTicketDetails(pending.tokenId ?? "");
        if (!ticket || !ticket.used || ticket.usedTime <= 0) {
          throw new Error(t("pendingStillConfirming"));
        }
        lookup.set(ticket);
        if (tickets.get().some((item) => item.tokenId === ticket.tokenId)) {
          tickets.set(mergeTicket(tickets.get(), ticket));
        }
        if (gateTickets.get().some((item) => item.tokenId === ticket.tokenId)) {
          gateTickets.set(mergeTicket(gateTickets.get(), ticket));
        }
      } else {
        if (
          !hashValueMatches(eventValue(eventPayload, 0), pending.creator ?? account) ||
          !hashValueMatches(eventValue(eventPayload, 1), pending.recipient ?? "") ||
          parseBigInt(eventValue(eventPayload, 2)) !== 1n ||
          decodeTokenId(eventValue(eventPayload, 3)) !== pending.tokenId
        ) throw new Error(t("pendingMismatch"));
        const ticket = await loadTicketDetails(pending.tokenId ?? "");
        if (!ticket || !hashValueMatches(ticket.owner, pending.recipient ?? "")) {
          throw new Error(t("pendingStillConfirming"));
        }
        tickets.set(tickets.get().filter((item) => item.tokenId !== ticket.tokenId));
        if (gateTickets.get().some((item) => item.tokenId === ticket.tokenId)) {
          gateTickets.set(mergeTicket(gateTickets.get(), ticket));
        }
      }

      clearPending(binding as RuntimeWriteBinding);
      latestResult.set({
        kind: `${pending.phase}_recovered`,
        txid: pending.txid,
        verified: true,
      });
      workflowStatus.set(t("pendingRecovered"));
      lastError.set("");
      await Promise.all([
        refreshDiscovery({ quiet: true }),
        refreshEvents({ quiet: true }),
        refreshTickets({ quiet: true }),
        refreshGateTickets(selectedEventId.get(), { quiet: true }),
      ]);
      return null;
    } catch (error) {
      if (
        generation !== recoveryGeneration ||
        !walletRequestIsCurrent(requestWalletGeneration, account)
      ) return pendingOperation.get();
      const message = app.errors.messageOf(error, t("pendingStillConfirming"));
      workflowStatus.set(message);
      if (!options.quiet) {
        lastError.set(message);
        throw error;
      }
      return pendingOperation.get();
    } finally {
      if (generation === recoveryGeneration) isRecovering.set(false);
    }
  }

  function startTransfer(ticket: unknown) {
    const item = ticket as TicketItem;
    if (!item?.tokenId) return;
    transferTokenId.set(item.tokenId);
    transferRecipient.set("");
  }

  async function refreshWalletScope(account: string, generation: number) {
    const binding = await refreshRuntimeReadiness(account);
    if (
      generation !== walletGeneration ||
      accountKey(currentAddress()) !== accountKey(account) ||
      !binding
    ) return;
    await Promise.all([
      refreshDiscovery({ quiet: true }),
      ...(account
        ? [refreshEvents({ quiet: true }), refreshTickets({ quiet: true })]
        : []),
    ]);
    if (
      account &&
      generation === walletGeneration &&
      selectedEventId.get()
    ) await refreshGateTickets(selectedEventId.get(), { quiet: true });
    if (
      generation === walletGeneration &&
      accountKey(currentAddress()) === accountKey(account) &&
      pendingOperation.get()
    ) await recoverPending({ quiet: true });
  }

  const unsubscribeWallet = app.chain.address.subscribe(() => {
    const nextAddress = stringValue(app.chain.address.get());
    // A same-address notification can still mean the wallet changed network.
    // Treat every bridge emission as a new chain context and re-attest it.
    walletGeneration += 1;
    runtimeGeneration += 1;
    eventsGeneration += 1;
    discoveryGeneration += 1;
    ticketsGeneration += 1;
    gateTicketsGeneration += 1;
    lookupGeneration += 1;
    recoveryGeneration += 1;
    const generation = walletGeneration;

    address.set(nextAddress);
    events.set([]);
    discoveredEvents.set([]);
    tickets.set([]);
    gateTickets.set([]);
    lookup.set(null);
    selectedEventId.set("");
    pendingOperation.set(null);
    ticketsExpectedCount.set(0);
    ticketsVerification.set(nextAddress ? "loading" : "wallet");
    gateTicketsExpectedCount.set(0);
    gateTicketsVerification.set(nextAddress ? "loading" : "event");
    latestRequest.set(null);
    latestResult.set(null);
    transferTokenId.set("");
    transferRecipient.set("");
    isRefreshing.set(false);
    isRefreshingDiscovery.set(false);
    isRefreshingTickets.set(false);
    isRefreshingGateTickets.set(false);
    isLookingUp.set(false);
    isRecovering.set(false);
    lastError.set("");

    if (!nextAddress && !normalizeEventTicketNetwork(launchNetwork)) {
      runtimeStatus.set("wallet");
      runtimeMessage.set(t("runtimeConnectWallet"));
      activeNetwork.set("");
      return;
    }
    void refreshWalletScope(nextAddress, generation);
  });
  app.lifecycle.cleanup(unsubscribeWallet);

  async function loadAll() {
    isLoading.set(true);
    try {
      const existing = currentAddress();
      if (existing && !address.get()) address.set(existing);
      const binding = await refreshRuntimeReadiness(existing);
      if (!binding) return;
      await Promise.all([
        refreshDiscovery({ quiet: true }),
        refreshEvents({ quiet: true }),
        refreshTickets({ quiet: true }),
      ]);
      if (selectedEventId.get()) {
        await refreshGateTickets(selectedEventId.get(), { quiet: true });
      }
      if (pendingOperation.get()) await recoverPending({ quiet: true });
    } finally {
      isLoading.set(false);
    }
  }

  return {
    events,
    discoveredEvents,
    tickets,
    gateTickets,
    address,
    selectedEventId,
    selectedEvent,
    lookup,
    latestRequest,
    latestResult,
    workflowStatus,
    lastError,
    ticketsVerification,
    ticketsExpectedCount,
    gateTicketsVerification,
    gateTicketsExpectedCount,
    runtimeStatus,
    runtimeMessage,
    activeNetwork,
    pendingOperation,
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
    isConnecting,
    isRefreshing,
    isRefreshingTickets,
    isRefreshingGateTickets,
    isRefreshingDiscovery,
    isRecovering,
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
    refreshDiscovery,
    refreshTickets,
    refreshGateTickets,
    refreshRuntimeReadiness,
    createEvent,
    selectEvent,
    openIssueModal,
    issueTicket,
    toggleEvent,
    lookupTicket,
    checkInTicket,
    transferTicket,
    recoverPending,
    startTransfer,
    loadAll,
  };
}

export type UseEventTicketReturn = ReturnType<typeof useEventTicket>;
