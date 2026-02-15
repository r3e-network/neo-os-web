import { ref } from "vue";
import type { GovernanceCandidate } from "../utils";
import { fetchCandidates } from "../utils";
import type { UniAppGlobals } from "@shared/types/globals";

export function useCandidateData(preferredChainId: () => string) {
  const candidates = ref<GovernanceCandidate[]>([]);
  const totalNetworkVotes = ref("0");
  const blockHeight = ref(0);
  const candidatesLoading = ref(false);

  const getCacheKey = (network: "mainnet" | "testnet") => `candidate_vote_candidates_cache_${network}`;

  const readCache = (key: string) => {
    const g = globalThis as unknown as UniAppGlobals;
    const uniApi = g?.uni as Record<string, (...args: unknown[]) => unknown> | undefined;
    if (uniApi?.getStorageSync) {
      return uniApi.getStorageSync(key);
    }
    if (typeof localStorage !== "undefined") {
      return localStorage.getItem(key);
    }
    return null;
  };

  const writeCache = (key: string, value: string) => {
    const g = globalThis as unknown as UniAppGlobals;
    const uniApi = g?.uni as Record<string, (...args: unknown[]) => unknown> | undefined;
    if (uniApi?.setStorageSync) {
      uniApi.setStorageSync(key, value);
      return;
    }
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(key, value);
    }
  };

  const formatVotes = (votes: string): string => {
    const num = BigInt(votes || "0");
    if (num >= BigInt(1e12)) {
      return (Number(num / BigInt(1e10)) / 100).toFixed(2) + "T";
    }
    if (num >= BigInt(1e9)) {
      return (Number(num / BigInt(1e7)) / 100).toFixed(2) + "B";
    }
    if (num >= BigInt(1e6)) {
      return (Number(num / BigInt(1e4)) / 100).toFixed(2) + "M";
    }
    if (num >= BigInt(1e3)) {
      return (Number(num / BigInt(10)) / 100).toFixed(2) + "K";
    }
    return votes || "0";
  };

  const normalizePublicKey = (value: unknown) => String(value || "").replace(/^0x/i, "");

  const loadCandidates = async (force = false, selectedCandidate?: GovernanceCandidate | null) => {
    const network = preferredChainId() === "neo-n3-testnet" ? "testnet" : "mainnet";
    const cacheKey = getCacheKey(network);

    try {
      const cached = readCache(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        candidates.value = parsed.candidates || [];
        totalNetworkVotes.value = parsed.totalVotes || "0";

        const lastFetch = parsed.timestamp || 0;
        const now = Date.now();
        if (!force && now - lastFetch < 5 * 60 * 1000 && candidates.value.length > 0) {
          return { updatedSelection: selectedCandidate ?? null };
        }
      }
    } catch {
      /* Cache read failure is non-critical */
    }

    candidatesLoading.value = true;
    try {
      const targetChain = preferredChainId() === "neo-n3-testnet" ? "neo-n3-testnet" : "neo-n3-mainnet";
      const response = await fetchCandidates(targetChain);
      candidates.value = response.candidates;
      totalNetworkVotes.value = response.totalVotes || "0";
      blockHeight.value = response.blockHeight || 0;

      let updatedSelection: GovernanceCandidate | null = null;
      if (selectedCandidate) {
        const match = candidates.value.find(
          (c) => normalizePublicKey(c.publicKey) === normalizePublicKey(selectedCandidate.publicKey)
        );
        updatedSelection = match || null;
      }

      writeCache(
        cacheKey,
        JSON.stringify({
          candidates: candidates.value,
          totalVotes: totalNetworkVotes.value,
          blockHeight: blockHeight.value,
          timestamp: Date.now(),
        })
      );

      return { updatedSelection };
    } finally {
      candidatesLoading.value = false;
    }
  };

  return {
    candidates,
    totalNetworkVotes,
    blockHeight,
    candidatesLoading,
    formatVotes,
    normalizePublicKey,
    loadCandidates,
  };
}
