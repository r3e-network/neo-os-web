import { ref, computed, watch } from "vue";
import { useWallet } from "@neo/uniapp-sdk";
import type { WalletSDK } from "@neo/types";
import { useI18n } from "./useI18n";
import { requireNeoChain } from "@shared/utils/chain";
import { parseInvokeResult } from "@shared/utils/neo";
import type { RoundItem } from "../pages/index/components/RoundList.vue";

const NEO_HASH = "0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5";
const GAS_HASH = "0xd2a4cff31913016155e38e474a2c06d08be276cf";

export function useQuadraticRounds() {
  const { t } = useI18n();
  const { address, connect, invokeContract, invokeRead, chainType, getContractAddress } = useWallet() as WalletSDK;

  const rounds = ref<RoundItem[]>([]);
  const selectedRoundId = ref<string>("");
  const contractAddress = ref<string | null>(null);
  const isRefreshingRounds = ref(false);
  const isCreatingRound = ref(false);
  const isAddingMatching = ref(false);
  const isFinalizing = ref(false);
  const isClaimingUnused = ref(false);
  const status = ref<{ msg: string; type: "success" | "error" } | null>(null);

  const selectedRound = computed(() =>
    rounds.value.find((round) => round.id === selectedRoundId.value) || null
  );

  const canManageSelectedRound = computed(() => {
    if (!selectedRound.value || !address.value) return false;
    return selectedRound.value.creator === address.value &&
           !selectedRound.value.cancelled &&
           !selectedRound.value.finalized;
  });

  const canFinalizeSelectedRound = computed(() => {
    if (!selectedRound.value || !address.value) return false;
    return selectedRound.value.creator === address.value &&
           !selectedRound.value.cancelled &&
           !selectedRound.value.finalized;
  });

  const canClaimUnused = computed(() => {
    if (!selectedRound.value || !address.value) return false;
    return selectedRound.value.creator === address.value &&
           selectedRound.value.finalized &&
           !selectedRound.value.cancelled;
  });

  const setStatus = (msg: string, type: "success" | "error") => {
    status.value = { msg, type };
    setTimeout(() => {
      if (status.value?.msg === msg) status.value = null;
    }, 4000);
  };

  const ensureContractAddress = async () => {
    if (!requireNeoChain(chainType, t, undefined, { silent: true })) {
      throw new Error(t("wrongChain"));
    }
    if (!contractAddress.value) {
      contractAddress.value = await getContractAddress();
    }
    if (!contractAddress.value) {
      throw new Error(t("contractMissing"));
    }
    return contractAddress.value;
  };

  const parseBigInt = (value: unknown) => {
    try {
      return BigInt(String(value ?? "0"));
    } catch {
      return 0n;
    }
  };

  const parseDateInput = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return 0;
    const normalized = trimmed.includes("T") ? trimmed : trimmed.replace(" ", "T");
    const parsed = Date.parse(normalized);
    if (Number.isNaN(parsed)) return 0;
    return Math.floor(parsed / 1000);
  };

  const parseRound = (raw: any, id: string): RoundItem | null => {
    if (!raw || typeof raw !== "object") return null;
    const matchingPool = parseBigInt(raw.matchingPool);
    const matchingAllocated = parseBigInt(raw.matchingAllocated);
    const matchingWithdrawn = parseBigInt(raw.matchingWithdrawn);
    const matchingRemaining = raw.matchingRemaining !== undefined
      ? parseBigInt(raw.matchingRemaining)
      : matchingPool - matchingAllocated - matchingWithdrawn;

    return {
      id,
      creator: String(raw.creator || ""),
      assetSymbol: String(raw.assetSymbol || ""),
      matchingPool,
      matchingRemaining,
      totalContributed: parseBigInt(raw.totalContributed),
      projectCount: parseBigInt(raw.projectCount),
      startTime: Number.parseInt(String(raw.startTime || "0"), 10) || 0,
      endTime: Number.parseInt(String(raw.endTime || "0"), 10) || 0,
      status: String(raw.status || ""),
      title: String(raw.title || ""),
      description: String(raw.description || ""),
    };
  };

  const fetchRoundIds = async () => {
    const contract = await ensureContractAddress();
    const result = await invokeRead({
      contractAddress: contract,
      operation: "getRounds",
      args: [{ type: "Integer", value: "0" }, { type: "Integer", value: "30" }],
    });
    const parsed = parseInvokeResult(result);
    if (!Array.isArray(parsed)) return [] as string[];
    return parsed
      .map((value) => Number.parseInt(String(value || "0"), 10))
      .filter((value) => Number.isFinite(value) && value > 0)
      .map((value) => String(value));
  };

  const fetchRoundDetails = async (roundId: string) => {
    const contract = await ensureContractAddress();
    const details = await invokeRead({
      contractAddress: contract,
      operation: "getRoundDetails",
      args: [{ type: "Integer", value: roundId }],
    });
    const parsed = parseInvokeResult(details) as any;
    return parseRound(parsed, roundId);
  };

  const refreshRounds = async () => {
    if (isRefreshingRounds.value) return;
    try {
      isRefreshingRounds.value = true;
      const ids = await fetchRoundIds();
      const details = await Promise.all(ids.map(fetchRoundDetails));
      rounds.value = details.filter(Boolean) as RoundItem[];
      if (!selectedRoundId.value && rounds.value.length > 0) {
        selectedRoundId.value = rounds.value[0].id;
      }
    } catch (e: any) {
      setStatus(e.message || t("contractMissing"), "error");
    } finally {
      isRefreshingRounds.value = false;
    }
  };

  const selectRound = (round: RoundItem) => {
    selectedRoundId.value = round.id;
  };

  const createRound = async (data: {
    title: string;
    description: string;
    asset: string;
    matchingPool: string;
    startTime: string;
    endTime: string;
  }) => {
    if (!requireNeoChain(chainType, t)) return;
    if (isCreatingRound.value) return;

    const title = data.title.trim().slice(0, 60);
    if (!title) {
      setStatus(t("invalidRound"), "error");
      return;
    }

    const startTime = parseDateInput(data.startTime);
    const endTime = parseDateInput(data.endTime);
    if (!startTime || !endTime || startTime >= endTime) {
      setStatus(t("invalidRound"), "error");
      return;
    }

    const decimals = data.asset === "NEO" ? 0 : 8;
    const matchingPool = (() => {
      const [intPart, fracPart = ""] = data.matchingPool.split(".");
      const normalized = fracPart.slice(0, decimals).padEnd(decimals, "0");
      const value = `${intPart}${normalized}`;
      return value.replace(/^0+/, "") || "0";
    })();

    if (!matchingPool || matchingPool === "0") {
      setStatus(t("invalidMatchingPool"), "error");
      return;
    }

    try {
      isCreatingRound.value = true;
      if (!address.value) await connect();
      if (!address.value) throw new Error(t("walletNotConnected"));

      const contract = await ensureContractAddress();
      const assetHash = data.asset === "NEO" ? NEO_HASH : GAS_HASH;
      const description = data.description.trim().slice(0, 240);

      await invokeContract({
        scriptHash: contract,
        operation: "createRound",
        args: [
          { type: "Hash160", value: address.value },
          { type: "Hash160", value: assetHash },
          { type: "Integer", value: matchingPool },
          { type: "Integer", value: startTime.toString() },
          { type: "Integer", value: endTime.toString() },
          { type: "String", value: title },
          { type: "String", value: description },
        ],
      });

      setStatus(t("roundCreated"), "success");
      await refreshRounds();
    } catch (e: any) {
      setStatus(e.message || t("contractMissing"), "error");
    } finally {
      isCreatingRound.value = false;
    }
  };

  const addMatching = async (amount: string) => {
    if (!requireNeoChain(chainType, t)) return;
    if (!selectedRound.value || isAddingMatching.value) return;

    const decimals = selectedRound.value.assetSymbol === "NEO" ? 0 : 8;
    const parsedAmount = (() => {
      const [intPart, fracPart = ""] = amount.split(".");
      const normalized = fracPart.slice(0, decimals).padEnd(decimals, "0");
      const value = `${intPart}${normalized}`;
      return value.replace(/^0+/, "") || "0";
    })();

    if (!parsedAmount || parsedAmount === "0") {
      setStatus(t("invalidMatchingPool"), "error");
      return;
    }

    try {
      isAddingMatching.value = true;
      if (!address.value) await connect();
      if (!address.value) throw new Error(t("walletNotConnected"));

      const contract = await ensureContractAddress();
      await invokeContract({
        scriptHash: contract,
        operation: "addMatchingPool",
        args: [
          { type: "Hash160", value: address.value },
          { type: "Integer", value: selectedRound.value.id },
          { type: "Integer", value: parsedAmount },
        ],
      });

      setStatus(t("matchingAdded"), "success");
      await refreshRounds();
    } catch (e: any) {
      setStatus(e.message || t("contractMissing"), "error");
    } finally {
      isAddingMatching.value = false;
    }
  };

  const parseJsonArray = (value: string) => {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  };

  const finalizeRound = async (projectIdsRaw: string, matchedRaw: string) => {
    if (!requireNeoChain(chainType, t)) return;
    if (!selectedRound.value || isFinalizing.value) return;

    const projectIdsArray = parseJsonArray(projectIdsRaw.trim());
    const matchedArray = parseJsonArray(matchedRaw.trim());
    if (!projectIdsArray || !matchedArray || projectIdsArray.length !== matchedArray.length || projectIdsArray.length === 0) {
      setStatus(t("invalidRound"), "error");
      return;
    }

    const projectIds = projectIdsArray
      .map((value) => Number.parseInt(String(value), 10))
      .filter((value) => Number.isFinite(value) && value > 0)
      .map((value) => String(value));

    const decimals = selectedRound.value.assetSymbol === "NEO" ? 0 : 8;
    const matchedAmounts = matchedArray.map((value) => {
      const [intPart, fracPart = ""] = String(value).split(".");
      const normalized = fracPart.slice(0, decimals).padEnd(decimals, "0");
      const val = `${intPart}${normalized}`;
      return val.replace(/^0+/, "") || "0";
    });

    try {
      isFinalizing.value = true;
      if (!address.value) await connect();
      if (!address.value) throw new Error(t("walletNotConnected"));

      const contract = await ensureContractAddress();
      await invokeContract({
        scriptHash: contract,
        operation: "finalizeRound",
        args: [
          { type: "Hash160", value: address.value },
          { type: "Integer", value: selectedRound.value.id },
          { type: "Array", value: projectIds.map((value) => ({ type: "Integer", value })) },
          { type: "Array", value: matchedAmounts.map((value) => ({ type: "Integer", value })) },
        ],
      });

      setStatus(t("roundFinalized"), "success");
      await refreshRounds();
    } catch (e: any) {
      setStatus(e.message || t("contractMissing"), "error");
    } finally {
      isFinalizing.value = false;
    }
  };

  const claimUnused = async () => {
    if (!requireNeoChain(chainType, t)) return;
    if (!selectedRound.value || isClaimingUnused.value) return;

    try {
      isClaimingUnused.value = true;
      if (!address.value) await connect();
      if (!address.value) throw new Error(t("walletNotConnected"));

      const contract = await ensureContractAddress();
      await invokeContract({
        scriptHash: contract,
        operation: "claimUnusedMatching",
        args: [
          { type: "Hash160", value: address.value },
          { type: "Integer", value: selectedRound.value.id },
        ],
      });

      setStatus(t("unusedClaimed"), "success");
      await refreshRounds();
    } catch (e: any) {
      setStatus(e.message || t("contractMissing"), "error");
    } finally {
      isClaimingUnused.value = false;
    }
  };

  const roundStatusLabel = (statusValue: string) => {
    switch (statusValue) {
      case "upcoming": return t("roundStatusUpcoming");
      case "active": return t("roundStatusActive");
      case "ended": return t("roundStatusEnded");
      case "finalized": return t("roundStatusFinalized");
      case "cancelled": return t("roundStatusCancelled");
      default: return statusValue || t("roundStatusActive");
    }
  };

  const formatSchedule = (startTime: number, endTime: number) => {
    if (!startTime || !endTime) return t("dateUnknown");
    const start = new Date(startTime * 1000);
    const end = new Date(endTime * 1000);
    return `${start.toLocaleString()} - ${end.toLocaleString()}`;
  };

  const formatAmount = (assetSymbol: string, amount: bigint) => {
    if (assetSymbol === "NEO") return amount.toString();
    const str = amount.toString().padStart(9, "0");
    const intPart = str.slice(0, -8) || "0";
    const fracPart = str.slice(-8);
    const normalized = fracPart.replace(/0+$/, "");
    return normalized ? `${intPart}.${normalized}` : intPart;
  };

  watch(address, async (newAddr) => {
    if (newAddr) await refreshRounds();
  });

  return {
    rounds,
    selectedRoundId,
    selectedRound,
    isRefreshingRounds,
    isCreatingRound,
    isAddingMatching,
    isFinalizing,
    isClaimingUnused,
    canManageSelectedRound,
    canFinalizeSelectedRound,
    canClaimUnused,
    status,
    refreshRounds,
    selectRound,
    createRound,
    addMatching,
    finalizeRound,
    claimUnused,
    roundStatusLabel,
    formatSchedule,
    formatAmount,
    setStatus,
    ensureContractAddress,
  };
}
