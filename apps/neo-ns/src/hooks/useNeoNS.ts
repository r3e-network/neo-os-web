/**
 * useNeoNS -- React hook for Neo Name Service domain logic.
 *
 * Uses createObservable instead of Vue ref/computed.
 */

import { createObservable } from "@shared/react/context";
import type { Observable } from "@shared/react/context";
import type { ChainService, EventBus } from "@shared/services";

const NNS_CONTRACT_HASH = "0x50ac1c37690cc2cfc594472833cf57505d5f46de";
const EXPIRY_WARNING_MS = 30 * 24 * 60 * 60 * 1000;
const SEARCH_DEBOUNCE_MS = 500;

export interface Domain {
  name: string;
  owner: string;
  expiry: number;
  target?: string;
}

export interface SearchResult {
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
    get: () => chain.address.value ? t("connected") : t("disconnected"),
    set: () => {},
    subscribe: () => () => {},
  };

  const expiringSoon: Observable<number> = {
    get: () => myDomains.get().filter((d) => d.expiry > 0 && d.expiry - Date.now() < EXPIRY_WARNING_MS).length,
    set: () => {},
    subscribe: (fn) => myDomains.subscribe(fn),
  };

  const loadMyDomains = async () => {
    if (!chain.address.value) { myDomains.set([]); return; }
    try {
      const tokensRaw = await chain.read("tokensOf", [{ type: "Hash160", value: chain.address.value }], readOpts);
      const tokens = Array.isArray(tokensRaw) ? tokensRaw : [];
      if (tokens.length === 0) { myDomains.set([]); return; }

      const domains: Domain[] = [];
      for (const tokenId of tokens) {
        try {
          const props = await chain.read("properties", [{ type: "ByteArray", value: String(tokenId) }], readOpts) as Record<string, unknown> | null;
          if (props) {
            const name = tokenIdToName(String(tokenId)) || String(props.name || tokenId);
            domains.push({
              name, owner: chain.address.value,
              expiry: Number(props.expiration || 0) * 1000,
              target: props.target ? String(props.target) : undefined,
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
          searchResult.set({ available: true, price });
        } else {
          let owner = t("unknownOwner");
          try {
            const tokenId = domainToTokenId(baseName);
            const ownerRaw = await chain.read("ownerOf", [{ type: "ByteArray", value: tokenId }], readOpts);
            if (ownerRaw) owner = String(ownerRaw);
          } catch { /* owner lookup can fail */ }
          searchResult.set({ available: false, owner });
        }
      } catch (e) {
        error.set(e instanceof Error ? e.message : t("availabilityFailed"));
      } finally {
        isSearching.set(false);
      }
    }, SEARCH_DEBOUNCE_MS);
  };

  const registerDomain = async () => {
    if (!searchResult.get()?.available || isLoading.get()) return;
    isLoading.set(true);
    try {
      await chain.ensureWallet();
      const query = searchQuery.get().trim().toLowerCase();
      const fullName = query.endsWith(".neo") ? query : query + ".neo";
      const result = await chain.invoke("register", [
        { type: "String", value: fullName },
        { type: "Hash160", value: chain.address.value as string },
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
    isLoading.set(true);
    try {
      await chain.ensureWallet();
      // The on-chain NameService ABI is `setRecord(name, type, data)` —
      // there is no `setTarget`. Type 1 is the "A" record (Neo address
      // as string). Calling the wrong name FAULTed with method-not-found.
      const result = await chain.invoke("setRecord", [
        { type: "String", value: domain.name },
        { type: "Integer", value: 1 },
        { type: "String", value: targetAddress },
      ], { scriptHash: contractHash });
      if (result.success) {
        eventBus.emit("neo-ns:recordSet", { action: t("targetSet"), domain: domain.name, target: targetAddress });
        await loadMyDomains();
      }
    } catch (e) {
      eventBus.emit("neo-ns:error", { message: e instanceof Error ? e.message : t("error") });
      throw e;
    } finally { isLoading.set(false); }
  };

  const transferDomain = async (domain: Domain, toAddress: string) => {
    if (!domain || !toAddress) return;
    isLoading.set(true);
    try {
      await chain.ensureWallet();
      const tokenId = domainToTokenId(domain.name.replace(/\.neo$/, ""));
      const result = await chain.invoke("transfer", [
        { type: "Hash160", value: toAddress },
        { type: "ByteArray", value: tokenId },
        { type: "String", value: "" },
      ], { scriptHash: contractHash, waitForEvent: "Transfer" });
      if (result.success) {
        eventBus.emit("neo-ns:transferred", { action: t("transferred"), domain: domain.name, to: toAddress });
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
