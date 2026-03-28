/**
 * useNeoPayApp — Domain logic for Neo Pay miniapp (new pattern)
 *
 * Wraps the existing useNeoPay composable, adapting it for the
 * defineMiniApp pattern with ChainService + EventBus.
 */

import { ref, computed } from "vue";
import type { ChainService, EventBus } from "@shared/services";
import { useWallet } from "@shared/utils/wallet-sdk";
import type { WalletSDK } from "@shared/utils/wallet-sdk";
import { useContractAddress } from "@shared/composables/useContractAddress";
import { formatErrorMessage } from "@shared/utils/errorHandling";
import { requireNeoChain } from "@shared/utils/chain";
import { toFixed8, toFixedDecimals } from "@shared/utils/format";
import { addressToScriptHash, normalizeScriptHash, parseInvokeResult } from "@shared/utils/neo";
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
  const wallet = useWallet() as WalletSDK;
  const { address, connect, invokeContract, invokeRead, chainType } = wallet;
  const { ensure: ensureContractAddress } = useContractAddress(t as (key: string) => string);

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
    const contract = await ensureContractAddress();
    const details = await invokeRead({
      scriptHash: contract,
      operation: "GetStreamDetails",
      args: [{ type: "Integer", value: streamId }],
    });
    const parsed = parseInvokeResult(details) as Record<string, unknown>;
    return parseStream(parsed, streamId);
  };

  const fetchStreamIds = async (operation: string, walletAddress: string) => {
    const contract = await ensureContractAddress();
    const result = await invokeRead({
      scriptHash: contract,
      operation,
      args: [
        { type: "Hash160", value: walletAddress },
        { type: "Integer", value: "0" },
        { type: "Integer", value: "20" },
      ],
    });
    const parsed = parseInvokeResult(result);
    if (!Array.isArray(parsed)) return [] as string[];
    return parsed
      .map((value) => String(value || ""))
      .map((value) => Number.parseInt(value, 10))
      .filter((value) => Number.isFinite(value) && value > 0)
      .map((value) => String(value));
  };

  // -- Actions --
  const refreshStreams = async () => {
    if (!address.value) return;
    if (isRefreshing.value) return;
    try {
      isRefreshing.value = true;
      const createdIds = await fetchStreamIds("getUserStreams", address.value);
      const beneficiaryIds = await fetchStreamIds("getBeneficiaryStreams", address.value);

      const created = await Promise.all(createdIds.map(fetchStreamDetails));
      const beneficiary = await Promise.all(beneficiaryIds.map(fetchStreamDetails));

      createdStreams.value = created.filter(Boolean) as StreamItem[];
      beneficiaryStreams.value = beneficiary.filter(Boolean) as StreamItem[];
      eventBus.emit("streams:refreshed", { count: allStreams.value.length });
    } catch (e: unknown) {
      eventBus.emit("streams:error", { message: formatErrorMessage(e, t("contractMissing")) });
      throw e;
    } finally {
      isRefreshing.value = false;
    }
  };

  const connectWallet = async () => {
    try {
      await connect();
      if (address.value) {
        await refreshStreams();
      }
      eventBus.emit("wallet:connected", { address: address.value });
    } catch (e: unknown) {
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
    if (!requireNeoChain(chainType, t as (key: string) => string)) return;

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
      if (!address.value) await connect();
      if (!address.value) throw new Error(t("walletNotConnected"));

      const contract = await ensureContractAddress();
      const assetHash = formData.asset === "NEO" ? BLOCKCHAIN_CONSTANTS.NEO_HASH : BLOCKCHAIN_CONSTANTS.GAS_HASH;
      const title = formData.name.trim().slice(0, 60);
      const notes = formData.notes.trim().slice(0, 240);

      await invokeContract({
        scriptHash: assetHash,
        operation: "transfer",
        args: [
          { type: "Hash160", value: address.value },
          { type: "Hash160", value: contract },
          { type: "Integer", value: totalFixed },
          { type: "Any", value: null },
        ],
      });

      await new Promise((resolve) => setTimeout(resolve, WAIT_AFTER_TRANSFER_MS));

      await invokeContract({
        scriptHash: contract,
        operation: "CreateStream",
        args: [
          { type: "Hash160", value: address.value },
          { type: "Hash160", value: beneficiary },
          { type: "Hash160", value: assetHash },
          { type: "Integer", value: totalFixed },
          { type: "Integer", value: rateFixed },
          { type: "Integer", value: String(intervalDays * 86400) },
          { type: "String", value: title },
          { type: "String", value: notes },
        ],
      });

      eventBus.emit("vault:created", {});
      await refreshStreams();
    } catch (e: unknown) {
      eventBus.emit("vault:error", { message: formatErrorMessage(e, t("contractMissing")) });
      throw e;
    } finally {
      isLoading.value = false;
    }
  };

  const claimStream = async (stream: StreamItem) => {
    if (claimingId.value) return;
    if (!requireNeoChain(chainType, t as (key: string) => string)) return;
    try {
      claimingId.value = stream.id;
      if (!address.value) throw new Error(t("walletNotConnected"));
      const contract = await ensureContractAddress();
      await invokeContract({
        scriptHash: contract,
        operation: "ClaimStream",
        args: [
          { type: "Hash160", value: address.value },
          { type: "Integer", value: stream.id },
        ],
      });
      await refreshStreams();
      eventBus.emit("stream:claimed", { id: stream.id });
    } catch (e: unknown) {
      eventBus.emit("stream:error", { message: formatErrorMessage(e, t("contractMissing")) });
      throw e;
    } finally {
      claimingId.value = null;
    }
  };

  const cancelStream = async (stream: StreamItem) => {
    if (cancellingId.value) return;
    if (!requireNeoChain(chainType, t as (key: string) => string)) return;
    try {
      cancellingId.value = stream.id;
      if (!address.value) throw new Error(t("walletNotConnected"));
      const contract = await ensureContractAddress();
      await invokeContract({
        scriptHash: contract,
        operation: "CancelStream",
        args: [
          { type: "Hash160", value: address.value },
          { type: "Integer", value: stream.id },
        ],
      });
      await refreshStreams();
      eventBus.emit("stream:cancelled", { id: stream.id });
    } catch (e: unknown) {
      eventBus.emit("stream:error", { message: formatErrorMessage(e, t("contractMissing")) });
      throw e;
    } finally {
      cancellingId.value = null;
    }
  };

  const loadAll = async () => {
    if (address.value) {
      await refreshStreams();
    }
  };

  return {
    // -- Wallet --
    address,

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
