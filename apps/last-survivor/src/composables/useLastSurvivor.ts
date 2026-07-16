/**
 * useLastSurvivor — Domain logic for the Last Survivor (doomsday clock) miniapp.
 *
 * Talks DIRECTLY to the app's standalone on-chain contract
 * (MiniAppLastSurvivor) via ctx.framework.chain. The earlier path routed
 * buy/settle through the OS game/payment/leaderboard/storage/badge kernel
 * proxies, which never actually held a pot or paid a winner — buys funded GAS
 * that was never distributed and "rollover" was a no-op. This composable now
 * drives the dedicated contract, a FOMO-style pot game where each key extends a
 * countdown, the pot grows on a rising bonding curve, and the LAST buyer wins
 * the entire pot as pull-payment credit when settle() runs (permissionless,
 * no oracle, no off-chain keeper required).
 *
 * Contract interaction model (verified against MiniAppLastSurvivor.cs / ABI):
 *
 *   READS (app.chain.readRaw, default app contract script hash):
 *     currentRoundId()                 -> Integer (rounds are 1-based)
 *     creditOf(player)                 -> Integer (prepaid GAS credit, base units)
 *     playerKeys(roundId, player)      -> Integer (keys held by the player)
 *     currentKeyCost(count)            -> Integer (cost of `count` keys NOW)
 *     keyCost(totalKeys, count)        -> Integer (cost given a round total)
 *     getCurrentRound()                -> Map{roundId,pot,totalKeys,lastBuyer,
 *                                           endTime(ms),settled,active,
 *                                           remainingTime(seconds)}
 *     getRound(id)                     -> Map{...same...}
 *
 *   MUTATIONS (app.chain.invoke):
 *     1. DEPOSIT (fund a buy) — a GAS transfer to the contract with the memo
 *        "miniapp-lastsurvivor:buy" so OnNEP17Payment credits the sender's
 *        prepaid balance:
 *          transfer(from, CONTRACT, costBaseUnits, "miniapp-lastsurvivor:buy")
 *          { scriptHash: GAS_HASH }
 *     2. buyKeys(player, count) -> cost. Consumes the prepaid credit at the
 *        rising bonding-curve price, adds the cost to the round pot, makes the
 *        player the last buyer, and extends the countdown. If buyKeys fails
 *        after a successful deposit the credit simply remains on the contract as
 *        reusable prepaid credit for the next buy — the deposit nets against any
 *        existing creditOf(player), and a stranded balance is reclaimable via
 *        withdraw (no funds are lost).
 *     settle() -> pot. PERMISSIONLESS. Once the round's countdown has expired it
 *        credits the recorded last buyer and advances to a fresh round. Anyone
 *        may call it; the on-chain last buyer remains the winner.
 *     withdraw(account) -> credit. Pays the whole unused prepaid buy-credit back
 *        to the wallet ("CreditWithdrawn" event, state[1] = amount) — the
 *        recovery path when a deposit landed but buyKeys never completed.
 *
 * AMOUNT CONVENTION: the contract takes/returns BASE UNITS. GAS = human × 1e8.
 * getCurrentRound.endTime is MILLISECONDS (Runtime.Time units); remainingTime is
 * already SECONDS. The contract's key-cost math is IDENTICAL to the frontend's
 * calculateKeyCostFormula (BASE_KEY_PRICE = 10_000_000 base units, +0.1% per
 * key), so the on-screen estimate equals exactly what the contract charges.
 *
 * The composable still owns:
 *   - Reactive state (observables + derived) for manifest/PlayArea bindings
 *   - Countdown timer logic (danger level, pulse, etc.)
 *   - Key cost formula (pure frontend math, mirrors the contract)
 *   - Loading/buying/settling UI flags (double-submit guards)
 *   - Formatted display values
 */

import { createObservable, createDerived } from "@shared/react/context";
import type { MiniAppFramework } from "@shared/react";
import { formatNumber, formatAddress, fromFixed8 } from "@shared/utils/format";
import { eventValue } from "@shared/utils/chain-events";
import { addressToScriptHash } from "@shared/utils/neo";
import { BLOCKCHAIN_CONSTANTS } from "@shared/constants";
import { getMiniAppContractHash } from "@shared/constants/rpc";
import {
  createPendingPurchaseStore,
  type PendingDeposit,
  type PendingLastSurvivorOperation,
  type PendingPurchase,
  type PendingPurchaseScope,
  type PendingSettlement,
  type PendingWithdrawal,
} from "../logic/pending-purchase-store";
import {
  readLastSurvivorTransactionOutcome,
  type LastSurvivorTransactionOutcome,
} from "../logic/last-survivor-rpc";

// HistoryEvent type (extracted from HistoryList component)
export interface HistoryEvent {
  id: string | number;
  title: string;
  details: string;
  date: string;
  /**
   * Numeric, newest-first ordering key. Derived from the round id so the
   * settled-round winner entries sort deterministically (highest round first).
   */
  sortKey: number;
}

// ============================================================================
// Constants
// ============================================================================

/** Base key price in GAS base units (0.1 GAS). Mirrors BASE_KEY_PRICE. */
const BASE_KEY_PRICE = 10000000n;
/** +0.1% of base per key already sold. Mirrors COMMON_DIFF (10 bps). */
const KEY_PRICE_INCREMENT_BPS = 10n;

/** Memo the contract requires on the buy-funding transfer. */
const BUY_MEMO = "miniapp-lastsurvivor:buy";
const PURCHASE_CONFIRM_TIMEOUT_MS = 45_000;
const RECOVERY_RECHECK_TIMEOUT_MS = 12_000;

/** Final ten-minute pressure window used by the doomsday meter. */
const DANGER_WINDOW_SECONDS = 600;

/** The zero script hash a fresh round carries for lastBuyer (UInt160.Zero). */
const ZERO_HASH = "0x0000000000000000000000000000000000000000";

/** How many past rounds to rebuild into the history list (newest first). */
const MAX_HISTORY_ROUNDS = 30;
const LAST_SURVIVOR_APP_ID = "miniapp-last-survivor";
const HASH160_PATTERN = /^0x[0-9a-f]{40}$/;

type NeoNetwork = "mainnet" | "testnet";

interface BoundChainContext {
  network: NeoNetwork;
  contractHash: string;
  playerAddress?: string;
  playerHash?: string;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error ?? "");
}

interface EventConfirmationResult {
  txid?: string;
  event?: unknown;
  verified?: boolean;
}

const normalizeTxid = (value: unknown): string => {
  const raw = String(value ?? "").trim().toLowerCase();
  return /^[0-9a-f]+$/i.test(raw) ? `0x${raw}` : raw;
};

function unwrapValue(value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  if ("value" in value) return unwrapValue((value as { value?: unknown }).value);
  return value;
}

/** Strict integer parser: unavailable or malformed chain data never becomes 0. */
function strictBigInt(value: unknown): bigint | null {
  const raw = unwrapValue(value);
  if (typeof raw === "bigint") return raw;
  if (typeof raw === "number") return Number.isSafeInteger(raw) ? BigInt(raw) : null;
  if (typeof raw !== "string" || !/^-?(?:0|[1-9]\d*)$/.test(raw.trim())) return null;
  try {
    return BigInt(raw.trim());
  } catch {
    return null;
  }
}

function strictBoolean(value: unknown): boolean | null {
  const raw = unwrapValue(value);
  if (raw === true || raw === false) return raw;
  if (raw === 1 || raw === "1" || raw === "true") return true;
  if (raw === 0 || raw === "0" || raw === "false") return false;
  return null;
}

function explicitNeoNetwork(value: unknown): NeoNetwork | null {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "mainnet" || normalized === "neo-n3-mainnet") return "mainnet";
  if (normalized === "testnet" || normalized === "neo-n3-testnet") return "testnet";
  return null;
}

function normalizeHash160(value: unknown): string {
  const raw = String(unwrapValue(value) ?? "").trim();
  const direct = raw.toLowerCase();
  if (HASH160_PATTERN.test(direct)) return direct;
  const converted = addressToScriptHash(raw);
  const normalized = String(converted || "").trim().toLowerCase();
  return HASH160_PATTERN.test(normalized) ? normalized : "";
}

/**
 * Convert a contract base-unit Integer to whole GAS as a number. Base units
 * are an integer count of 1e-8 GAS; dividing by 1e8 yields human GAS.
 */
const fromBaseUnits = (base: bigint): number => Number(base) / 1e8;

/**
 * Is a parsed Hash160 / address value the zero address (a fresh round's
 * lastBuyer)? Treats "", the 0x-zero hash, and the base58 zero form as empty.
 */
const isZeroAddress = (value: string): boolean => {
  if (!value) return true;
  const v = value.trim();
  if (v === ZERO_HASH) return true;
  // A 0x-hash of all zeros (case/length tolerant).
  if (/^0x0{40}$/i.test(v)) return true;
  return false;
};

// ============================================================================
// Types
// ============================================================================

export interface UseLastSurvivorOptions {
  /** MiniApp framework SDK from ctx.framework (chain args / reads / invokes). */
  app: MiniAppFramework;
  /** Translation function. */
  t: (key: string, params?: Record<string, string | number>) => string;
  /** Injectable application-log reader for deterministic product tests. */
  transactionOutcomeReader?: (
    network: unknown,
    txid: unknown,
    eventName: unknown,
    contractHash: unknown,
  ) => Promise<LastSurvivorTransactionOutcome>;
}

/**
 * Normalized current-round snapshot read from getCurrentRound(). Amount fields
 * are kept in their contract scale (pot in base units, remainingTime seconds).
 */
interface RoundSnapshot {
  roundId: number;
  potBase: bigint;
  totalKeys: bigint;
  lastBuyer: string;
  endTimeMs: number;
  settled: boolean;
  active: boolean;
  remainingSeconds: number;
}

// ============================================================================
// Round map parsing
// ============================================================================

/**
 * Map a getCurrentRound / getRound Map (returned by app.chain.readRaw as a plain
 * object) into a RoundSnapshot. Returns null for an unknown / empty result.
 */
function parseRound(raw: unknown): RoundSnapshot | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const v = raw as Record<string, unknown>;
  const parsedRoundId = strictBigInt(v.roundId);
  const potBase = strictBigInt(v.pot);
  const totalKeys = strictBigInt(v.totalKeys);
  const endTimeMs = strictBigInt(v.endTime);
  const remainingSeconds = strictBigInt(v.remainingTime);
  const settled = strictBoolean(v.settled);
  const active = strictBoolean(v.active);
  const lastBuyerRaw = String(unwrapValue(v.lastBuyer) ?? "").trim();
  const roundIdNumber = parsedRoundId === null ? NaN : Number(parsedRoundId);
  const endTimeNumber = endTimeMs === null ? NaN : Number(endTimeMs);
  const remainingNumber = remainingSeconds === null ? NaN : Number(remainingSeconds);
  if (
    !Number.isSafeInteger(roundIdNumber) ||
    roundIdNumber <= 0 ||
    potBase === null || potBase < 0n ||
    totalKeys === null || totalKeys < 0n ||
    !Number.isSafeInteger(endTimeNumber) || endTimeNumber < 0 ||
    !Number.isSafeInteger(remainingNumber) || remainingNumber < 0 ||
    settled === null ||
    active === null ||
    (lastBuyerRaw && !isZeroAddress(lastBuyerRaw) && !normalizeHash160(lastBuyerRaw))
  ) return null;
  return {
    roundId: roundIdNumber,
    potBase,
    totalKeys,
    lastBuyer: isZeroAddress(lastBuyerRaw) ? "" : normalizeHash160(lastBuyerRaw),
    endTimeMs: endTimeNumber,
    settled,
    active,
    remainingSeconds: remainingNumber,
  };
}

// ============================================================================
// Composable
// ============================================================================

export function useLastSurvivor({
  app,
  t,
  transactionOutcomeReader = readLastSurvivorTransactionOutcome,
}: UseLastSurvivorOptions) {
  // ── Game State ──────────────────────────────────────────────────────
  const roundId = createObservable(0);
  const totalPot = createObservable(0);
  const isRoundActive = createObservable(false);
  const lastBuyer = createObservable<string | null>(null);
  const userKeys = createObservable(0);
  const keyCount = createObservable("1");
  const keyValidationError = createObservable<string | null>(null);
  const history = createObservable<HistoryEvent[]>([]);
  const isBuyingKeys = createObservable(false);
  const isSettling = createObservable(false);
  const isLoading = createObservable(false);
  const totalKeysInRound = createObservable(0n);
  const roundDataAvailable = createObservable(false);
  /**
   * Has a round read COMPLETED at least once (success or failure)? Distinct from
   * `roundDataAvailable`, which is false both before the first read and after a
   * failed one. The shell chrome binds the round read-outs with no loading gate,
   * so that conflation published `t("notAvailable")` ("N/A") the instant a
   * visitor arrived — a dashed prize pot on a pot-based game, before any read
   * had run. This flag separates "not read yet" (→ pendingKey) from "read, and
   * there is genuinely no round" (→ a real "N/A" reading). Set in loadAll's
   * finally so even the throw / early-return paths settle it; guest mode never
   * needs it because the guest engine sets `roundDataAvailable` true directly.
   */
  const roundSettled = createObservable(false);
  const userKeysAvailable = createObservable(false);
  const creditAvailable = createObservable(false);
  const historyAvailable = createObservable(false);
  const quoteAvailable = createObservable(false);
  const serviceNotice = createObservable("");
  /** Connected wallet's unused prepaid buy-credit (human GAS). */
  const prepaidCredit = createObservable(0);
  /** Any exact transaction recovery is unresolved; financial actions stay locked. */
  const purchasePending = createObservable(false);
  const pendingOperationKind = createObservable("");
  const pendingTransactionId = createObservable("");
  const recoveryNotice = createObservable("");
  const storageHealthy = createObservable(true);
  const pendingPurchaseStore = createPendingPurchaseStore(app.storage.local);
  let recoveryInFlight: Promise<boolean> | null = null;

  // Connected wallet address (synced from main.tsx / chain).
  const address = createObservable<string | null>(app.chain.address.get() ?? null);

  const setAddress = (addr: string | null) => {
    address.set(addr ?? null);
  };

  const requireBoundContext = async (requireWallet: boolean): Promise<BoundChainContext> => {
    const detected = explicitNeoNetwork(await app.chain.detectNetwork());
    const launched = explicitNeoNetwork(app.platform.launch.network);
    if (!detected || (launched && launched !== detected)) {
      throw new Error(t("chainBindingMismatch"));
    }
    const contractHash = normalizeHash160(app.chain.contractAddress.get());
    const expectedContract = normalizeHash160(
      getMiniAppContractHash(LAST_SURVIVOR_APP_ID, detected),
    );
    if (!contractHash || !expectedContract || contractHash !== expectedContract) {
      throw new Error(t("chainBindingMismatch"));
    }
    if (!requireWallet) return { network: detected, contractHash };

    const ensuredAddress = String(await app.chain.ensureWallet() ?? "").trim();
    const boundAddress = String(app.chain.address.get() ?? ensuredAddress).trim();
    const ensuredHash = normalizeHash160(ensuredAddress);
    const boundHash = normalizeHash160(boundAddress);
    if (!ensuredHash || !boundHash || ensuredHash !== boundHash) {
      throw new Error(t("walletBindingMismatch"));
    }
    setAddress(boundAddress);
    return {
      network: detected,
      contractHash,
      playerAddress: boundAddress,
      playerHash: boundHash,
    };
  };

  const pendingScope = (context: BoundChainContext): PendingPurchaseScope => ({
    network: context.network,
    contract: context.contractHash,
    player: context.playerHash ?? "",
  });

  const eventMatchesTransaction = (
    event: unknown,
    record: PendingLastSurvivorOperation,
  ): boolean => {
    if (!event || typeof event !== "object") return false;
    const metadata = event as Record<string, unknown>;
    const eventTxid = normalizeTxid(
      metadata.tx_hash ?? metadata.txid ?? metadata.transaction_hash ?? metadata.transactionHash,
    );
    const eventName = String(metadata.event_name ?? metadata.eventName ?? "").trim();
    const expectedEventName = record.kind === "purchase"
      ? "KeysBought"
      : record.kind === "deposit"
        ? "Credited"
        : record.kind === "settle"
          ? "RoundSettled"
          : "CreditWithdrawn";
    return (
      (!eventTxid || eventTxid === normalizeTxid(record.txid)) &&
      (!eventName || eventName === expectedEventName)
    );
  };

  const matchesPendingPurchase = (
    event: unknown,
    record: PendingPurchase,
  ): boolean => {
    if (!eventMatchesTransaction(event, record)) return false;
    const eventRound = strictBigInt(eventValue(event, 0));
    const quotedRound = strictBigInt(record.roundId);
    const eventCount = strictBigInt(eventValue(event, 2));
    const eventCost = strictBigInt(eventValue(event, 3));
    return (
      eventRound !== null &&
      quotedRound !== null &&
      eventCount !== null &&
      eventCost !== null &&
      // A permissionless settle can roll the round forward between quote and
      // inclusion. The exact tx's KeysBought event is authoritative; accepting
      // a newer round prevents a successful purchase from wedging recovery.
      eventRound >= quotedRound &&
      normalizeHash160(eventValue(event, 1)) === record.player &&
      eventCount.toString() === record.count &&
      eventCost > 0n
    );
  };

  const matchesPendingDeposit = (event: unknown, record: PendingDeposit): boolean => {
    if (!eventMatchesTransaction(event, record)) return false;
    const amount = strictBigInt(eventValue(event, 1));
    const balance = strictBigInt(eventValue(event, 2));
    return (
      normalizeHash160(eventValue(event, 0)) === record.player &&
      amount?.toString() === record.amount &&
      balance !== null &&
      balance >= BigInt(record.expectedCredit)
    );
  };

  const matchesPendingSettlement = (event: unknown, record: PendingSettlement): boolean => {
    if (!eventMatchesTransaction(event, record)) return false;
    return (
      strictBigInt(eventValue(event, 0))?.toString() === record.roundId &&
      normalizeHash160(eventValue(event, 1)) === record.winner &&
      strictBigInt(eventValue(event, 2))?.toString() === record.pot &&
      strictBigInt(eventValue(event, 3))?.toString() === record.nextRoundId
    );
  };

  const matchesPendingWithdrawal = (event: unknown, record: PendingWithdrawal): boolean => {
    if (!eventMatchesTransaction(event, record)) return false;
    return (
      normalizeHash160(eventValue(event, 0)) === record.player &&
      strictBigInt(eventValue(event, 1))?.toString() === record.beforeCredit
    );
  };

  const readUnsigned = async (operation: string, args: ReturnType<typeof app.chain.arg.integer>[] | unknown[] = []) => {
    const value = strictBigInt(await app.chain.readRaw(operation, args as never));
    if (value === null || value < 0n) throw new Error(t("contractReadUnavailable"));
    return value;
  };

  const confirmOperationReadback = async (
    record: PendingLastSurvivorOperation,
    exactEvent: unknown,
  ): Promise<boolean> => {
    if (record.kind === "purchase") {
      if (!matchesPendingPurchase(exactEvent, record)) return false;
      const eventRound = strictBigInt(eventValue(exactEvent, 0));
      if (eventRound === null || eventRound <= 0n) return false;
      const round = parseRound(await app.chain.readRaw("getRound", [
        app.chain.arg.integer(eventRound),
      ]));
      const playerKeys = await readUnsigned("playerKeys", [
        app.chain.arg.integer(eventRound),
        app.chain.arg.hash160(record.player),
      ]);
      const eventPot = strictBigInt(eventValue(exactEvent, 4));
      return Boolean(
        round &&
        BigInt(round.roundId) === eventRound &&
        round.totalKeys >= BigInt(record.count) &&
        playerKeys >= BigInt(record.count) &&
        (eventPot === null || round.potBase >= eventPot),
      );
    }
    if (record.kind === "deposit") {
      if (!matchesPendingDeposit(exactEvent, record)) return false;
      const credit = await readUnsigned("creditOf", [app.chain.arg.hash160(record.player)]);
      return credit >= BigInt(record.expectedCredit);
    }
    if (record.kind === "settle") {
      if (!matchesPendingSettlement(exactEvent, record)) return false;
      const [settledRound, currentRound] = await Promise.all([
        app.chain.readRaw("getRound", [app.chain.arg.integer(record.roundId)]),
        app.chain.readRaw("getCurrentRound", []),
      ]);
      const historical = parseRound(settledRound);
      const current = parseRound(currentRound);
      return Boolean(
        historical?.settled === true &&
        historical.roundId === Number(record.roundId) &&
        historical.lastBuyer === record.winner &&
        historical.potBase.toString() === record.pot &&
        current &&
        current.roundId >= Number(record.nextRoundId),
      );
    }
    if (!matchesPendingWithdrawal(exactEvent, record)) return false;
    const credit = await readUnsigned("creditOf", [app.chain.arg.hash160(record.player)]);
    return credit === 0n;
  };

  const eventNameFor = (record: PendingLastSurvivorOperation): string => {
    if (record.kind === "purchase") return "KeysBought";
    if (record.kind === "deposit") return "Credited";
    if (record.kind === "settle") return "RoundSettled";
    return "CreditWithdrawn";
  };

  const showPending = (record: PendingLastSurvivorOperation) => {
    purchasePending.set(true);
    pendingOperationKind.set(record.kind);
    pendingTransactionId.set(record.txid);
    recoveryNotice.set(t("transactionRecoveryPending"));
  };

  const clearPendingState = () => {
    purchasePending.set(false);
    pendingOperationKind.set("");
    pendingTransactionId.set("");
    recoveryNotice.set("");
  };

  const persistPending = (
    scope: PendingPurchaseScope,
    input: Parameters<typeof pendingPurchaseStore.save>[1],
  ): PendingLastSurvivorOperation => {
    try {
      const record = pendingPurchaseStore.save(scope, input);
      storageHealthy.set(true);
      showPending(record);
      return record;
    } catch {
      const recovered = (() => {
        try { return pendingPurchaseStore.load(scope); } catch { return null; }
      })();
      if (recovered) {
        showPending(recovered);
      } else {
        purchasePending.set(true);
        pendingOperationKind.set("kind" in input ? input.kind : "purchase");
        pendingTransactionId.set(normalizeTxid(input.txid));
      }
      storageHealthy.set(false);
      const txid = recovered?.txid || normalizeTxid(input.txid);
      const message = t("recoveryStorageUnavailableAfterBroadcast", { txid });
      recoveryNotice.set(message);
      throw new Error(message);
    }
  };

  const loadPendingRecord = (scope: PendingPurchaseScope) => {
    try {
      const record = pendingPurchaseStore.load(scope);
      if (record) {
        // load() can intentionally return the exact in-memory post-broadcast
        // record when durable storage became unavailable after preflight.
        storageHealthy.set(pendingPurchaseStore.isDurable(scope, record));
      } else {
        try {
          pendingPurchaseStore.assertAvailable();
          storageHealthy.set(true);
        } catch {
          storageHealthy.set(false);
        }
      }
      return record;
    } catch {
      storageHealthy.set(false);
      purchasePending.set(true);
      recoveryNotice.set(t("recoveryRecordInvalid"));
      throw new Error(t("recoveryRecordInvalid"));
    }
  };

  const clearPersistedPending = (scope: PendingPurchaseScope): boolean => {
    try {
      pendingPurchaseStore.clear(scope);
      storageHealthy.set(true);
      clearPendingState();
      return true;
    } catch {
      storageHealthy.set(false);
      purchasePending.set(true);
      recoveryNotice.set(t("recoveryStorageUnavailable"));
      return false;
    }
  };

  const confirmSubmittedOperation = async (
    scope: PendingPurchaseScope,
    record: PendingLastSurvivorOperation,
    result: EventConfirmationResult,
    timeoutMs = PURCHASE_CONFIRM_TIMEOUT_MS,
  ): Promise<boolean> => {
    let exactEvent = result.verified === true && result.event
      ? result.event
      : null;
    if (exactEvent && !(await confirmOperationReadback(record, exactEvent))) {
      exactEvent = null;
    }
    if (!exactEvent) {
      const recovered = await app.events.waitFor(
        record.txid,
        eventNameFor(record),
        timeoutMs,
      );
      if (recovered && await confirmOperationReadback(record, recovered)) {
        exactEvent = recovered;
      }
    }
    if (!exactEvent) {
      const outcome = await transactionOutcomeReader(
        record.network,
        record.txid,
        eventNameFor(record),
        record.contract,
      );
      if (outcome.state === "fault") {
        clearPersistedPending(scope);
        recoveryNotice.set(t("transactionFault"));
        throw new Error(t("transactionFault"));
      }
      if (outcome.state === "halt" && outcome.event) {
        if (await confirmOperationReadback(record, outcome.event)) exactEvent = outcome.event;
      } else if (outcome.state === "halt") {
        recoveryNotice.set(t("transactionEventMismatch"));
      }
    }
    if (!exactEvent) {
      showPending(record);
      recoveryNotice.set(t("transactionRecoveryStillPending"));
      return false;
    }
    return clearPersistedPending(scope);
  };

  const recoverPendingPurchaseForScope = async (
    scope: PendingPurchaseScope,
    timeoutMs = RECOVERY_RECHECK_TIMEOUT_MS,
  ): Promise<boolean> => {
    let record: PendingLastSurvivorOperation | null = null;
    try {
      record = loadPendingRecord(scope);
    } catch {
      storageHealthy.set(false);
      purchasePending.set(true);
      recoveryNotice.set(t("recoveryRecordInvalid"));
      return false;
    }
    if (!record) {
      clearPendingState();
      return false;
    }
    showPending(record);
    if (recoveryInFlight) return recoveryInFlight;
    recoveryInFlight = (async () => {
      try {
        const exactEvent = await app.events.waitFor(
          record.txid,
          eventNameFor(record),
          timeoutMs,
        );
        let recoveredEvent = exactEvent;
        if (!recoveredEvent) {
          const outcome = await transactionOutcomeReader(
            record.network,
            record.txid,
            eventNameFor(record),
            record.contract,
          );
          if (outcome.state === "fault") {
            clearPersistedPending(scope);
            recoveryNotice.set(t("transactionFault"));
            return false;
          }
          if (outcome.state === "halt") recoveredEvent = outcome.event;
          if (outcome.state === "halt" && !outcome.event) {
            recoveryNotice.set(t("transactionEventMismatch"));
          }
        }
        if (!recoveredEvent || !(await confirmOperationReadback(record, recoveredEvent))) {
          recoveryNotice.set(t("transactionRecoveryStillPending"));
          return false;
        }
        if (!clearPersistedPending(scope)) return false;
        recoveryNotice.set(t("transactionRecoveryConfirmed"));
        return true;
      } catch {
        recoveryNotice.set(t("transactionRecoveryStillPending"));
        return false;
      } finally {
        recoveryInFlight = null;
      }
    })();
    return recoveryInFlight;
  };

  const recoverPendingPurchase = async (): Promise<boolean> => {
    if (app.mode.isGuest()) return false;
    const playerAddress = address.get() || app.chain.address.get() || "";
    const playerHash = normalizeHash160(playerAddress);
    if (!playerHash) {
      clearPendingState();
      return false;
    }
    try {
      const context = await requireBoundContext(false);
      return recoverPendingPurchaseForScope(
        pendingScope({ ...context, playerAddress, playerHash }),
      );
    } catch {
      serviceNotice.set(t("chainBindingMismatch"));
      return false;
    }
  };

  // ── Timer State ─────────────────────────────────────────────────────
  const endTime = createObservable(0);
  const now = createObservable(Date.now());

  const timeRemainingSeconds = createDerived(() => {
    if (!endTime.get()) return 0;
    return Math.max(0, Math.floor((endTime.get() - now.get()) / 1000));
  }, [now, endTime]);

  // Which phase the round read is in, for the chrome read-outs that MiniAppRoot
  // renders with no loading gate. `roundDataAvailable` alone conflates "not read
  // yet" with "read, no round"; pairing it with `roundSettled` tells them apart
  // so an unread binding says nothing (`undefined` → the manifest's pendingKey)
  // instead of publishing "N/A" the instant a visitor arrives.
  const roundReadPhase = (): "unread" | "ready" | "unavailable" =>
    roundDataAvailable.get() ? "ready" : roundSettled.get() ? "unavailable" : "unread";

  const countdown = createDerived(() => {
    // Unread: no round context exists yet (guest sets `roundDataAvailable` true
    // on enter, so guest is never unread). Say nothing rather than fabricate a
    // "00:00:00" clock that reads as a round already ended.
    if (roundReadPhase() === "unread") return undefined;
    const total = timeRemainingSeconds.get();
    const hours = String(Math.floor(total / 3600)).padStart(2, "0");
    const mins = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
    const secs = String(total % 60).padStart(2, "0");
    return `${hours}:${mins}:${secs}`;
  }, [timeRemainingSeconds, roundDataAvailable, roundSettled]);

  const dangerLevel = createDerived(() => {
    const seconds = timeRemainingSeconds.get();
    if (seconds <= 0) return "low";
    if (seconds > DANGER_WINDOW_SECONDS) return "low";
    if (seconds > 300) return "medium";
    if (seconds > 60) return "high";
    return "critical";
  }, [timeRemainingSeconds]);

  const dangerLevelText = createDerived(() => {
    switch (dangerLevel.get()) {
      case "low": return t("dangerLow");
      case "medium": return t("dangerMedium");
      case "high": return t("dangerHigh");
      case "critical": return t("dangerCritical");
      default: return t("dangerLow");
    }
  }, [dangerLevel]);

  const dangerProgress = createDerived(() => {
    const seconds = timeRemainingSeconds.get();
    if (seconds <= 0) return 0;
    const remainingShare = Math.min(seconds, DANGER_WINDOW_SECONDS) / DANGER_WINDOW_SECONDS;
    return Math.max(0, Math.min(100, (1 - remainingShare) * 100));
  }, [timeRemainingSeconds]);

  const shouldPulse = createDerived(() => {
    const seconds = timeRemainingSeconds.get();
    return seconds > 0 && seconds <= 60;
  }, [timeRemainingSeconds]);

  const updateNow = () => { now.set(Date.now()); };

  // ── Formatted display values ──────────────────────────────────────
  // Each round read-out resolves three honest phases (see `roundReadPhase`):
  // `undefined` while unread so the shell shows its pendingKey; the existing
  // "N/A" / "unavailable" word once a read has SETTLED with no round (a real
  // reading, kept verbatim); and the real value when the round is available.
  const lastBuyerLabel = createDerived(
    () => {
      switch (roundReadPhase()) {
        case "unread": return undefined;
        case "unavailable": return t("notAvailable");
        default: return lastBuyer.get() ? formatAddress(lastBuyer.get() ?? "") : t("awaitingFirstKey");
      }
    },
    [lastBuyer, roundDataAvailable, roundSettled],
  );
  const formattedRound = createDerived(
    () => {
      switch (roundReadPhase()) {
        case "unread": return undefined;
        case "unavailable": return t("notAvailable");
        default: return `#${roundId.get()}`;
      }
    },
    [roundId, roundDataAvailable, roundSettled],
  );
  const totalPotDisplay = createDerived(
    () => {
      switch (roundReadPhase()) {
        case "unread": return undefined;
        case "unavailable": return t("notAvailable");
        default: return `${formatNumber(totalPot.get(), 2)} ${t("tokenGas")}`;
      }
    },
    [totalPot, roundDataAvailable, roundSettled],
  );
  const roundStatusDisplay = createDerived(
    () => {
      switch (roundReadPhase()) {
        case "unread": return undefined;
        case "unavailable": return t("roundStateUnavailable");
        default: return isRoundActive.get() ? t("activeRound") : t("inactiveRound");
      }
    },
    [isRoundActive, roundDataAvailable, roundSettled],
  );
  // The chrome's read-out of the user's key count. `userKeys` stays a plain
  // number for the PlayArea; this is what the stat rail and sidebar bind. Only
  // the unread state is `undefined` (→ pendingKey). Once a round is in context
  // (guest sets it, or a gamefi read settled it), a settled 0 is a real reading
  // — "you hold 0 keys" — and renders as 0, never as pending copy.
  const userKeysDisplay = createDerived(
    () => (roundReadPhase() === "unread" ? undefined : userKeys.get()),
    [userKeys, roundDataAvailable, roundSettled],
  );

  // Round-total keys as a plain number for binding (the raw value is a bigint
  // tracked in `totalKeysInRound`, used by the cost formula). This is the
  // number of keys SOLD in the round — distinct from the buy-selector
  // `keyCount` picker, which is only used to estimate purchase cost.
  const totalKeysDisplay = createDerived(
    () => Number(totalKeysInRound.get()),
    [totalKeysInRound],
  );

  // The user's share of the round, as a percentage of the round's real total
  // keys. Guards divide-by-zero (returns 0 when no keys have been sold yet).
  const userSharePercent = createDerived(() => {
    if (!userKeysAvailable.get() || !roundDataAvailable.get()) return 0;
    const total = Number(totalKeysInRound.get());
    if (total <= 0) return 0;
    return (userKeys.get() / total) * 100;
  }, [totalKeysInRound, userKeys, userKeysAvailable, roundDataAvailable]);

  // The round has ended on chain (timer expired with a recorded last buyer and a
  // non-empty pot) and still needs settle() to pay the winner and roll forward.
  // The PlayArea surfaces this as the settle affordance.
  const needsLifecycleSync = createDerived(() => {
    const countdownExpired = endTime.get() > 0 && timeRemainingSeconds.get() <= 0;
    return (
      (!isRoundActive.get() || countdownExpired) &&
      !!lastBuyer.get() &&
      totalPot.get() > 0
    );
  }, [isRoundActive, endTime, timeRemainingSeconds, lastBuyer, totalPot]);

  /** True when the connected wallet has unused prepaid buy-credit to withdraw. */
  const hasCredit = createDerived(
    () => creditAvailable.get() && prepaidCredit.get() > 0,
    [prepaidCredit, creditAvailable],
  );

  // ── Key cost formula (pure frontend math, mirrors the contract) ────
  const calculateKeyCostFormula = (count: bigint, currentTotalKeys: bigint): bigint => {
    if (count <= 0n) return 0n;
    const commonDiff = (BASE_KEY_PRICE * KEY_PRICE_INCREMENT_BPS) / 10000n;
    const firstKeyPrice = BASE_KEY_PRICE + currentTotalKeys * commonDiff;
    const baseCost = count * firstKeyPrice;
    const incrementCost = ((count * (count - 1n)) / 2n) * commonDiff;
    return baseCost + incrementCost;
  };

  const estimatedCostRaw = createDerived(() => {
    const count = BigInt(Math.max(0, Math.floor(Number(keyCount.get()) || 0)));
    return calculateKeyCostFormula(count, totalKeysInRound.get());
  }, [keyCount, totalKeysInRound]);

  /** Exact human-GAS estimate used by the transaction pre-flight gate. */
  const estimatedCostGas = createDerived(
    () => fromBaseUnits(estimatedCostRaw.get()),
    [estimatedCostRaw],
  );

  const estimatedCost = createDerived(() => fromBaseUnits(estimatedCostRaw.get()).toFixed(2), [estimatedCostRaw]);

  // ── Data Loading (direct chain reads) ──────────────────────────────

  /**
   * Load the current round straight from getCurrentRound(). Maps the contract
   * Map into the observables the UI binds; returns the remaining time in
   * seconds (already the contract's unit) so loadAll can derive endTime.
   */
  const loadRoundData = async (): Promise<number | null> => {
    try {
      const raw = await app.chain.readRaw("getCurrentRound", []);
      const round = parseRound(raw);
      if (round) {
        roundId.set(round.roundId);
        // pot is in base units (1e8) — scale to whole GAS for display.
        totalPot.set(fromBaseUnits(round.potBase));
        // A round is buyable while active. A fresh round (no keys) is always
        // active; an expired round reports active=false and remainingTime 0.
        isRoundActive.set(round.active);
        lastBuyer.set(round.lastBuyer || "");
        totalKeysInRound.set(round.totalKeys);
        roundDataAvailable.set(true);
        serviceNotice.set("");
        return round.remainingSeconds;
      }
      roundDataAvailable.set(false);
      serviceNotice.set(t("roundStateUnavailable"));
      return null;
    } catch (e) {
      roundDataAvailable.set(false);
      serviceNotice.set(t("roundStateUnavailable"));
      console.warn("[useLastSurvivor] loadRoundData failed:", errorMessage(e));
      return null;
    }
  };

  /**
   * Load the connected wallet's key count for the current round via
   * playerKeys(roundId, player). Missing identity or a failed read is marked
   * unavailable; it is never presented as a verified zero-key position.
   */
  const loadUserKeys = async () => {
    const currentRound = roundId.get();
    const walletAddr = address.get();
    const walletHash = normalizeHash160(walletAddr);
    if (!currentRound || !walletHash) {
      userKeysAvailable.set(false);
      return;
    }
    try {
      const keys = strictBigInt(await app.chain.readRaw("playerKeys", [
        app.chain.arg.integer(currentRound),
        app.chain.arg.hash160(walletHash),
      ]));
      const numeric = keys === null ? NaN : Number(keys);
      if (keys === null || keys < 0n || !Number.isSafeInteger(numeric)) {
        throw new Error(t("contractReadUnavailable"));
      }
      userKeys.set(numeric);
      userKeysAvailable.set(true);
    } catch (e) {
      console.warn("[useLastSurvivor] loadUserKeys failed:", errorMessage(e));
      userKeysAvailable.set(false);
    }
  };

  /**
   * Refresh the connected wallet's unused prepaid buy-credit from
   * creditOf(account). Base units → human GAS. Missing identity or a failed
   * read is explicitly unavailable and leaves the last known amount untouched.
   */
  const loadCredit = async () => {
    const walletAddr = address.get();
    const walletHash = normalizeHash160(walletAddr);
    if (!walletHash) {
      creditAvailable.set(false);
      return;
    }
    try {
      const raw = strictBigInt(await app.chain.readRaw("creditOf", [
        app.chain.arg.hash160(walletHash),
      ]));
      if (raw === null || raw < 0n) throw new Error(t("contractReadUnavailable"));
      prepaidCredit.set(fromFixed8(raw));
      creditAvailable.set(true);
    } catch (e) {
      console.warn("[useLastSurvivor] creditOf read failed:", errorMessage(e));
      creditAvailable.set(false);
    }
  };

  const loadAuthoritativeQuote = async (countInput = keyCount.get()): Promise<bigint | null> => {
    const count = Number(countInput);
    if (!Number.isInteger(count) || count <= 0 || count > 1000) {
      quoteAvailable.set(false);
      return null;
    }
    try {
      const quote = strictBigInt(await app.chain.readRaw("currentKeyCost", [
        app.chain.arg.integer(count),
      ]));
      if (quote === null || quote <= 0n) throw new Error(t("contractReadUnavailable"));
      quoteAvailable.set(true);
      return quote;
    } catch {
      quoteAvailable.set(false);
      return null;
    }
  };

  /**
   * Rebuild the history list from past rounds. Rounds 1..currentRoundId-1 are
   * already finished; each settled round with a pot yields a "winnerDeclared"
   * entry (winner = lastBuyer, prize = pot). Newest first, capped at
   * MAX_HISTORY_ROUNDS. This replaces the leaderboard/storage event sources.
   */
  const loadHistory = async () => {
    try {
      const current = roundId.get();
      if (current <= 1) {
        history.set([]);
        historyAvailable.set(true);
        return;
      }

      // Scan the most recent finished rounds (current-1 down to the cap), newest
      // first. Round ids are 1-based; the current round is still in progress.
      const start = Math.max(1, current - MAX_HISTORY_ROUNDS);
      const ids: number[] = [];
      for (let id = current - 1; id >= start; id -= 1) ids.push(id);

      const results = await Promise.all(
        ids.map(async (id) => {
          try {
            const raw = await app.chain.readRaw("getRound", [
              app.chain.arg.integer(id),
            ]);
            return parseRound(raw);
          } catch (e) {
            console.warn(
              "[useLastSurvivor] getRound failed for",
              id,
              ":",
              errorMessage(e),
            );
            return null;
          }
        }),
      );

      const items: HistoryEvent[] = [];
      if (results.some((round) => round === null)) {
        historyAvailable.set(false);
        return;
      }
      for (const round of results) {
        if (!round) return;
        // A finished round with a winner + pot is a settled win. A round with no
        // keys / no buyer never produced a winner and is skipped.
        if (round.totalKeys <= 0n || !round.lastBuyer || round.potBase <= 0n) continue;
        const prizeGas = fromBaseUnits(round.potBase);
        items.push({
          id: `round-${round.roundId}`,
          title: t("winnerDeclared"),
          details: `#${round.roundId} • ${formatAddress(round.lastBuyer)} • ${prizeGas.toFixed(2)} ${t("tokenGas")}`,
          date: "",
          sortKey: round.roundId,
        });
      }

      // Newest round first.
      history.set(items.sort((a, b) => b.sortKey - a.sortKey));
      historyAvailable.set(true);
    } catch (e) {
      console.warn("[useLastSurvivor] loadHistory failed:", errorMessage(e));
      historyAvailable.set(false);
    }
  };

  const validateKeyCount = (count: string): string | null => {
    const num = parseInt(count, 10);
    if (isNaN(num) || num <= 0) return t("invalidKeyCount");
    if (num > 1000) return t("maxKeyCountExceeded");
    return null;
  };

  /**
   * Probe the player-facing read/recovery ABI rather than an admin method.
   * This proves that the UI can quote keys and inspect recoverable credit; it
   * deliberately does NOT claim that an older deployment has the same payout
   * implementation as the checksum-matched TestNet v1.1 generation.
   */
  const hasRecoveryReadAbi = async (): Promise<boolean> => {
    try {
      const accountHash = normalizeHash160(address.get()) || ZERO_HASH;
      const [credit, cost] = await Promise.all([
        app.chain.readRaw("creditOf", [app.chain.arg.hash160(accountHash)]),
        app.chain.readRaw("currentKeyCost", [app.chain.arg.integer(1)]),
      ]);
      const parsedCredit = strictBigInt(credit);
      const parsedCost = strictBigInt(cost);
      return parsedCredit !== null && parsedCredit >= 0n && parsedCost !== null && parsedCost > 0n;
    } catch {
      return false;
    }
  };

  /**
   * Load all data. Called by defineMiniApp on mount and wallet reconnect.
   */
  const loadAll = async () => {
    // GUEST mode owns the arena locally (guest-engine drives the observables).
    // Skip every on-chain read so a mount-time / refresh load never clobbers the
    // local surface after the player switches to guest.
    if (app.mode.isGuest()) return;
    isLoading.set(true);
    try {
      setAddress(app.chain.address.get() ?? address.get() ?? null);
      try {
        await requireBoundContext(false);
      } catch {
        roundDataAvailable.set(false);
        userKeysAvailable.set(false);
        creditAvailable.set(false);
        quoteAvailable.set(false);
        historyAvailable.set(false);
        serviceNotice.set(t("chainBindingMismatch"));
        return;
      }
      if (!(await hasRecoveryReadAbi())) {
        roundDataAvailable.set(false);
        quoteAvailable.set(false);
        serviceNotice.set(t("contractUpgradeRequired"));
        await loadCredit();
        return;
      }
      await recoverPendingPurchase();
      const remainingSeconds = await loadRoundData();
      if (remainingSeconds !== null) {
        const endTimeMs = remainingSeconds > 0 ? Date.now() + remainingSeconds * 1000 : 0;
        endTime.set(endTimeMs);
        await Promise.all([loadUserKeys(), loadHistory()]);
      } else {
        userKeysAvailable.set(false);
        historyAvailable.set(false);
      }
      await Promise.all([loadCredit(), loadAuthoritativeQuote()]);
    } finally {
      isLoading.set(false);
      // A read round has completed — success, failure, or an early return above.
      // From here `roundDataAvailable === false` means "read, no round" (a real
      // "N/A" reading), never "not read yet". Runs on every exit path.
      roundSettled.set(true);
    }
  };

  // ── Actions (direct chain invocations) ─────────────────────────────

  /**
   * Buy `count` keys against the standalone contract.
   *
   * The preferred host path batches the GAS shortfall transfer and buyKeys in
   * ONE signed transaction. This removes the one-block race where a 30-second
   * round could expire after a deposit but before a separate buy. Minimal hosts
   * without batch support retain the confirmed-deposit fallback.
   *
   * If step 1 succeeds but step 2 fails, the prepaid credit simply remains on
   * the contract under the player and is reused on the next buy — there is no
   * refund call (and none is needed; funds are not lost). When the round has
   * already ended (timer expired with keys), the contract rejects the buy with
   * "round ended; settle first"; we surface that the round must be settled
   * before buying rather than letting the buy fault opaquely.
   */
  const buyKeys = async (count: string) => {
    if (isBuyingKeys.get()) return;
    if (!roundDataAvailable.get()) {
      throw new Error(serviceNotice.get() || t("keyPurchaseUnavailable"));
    }
    const validation = validateKeyCount(count);
    if (validation) {
      keyValidationError.set(validation);
      throw new Error(validation);
    }
    keyValidationError.set(null);
    const numKeys = Math.max(0, Math.floor(Number(count) || 0));
    if (numKeys <= 0) throw new Error(t("invalidKeyCount"));

    const context = await requireBoundContext(true);
    const playerHash = context.playerHash;
    if (!playerHash) throw new Error(t("walletNotConnected"));
    const scope = pendingScope(context);

    let existing: PendingLastSurvivorOperation | null;
    try {
      existing = loadPendingRecord(scope);
    } catch (error) {
      throw error;
    }
    if (existing) {
      await recoverPendingPurchaseForScope(scope);
      try {
        existing = loadPendingRecord(scope);
      } catch {
        throw new Error(t("recoveryRecordInvalid"));
      }
      if (existing) throw new Error(t("keyPurchasePending"));
    }

    // A durable journal must be writable before any wallet broadcast. This is
    // intentionally after wallet/network binding but before the authoritative
    // quote or invoke so storage denial cannot create an untracked transaction.
    try {
      pendingPurchaseStore.assertAvailable();
      storageHealthy.set(true);
    } catch {
      storageHealthy.set(false);
      throw new Error(t("recoveryStorageUnavailable"));
    }

    isBuyingKeys.set(true);
    try {
      // Re-read the round at the write boundary. The local countdown and local
      // pricing formula are presentation aids, never authorization for a buy.
      const liveRound = parseRound(await app.chain.readRaw("getCurrentRound", []));
      if (!liveRound) throw new Error(t("roundStateUnavailable"));
      if (!liveRound.active || (liveRound.totalKeys > 0n && liveRound.remainingSeconds <= 0)) {
        throw new Error(t("settleBeforeBuy"));
      }
      roundId.set(liveRound.roundId);
      totalKeysInRound.set(liveRound.totalKeys);
      const costBase = await loadAuthoritativeQuote(String(numKeys));
      if (costBase === null || costBase <= 0n) {
        throw new Error(t("keyQuoteUnavailable"));
      }

      // Step 1: DEPOSIT — top up only the SHORTFALL beyond any prepaid credit
      // left from a previous aborted buy, so stale credit is consumed instead of
      // accumulating. When the existing credit already covers the cost the
      // deposit is skipped entirely.
      const credit = await readUnsigned("creditOf", [app.chain.arg.hash160(playerHash)]);
      creditAvailable.set(true);
      prepaidCredit.set(fromFixed8(credit));

      const buyArgs = [
        app.chain.arg.hash160(playerHash),
        app.chain.arg.integer(numKeys),
      ];
      let inFlightRecord: PendingPurchase | null = null;
      const rememberPurchase = (txid: string) => {
        if (!txid) return;
        const saved = persistPending(scope, {
          kind: "purchase",
          txid,
          roundId: String(liveRound.roundId),
          count: String(numKeys),
          cost: costBase.toString(),
        });
        if (saved.kind !== "purchase") throw new Error(t("keyPurchasePending"));
        inFlightRecord = saved;
      };
      const confirmPurchase = async (
        result: { txid?: string; event?: unknown; verified?: boolean },
      ) => {
        const txid = String(result.txid ?? "").trim();
        if (!txid) throw new Error(t("keyPurchaseUnavailable"));
        if (!inFlightRecord) rememberPurchase(txid);
        const record = inFlightRecord;
        if (!record) throw new Error(t("keyPurchasePending"));
        if (!(await confirmSubmittedOperation(scope, record, result))) {
          throw new Error(t("keyPurchasePending"));
        }
      };

      if (credit < costBase) {
        const shortfall = costBase - credit;
        try {
          const batch = await app.chain.invokeMultiple(
            [
              {
                scriptHash: BLOCKCHAIN_CONSTANTS.GAS_HASH,
                operation: "transfer",
                args: [
                  app.chain.arg.hash160(playerHash),
                  app.chain.arg.hash160(context.contractHash),
                  app.chain.arg.integer(shortfall),
                  app.chain.arg.string(BUY_MEMO),
                ],
              },
              { operation: "buyKeys", args: buyArgs },
            ],
            { onTransactionSent: rememberPurchase },
          );
          await confirmPurchase(batch);
          await loadAll();
          return numKeys;
        } catch (batchError) {
          // Once a txid exists, the only safe action is exact-tx recovery. Never
          // fall back to a second purchase and risk a duplicate buy.
          if (inFlightRecord || loadPendingRecord(scope)) {
            throw new Error(t("keyPurchasePending"));
          }
          // Minimal standalone hosts may not expose wallet.invokeMultiple. No
          // transaction was broadcast, so the proven two-step path is safe.
          if (!/does not support invokeMultiple/i.test(errorMessage(batchError))) {
            throw batchError;
          }
        }

        const expectedBalance = credit + shortfall;
        let depositRecord: PendingDeposit | null = null;
        const rememberDeposit = (txid: string) => {
          if (!txid) return;
          const saved = persistPending(scope, {
            kind: "deposit",
            txid,
            amount: shortfall.toString(),
            expectedCredit: expectedBalance.toString(),
          });
          if (saved.kind !== "deposit") throw new Error(t("keyDepositConfirmationPending"));
          depositRecord = saved;
        };
        const depositResult = await app.chain.invoke(
          "transfer",
          [
            app.chain.arg.hash160(playerHash),
            app.chain.arg.hash160(context.contractHash),
            app.chain.arg.integer(shortfall),
            app.chain.arg.string(BUY_MEMO),
          ],
          {
            scriptHash: BLOCKCHAIN_CONSTANTS.GAS_HASH,
            waitForEvent: "Credited",
            onTransactionSent: rememberDeposit,
          },
        );
        if (!depositRecord && depositResult.txid) rememberDeposit(depositResult.txid);
        if (
          !depositRecord ||
          !(await confirmSubmittedOperation(scope, depositRecord, depositResult))
        ) {
          // The GAS transfer may already be in flight. Never submit the consuming
          // buy until this exact tx proves that the intended account was credited.
          throw new Error(t("keyDepositConfirmationPending"));
        }
      }

      // Step 2: buyKeys — consumes the prepaid credit. If this fails the credit
      // persists on the contract under the player and is reusable on the next
      // buy (or withdrawable via withdrawCredit; funds are not lost).
      try {
        const result = await app.chain.invoke(
          "buyKeys",
          buyArgs,
          {
            waitForEvent: "KeysBought",
            onTransactionSent: rememberPurchase,
          },
        );
        await confirmPurchase(result);
      } catch (buyErr) {
        const raw = errorMessage(buyErr);
        console.error(
          "[useLastSurvivor] buyKeys failed after deposit succeeded:",
          raw,
        );
        // A round that ended between the round read and the buy faults with
        // "round ended; settle first" — surface the settle requirement; any
        // other failure leaves the deposit as reusable prepaid credit.
        if (/settle first|round ended/i.test(raw)) {
          throw new Error(t("settleBeforeBuy"));
        }
        if (raw === t("transactionFault")) throw buyErr;
        if (inFlightRecord || loadPendingRecord(scope)) {
          throw new Error(t("keyPurchasePending"));
        }
        throw new Error(t("keyPurchaseDepositHeld"));
      }

      await loadAll();
      return numKeys;
    } finally {
      isBuyingKeys.set(false);
    }
  };

  /**
   * Settle the current round against the standalone contract.
   *
   * settle() is PERMISSIONLESS: once the round's countdown has expired it
   * credits the recorded last buyer (NOT the caller) with the entire pot and
   * advances to a fresh round. Anyone may trigger it; the winner withdraws the
   * pull-payment credit separately. The UI surfaces this through the
   * needsLifecycleSync affordance once a round has ended with a pot.
   */
  const settleRound = async () => {
    if (isSettling.get()) return;
    const context = await requireBoundContext(true);
    if (!context.playerHash) throw new Error(t("walletNotConnected"));
    const scope = pendingScope(context);
    const existing = loadPendingRecord(scope);
    if (existing) {
      await recoverPendingPurchaseForScope(scope);
      if (loadPendingRecord(scope)) throw new Error(t("pendingWriteMustResolve"));
    }
    try {
      pendingPurchaseStore.assertAvailable();
      storageHealthy.set(true);
    } catch {
      storageHealthy.set(false);
      throw new Error(t("recoveryStorageUnavailable"));
    }

    isSettling.set(true);
    try {
      let expectedRound: RoundSnapshot | null = null;
      try {
        expectedRound = parseRound(await app.chain.readRaw("getCurrentRound", []));
      } catch {
        // A stale local HUD is not sufficient evidence for a financial settle.
      }
      const settlementRound = expectedRound;
      if (
        !settlementRound ||
        !settlementRound.lastBuyer ||
        settlementRound.potBase <= 0n
      ) {
        throw new Error(t("roundStateUnavailable"));
      }
      if (settlementRound.remainingSeconds > 0) {
        throw new Error(t("settlementNotReady"));
      }

      let pendingSettlement: PendingSettlement | null = null;
      const rememberSettlement = (txid: string) => {
        if (!txid) return;
        const saved = persistPending(scope, {
          kind: "settle",
          txid,
          roundId: String(settlementRound.roundId),
          winner: settlementRound.lastBuyer,
          pot: settlementRound.potBase.toString(),
          nextRoundId: String(settlementRound.roundId + 1),
        });
        if (saved.kind !== "settle") throw new Error(t("settlementConfirmationPending"));
        pendingSettlement = saved;
      };
      const result = await app.chain.invoke(
        "settle",
        [],
        {
          waitForEvent: "RoundSettled",
          onTransactionSent: rememberSettlement,
        },
      );
      if (!pendingSettlement && result.txid) rememberSettlement(result.txid);
      if (
        !pendingSettlement ||
        !(await confirmSubmittedOperation(scope, pendingSettlement, result))
      ) {
        // A broadcast is not a settlement. Throwing keeps the action wrapper
        // from emitting its roundSettled success toast.
        throw new Error(t("settlementConfirmationPending"));
      }
      await loadAll();
    } finally {
      isSettling.set(false);
    }
  };

  /**
   * Withdraw the connected wallet's unused prepaid buy-credit via
   * withdraw(account). The contract pays the WHOLE credit back to the wallet —
   * the recovery path when a deposit landed but buyKeys never completed. Returns
   * the withdrawn amount in human GAS (from the "CreditWithdrawn" event,
   * state[1] = amount).
   */
  const withdrawCredit = async (): Promise<{ amount: number }> => {
    if (isLoading.get()) throw new Error(t("operationBusy"));
    const context = await requireBoundContext(true);
    const accountHash = context.playerHash;
    if (!accountHash) throw new Error(t("walletNotConnected"));
    const scope = pendingScope(context);
    const existing = loadPendingRecord(scope);
    if (existing) {
      await recoverPendingPurchaseForScope(scope);
      if (loadPendingRecord(scope)) throw new Error(t("pendingWriteMustResolve"));
    }
    try {
      pendingPurchaseStore.assertAvailable();
      storageHealthy.set(true);
    } catch {
      storageHealthy.set(false);
      throw new Error(t("recoveryStorageUnavailable"));
    }

    isLoading.set(true);
    try {
      // Read the live credit first — the contract reverts "no credit" on an empty
      // balance, so surface a clean message before prompting the wallet.
      let credit: bigint;
      try {
        credit = await readUnsigned("creditOf", [app.chain.arg.hash160(accountHash)]);
      } catch {
        throw new Error(t("creditReadUnavailable"));
      }
      if (credit <= 0n) throw new Error(t("noCredit"));

      let pendingWithdrawal: PendingWithdrawal | null = null;
      const rememberWithdrawal = (txid: string) => {
        if (!txid) return;
        const saved = persistPending(scope, {
          kind: "withdraw",
          txid,
          beforeCredit: credit.toString(),
        });
        if (saved.kind !== "withdraw") throw new Error(t("withdrawConfirmationPending"));
        pendingWithdrawal = saved;
      };
      const result = await app.chain.invoke(
        "withdraw",
        [app.chain.arg.hash160(accountHash)],
        {
          waitForEvent: "CreditWithdrawn",
          onTransactionSent: rememberWithdrawal,
        },
      );
      if (!pendingWithdrawal && result.txid) rememberWithdrawal(result.txid);
      if (
        !pendingWithdrawal ||
        !(await confirmSubmittedOperation(scope, pendingWithdrawal, result))
      ) {
        // Never turn the pre-invoke credit read into a claimed payout amount.
        throw new Error(t("withdrawConfirmationPending"));
      }
      const amount = fromFixed8(credit);

      await loadAll();
      return { amount };
    } finally {
      isLoading.set(false);
    }
  };

  return {
    // ── Raw State ───────────────────────────────────────────────────
    roundId,
    totalPot,
    isRoundActive,
    lastBuyer,
    userKeys,
    keyCount,
    keyValidationError,
    history,
    isBuyingKeys,
    isSettling,
    isLoading,
    roundDataAvailable,
    roundSettled,
    userKeysAvailable,
    creditAvailable,
    historyAvailable,
    quoteAvailable,
    serviceNotice,
    totalKeysInRound,
    prepaidCredit,
    hasCredit,
    purchasePending,
    pendingOperationKind,
    pendingTransactionId,
    recoveryNotice,
    storageHealthy,
    address,

    // ── Timer State ─────────────────────────────────────────────────
    // endTime is exposed so the guest engine can drive the local doomsday clock
    // (the same base the countdown derives from) without a chain read.
    endTime,
    countdown,
    dangerLevel,
    dangerLevelText,
    dangerProgress,
    shouldPulse,
    timeRemainingSeconds,
    updateNow,

    // ── Formatted values ────────────────────────────────────────────
    lastBuyerLabel,
    formattedRound,
    totalPotDisplay,
    roundStatusDisplay,
    userKeysDisplay,
    totalKeysDisplay,
    userSharePercent,
    needsLifecycleSync,
    estimatedCost,
    estimatedCostGas,
    estimatedCostRaw,

    // ── Actions ─────────────────────────────────────────────────────
    setAddress,
    buyKeys,
    settleRound,
    withdrawCredit,
    loadAll,
    loadUserKeys,
    loadCredit,
    loadAuthoritativeQuote,
    recoverPendingPurchase,
  };
}

export type UseLastSurvivorReturn = ReturnType<typeof useLastSurvivor>;
