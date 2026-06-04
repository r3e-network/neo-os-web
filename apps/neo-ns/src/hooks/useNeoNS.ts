/**
 * useNeoNS -- React hook for Neo Name Service domain logic.
 *
 * Uses createObservable instead of Vue ref/computed.
 */

import { createObservable } from "@shared/react/context";
import type { Observable } from "@shared/react/context";
import type { ChainService, EventBus } from "@shared/services";

const NNS_CONTRACT_HASH = "0x50ac1c37690cc2cfc594472833cf57505d5f46de";
const NNS_RECORD_TYPE_ADDRESS = 16;
const EXPIRY_WARNING_MS = 30 * 24 * 60 * 60 * 1000;
const SEARCH_DEBOUNCE_MS = 500;
/** Neo N3 address: base58check, leading 'N', 34 chars total. */
const NEO_ADDRESS_PATTERN = /^N[1-9A-HJ-NP-Za-km-z]{33}$/;
/** Any expiry beyond this far-future bound is treated as a unit error (over-scaled). */
const MAX_PLAUSIBLE_EXPIRY_MS = Date.UTC(2200, 0, 1);

/**
 * Normalise a raw `properties.expiration` value into epoch milliseconds.
 *
 * The on-chain NNS contract returns a Unix timestamp; depending on the
 * deployment this can be in milliseconds (NeoVM `Runtime.Time`) or seconds.
 * Rather than hard-coding one unit, detect the magnitude: values that already
 * look like milliseconds (>= ~ year 2001 in ms) are used as-is, smaller values
 * are treated as seconds and scaled. Absurd over-scaled results (a previous
 * `* 1000` on an already-ms value) are clamped back down so the UI never shows
 * a ~50,000-year future date and `expiringSoon` keeps working.
 */
function normalizeExpiryMs(raw: unknown): number {
  let ms = Number(raw ?? 0);
  if (!Number.isFinite(ms) || ms <= 0) return 0;
  // Seconds-scale timestamps (< ~ year 33658 in seconds) get promoted to ms.
  // 1e12 ms ≈ 2001-09; anything below that magnitude is almost certainly seconds.
  if (ms < 1e12) ms *= 1000;
  // Guard against a double-scaled (already-ms then *1000) value.
  if (ms > MAX_PLAUSIBLE_EXPIRY_MS) ms = Math.floor(ms / 1000);
  return ms > MAX_PLAUSIBLE_EXPIRY_MS ? 0 : ms;
}

/** Strict Neo N3 address check (trims whitespace, rejects empty/malformed). */
function isValidNeoAddress(value: unknown): boolean {
  return NEO_ADDRESS_PATTERN.test(String(value ?? "").trim());
}

export interface Domain {
  name: string;
  owner: string;
  expiry: number;
  target?: string;
}

export interface SearchResult {
  /** The exact full ".neo" name that was searched (snapshotted so registration cannot drift from the live query). */
  name: string;
  available: boolean;
  price?: number;
  owner?: string;
}

export interface UseNeoNSOptions {
  chain: ChainService;
  eventBus: EventBus;
  t: (key: string, params?: Record<string, string | number>) => string;
  nnsContractHash?: string;
}

function domainToTokenId(name: string): string {
  const fullName = name.toLowerCase().endsWith(".neo") ? name.toLowerCase() : name.toLowerCase() + ".neo";
  const encoder = new TextEncoder();
  const bytes = encoder.encode(fullName);
  return btoa(String.fromCharCode(...bytes));
}

function tokenIdToName(tokenId: string): string {
  try {
    const bytes = Uint8Array.from(atob(tokenId), (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch { return tokenId; }
}

export function useNeoNS({ chain, eventBus, t, nnsContractHash }: UseNeoNSOptions) {
  const contractHash = nnsContractHash ?? NNS_CONTRACT_HASH;
  const readOpts = { scriptHash: contractHash };

  const myDomains = createObservable<Domain[]>([]);
  const isLoading = createObservable(false);
  const error = createObservable("");
  const searchQuery = createObservable("");
  const searchResult = createObservable<SearchResult | null>(null);
  const isSearching = createObservable(false);
  const registrationCost = createObservable(0);
  const managingDomain = createObservable<Domain | null>(null);

  let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  const domainCount: Observable<number> = {
    get: () => myDomains.get().length,
    set: () => {},
    subscribe: (fn) => myDomains.subscribe(fn),
  };

  const walletStatus: Observable<string> = {
    get: () => chain.address.get() ? t("connected") : t("disconnected"),
    set: () => {},
    subscribe: () => () => {},
  };

  const expiringSoon: Observable<number> = {
    get: () =>
      myDomains.get().filter((d) => {
        if (d.expiry <= 0) return false;
        const remaining = d.expiry - Date.now();
        // Only future-but-near expiries count; already-expired domains (remaining <= 0)
        // are not "expiring soon".
        return remaining > 0 && remaining < EXPIRY_WARNING_MS;
      }).length,
    set: () => {},
    subscribe: (fn) => myDomains.subscribe(fn),
  };

  const loadMyDomains = async () => {
    const addr = chain.address.get();
    if (!addr) { myDomains.set([]); return; }
    try {
      const tokensRaw = await chain.read("tokensOf", [{ type: "Hash160", value: addr }], readOpts);
      const tokens = Array.isArray(tokensRaw) ? tokensRaw : [];
      if (tokens.length === 0) { myDomains.set([]); return; }

      const domains: Domain[] = [];
      for (const tokenId of tokens) {
        try {
          const props = await chain.read("properties", [{ type: "ByteArray", value: String(tokenId) }], readOpts) as Record<string, unknown> | null;
          if (props) {
            const name = tokenIdToName(String(tokenId)) || String(props.name || tokenId);
            let target = props.target ? String(props.target) : undefined;
            try {
              const resolvedTarget = await chain.read("resolve", [
                { type: "String", value: name },
                { type: "Integer", value: String(NNS_RECORD_TYPE_ADDRESS) },
              ], readOpts);
              if (resolvedTarget) target = String(resolvedTarget);
            } catch { /* address record can be unset */ }
            domains.push({
              name, owner: addr,
              expiry: normalizeExpiryMs(props.expiration),
              target,
            });
          }
        } catch (e) {
          console.warn(`[useNeoNS] Failed to fetch properties for token ${tokenId}:`, e instanceof Error ? e.message : String(e));
        }
      }
      myDomains.set(domains.sort((a, b) => b.expiry - a.expiry));
    } catch (e) {
      error.set(e instanceof Error ? e.message : t("error"));
      myDomains.set([]);
    }
  };

  const searchDomain = () => {
    const query = searchQuery.get().trim().toLowerCase();
    if (!query || query.length < 1) { searchResult.set(null); return; }
    if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(async () => {
      isSearching.set(true);
      searchResult.set(null);
      try {
        const fullName = query.endsWith(".neo") ? query : query + ".neo";
        const availableRaw = await chain.read("isAvailable", [{ type: "String", value: fullName }], readOpts);
        const isAvailable = Boolean(availableRaw);
        const baseName = fullName.replace(/\.neo$/, "");
        const priceRaw = await chain.read("getPrice", [{ type: "Integer", value: baseName.length }], readOpts);
        const price = Number(priceRaw || 0) / 1e8;
        registrationCost.set(price);

        if (isAvailable) {
          searchResult.set({ name: fullName, available: true, price });
        } else {
          let owner = t("unknownOwner");
          try {
            const tokenId = domainToTokenId(baseName);
            const ownerRaw = await chain.read("ownerOf", [{ type: "ByteArray", value: tokenId }], readOpts);
            if (ownerRaw) owner = String(ownerRaw);
          } catch { /* owner lookup can fail */ }
          searchResult.set({ name: fullName, available: false, owner });
        }
      } catch (e) {
        error.set(e instanceof Error ? e.message : t("availabilityFailed"));
      } finally {
        isSearching.set(false);
      }
    }, SEARCH_DEBOUNCE_MS);
  };

  const registerDomain = async () => {
    const result0 = searchResult.get();
    if (!result0?.available || isLoading.get()) return;
    isLoading.set(true);
    try {
      await chain.ensureWallet();
      // Register the exact name whose availability and price were verified by the
      // last search -- NOT the live searchQuery, which the user may have edited since.
      const fullName = result0.name;
      const result = await chain.invoke("register", [
        { type: "String", value: fullName },
        { type: "Hash160", value: chain.address.get() as string },
      ], { scriptHash: contractHash, waitForEvent: "Transfer" });

      if (result.success) {
        eventBus.emit("neo-ns:registered", { action: `${fullName} ${t("registered")}`, domain: fullName });
        searchQuery.set("");
        searchResult.set(null);
        registrationCost.set(0);
        await loadMyDomains();
      }
    } catch (e) {
      eventBus.emit("neo-ns:error", { message: e instanceof Error ? e.message : t("registrationFailed") });
      throw e;
    } finally { isLoading.set(false); }
  };

  const setRecord = async (domain: Domain, targetAddress: string) => {
    if (!domain || !targetAddress) return;
    const target = String(targetAddress).trim();
    // Reject empty/whitespace/malformed addresses before reaching the chain so the
    // user gets a clear "invalid address" hint instead of a raw contract error.
    if (!isValidNeoAddress(target)) throw new Error(t("invalidAddress"));
    isLoading.set(true);
    try {
      await chain.ensureWallet();
      const result = await chain.invoke("setRecord", [
        { type: "String", value: domain.name },
        { type: "Integer", value: String(NNS_RECORD_TYPE_ADDRESS) },
        { type: "String", value: target },
      ], { scriptHash: contractHash });
      if (result.success) {
        eventBus.emit("neo-ns:recordSet", { action: t("targetSet"), domain: domain.name, target });
        await loadMyDomains();
      }
    } catch (e) {
      eventBus.emit("neo-ns:error", { message: e instanceof Error ? e.message : t("error") });
      throw e;
    } finally { isLoading.set(false); }
  };

  const transferDomain = async (domain: Domain, toAddress: string) => {
    if (!domain || !toAddress) return;
    const to = String(toAddress).trim();
    // Reject empty/whitespace/malformed receiver addresses before invoking transfer.
    if (!isValidNeoAddress(to)) throw new Error(t("invalidAddress"));
    isLoading.set(true);
    try {
      await chain.ensureWallet();
      const tokenId = domainToTokenId(domain.name.replace(/\.neo$/, ""));
      const result = await chain.invoke("transfer", [
        { type: "Hash160", value: to },
        { type: "ByteArray", value: tokenId },
        { type: "String", value: "" },
      ], { scriptHash: contractHash, waitForEvent: "Transfer" });
      if (result.success) {
        eventBus.emit("neo-ns:transferred", { action: t("transferred"), domain: domain.name, to });
        await loadMyDomains();
      }
    } catch (e) {
      eventBus.emit("neo-ns:error", { message: e instanceof Error ? e.message : t("error") });
      throw e;
    } finally { isLoading.set(false); }
  };

  const renewDomain = async (domain: Domain) => {
    if (!domain) return;
    isLoading.set(true);
    try {
      await chain.ensureWallet();
      const result = await chain.invoke("renew", [{ type: "String", value: domain.name }], { scriptHash: contractHash });
      if (result.success) {
        eventBus.emit("neo-ns:renewed", { action: `${domain.name} ${t("renewed")}`, domain: domain.name });
        await loadMyDomains();
      }
    } catch (e) {
      eventBus.emit("neo-ns:error", { message: e instanceof Error ? e.message : t("error") });
      throw e;
    } finally { isLoading.set(false); }
  };

  const showManage = (domain: Domain) => { managingDomain.set(domain); };
  const cancelManage = () => { managingDomain.set(null); };

  const loadAll = async () => {
    isLoading.set(true);
    error.set("");
    try { await loadMyDomains(); } finally { isLoading.set(false); }
  };

  const cleanup = () => {
    if (searchDebounceTimer) { clearTimeout(searchDebounceTimer); searchDebounceTimer = null; }
  };

  return {
    myDomains, isLoading, error, searchQuery, searchResult, isSearching,
    registrationCost, managingDomain, domainCount, walletStatus, expiringSoon,
    loadMyDomains, loadAll, searchDomain, registerDomain, setRecord,
    transferDomain, renewDomain, showManage, cancelManage, cleanup,
  };
}
