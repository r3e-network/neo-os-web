/**
 * useMemorialShrine — Domain logic for the Memorial Shrine miniapp.
 *
 * Talks directly to the network-specific deployed MiniAppMemorialShrine
 * contract via the MiniApp framework (ctx.framework). The earlier path read the memorial / obituary catalog
 * and the visitor's tribute history through the Morpheus OS kernel
 * (ctx.os.storage list/get) and hinted achievements through ctx.os.badge. That
 * kernel/edge is DOWN/degraded, so those reads returned nothing and the app fell
 * back to hardcoded placeholder memorials. This composable removes the OS
 * dependency entirely: every read is a contract getter and every write is a
 * wallet-signed contract call.
 *
 * Contract interaction model (verified read-only against both deployed ABIs):
 *
 *   READS (app.chain.readRaw, explicit network contract script hash):
 *     getMemorialCount()                         -> Integer
 *     getMemorialDetails(memorialId)             -> Map{id,creator,deceasedName,
 *                                                    photoHash,relationship,
 *                                                    birthYear,deathYear,biography,
 *                                                    obituary,createTime,
 *                                                    lastTributeTime,active,
 *                                                    incenseCount,candleCount,
 *                                                    flowerCount,fruitCount,
 *                                                    wineCount,feastCount}
 *     getRecentObituaries()                      -> Array<Integer memorialId>
 *     getVisitorMemorials(visitor)               -> Array<Integer memorialId>
 *     getMemorialTributes(memorialId,offset,lim) -> Array<Integer tributeId>
 *     getTributeDetails(tributeId)               -> Map{id,memorialId,visitor,
 *                                                    offeringType,offeringName,
 *                                                    message,timestamp}
 *
 *   WRITES (app.chain.invoke / app.chain.invokeWithPayment; mainnet tribute
 *   rides app.funds.receiptPay):
 *     createMemorial(creator, deceasedName, photoHash, relationship, birthYear,
 *                    deathYear, biography, obituary) -> Integer (free, no deposit)
 *       event: MemorialCreated(memorialId, creator, deceasedName, deathYear)
 *     payTribute(visitor, memorialId, offeringType, message) -> Integer
 *       deposit-then-act: the offering cost (GAS, base units) is prepaid to the
 *       contract with a memo whose prefix-before-":" is the appId
 *       "miniapp-memorial-shrine" (the only part the contract's onNEP17Payment
 *       validates — see "invalid payment memo"); onNEP17Payment credits the
 *       visitor's prepaid GAS, then payTribute consumes the offering cost from it
 *       ("insufficient prepaid gas" otherwise).
 *       event: TributePaid(memorialId, visitor, offeringType)
 *
 * AMOUNT CONVENTION: offerings are paid in GAS BASE UNITS (1e8 per GAS). The
 * on-chain offering menu (getOfferingMenu) fixes the costs by type:
 *   1 incense 0.01 · 2 candle 0.02 · 3 flower 0.03 · 4 fruit 0.05 ·
 *   5 wine 0.10 · 6 feast 0.50 GAS.
 */

import { createObservable, createDerived } from "@shared/react/context";
import type { MiniAppFramework } from "@shared/react";
import { addressToScriptHash } from "@shared/utils/neo";
import { readQueryParam } from "@shared/utils/url";
import {
  validateMemorialDraft,
  type MemorialDraftInput,
} from "../logic/memorial-draft";
import {
  MEMORIAL_OFFERING_COSTS_FIXED8,
  MEMORIAL_SHRINE_APP_ID,
  MEMORIAL_SHRINE_CONTRACTS,
  assertMemorialRecoveryStorage,
  createdMemorialIdFromOutcome,
  isMemorialPaymentHubAvailable,
  memorialReadbackMatches,
  normalizeMemorialHash,
  normalizeMemorialNetwork,
  normalizeMemorialTxid,
  normalizeMemorialWallet,
  normalizeTributeMessage,
  parseMemorialBoolean,
  parseMemorialInteger,
  persistPendingMemorialWrite,
  readMemorialTransactionOutcome,
  readPendingMemorialWrite,
  tributeEventMatches,
  tributeReadbackMatches,
  type MemorialOfferingType,
  type MemorialTransactionReader,
  type MemorialWritePhase,
  type PendingMemorialIntent,
  type PendingTributeIntent,
  type PendingMemorialWrite,
} from "../logic/memorial-production";
import type { Memorial } from "../types";

/** The framework contract-arg shape (from app.chain.arg.*); accepts the raw-address Hash160 literal too. */
type FrameworkArg = ReturnType<MiniAppFramework["chain"]["arg"]["string"]>;
/** The framework tx-result shape (from app.chain.invoke / invokeWithPayment). */
type FrameworkTx = Awaited<ReturnType<MiniAppFramework["chain"]["invoke"]>>;

const APP_ID = MEMORIAL_SHRINE_APP_ID;

/**
 * Local store of memorial ids the visitor has actually opened ("Visited").
 * app.storage.local key — the app's storage namespace is pinned to the legacy
 * "memorial-shrine-" prefix (defineMiniApp storagePrefix), so this resolves to
 * the exact pre-framework runtime-cache key ("memorial-shrine-visited") and
 * existing visited history still hits.
 */
const VISITED_STORE_KEY = "visited";
/** How many visited ids to retain locally. */
const MAX_VISITED = 60;

/** Defensive caps on how many records to enumerate per refresh. */
const MAX_MEMORIALS = 60;
const MAX_OBITUARIES = 20;
const MAX_TRIBUTES_PER_MEMORIAL = 50;
const MAX_RECOVERY_TRIBUTES = 20;

/** Convert a verified NeoVM integer without turning malformed reads into zero. */
function safeMemorialNumber(value: unknown, positive = false): number | null {
  const parsed = parseMemorialInteger(value);
  if (
    parsed === null || parsed < 0n ||
    (positive && parsed === 0n) ||
    parsed > BigInt(Number.MAX_SAFE_INTEGER)
  ) return null;
  return Number(parsed);
}

function memorialField(raw: Record<string, unknown> | Map<unknown, unknown>, key: string): unknown {
  return raw instanceof Map ? raw.get(key) : raw[key];
}

/**
 * Normalize a script-hash-like value to bare lowercase hex for comparison.
 *
 * Contract Hash160s come back from the chain reader either as `0x<hex>` (raw
 * little-endian bytes) or — when those 20 bytes happen to be printable — as the
 * decoded text; the connected address resolves via addressToScriptHash to
 * `0x<hex>` little-endian. Comparing both the hex and its byte-reversed form
 * makes the visitor match robust to either byte order.
 */
function hashKeys(value: unknown): string[] {
  const raw = String(value ?? "").trim().toLowerCase();
  const hex = raw.startsWith("0x") ? raw.slice(2) : raw;
  if (!/^[0-9a-f]{40}$/.test(hex)) return raw ? [raw] : [];
  const reversed = hex.match(/.{2}/g)?.reverse().join("") ?? hex;
  return [hex, reversed];
}

function sameHash(a: unknown, b: unknown): boolean {
  const ka = hashKeys(a);
  const kb = new Set(hashKeys(b));
  return ka.some((k) => kb.has(k));
}

// ============================================================================
// Types
// ============================================================================

/** A tribute the connected wallet has paid, read back from the contract. */
export interface TributeRecord {
  tributeId: number;
  memorialId: number;
  offeringType: number;
  offeringName: string;
  message: string;
  amountGas: string;
  paidAt: number;
}

export type MemorialCatalogStatus =
  | "loading"
  | "ready"
  | "empty"
  | "partial"
  /**
   * No network/contract has been handed to us, so the catalog was never read.
   * Distinct from "error", which means a read was attempted and failed. Only
   * the latter justifies "The garden could not be refreshed" — the former is
   * simply a visitor who has not connected yet.
   */
  | "awaiting-context"
  | "error";

export type MemorialNetworkStatus =
  | "loading"
  | "ready"
  | "unknown-network"
  | "read-unavailable"
  | "paused"
  | "tribute-unavailable";

export interface UseMemorialShrineOptions {
  /** MiniApp framework (ctx.framework); its chain layer submits wallet-confirmed writes + reads. */
  app: MiniAppFramework;
  /** Network inferred from launch params; mainnet tribute requires receipt ID. */
  launchNetwork?: "mainnet" | "testnet" | null;
  /** Translation function. */
  t: (key: string, params?: Record<string, string | number>) => string;
  /** Injectable getapplicationlog reader for focused deterministic tests. */
  transactionReader?: MemorialTransactionReader;
}

// ============================================================================
// On-chain parsing
// ============================================================================

/** Build a Memorial from a getMemorialDetails Map. Returns null if empty. */
function memorialFromMap(raw: unknown): Memorial | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown> | Map<unknown, unknown>;
  const id = safeMemorialNumber(memorialField(record, "id"), true);
  const creator = memorialField(record, "creator");
  const name = memorialField(record, "deceasedName");
  const photoHash = memorialField(record, "photoHash");
  const relationship = memorialField(record, "relationship");
  const biography = memorialField(record, "biography");
  const obituary = memorialField(record, "obituary");
  // A missing / zeroed memorial yields an empty map (no id, no creator).
  if (
    id === null || !normalizeMemorialHash(creator) ||
    typeof name !== "string" || !name.trim() ||
    typeof photoHash !== "string" || typeof relationship !== "string" ||
    typeof biography !== "string" || typeof obituary !== "string"
  ) return null;

  const birthYear = safeMemorialNumber(memorialField(record, "birthYear"));
  const deathYear = safeMemorialNumber(memorialField(record, "deathYear"));
  const incense = safeMemorialNumber(memorialField(record, "incenseCount"));
  const candle = safeMemorialNumber(memorialField(record, "candleCount"));
  const flower = safeMemorialNumber(memorialField(record, "flowerCount"));
  const fruit = safeMemorialNumber(memorialField(record, "fruitCount"));
  const wine = safeMemorialNumber(memorialField(record, "wineCount"));
  const feast = safeMemorialNumber(memorialField(record, "feastCount"));
  const lastTributeTime = safeMemorialNumber(memorialField(record, "lastTributeTime"));
  if (
    birthYear === null || deathYear === null || lastTributeTime === null ||
    incense === null || candle === null || flower === null ||
    fruit === null || wine === null || feast === null
  ) return null;

  return {
    id,
    name,
    photoHash,
    birthYear,
    deathYear,
    relationship,
    biography,
    obituary,
    // "Recent tribute" = a tribute landed within the last 7 days.
    hasRecentTribute:
      lastTributeTime > 0 && Date.now() - lastTributeTime < 7 * 24 * 60 * 60 * 1000,
    offerings: { incense, candle, flower, fruit, wine, feast },
  };
}

// ============================================================================
// Composable
// ============================================================================

export function useMemorialShrine({
  app,
  launchNetwork,
  t,
  transactionReader = readMemorialTransactionOutcome,
}: UseMemorialShrineOptions) {
  const network = normalizeMemorialNetwork(launchNetwork);
  const contractHash = network ? MEMORIAL_SHRINE_CONTRACTS[network] : "";
  const memorials = createObservable<Memorial[]>([]);
  const visitedMemorials = createObservable<Memorial[]>([]);
  const myTributes = createObservable<TributeRecord[]>([]);
  const recentObituaries = createObservable<{ id: number; name: string; text: string }[]>([]);
  const selectedMemorial = createObservable<Memorial | null>(null);
  const shareStatus = createObservable<string | null>(null);
  const catalogStatus = createObservable<MemorialCatalogStatus>("loading");
  const catalogError = createObservable("");
  const networkStatus = createObservable<MemorialNetworkStatus>(
    network ? "loading" : "unknown-network",
  );
  const networkMessage = createObservable("");
  const isSubmitting = createObservable(false);
  const isPaying = createObservable(false);
  const confirmationChecking = createObservable(false);
  const pendingWrite = createObservable<PendingMemorialWrite | null>(null);
  const writePhase = createObservable<MemorialWritePhase>("idle");
  const writeNotice = createObservable("");
  const writeError = createObservable("");
  const storageHealthy = createObservable(true);
  const lastTx = createObservable<FrameworkTx | null>(null);

  const memorialCount = createDerived(() => memorials.get().length, [memorials]);
  // "My Tributes" reflects tributes the connected wallet has actually paid,
  // read straight from the contract — independent of "Visited".
  const tributeCount = createDerived(() => myTributes.get().length, [myTributes]);
  const obituaryCount = createDerived(() => recentObituaries.get().length, [recentObituaries]);

  const readContract = (
    operation: string,
    args: FrameworkArg[] = [],
  ): Promise<unknown> => {
    if (!contractHash) return Promise.reject(new Error("walletNetworkUnknown"));
    return app.chain.readRaw(operation, args, { scriptHash: contractHash });
  };

  /** Resolve the connected wallet address without prompting a connection. */
  const connectedAddress = (): string | null => {
    try {
      return app.chain.address.get();
    } catch (_e) {
      return null;
    }
  };

  const requireNonNegativeInteger = (value: unknown, errorKey: string): bigint => {
    const parsed = parseMemorialInteger(value);
    if (parsed === null || parsed < 0n) throw new Error(t(errorKey));
    return parsed;
  };

  const requirePositiveId = (value: unknown, errorKey: string): number => {
    const parsed = parseMemorialInteger(value);
    if (parsed === null || parsed <= 0n || parsed > BigInt(Number.MAX_SAFE_INTEGER)) {
      throw new Error(t(errorKey));
    }
    return Number(parsed);
  };

  const setPending = (record: PendingMemorialWrite) => {
    pendingWrite.set(record);
    writePhase.set("broadcast");
    writeNotice.set(t("transactionPending", { txid: record.txid }));
    writeError.set("");
    try {
      persistPendingMemorialWrite(app.storage.local, record.network, record);
      storageHealthy.set(true);
    } catch {
      storageHealthy.set(false);
      writePhase.set("storage-error");
      writeError.set(t("recoveryStorageUnavailableAfterBroadcast", { txid: record.txid }));
      throw new Error("recoveryStorageUnavailableAfterBroadcast");
    }
  };

  const clearPending = () => {
    const record = pendingWrite.get();
    if (!record) return true;
    try {
      persistPendingMemorialWrite(app.storage.local, record.network, null);
      pendingWrite.set(null);
      storageHealthy.set(true);
      return true;
    } catch {
      storageHealthy.set(false);
      writePhase.set("storage-error");
      writeError.set(t("recoveryStorageUnavailable"));
      return false;
    }
  };

  const restorePending = (): boolean => {
    if (!network) return false;
    const restored = readPendingMemorialWrite(app.storage.local, network);
    if (restored.pending) {
      pendingWrite.set(restored.pending);
      storageHealthy.set(true);
      writePhase.set("broadcast");
      writeNotice.set(t("transactionPending", { txid: restored.pending.txid }));
      return true;
    }
    if (restored.corrupted) {
      storageHealthy.set(false);
      writePhase.set("storage-error");
      writeError.set(t("pendingRecordCorrupted"));
      return false;
    }
    try {
      assertMemorialRecoveryStorage(app.storage.local);
      storageHealthy.set(true);
      if (writePhase.get() === "storage-error" && !pendingWrite.get()) {
        writePhase.set("idle");
        writeError.set("");
      }
      return true;
    } catch {
      storageHealthy.set(false);
      writePhase.set("storage-error");
      writeError.set(t("recoveryStorageUnavailable"));
      return false;
    }
  };

  const loadNetworkStatus = async (): Promise<boolean> => {
    networkMessage.set("");
    if (!network || !contractHash) {
      networkStatus.set("unknown-network");
      // Display copy, not the write-gate error: a visitor who has not connected
      // needs an invitation, not an instruction about explicit sessions.
      networkMessage.set(t("walletNetworkAwaiting"));
      return false;
    }
    networkStatus.set("loading");
    try {
      const paused = parseMemorialBoolean(await readContract("isPaused"));
      if (paused === null) throw new Error("contractReadUnavailable");
      if (paused) {
        networkStatus.set("paused");
        networkMessage.set(t("contractPaused"));
        return false;
      }
      if (network === "mainnet") {
        const hub = await readContract("paymentHub");
        if (!isMemorialPaymentHubAvailable(hub)) {
          networkStatus.set("tribute-unavailable");
          networkMessage.set(t("mainnetTributeUnavailable"));
          return true;
        }
      }
      networkStatus.set("ready");
      return true;
    } catch {
      networkStatus.set("read-unavailable");
      networkMessage.set(t("contractReadUnavailable"));
      return false;
    }
  };

  const assertRecoveryPreflight = () => {
    if (!network || !contractHash) throw new Error(t("walletNetworkUnknown"));
    if (pendingWrite.get()) throw new Error(t("pendingWriteMustResolve"));
    try {
      assertMemorialRecoveryStorage(app.storage.local);
    } catch {
      storageHealthy.set(false);
      throw new Error(t("recoveryStorageUnavailable"));
    }
    storageHealthy.set(true);
  };

  const assertContractAvailable = async (forTribute: boolean) => {
    const paused = parseMemorialBoolean(await readContract("isPaused"));
    if (paused === null) throw new Error(t("contractReadUnavailable"));
    if (paused) throw new Error(t("contractPaused"));
    if (forTribute && network === "mainnet") {
      const hub = await readContract("paymentHub");
      if (!isMemorialPaymentHubAvailable(hub)) {
        throw new Error(t("mainnetTributeUnavailable"));
      }
    }
  };

  const requireBoundWallet = async () => {
    if (!network || !contractHash) throw new Error(t("walletNetworkUnknown"));
    const configuredContract = normalizeMemorialHash(app.chain.contractAddress.get());
    if (configuredContract && configuredContract !== contractHash) {
      throw new Error(t("contractBindingMismatch"));
    }
    const wallet = normalizeMemorialWallet(await app.chain.ensureWallet());
    if (!wallet) throw new Error(t("walletAddressInvalid"));
    const detectedNetwork = normalizeMemorialNetwork(await app.chain.detectNetwork());
    if (!detectedNetwork) throw new Error(t("walletNetworkUnknown"));
    if (detectedNetwork !== network) throw new Error(t("walletNetworkMismatch"));
    return wallet;
  };

  // ------------------------------------------
  // Read: a single memorial by id (contract getter)
  // ------------------------------------------

  const readMemorial = async (id: number): Promise<Memorial | null> => {
    try {
      const raw = await readContract("getMemorialDetails", [
        app.chain.arg.integer(id),
      ]);
      return memorialFromMap(raw);
    } catch (_e) {
      return null;
    }
  };

  // ------------------------------------------
  // Read: load memorials + obituaries (contract getters)
  // ------------------------------------------

  /**
   * Load the memorial catalog straight from the contract. Memorials are ids
   * 1..getMemorialCount(); each is read via getMemorialDetails. Newest first.
   */
  const loadMemorials = async (): Promise<boolean> => {
    catalogStatus.set("loading");
    catalogError.set("");
    // Nothing to read against yet: no launch network means no canonical
    // contract. Report the honest pre-connect state instead of firing a read
    // that can only fail and then calling that failure a refresh error.
    if (!network || !contractHash) {
      catalogStatus.set("awaiting-context");
      catalogError.set("");
      return false;
    }
    let total = 0;
    try {
      const count = requireNonNegativeInteger(
        await readContract("getMemorialCount"),
        "contractReadUnavailable",
      );
      if (count > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("contractReadUnavailable");
      total = Number(count);
    } catch (_e) {
      catalogStatus.set("error");
      catalogError.set(t("catalogLoadFailed"));
      return false;
    }

    if (total <= 0) {
      memorials.set([]);
      recentObituaries.set([]);
      catalogStatus.set("empty");
      return true;
    } else {
      const ids: number[] = [];
      // Highest id first so the freshest memorials lead the grid.
      for (let id = total; id >= 1 && ids.length < MAX_MEMORIALS; id -= 1) ids.push(id);
      const results = await Promise.all(ids.map((id) => readMemorial(id)));
      const previous = new Map(memorials.get().map((memorial) => [memorial.id, memorial]));
      const resolved = ids
        .map((id, index) => results[index] ?? previous.get(id) ?? null)
        .filter((memorial): memorial is Memorial => memorial !== null);
      const failedCount = results.filter((memorial) => memorial === null).length;

      if (resolved.length === 0) {
        catalogStatus.set("error");
        catalogError.set(t("catalogLoadFailed"));
        return false;
      }

      memorials.set(resolved);
      if (failedCount > 0) {
        catalogStatus.set("partial");
        catalogError.set(t("catalogLoadPartial", { count: failedCount }));
      } else {
        catalogStatus.set("ready");
      }
    }

    await loadObituaries();
    return catalogStatus.get() === "ready";
  };

  /**
   * Load recent obituaries from the contract: getRecentObituaries() returns the
   * newest memorial ids that published an obituary; each id resolves to a
   * name + obituary text via getMemorialDetails.
   */
  const loadObituaries = async () => {
    let ids: number[] = [];
    try {
      const raw = await readContract("getRecentObituaries");
      if (!Array.isArray(raw)) return;
      const parsed = raw.map((value) => safeMemorialNumber(value, true));
      if (parsed.some((id) => id === null)) return;
      ids = parsed.filter((id): id is number => id !== null).slice(0, MAX_OBITUARIES);
    } catch (_e) {
      return;
    }

    if (ids.length === 0) {
      recentObituaries.set([]);
      return;
    }

    // Reuse already-loaded memorials where possible, fall back to a read.
    const loaded = memorials.get();
    const items = await Promise.all(
      ids.map(async (id) => {
        const cached = loaded.find((m) => m.id === id);
        const memorial = cached ?? (await readMemorial(id));
        if (!memorial) return null;
        const text = memorial.obituary?.trim() || memorial.biography?.trim() || "";
        return { id, name: memorial.name, text };
      }),
    );
    recentObituaries.set(
      items.filter((item): item is { id: number; name: string; text: string } => item !== null),
    );
  };

  /** Read the persisted visited-memorial id list (newest first). */
  const readVisitedIds = (): number[] => {
    try {
      const raw = app.storage.local.get<number[]>(VISITED_STORE_KEY);
      if (!Array.isArray(raw)) return [];
      return raw.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0);
    } catch {
      return [];
    }
  };

  /** Persist a memorial id as visited (newest first, deduped, capped). */
  const persistVisitedId = (id: number) => {
    try {
      const next = [id, ...readVisitedIds().filter((existing) => existing !== id)].slice(0, MAX_VISITED);
      app.storage.local.set(VISITED_STORE_KEY, next);
    } catch {
      /* best-effort local persistence */
    }
  };

  /**
   * "Visited" reflects memorials this device has ACTUALLY opened — persisted
   * locally and rehydrated against the loaded catalog. It starts empty for a
   * fresh visitor (no fabricated seeds) and resolves stored ids to the catalog
   * entry where available, falling back to a contract read for older ones.
   */
  const loadVisitedMemorials = async () => {
    const ids = readVisitedIds();
    if (ids.length === 0) {
      visitedMemorials.set([]);
      return;
    }
    const loaded = memorials.get();
    const resolved = await Promise.all(
      ids.map(async (id) => loaded.find((m) => m.id === id) ?? (await readMemorial(id))),
    );
    visitedMemorials.set(resolved.filter((m): m is Memorial => m !== null));
  };

  // ------------------------------------------
  // Read: the connected wallet's real tributes (contract getters)
  // ------------------------------------------

  /**
   * Load tributes actually paid by the connected wallet from the contract.
   *
   * getVisitorMemorials(visitor) lists the memorials the visitor has tributed;
   * for each, getMemorialTributes + getTributeDetails surface the visitor's own
   * tribute records (offering, message, timestamp). Does not prompt a wallet
   * connection: with no wallet connected the "My Tributes" counter stays at 0.
   */
  const loadMyTributes = async () => {
    const visitor = connectedAddress();
    if (!visitor) {
      myTributes.set([]);
      return;
    }
    const visitorHash = addressToScriptHash(visitor);
    if (!visitorHash) {
      myTributes.set([]);
      return;
    }

    let memorialIds: number[] = [];
    try {
      // visitorHash is already a 0x script hash (addressToScriptHash above);
      // app.chain.arg.hash160 preserves it verbatim.
      const raw = await readContract("getVisitorMemorials", [
        app.chain.arg.hash160(visitorHash),
      ]);
      if (!Array.isArray(raw)) return;
      const parsed = raw.map((value) => safeMemorialNumber(value, true));
      if (parsed.some((id) => id === null)) return;
      memorialIds = parsed.filter((id): id is number => id !== null);
    } catch (_e) {
      return;
    }

    if (memorialIds.length === 0) {
      myTributes.set([]);
      return;
    }

    const perMemorial = await Promise.all(
      memorialIds.map((memorialId) => readVisitorTributesForMemorial(visitorHash, memorialId)),
    );
    if (perMemorial.some((records) => records === null)) return;
    const records = perMemorial
      .flatMap((items) => items ?? [])
      .sort((a, b) => b.paidAt - a.paidAt);
    myTributes.set(records);
  };

  /** Read this visitor's tribute records for one memorial. */
  const readVisitorTributesForMemorial = async (
    visitorHash: string,
    memorialId: number,
  ): Promise<TributeRecord[] | null> => {
    let tributeIds: number[] = [];
    try {
      const raw = await readContract("getMemorialTributes", [
        app.chain.arg.integer(memorialId),
        app.chain.arg.integer(0),
        app.chain.arg.integer(MAX_TRIBUTES_PER_MEMORIAL),
      ]);
      if (!Array.isArray(raw)) return null;
      const parsed = raw.map((value) => safeMemorialNumber(value, true));
      if (parsed.some((id) => id === null)) return null;
      tributeIds = parsed.filter((id): id is number => id !== null);
    } catch (_e) {
      return null;
    }

    const details = await Promise.all(
      tributeIds.map(async (tributeId) => {
        try {
          const raw = await readContract("getTributeDetails", [
            app.chain.arg.integer(tributeId),
          ]);
          return raw && typeof raw === "object" && !Array.isArray(raw)
            ? (raw as Record<string, unknown>)
            : null;
        } catch (_e) {
          return null;
        }
      }),
    );

    const records: TributeRecord[] = [];
    if (details.some((record) => record === null)) return null;
    for (const record of details) {
      if (!record) continue;
      if (!sameHash(record.visitor, visitorHash)) continue;
      const tributeId = safeMemorialNumber(record.id, true);
      const recordMemorialId = safeMemorialNumber(record.memorialId, true);
      const offeringType = safeMemorialNumber(record.offeringType, true);
      const paidAt = safeMemorialNumber(record.timestamp);
      if (
        tributeId === null || recordMemorialId !== memorialId ||
        offeringType === null || paidAt === null
      ) return null;
      const fixed8 = MEMORIAL_OFFERING_COSTS_FIXED8[offeringType as MemorialOfferingType];
      if (!fixed8) return null;
      records.push({
        tributeId,
        memorialId: recordMemorialId,
        offeringType,
        offeringName: String(record.offeringName ?? ""),
        message: String(record.message ?? ""),
        amountGas: app.amount.fixed8ToGas(BigInt(fixed8)),
        paidAt,
      });
    }
    return records;
  };

  // ------------------------------------------
  // Navigation
  // ------------------------------------------

  const openMemorial = (id: number) => {
    const memorial = memorials.get().find((m) => m.id === id);
    if (memorial) {
      selectedMemorial.set(memorial);
      // Track the opened memorial in "Visited" — real, persisted opens only.
      if (!visitedMemorials.get().some((m) => m.id === id)) {
        visitedMemorials.set([memorial, ...visitedMemorials.get()]);
      }
      persistVisitedId(id);
      if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        url.searchParams.set("id", String(id));
        window.history.replaceState({}, "", url.toString());
      }
    }
  };

  const closeMemorial = () => {
    selectedMemorial.set(null);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.delete("id");
      window.history.replaceState({}, "", url.toString());
    }
  };

  /** Surface the latest explicit share result without a synthetic timer phase. */
  const flashShareStatus = (message: string) => {
    shareStatus.set(message);
  };

  const shareMemorial = async (memorial?: Memorial) => {
    const target = memorial || selectedMemorial.get();
    if (!target || typeof window === "undefined") return;
    const shareUrl = `${window.location.origin}${window.location.pathname}?id=${target.id}`;
    const shareData = {
      title: `${target.name} - ${t("title")}`,
      text: `${t("tagline")} | ${target.name} (${target.birthYear}-${target.deathYear})`,
      url: shareUrl,
    };

    // Native Web Share when available (mobile); otherwise copy to clipboard so
    // desktop browsers without navigator.share are not a silent no-op.
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch {
        /* user dismissed the sheet or share failed → fall through to copy */
      }
    }
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        flashShareStatus(t("linkCopied"));
        return;
      }
    } catch {
      /* clipboard blocked → surface the link so the user can copy manually */
    }
    flashShareStatus(shareUrl);
  };

  const checkUrlForMemorial = async () => {
    const idParam = readQueryParam("id");
    if (idParam) {
      const id = parseInt(idParam, 10);
      if (!isNaN(id)) {
        const memorial = memorials.get().find((m) => m.id === id) ?? (await readMemorial(id));
        if (memorial) selectedMemorial.set(memorial);
      }
    }
  };

  const markReadbackPending = (record: PendingMemorialWrite) => {
    writePhase.set("readback-pending");
    writeNotice.set(t("transactionReadbackPending", { txid: record.txid }));
    writeError.set("");
    return { status: "pending" as const, record };
  };

  const confirmPendingWrite = async (candidate?: PendingMemorialWrite | null) => {
    const record = candidate ?? pendingWrite.get();
    if (!record || confirmationChecking.get()) return null;
    confirmationChecking.set(true);
    writePhase.set("checking");
    writeNotice.set(t("transactionChecking", { txid: record.txid }));
    writeError.set("");
    try {
      let outcome;
      try {
        outcome = await transactionReader(record.network, record.txid);
      } catch {
        outcome = { state: "unknown" as const, notifications: [] };
      }
      if (pendingWrite.get()?.txid !== record.txid) return null;
      if (outcome.state === "unknown") {
        writePhase.set("broadcast");
        writeNotice.set(t("transactionPending", { txid: record.txid }));
        return { status: "pending" as const, record };
      }
      if (outcome.state === "fault") {
        if (clearPending()) {
          writePhase.set("fault");
          writeNotice.set("");
          writeError.set(t("transactionFaulted", { txid: record.txid }));
        }
        return { status: "fault" as const, record };
      }

      if (record.intent.kind === "create") {
        const memorialId = createdMemorialIdFromOutcome(record, outcome);
        if (!memorialId) {
          if (clearPending()) {
            writePhase.set("event-mismatch");
            writeNotice.set("");
            writeError.set(t("transactionEventMismatch", { txid: record.txid }));
          }
          return { status: "mismatch" as const, record };
        }
        try {
          const [details, countRaw] = await Promise.all([
            readContract("getMemorialDetails", [app.chain.arg.integer(memorialId)]),
            readContract("getMemorialCount"),
          ]);
          const count = requireNonNegativeInteger(countRaw, "contractReadUnavailable");
          if (count < BigInt(memorialId) || !memorialReadbackMatches(details, record, memorialId)) {
            return markReadbackPending(record);
          }
        } catch {
          return markReadbackPending(record);
        }
      } else {
        const intent = record.intent;
        if (!tributeEventMatches(record, outcome)) {
          if (clearPending()) {
            writePhase.set("event-mismatch");
            writeNotice.set("");
            writeError.set(t("transactionEventMismatch", { txid: record.txid }));
          }
          return { status: "mismatch" as const, record };
        }
        try {
          const before = requireNonNegativeInteger(
            intent.beforeTributeCount,
            "contractReadUnavailable",
          );
          const after = requireNonNegativeInteger(
            await readContract("getMemorialTributeCount", [
              app.chain.arg.integer(intent.memorialId),
            ]),
            "contractReadUnavailable",
          );
          if (after <= before) return markReadbackPending(record);
          const delta = after - before;
          if (delta > BigInt(MAX_RECOVERY_TRIBUTES)) return markReadbackPending(record);
          const idsRaw = await Promise.all(
            Array.from({ length: Number(delta) }, (_, index) =>
              readContract("getMemorialTributeAt", [
                app.chain.arg.integer(intent.memorialId),
                app.chain.arg.integer((before + BigInt(index)).toString()),
              ]),
            ),
          );
          const ids = idsRaw
            .map((value) => parseMemorialInteger(value))
            .filter((value): value is bigint => value !== null && value > 0n && value <= BigInt(Number.MAX_SAFE_INTEGER))
            .map(Number);
          const details = await Promise.all(ids.map((id) =>
            readContract("getTributeDetails", [app.chain.arg.integer(id)]),
          ));
          if (!details.some((value) => tributeReadbackMatches(value, record))) {
            return markReadbackPending(record);
          }
        } catch {
          return markReadbackPending(record);
        }
      }

      if (!clearPending()) return { status: "pending" as const, record };
      writePhase.set("confirmed");
      writeNotice.set(t("transactionConfirmed", { txid: record.txid }));
      writeError.set("");
      await loadMemorials();
      await loadMyTributes();
      if (record.intent.kind === "tribute") {
        const memorialId = record.intent.memorialId;
        if (selectedMemorial.get()?.id === memorialId) {
          selectedMemorial.set(
            memorials.get().find((memorial) => memorial.id === memorialId) ?? null,
          );
        }
      }
      return { status: "confirmed" as const, record };
    } finally {
      confirmationChecking.set(false);
    }
  };

  const buildPending = (
    intent: PendingMemorialIntent,
    wallet: { address: string; hash: string },
    txidInput: string,
  ): PendingMemorialWrite | null => {
    if (!network) return null;
    const txid = normalizeMemorialTxid(txidInput);
    if (!txid) return null;
    return {
      version: 1,
      network,
      contractHash,
      wallet: wallet.address,
      walletHash: wallet.hash,
      txid,
      intent,
      createdAt: Date.now(),
    };
  };

  // ------------------------------------------
  // Write: create memorial (direct MiniApp contract)
  // ------------------------------------------

  const createMemorial = async (form: MemorialDraftInput) => {
    if (isSubmitting.get()) return null;
    const validation = validateMemorialDraft(form);
    if (!validation.ok) throw new Error(t(validation.errorKey));
    const draft = validation.value;
    isSubmitting.set(true);
    writePhase.set("preparing");
    writeNotice.set(t("transactionPreparing"));
    writeError.set("");
    try {
      assertRecoveryPreflight();
      await assertContractAvailable(false);
      const beforeMemorialCount = requireNonNegativeInteger(
        await readContract("getMemorialCount"),
        "contractReadUnavailable",
      ).toString();
      const creator = await requireBoundWallet();
      const intent: PendingMemorialIntent = {
        kind: "create",
        ...draft,
        beforeMemorialCount,
      };
      const args: FrameworkArg[] = [
        app.chain.arg.hash160Raw(creator.address),
        app.chain.arg.string(draft.name),
        app.chain.arg.string(draft.photoHash),
        app.chain.arg.string(draft.relationship),
        app.chain.arg.integer(draft.birthYear),
        app.chain.arg.integer(draft.deathYear),
        app.chain.arg.string(draft.biography),
        app.chain.arg.string(draft.obituary),
      ];
      let captured: PendingMemorialWrite | null = null;
      let persistenceFailed = false;
      const rememberBroadcast = (txid: string) => {
        const record = buildPending(intent, creator, txid);
        if (!record) return;
        captured = record;
        try { setPending(record); } catch { persistenceFailed = true; }
      };
      let result: FrameworkTx;
      try {
        result = await app.chain.invoke("createMemorial", args, {
          scriptHash: contractHash,
          waitForEvent: "MemorialCreated",
          waitTimeoutMs: 45_000,
          onTransactionSent: rememberBroadcast,
        });
      } catch (error) {
        const active = pendingWrite.get();
        if (active) {
          writePhase.set(persistenceFailed ? "storage-error" : "broadcast");
          writeNotice.set(t("transactionPending", { txid: active.txid }));
          return { txid: active.txid, confirmed: false };
        }
        throw error;
      }
      lastTx.set(result);
      if (!captured) rememberBroadcast(result.txid);
      const active = pendingWrite.get();
      if (!active) throw new Error(t("transactionNotBroadcast"));
      const resultTxid = normalizeMemorialTxid(result.txid);
      if (resultTxid && resultTxid !== active.txid) {
        writeError.set(t("transactionIdentityChanged"));
        return { txid: active.txid, confirmed: false };
      }
      if (persistenceFailed) return { txid: active.txid, confirmed: false };
      const settlement = await confirmPendingWrite(active);
      return { txid: active.txid, confirmed: settlement?.status === "confirmed" };
    } catch (error) {
      writeError.set(app.errors.messageOf(error, t("unknownError")));
      if (!pendingWrite.get()) writePhase.set("idle");
      throw error;
    } finally {
      isSubmitting.set(false);
    }
  };

  // ------------------------------------------
  // Write: pay tribute (testnet prepay / mainnet receipt ABI)
  // ------------------------------------------

  const payTribute = async (
    memorialId: number,
    offeringType: number,
    message: string,
    receiptId?: string,
  ) => {
    if (isPaying.get()) return null;
    if (!Number.isSafeInteger(memorialId) || memorialId <= 0) {
      throw new Error(t("invalidMemorial"));
    }
    if (!Object.prototype.hasOwnProperty.call(MEMORIAL_OFFERING_COSTS_FIXED8, offeringType)) {
      throw new Error(t("invalidOffering"));
    }
    const selectedOffering = offeringType as MemorialOfferingType;
    const offeringCost = MEMORIAL_OFFERING_COSTS_FIXED8[selectedOffering];
    const normalizedMessage = normalizeTributeMessage(message);
    if (normalizedMessage === null) throw new Error(t("tributeMessageTooLong"));
    const normalizedReceiptId = String(receiptId ?? "").trim();
    if (network === "mainnet" && !/^[1-9]\d*$/.test(normalizedReceiptId)) {
      throw new Error(t("receiptIdRequired"));
    }
    if (network === "testnet" && normalizedReceiptId) {
      throw new Error(t("receiptIdUnexpected"));
    }
    isPaying.set(true);
    writePhase.set("preparing");
    writeNotice.set(t("transactionPreparing"));
    writeError.set("");
    try {
      assertRecoveryPreflight();
      await assertContractAvailable(true);
      const memorialRaw = await readContract("getMemorialDetails", [
        app.chain.arg.integer(memorialId),
      ]);
      if (requirePositiveId(
        memorialRaw && typeof memorialRaw === "object"
          ? (memorialRaw instanceof Map
              ? memorialRaw.get("id")
              : (memorialRaw as Record<string, unknown>).id)
          : null,
        "invalidMemorial",
      ) !== memorialId) throw new Error(t("invalidMemorial"));
      const chainCost = requireNonNegativeInteger(
        await readContract("getOfferingCost", [app.chain.arg.integer(selectedOffering)]),
        "contractReadUnavailable",
      );
      if (chainCost.toString() !== offeringCost) throw new Error(t("offeringCostMismatch"));
      const beforeTributeCount = requireNonNegativeInteger(
        await readContract("getMemorialTributeCount", [app.chain.arg.integer(memorialId)]),
        "contractReadUnavailable",
      ).toString();
      const visitor = await requireBoundWallet();
      const baseIntent: PendingTributeIntent = {
        kind: "tribute",
        memorialId,
        offeringType: selectedOffering,
        message: normalizedMessage,
        amountFixed8: offeringCost,
        receiptId: network === "mainnet" ? normalizedReceiptId : "",
        beforeTributeCount,
      };
      const args: FrameworkArg[] = [
        app.chain.arg.hash160Raw(visitor.address),
        app.chain.arg.integer(memorialId),
        app.chain.arg.integer(selectedOffering),
        app.chain.arg.string(normalizedMessage),
      ];
      let paymentTxid = "";
      let captured: PendingMemorialWrite | null = null;
      let persistenceFailed = false;
      const rememberPayment = (txid: string) => {
        paymentTxid = normalizeMemorialTxid(txid);
      };
      const rememberBroadcast = (txid: string) => {
        const intent: PendingMemorialIntent = paymentTxid
          ? { ...baseIntent, paymentTxid }
          : baseIntent;
        const record = buildPending(intent, visitor, txid);
        if (!record) return;
        captured = record;
        try { setPending(record); } catch { persistenceFailed = true; }
      };
      let result: FrameworkTx;
      try {
        if (network === "mainnet") {
          result = await app.funds.receiptPay({
            operation: "payTribute",
            args,
            receiptId: normalizedReceiptId,
            scriptHash: contractHash,
            waitForEvent: "TributePaid",
            waitTimeoutMs: 45_000,
            onTransactionSent: rememberBroadcast,
            notify: "silent",
          });
        } else if (network === "testnet") {
          result = await app.chain.invokeWithPayment(
            offeringCost,
            `${APP_ID}:tribute:${memorialId}:${selectedOffering}`,
            "payTribute",
            args,
            {
              scriptHash: contractHash,
              waitForEvent: "TributePaid",
              waitTimeoutMs: 45_000,
              onPaymentSent: rememberPayment,
              onTransactionSent: rememberBroadcast,
            },
          );
        } else {
          throw new Error(t("walletNetworkUnknown"));
        }
      } catch (error) {
        const active = pendingWrite.get();
        if (active) {
          writePhase.set(persistenceFailed ? "storage-error" : "broadcast");
          writeNotice.set(t("transactionPending", { txid: active.txid }));
          return { txid: active.txid, confirmed: false };
        }
        throw error;
      }
      lastTx.set(result);
      if (!captured) rememberBroadcast(result.txid);
      const active = pendingWrite.get();
      if (!active) throw new Error(t("transactionNotBroadcast"));
      const resultTxid = normalizeMemorialTxid(result.txid);
      if (resultTxid && resultTxid !== active.txid) {
        writeError.set(t("transactionIdentityChanged"));
        return { txid: active.txid, confirmed: false };
      }
      if (persistenceFailed) return { txid: active.txid, confirmed: false };
      const settlement = await confirmPendingWrite(active);
      return { txid: active.txid, confirmed: settlement?.status === "confirmed" };
    } catch (error) {
      writeError.set(app.errors.messageOf(error, t("unknownError")));
      if (!pendingWrite.get()) writePhase.set("idle");
      throw error;
    } finally {
      isPaying.set(false);
    }
  };

  // ------------------------------------------
  // Load all
  // ------------------------------------------

  const loadAll = async () => {
    restorePending();
    await Promise.all([loadNetworkStatus(), loadMemorials()]);
    await checkUrlForMemorial();
    await Promise.all([loadVisitedMemorials(), loadMyTributes()]);
    if (pendingWrite.get()) await confirmPendingWrite(pendingWrite.get());
  };

  restorePending();

  const cleanupTimers = () => { /* no synthetic transaction timers */ };
  return {
    // State
    memorials, visitedMemorials, myTributes, recentObituaries, selectedMemorial, shareStatus,
    catalogStatus, catalogError, networkStatus, networkMessage,
    isSubmitting, isPaying, confirmationChecking,
    pendingWrite, writePhase, writeNotice, writeError, storageHealthy,
    lastTx,
    memorialCount, tributeCount, obituaryCount,

    // Navigation
    loadMemorials, loadVisitedMemorials, loadMyTributes, openMemorial, closeMemorial,
    shareMemorial, checkUrlForMemorial,

    // Write actions
    createMemorial, payTribute, confirmPendingWrite,

    // Lifecycle
    loadAll, loadNetworkStatus, cleanupTimers,
  };
}

export type UseMemorialShrineReturn = ReturnType<typeof useMemorialShrine>;
