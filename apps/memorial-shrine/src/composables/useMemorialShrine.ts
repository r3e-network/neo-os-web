/**
 * useMemorialShrine — Domain logic for the Memorial Shrine miniapp.
 *
 * Talks DIRECTLY to the app's standalone on-chain contract
 * (MiniAppMemorialShrine, testnet 0x87f0fe2ba69cd973a3274471234d3cc13ef943c5)
 * via the MiniApp framework (ctx.framework). The earlier path read the memorial / obituary catalog
 * and the visitor's tribute history through the Morpheus OS kernel
 * (ctx.os.storage list/get) and hinted achievements through ctx.os.badge. That
 * kernel/edge is DOWN/degraded, so those reads returned nothing and the app fell
 * back to hardcoded placeholder memorials. This composable removes the OS
 * dependency entirely: every read is a contract getter and every write is a
 * wallet-signed contract call.
 *
 * Contract interaction model (verified against the deployed ABI + the live
 * validation harness deploy/scripts/live_validate_remaining_contracts_part2.js):
 *
 *   READS (app.chain.readRaw, default app contract script hash):
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
 *   WRITES (app.chain.invoke / app.chain.invokeWithPayment):
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
import { eventValue } from "@shared/utils/chain-events";
import { addressToScriptHash } from "@shared/utils/neo";
import { readQueryParam } from "@shared/utils/url";
import { readCachedJSON, writeCachedJSON } from "@shared/utils/runtime-cache";
import type { Memorial } from "../types";

/** The framework contract-arg shape (from app.chain.arg.*); accepts the raw-address Hash160 literal too. */
type FrameworkArg = ReturnType<MiniAppFramework["chain"]["arg"]["string"]>;
/** The framework tx-result shape (from app.chain.invoke / invokeWithPayment). */
type FrameworkTx = Awaited<ReturnType<MiniAppFramework["chain"]["invoke"]>>;

const APP_ID = "miniapp-memorial-shrine";

/** Local store of memorial ids the visitor has actually opened ("Visited"). */
const VISITED_STORE_KEY = "memorial-shrine-visited";
/** How many visited ids to retain locally. */
const MAX_VISITED = 60;

/** Fixed offering cost (GAS base units) keyed by on-chain offering type. */
const OFFERING_COSTS_FIXED8: Record<number, bigint> = {
  1: 1000000n,
  2: 2000000n,
  3: 3000000n,
  4: 5000000n,
  5: 10000000n,
  6: 50000000n,
};

/** Defensive caps on how many records to enumerate per refresh. */
const MAX_MEMORIALS = 60;
const MAX_OBITUARIES = 20;
const MAX_TRIBUTES_PER_MEMORIAL = 50;

function normalizeText(value: unknown, maxLength: number): string {
  return String(value ?? "").trim().slice(0, maxLength);
}

/** Coerce a parsed NeoVM Integer (number | numeric string) to a JS number. */
function asNumber(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
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

export interface UseMemorialShrineOptions {
  /** MiniApp framework (ctx.framework); its chain layer submits wallet-confirmed writes + reads. */
  app: MiniAppFramework;
  /** Network inferred from launch params; mainnet tribute requires receipt ID. */
  launchNetwork?: "mainnet" | "testnet" | null;
  /** EventBus for UI events. */
  eventBus: { emit: (event: string, payload?: unknown) => void };
  /** Translation function. */
  t: (key: string, params?: Record<string, string | number>) => string;
}

// ============================================================================
// On-chain parsing
// ============================================================================

/** Build a Memorial from a getMemorialDetails Map. Returns null if empty. */
function memorialFromMap(raw: unknown): Memorial | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  const id = asNumber(record.id);
  // A missing / zeroed memorial yields an empty map (no id, no creator).
  if (id <= 0 || !record.creator) return null;

  const incense = asNumber(record.incenseCount);
  const candle = asNumber(record.candleCount);
  const flower = asNumber(record.flowerCount);
  const fruit = asNumber(record.fruitCount);
  const wine = asNumber(record.wineCount);
  const feast = asNumber(record.feastCount);
  const lastTributeTime = asNumber(record.lastTributeTime);

  return {
    id,
    name: String(record.deceasedName ?? ""),
    photoHash: String(record.photoHash ?? ""),
    birthYear: asNumber(record.birthYear),
    deathYear: asNumber(record.deathYear),
    relationship: String(record.relationship ?? ""),
    biography: String(record.biography ?? ""),
    obituary: String(record.obituary ?? ""),
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
  eventBus,
  t,
}: UseMemorialShrineOptions) {
  const memorials = createObservable<Memorial[]>([]);
  const visitedMemorials = createObservable<Memorial[]>([]);
  const myTributes = createObservable<TributeRecord[]>([]);
  const recentObituaries = createObservable<{ id: number; name: string; text: string }[]>([]);
  const selectedMemorial = createObservable<Memorial | null>(null);
  const shareStatus = createObservable<string | null>(null);
  const isSubmitting = createObservable(false);
  const isPaying = createObservable(false);
  const lastTx = createObservable<FrameworkTx | null>(null);
  let shareStatusTimer: ReturnType<typeof setTimeout> | null = null;

  const memorialCount = createDerived(() => memorials.get().length, [memorials]);
  // "My Tributes" reflects tributes the connected wallet has actually paid,
  // read straight from the contract — independent of "Visited".
  const tributeCount = createDerived(() => myTributes.get().length, [myTributes]);
  const obituaryCount = createDerived(() => recentObituaries.get().length, [recentObituaries]);

  /** Resolve the connected wallet address without prompting a connection. */
  const connectedAddress = (): string | null => {
    try {
      return app.chain.address.get();
    } catch (_e) {
      return null;
    }
  };

  // ------------------------------------------
  // Read: a single memorial by id (contract getter)
  // ------------------------------------------

  const readMemorial = async (id: number): Promise<Memorial | null> => {
    try {
      const raw = await app.chain.readRaw("getMemorialDetails", [
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
  const loadMemorials = async () => {
    let total = 0;
    try {
      total = Math.min(asNumber(await app.chain.readRaw("getMemorialCount", [])), MAX_MEMORIALS);
    } catch (_e) {
      total = 0;
    }

    if (total <= 0) {
      memorials.set([]);
    } else {
      const ids: number[] = [];
      // Highest id first so the freshest memorials lead the grid.
      for (let id = total; id >= 1 && ids.length < MAX_MEMORIALS; id -= 1) ids.push(id);
      const results = await Promise.all(ids.map((id) => readMemorial(id)));
      memorials.set(results.filter((m): m is Memorial => m !== null));
    }

    await loadObituaries();
  };

  /**
   * Load recent obituaries from the contract: getRecentObituaries() returns the
   * newest memorial ids that published an obituary; each id resolves to a
   * name + obituary text via getMemorialDetails.
   */
  const loadObituaries = async () => {
    let ids: number[] = [];
    try {
      const raw = await app.chain.readRaw("getRecentObituaries", []);
      if (Array.isArray(raw)) {
        ids = raw
          .map((value) => asNumber(value))
          .filter((id) => id > 0)
          .slice(0, MAX_OBITUARIES);
      }
    } catch (_e) {
      ids = [];
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
      const raw = readCachedJSON<number[]>(VISITED_STORE_KEY);
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
      writeCachedJSON(VISITED_STORE_KEY, next);
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
      const raw = await app.chain.readRaw("getVisitorMemorials", [
        app.chain.arg.hash160(visitorHash),
      ]);
      if (Array.isArray(raw)) {
        memorialIds = raw.map((value) => asNumber(value)).filter((id) => id > 0);
      }
    } catch (_e) {
      myTributes.set([]);
      return;
    }

    if (memorialIds.length === 0) {
      myTributes.set([]);
      return;
    }

    const perMemorial = await Promise.all(
      memorialIds.map((memorialId) => readVisitorTributesForMemorial(visitorHash, memorialId)),
    );
    const records = perMemorial.flat().sort((a, b) => b.paidAt - a.paidAt);
    myTributes.set(records);
  };

  /** Read this visitor's tribute records for one memorial. */
  const readVisitorTributesForMemorial = async (
    visitorHash: string,
    memorialId: number,
  ): Promise<TributeRecord[]> => {
    let tributeIds: number[] = [];
    try {
      const raw = await app.chain.readRaw("getMemorialTributes", [
        app.chain.arg.integer(memorialId),
        app.chain.arg.integer(0),
        app.chain.arg.integer(MAX_TRIBUTES_PER_MEMORIAL),
      ]);
      if (Array.isArray(raw)) {
        tributeIds = raw.map((value) => asNumber(value)).filter((id) => id > 0);
      }
    } catch (_e) {
      return [];
    }

    const details = await Promise.all(
      tributeIds.map(async (tributeId) => {
        try {
          const raw = await app.chain.readRaw("getTributeDetails", [
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
    for (const record of details) {
      if (!record) continue;
      if (!sameHash(record.visitor, visitorHash)) continue;
      const offeringType = asNumber(record.offeringType) || 1;
      const cost = OFFERING_COSTS_FIXED8[offeringType] ?? OFFERING_COSTS_FIXED8[1] ?? 1000000n;
      records.push({
        tributeId: asNumber(record.id),
        memorialId: asNumber(record.memorialId) || memorialId,
        offeringType,
        offeringName: String(record.offeringName ?? ""),
        message: String(record.message ?? ""),
        amountGas: app.amount.fixed8ToGas(cost),
        paidAt: asNumber(record.timestamp),
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

  /** Briefly surface a share status message (auto-clears after 2.5s). */
  const flashShareStatus = (message: string) => {
    shareStatus.set(message);
    if (shareStatusTimer) clearTimeout(shareStatusTimer);
    shareStatusTimer = setTimeout(() => {
      shareStatus.set(null);
      shareStatusTimer = null;
    }, 2500);
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
        eventBus.emit("memorial:shared", { id: target.id, url: shareUrl });
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

  // ------------------------------------------
  // Write: create memorial (direct MiniApp contract)
  // ------------------------------------------

  /**
   * Create a memorial directly on the MiniApp contract. The wallet signs the
   * `createMemorial` invocation and the UI listens for `MemorialCreated`. The
   * call is free — no GAS is prepaid for creation.
   */
  const createMemorial = async (form: {
    name: string;
    photoHash: string;
    relationship: string;
    birthYear: number;
    deathYear: number;
    biography: string;
    obituary: string;
  }) => {
    if (isSubmitting.get()) return;
    isSubmitting.set(true);
    try {
      const creator = await app.chain.ensureWallet();
      // NOTE: the contract's createMemorial takes the creator as a Hash160 whose
      // value is the RAW wallet address (the deployed ABI + live-validate harness
      // expect the base58 form here, not a script hash). Keep this arg literal —
      // routing it through arg.hash160 would convert it to a script hash and
      // change on-chain behavior.
      const args: FrameworkArg[] = [
        { type: "Hash160", value: creator },
        app.chain.arg.string(normalizeText(form.name, 96)),
        app.chain.arg.string(normalizeText(form.photoHash, 160)),
        app.chain.arg.string(normalizeText(form.relationship, 64)),
        app.chain.arg.integer(form.birthYear || 0),
        app.chain.arg.integer(form.deathYear || 0),
        app.chain.arg.string(normalizeText(form.biography, 600)),
        app.chain.arg.string(normalizeText(form.obituary, 600)),
      ];

      const result = await app.chain.invoke("createMemorial", args, {
        waitForEvent: "MemorialCreated",
        waitTimeoutMs: 30_000,
      });
      lastTx.set(result);

      eventBus.emit("memorial:created", {
        name: form.name,
        memorialId: eventValue(result.event, 0),
        txid: result.txid,
      });

      await loadMemorials();
    } finally {
      isSubmitting.set(false);
    }
  };

  // ------------------------------------------
  // Write: pay tribute (direct-prepaid GAS + contract call)
  // ------------------------------------------

  /**
   * Pay tribute by prepaying the selected offering cost and invoking
   * `payTribute(visitor, memorialId, offeringType, message)`.
   *
   * On testnet the offering cost is prepaid through invokeWithPayment (a GAS
   * transfer with the appId memo prefix, then the call). On mainnet the receipt
   * ID maps to an already-settled payment so the call is direct.
   */
  const payTribute = async (
    memorialId: number,
    offeringType: number,
    message: string,
    receiptId?: string,
  ) => {
    if (isPaying.get()) return;
    isPaying.set(true);
    try {
      const visitor = await app.chain.ensureWallet();
      const selectedOffering = Number.isInteger(offeringType) ? offeringType : 1;
      const offeringCost =
        OFFERING_COSTS_FIXED8[selectedOffering] ?? OFFERING_COSTS_FIXED8[1] ?? 1000000n;
      // The visitor Hash160 carries the RAW wallet address (deployed ABI +
      // live-validate harness expect base58, not a script hash) — kept literal;
      // routing it through arg.hash160 would change on-chain behavior.
      const args: FrameworkArg[] = [
        { type: "Hash160", value: visitor },
        app.chain.arg.integer(memorialId),
        app.chain.arg.integer(selectedOffering),
        app.chain.arg.string(normalizeText(message, 280)),
      ];
      let result: FrameworkTx;
      if (launchNetwork === "mainnet") {
        const normalizedReceiptId = String(receiptId ?? "").trim();
        if (!/^[1-9]\d*$/.test(normalizedReceiptId)) {
          throw new Error(t("receiptIdRequired"));
        }
        result = await app.chain.invoke(
          "payTribute",
          [
            ...args,
            app.chain.arg.integer(normalizedReceiptId),
          ],
          { waitForEvent: "TributePaid", waitTimeoutMs: 30_000 },
        );
      } else {
        result = await app.chain.invokeWithPayment(
          offeringCost.toString(),
          `${APP_ID}:tribute:${memorialId}:${selectedOffering}`,
          "payTribute",
          args,
          { waitForEvent: "TributePaid", waitTimeoutMs: 30_000 },
        );
      }
      lastTx.set(result);

      const amountGas = app.amount.fixed8ToGas(offeringCost);
      eventBus.emit("tribute:paid", {
        memorialId,
        offeringType: selectedOffering,
        amountGas,
        txid: result.txid,
      });

      // Reflect the paid tribute immediately, then reconcile from chain. The
      // optimistic record uses the TributePaid tributeId (event slot is the
      // returned id) so the counter advances without waiting on the read.
      const optimistic: TributeRecord = {
        tributeId: asNumber(eventValue(result.event, 0)),
        memorialId,
        offeringType: selectedOffering,
        offeringName: "",
        message: normalizeText(message, 280),
        amountGas,
        paidAt: Date.now(),
      };
      myTributes.set([optimistic, ...myTributes.get()]);

      // Reconcile memorials (offering counts) + the canonical tribute list.
      await loadMemorials();
      await loadMyTributes();
      if (selectedMemorial.get()?.id === memorialId) {
        selectedMemorial.set(memorials.get().find((m) => m.id === memorialId) || null);
      }
    } finally {
      isPaying.set(false);
    }
  };

  // ------------------------------------------
  // Load all
  // ------------------------------------------

  const loadAll = async () => {
    await loadMemorials();
    await checkUrlForMemorial();
    await loadVisitedMemorials();
    await loadMyTributes();
  };

  const cleanupTimers = () => {
    if (shareStatusTimer) { clearTimeout(shareStatusTimer); shareStatusTimer = null; }
  };
  return {
    // State
    memorials, visitedMemorials, myTributes, recentObituaries, selectedMemorial, shareStatus,
    isSubmitting, isPaying,
    lastTx,
    memorialCount, tributeCount, obituaryCount,

    // Navigation
    loadMemorials, loadVisitedMemorials, loadMyTributes, openMemorial, closeMemorial,
    shareMemorial, checkUrlForMemorial,

    // Write actions
    createMemorial, payTribute,

    // Lifecycle
    loadAll, cleanupTimers,
  };
}

export type UseMemorialShrineReturn = ReturnType<typeof useMemorialShrine>;
