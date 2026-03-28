/**
 * useNeoPayApp — Domain logic for Neo Pay miniapp (new pattern)
 *
 * Receives ChainService + EventBus from PlatformServices.
 * Handles payment stream creation, claiming, and cancellation.
 *
 * Replaces the legacy useNeoPay composable which wired useWallet +
 * useContractAddress + useStatusMessage directly.
 */

import { ref, computed } from "vue";
import type { ChainService, EventBus } from "@shared/services";
import { formatErrorMessage } from "@shared/utils/errorHandling";
import { toFixed8, toFixedDecimals } from "@shared/utils/format";
import { addressToScriptHash, normalizeScriptHash } from "@shared/utils/neo";
import { parseBigInt } from "@shared/utils/parsers";
import { BLOCKCHAIN_CONSTANTS } from "@shared/constants";
import type { StreamItem, StreamStatus } from "../types";

const WAIT_AFTER_TRANSFER_MS = 4000;
const NEO_HASH_NORMALIZED = normalizeScriptHash(BLOCKCHAIN_CONSTANTS.NEO_HASH);

export interface UseNeoPayAppOptions {
  chain: ChainService;
  eventBus: EventBus;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function useNeoPayApp({ chain, eventBus, t }: UseNeoPayAppOptions) {
  const isLoading = ref(false);
  const isRefreshing = ref(false);
  const claimingId = ref<string | null>(null);
  const cancellingId = ref<string | null>(null);
  const createdStreams = ref<StreamItem[]>([]);
  const beneficiaryStreams = ref<StreamItem[]>([]);

  // -- Computed --
  const allStreams = computed(() => [...createdStreams.value, ...beneficiaryStreams.value]);
  const activeCount = computed(() => allStreams.value.filter((s) => s.status === "active").length);
  const createdStreamCount = computed(() => createdStreams.value.length);
  const beneficiaryStreamCount = computed(() => beneficiaryStreams.value.length);
  const totalStreamCount = computed(() => createdStreams.value.length + beneficiaryStreams.value.length);

  // -- Helpers --
  const parseStream = (raw: unknown, id: string): StreamItem | null => {
    if (!raw || typeof raw !== "object") return null;
    const record = raw as Record<string, unknown>;
    const asset = String(record.asset || "");
    const assetNormalized = normalizeScriptHash(asset);
    const assetSymbol: "NEO" | "GAS" = assetNormalized === NEO_HASH_NORMALIZED ? "NEO" : "GAS";

    const totalAmount = parseBigInt(record.totalAmount);
    const releasedAmount = parseBigInt(record.releasedAmount);
    const remainingAmount = parseBigInt(record.remainingAmount ?? totalAmount - releasedAmount);
    const rateAmount = parseBigInt(record.rateAmount);
    const intervalSeconds = parseBigInt(record.intervalSeconds);
    const intervalDays = Number(intervalSeconds / 86400n) || 0;
    const statusValue = String(record.status || "active") as StreamStatus;

    return {
      id,
      creator: String(record.creator || ""),
      beneficiary: String(record.beneficiary || ""),
      asset,
      assetSymbol,
      totalAmount,
      releasedAmount,
      remainingAmount,
      rateAmount,
      intervalSeconds,
      intervalDays,
      status: statusValue,
      claimable: parseBigInt(record.claimable),
      title: String(record.title || ""),
      notes: String(record.notes || ""),
    };
  };

  const fetchStreamDetails = async (streamId: string) => {
    const details = await chain.read("GetStreamDetails", [
      { type: "Integer", value: streamId },
    ]);
    const parsed = details as Record<string, unknown>;
    return parseStream(parsed, streamId);
  };

  const fetchStreamIds = async (operation: string, walletAddress: string) => {
    const result = await chain.read(operation, [
      { type: "Hash160", value: walletAddress },
      { type: "Integer", value: "0" },
      { type: "Integer", value: "20" },
    ]);
    if (!Array.isArray(result)) return [] as string[];
    return result
      .map((value) => String(value || ""))
      .map((value) => Number.parseInt(value, 10))
      .filter((value) => Number.isFinite(value) && value > 0)
      .map((value) => String(value));
  };

  // -- Actions --
  const refreshStreams = async () => {
    if (!chain.address.value) return;
    if (isRefreshing.value) return;
    try {
      isRefreshing.value = true;
      const createdIds = await fetchStreamIds("getUserStreams", chain.address.value);
      const beneficiaryIds = await fetchStreamIds("getBeneficiaryStreams", chain.address.value);

      const created = await Promise.all(createdIds.map(fetchStreamDetails));
      const beneficiary = await Promise.all(beneficiaryIds.map(fetchStreamDetails));

      createdStreams.value = created.filter(Boolean) as StreamItem[];
      beneficiaryStreams.value = beneficiary.filter(Boolean) as StreamItem[];
      eventBus.emit("streams:refreshed", { count: allStreams.value.length });
    } catch (e) {
      eventBus.emit("streams:error", { message: formatErrorMessage(e, t("contractMissing")) });
      throw e;
    } finally {
      isRefreshing.value = false;
    }
  };

  const connectWallet = async () => {
    try {
      await chain.ensureWallet();
      if (chain.address.value) {
        await refreshStreams();
      }
      eventBus.emit("wallet:connected", { address: chain.address.value });
    } catch (e) {
      eventBus.emit("wallet:error", { message: formatErrorMessage(e, t("walletNotConnected")) });
      throw e;
    }
  };

  const handleCreateVault = async (formData: {
    name: string;
    beneficiary: string;
    asset: string;
    total: string;
    rate: string;
    intervalDays: string;
    notes: string;
  }) => {
    if (isLoading.value) return;

    const beneficiary = formData.beneficiary.trim();
    if (!beneficiary || !addressToScriptHash(beneficiary)) {
      throw new Error(t("invalidAddress"));
    }

    const intervalDays = Number.parseInt(formData.intervalDays, 10);
    if (!Number.isFinite(intervalDays) || intervalDays < 1 || intervalDays > 365) {
      throw new Error(t("intervalInvalid"));
    }

    const decimals = formData.asset === "NEO" ? 0 : 8;
    const totalFixed = decimals === 8 ? toFixed8(formData.total) : toFixedDecimals(formData.total, 0);
    const rateFixed = decimals === 8 ? toFixed8(formData.rate) : toFixedDecimals(formData.rate, 0);

    const totalAmount = parseBigInt(totalFixed);
    const rateAmount = parseBigInt(rateFixed);

    if (totalAmount <= 0n || rateAmount <= 0n) {
      throw new Error(t("invalidAmount"));
    }
    if (rateAmount > totalAmount) {
      throw new Error(t("rateTooHigh"));
    }

    try {
      isLoading.value = true;
      await chain.ensureWallet();
      if (!chain.address.value) throw new Error(t("walletNotConnected"));

      const assetHash = formData.asset === "NEO" ? BLOCKCHAIN_CONSTANTS.NEO_HASH : BLOCKCHAIN_CONSTANTS.GAS_HASH;
      const title = formData.name.trim().slice(0, 60);
      const notes = formData.notes.trim().slice(0, 240);
      const contractHash = chain.contractAddress.value;
      if (!contractHash) throw new Error(t("contractMissing"));

      // Step 1: Transfer asset to contract
      await chain.invoke(
        "transfer",
        [
          { type: "Hash160", value: chain.address.value },
          { type: "Hash160", value: contractHash },
          { type: "Integer", value: totalFixed },
          { type: "String", value: "" },
        ],
        { scriptHash: assetHash },
      );

      // Wait for transfer to settle
      await new Promise((resolve) => setTimeout(resolve, WAIT_AFTER_TRANSFER_MS));

      // Step 2: Create the stream
      await chain.invoke(
        "CreateStream",
        [
          { type: "Hash160", value: chain.address.value },
          { type: "Hash160", value: beneficiary },
          { type: "Hash160", value: assetHash },
          { type: "Integer", value: totalFixed },
          { type: "Integer", value: rateFixed },
          { type: "Integer", value: String(intervalDays * 86400) },
          { type: "String", value: title },
          { type: "String", value: notes },
        ],
        { waitForEvent: "StreamCreated" },
      );

      eventBus.emit("vault:created", {});
      await refreshStreams();
    } catch (e) {
      eventBus.emit("vault:error", { message: formatErrorMessage(e, t("contractMissing")) });
      throw e;
    } finally {
      isLoading.value = false;
    }
  };

  const claimStream = async (stream: StreamItem) => {
    if (claimingId.value) return;
    try {
      claimingId.value = stream.id;
      await chain.ensureWallet();
      if (!chain.address.value) throw new Error(t("walletNotConnected"));

      await chain.invoke(
        "ClaimStream",
        [
          { type: "Hash160", value: chain.address.value },
          { type: "Integer", value: stream.id },
        ],
        { waitForEvent: "StreamClaimed" },
      );

      await refreshStreams();
      eventBus.emit("stream:claimed", { id: stream.id });
    } catch (e) {
      eventBus.emit("stream:error", { message: formatErrorMessage(e, t("contractMissing")) });
      throw e;
    } finally {
      claimingId.value = null;
    }
  };

  const cancelStream = async (stream: StreamItem) => {
    if (cancellingId.value) return;
    try {
      cancellingId.value = stream.id;
      await chain.ensureWallet();
      if (!chain.address.value) throw new Error(t("walletNotConnected"));

      await chain.invoke(
        "CancelStream",
        [
          { type: "Hash160", value: chain.address.value },
          { type: "Integer", value: stream.id },
        ],
        { waitForEvent: "StreamCancelled" },
      );

      await refreshStreams();
      eventBus.emit("stream:cancelled", { id: stream.id });
    } catch (e) {
      eventBus.emit("stream:error", { message: formatErrorMessage(e, t("contractMissing")) });
      throw e;
    } finally {
      cancellingId.value = null;
    }
  };

  const loadAll = async () => {
    if (chain.address.value) {
      await refreshStreams();
    }
  };

  return {
    // -- Wallet --
    address: chain.address,

    // -- State --
    createdStreams,
    beneficiaryStreams,
    isLoading,
    isRefreshing,
    claimingId,
    cancellingId,

    // -- Computed --
    allStreams,
    activeCount,
    createdStreamCount,
    beneficiaryStreamCount,
    totalStreamCount,

    // -- Actions --
    refreshStreams,
    connectWallet,
    handleCreateVault,
    claimStream,
    cancelStream,
    loadAll,
  };
}

export type UseNeoPayAppReturn = ReturnType<typeof useNeoPayApp>;
