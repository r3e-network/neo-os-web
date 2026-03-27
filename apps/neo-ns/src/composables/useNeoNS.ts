/**
 * useNeoNS — Domain logic composable for the Neo Name Service miniapp
 *
 * This composable encapsulates all NNS business logic: domain lookup,
 * registration checks, ownership queries, record management, and transfers.
 * It replaces the legacy useNeoNS.ts + useDomainRegister.ts by receiving
 * ChainService + BalanceService + EventBus from PlatformServices instead
 * of wiring useWallet/useContractInteraction directly.
 *
 * Key design decisions:
 *   - No onMounted/onUnmounted — lifecycle is managed by defineMiniApp
 *   - No useWallet() inject — services are passed in explicitly
 *   - Sidebar/stats driven by manifest, not manually constructed
 *   - The NNS contract hash is passed as an option so it can be overridden
 *     per-network if needed
 */

import { ref, computed } from "vue";
import type { ChainService, EventBus } from "@shared/services";

// ============================================================================
// Constants
// ============================================================================

/** NNS contract address on Neo N3 mainnet */
const NNS_CONTRACT_HASH = "0x50ac1c37690cc2cfc594472833cf57505d5f46de";

/** Expiry warning threshold: 30 days in milliseconds */
const EXPIRY_WARNING_MS = 30 * 24 * 60 * 60 * 1000;

/** Search debounce delay in milliseconds */
const SEARCH_DEBOUNCE_MS = 500;

// ============================================================================
// Types
// ============================================================================

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
  /** ChainService instance from PlatformServices */
  chain: ChainService;
  /** EventBus instance from PlatformServices */
  eventBus: EventBus;
  /** Translation function */
  t: (key: string, params?: Record<string, string | number>) => string;
  /** Override the NNS contract hash (defaults to mainnet) */
  nnsContractHash?: string;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Encode a domain name into the Base64 token ID expected by the NNS contract.
 */
function domainToTokenId(name: string): string {
  const fullName = name.toLowerCase().endsWith(".neo")
    ? name.toLowerCase()
    : name.toLowerCase() + ".neo";
  const encoder = new TextEncoder();
  const bytes = encoder.encode(fullName);
  return btoa(String.fromCharCode(...bytes));
}

/**
 * Decode a Base64 token ID back to a domain name string.
 */
function tokenIdToName(tokenId: string): string {
  try {
    const bytes = Uint8Array.from(atob(tokenId), (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return tokenId;
  }
}

// ============================================================================
// Composable
// ============================================================================

export function useNeoNS({ chain, eventBus, t, nnsContractHash }: UseNeoNSOptions) {
  const contractHash = nnsContractHash ?? NNS_CONTRACT_HASH;
  const readOpts = { scriptHash: contractHash };

  // ── Owned Domains State ─────────────────────────────────────────────
  const myDomains = ref<Domain[]>([]);
  const isLoading = ref(false);
  const error = ref("");

  // ── Search / Registration State ─────────────────────────────────────
  const searchQuery = ref("");
  const searchResult = ref<SearchResult | null>(null);
  const isSearching = ref(false);
  const registrationCost = ref(0);

  // ── Domain Management State ─────────────────────────────────────────
  const managingDomain = ref<Domain | null>(null);

  // ── Search Debounce Handle ──────────────────────────────────────────
  let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  // ── Computed Values (for manifest stat/sidebar bindings) ────────────
  const domainCount = computed(() => myDomains.value.length);
  const walletStatus = computed(() =>
    chain.address.value ? t("connected") : t("disconnected"),
  );
  const expiringSoon = computed(() =>
    myDomains.value.filter(
      (d: Domain) => d.expiry > 0 && d.expiry - Date.now() < EXPIRY_WARNING_MS,
    ).length,
  );

  // ── Data Loading ────────────────────────────────────────────────────

  /**
   * Load all domains owned by the connected wallet.
   * Fetches token IDs via tokensOf, then properties for each.
   */
  const loadMyDomains = async () => {
    if (!chain.address.value) {
      myDomains.value = [];
      return;
    }

    try {
      const tokensRaw = await chain.read("tokensOf", [
        { type: "Hash160", value: chain.address.value },
      ], readOpts);

      const tokens = Array.isArray(tokensRaw) ? tokensRaw : [];
      if (tokens.length === 0) {
        myDomains.value = [];
        return;
      }

      const domains: Domain[] = [];
      for (const tokenId of tokens) {
        try {
          const props = await chain.read("properties", [
            { type: "ByteArray", value: String(tokenId) },
          ], readOpts) as Record<string, unknown> | null;

          if (props) {
            const name = tokenIdToName(String(tokenId)) || String(props.name || tokenId);
            domains.push({
              name,
              owner: chain.address.value,
              expiry: Number(props.expiration || 0) * 1000,
              target: props.target ? String(props.target) : undefined,
            });
          }
        } catch (e) {
          console.warn(
            `[useNeoNS] Failed to fetch properties for token ${tokenId}:`,
            e instanceof Error ? e.message : String(e),
          );
        }
      }

      myDomains.value = domains.sort((a, b) => b.expiry - a.expiry);
    } catch (e) {
      error.value = e instanceof Error ? e.message : t("error");
      myDomains.value = [];
    }
  };

  // ── Search / Availability Check ─────────────────────────────────────

  /**
   * Search for a domain name and check its availability + price.
   * Debounced to avoid excessive RPC calls.
   */
  const searchDomain = () => {
    const query = searchQuery.value.trim().toLowerCase();
    if (!query || query.length < 1) {
      searchResult.value = null;
      return;
    }

    if (searchDebounceTimer) {
      clearTimeout(searchDebounceTimer);
    }

    searchDebounceTimer = setTimeout(async () => {
      isSearching.value = true;
      searchResult.value = null;

      try {
        const fullName = query.endsWith(".neo") ? query : query + ".neo";

        // Check availability
        const availableRaw = await chain.read("isAvailable", [
          { type: "String", value: fullName },
        ], readOpts);
        const isAvailable = Boolean(availableRaw);

        // Fetch price based on name length (excluding .neo)
        const baseName = fullName.replace(/\.neo$/, "");
        const priceRaw = await chain.read("getPrice", [
          { type: "Integer", value: baseName.length },
        ], readOpts);
        const price = Number(priceRaw || 0) / 1e8;
        registrationCost.value = price;

        if (isAvailable) {
          searchResult.value = { available: true, price };
        } else {
          // Look up the current owner
          let owner = t("unknownOwner");
          try {
            const tokenId = domainToTokenId(baseName);
            const ownerRaw = await chain.read("ownerOf", [
              { type: "ByteArray", value: tokenId },
            ], readOpts);
            if (ownerRaw) owner = String(ownerRaw);
          } catch {
            // Owner lookup can fail for expired domains
          }
          searchResult.value = { available: false, owner };
        }
      } catch (e) {
        error.value = e instanceof Error ? e.message : t("availabilityFailed");
        eventBus.emit("neo-ns:error", {
          message: e instanceof Error ? e.message : t("availabilityFailed"),
        });
      } finally {
        isSearching.value = false;
      }
    }, SEARCH_DEBOUNCE_MS);
  };

  // ── Actions ─────────────────────────────────────────────────────────

  /**
   * Register a domain that was confirmed as available via searchDomain().
   */
  const registerDomain = async () => {
    if (!searchResult.value?.available || isLoading.value) return;

    isLoading.value = true;
    try {
      await chain.ensureWallet();

      const query = searchQuery.value.trim().toLowerCase();
      const fullName = query.endsWith(".neo") ? query : query + ".neo";

      const result = await chain.invoke(
        "register",
        [
          { type: "String", value: fullName },
          { type: "Hash160", value: chain.address.value as string },
        ],
        { scriptHash: contractHash, waitForEvent: "Transfer" },
      );

      if (result.success) {
        eventBus.emit("neo-ns:registered", {
          action: `${fullName} ${t("registered")}`,
          domain: fullName,
        });
        // Clear search state
        searchQuery.value = "";
        searchResult.value = null;
        registrationCost.value = 0;
        // Reload domains
        await loadMyDomains();
      }
    } catch (e) {
      eventBus.emit("neo-ns:error", {
        message: e instanceof Error ? e.message : t("registrationFailed"),
      });
      throw e;
    } finally {
      isLoading.value = false;
    }
  };

  /**
   * Set the target address record for a domain.
   */
  const setRecord = async (domain: Domain, targetAddress: string) => {
    if (!domain || !targetAddress) return;

    isLoading.value = true;
    try {
      await chain.ensureWallet();

      const result = await chain.invoke(
        "setTarget",
        [
          { type: "String", value: domain.name },
          { type: "Hash160", value: targetAddress },
        ],
        { scriptHash: contractHash },
      );

      if (result.success) {
        eventBus.emit("neo-ns:recordSet", {
          action: t("targetSet"),
          domain: domain.name,
          target: targetAddress,
        });
        await loadMyDomains();
      }
    } catch (e) {
      eventBus.emit("neo-ns:error", {
        message: e instanceof Error ? e.message : t("error"),
      });
      throw e;
    } finally {
      isLoading.value = false;
    }
  };

  /**
   * Transfer domain ownership to another address.
   */
  const transferDomain = async (domain: Domain, toAddress: string) => {
    if (!domain || !toAddress) return;

    isLoading.value = true;
    try {
      await chain.ensureWallet();

      const tokenId = domainToTokenId(domain.name.replace(/\.neo$/, ""));
      const result = await chain.invoke(
        "transfer",
        [
          { type: "Hash160", value: toAddress },
          { type: "ByteArray", value: tokenId },
          { type: "String", value: "" },
        ],
        { scriptHash: contractHash, waitForEvent: "Transfer" },
      );

      if (result.success) {
        eventBus.emit("neo-ns:transferred", {
          action: t("transferred"),
          domain: domain.name,
          to: toAddress,
        });
        await loadMyDomains();
      }
    } catch (e) {
      eventBus.emit("neo-ns:error", {
        message: e instanceof Error ? e.message : t("error"),
      });
      throw e;
    } finally {
      isLoading.value = false;
    }
  };

  /**
   * Renew a domain registration.
   */
  const renewDomain = async (domain: Domain) => {
    if (!domain) return;

    isLoading.value = true;
    try {
      await chain.ensureWallet();

      const result = await chain.invoke(
        "renew",
        [{ type: "String", value: domain.name }],
        { scriptHash: contractHash },
      );

      if (result.success) {
        eventBus.emit("neo-ns:renewed", {
          action: `${domain.name} ${t("renewed")}`,
          domain: domain.name,
        });
        await loadMyDomains();
      }
    } catch (e) {
      eventBus.emit("neo-ns:error", {
        message: e instanceof Error ? e.message : t("error"),
      });
      throw e;
    } finally {
      isLoading.value = false;
    }
  };

  // ── Domain Management Panel ─────────────────────────────────────────

  const showManage = (domain: Domain) => {
    managingDomain.value = domain;
  };

  const cancelManage = () => {
    managingDomain.value = null;
  };

  // ── Lifecycle ───────────────────────────────────────────────────────

  /**
   * Load all data. Called by defineMiniApp on mount and wallet-connect.
   */
  const loadAll = async () => {
    isLoading.value = true;
    error.value = "";
    try {
      await loadMyDomains();
    } finally {
      isLoading.value = false;
    }
  };

  /**
   * Cleanup timers and resources.
   */
  const cleanup = () => {
    if (searchDebounceTimer) {
      clearTimeout(searchDebounceTimer);
      searchDebounceTimer = null;
    }
  };

  return {
    // ── Raw State ───────────────────────────────────────────────────
    myDomains,
    isLoading,
    error,
    searchQuery,
    searchResult,
    isSearching,
    registrationCost,
    managingDomain,

    // ── Computed (for manifest stat/sidebar bindings) ────────────────
    domainCount,
    walletStatus,
    expiringSoon,

    // ── Data Loading ────────────────────────────────────────────────
    loadMyDomains,
    loadAll,

    // ── Search ──────────────────────────────────────────────────────
    searchDomain,

    // ── Actions ─────────────────────────────────────────────────────
    registerDomain,
    setRecord,
    transferDomain,
    renewDomain,
    showManage,
    cancelManage,

    // ── Cleanup ─────────────────────────────────────────────────────
    cleanup,
  };
}

/** Return type of useNeoNS for external typing */
export type UseNeoNSReturn = ReturnType<typeof useNeoNS>;
