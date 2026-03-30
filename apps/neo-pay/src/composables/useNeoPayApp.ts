/**
 * useNeoPayApp — Domain logic for Neo Pay miniapp (OS Services Pattern)
 *
 * Migrated to OS service proxies. All contract interaction is delegated to
 * OS services (VestingProxy, PaymentProxy) via edge functions, so this file
 * contains zero contract hashes, parameter encoding, or event parsing logic.
 *
 * Migration from direct chain calls to OS services:
 *
 *   BEFORE (chain):
 *     chain.read("GetStreamDetails", [{ type: "Integer", value: id }])
 *     chain.read("getUserStreams", [{ type: "Hash160", value: addr }, ...])
 *     chain.read("getBeneficiaryStreams", [{ type: "Hash160", value: addr }, ...])
 *     chain.invoke("transfer", [...], { scriptHash: assetHash })
 *     chain.invoke("CreateStream", [...], { waitForEvent: "StreamCreated" })
 *     chain.invoke("ClaimStream", [...], { waitForEvent: "StreamClaimed" })
 *     chain.invoke("CancelStream", [...], { waitForEvent: "StreamCancelled" })
 *
 *   AFTER (OS proxy):
 *     vestingService.listStreams("creator")
 *     vestingService.listStreams("beneficiary")
 *     vestingService.getStream(streamId)
 *     paymentService.deposit(amount, memo)
 *     vestingService.createStream(params)
 *     vestingService.claim(streamId)
 *     vestingService.cancel(streamId)
 *
 * The composable still owns:
 *   - Reactive state (refs + computed) for manifest bindings
 *   - Form validation (pure frontend checks)
 *   - Loading/claiming/cancelling UI flags
 *   - Stream parsing and display formatting
 */

import { ref, computed } from "vue";
import type { VestingProxy } from "@shared/services/os/VestingProxy";
import type { PaymentProxy } from "@shared/services/os/PaymentProxy";
import { toFixed8, toFixedDecimals } from "@shared/utils/format";
import { addressToScriptHash, normalizeScriptHash } from "@shared/utils/neo";
import { parseBigInt } from "@shared/utils/parsers";
import { BLOCKCHAIN_CONSTANTS } from "@shared/constants";
import type { StreamItem, StreamStatus } from "../types";

const NEO_HASH_NORMALIZED = normalizeScriptHash(BLOCKCHAIN_CONSTANTS.NEO_HASH);

export interface UseNeoPayAppOptions {
  /** OS VestingProxy instance from ctx.os.vesting */
  vestingService: VestingProxy;
  /** OS PaymentProxy instance from ctx.os.payment */
  paymentService: PaymentProxy;
  /** Translation function */
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function useNeoPayApp({ vestingService, paymentService, t }: UseNeoPayAppOptions) {
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

  /**
   * Parse a raw stream record (returned by VestingProxy) into a typed StreamItem.
   */
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

  // -- Data Loading (via OS services) --

  /**
   * Load all streams for the current user via VestingProxy.
   * The edge function translates listStreams into the contract's
   * getUserStreams / getBeneficiaryStreams calls and returns normalized data.
   */
  const refreshStreams = async () => {
    if (isRefreshing.value) return;
    try {
      isRefreshing.value = true;

      const [creatorRaw, beneficiaryRaw] = await Promise.all([
        vestingService.listStreams("creator"),
        vestingService.listStreams("beneficiary"),
      ]);

      const created = (creatorRaw ?? []).map((entry: unknown) => {
        const record = entry as Record<string, unknown>;
        const id = String(record.id ?? record.streamId ?? "");
        return parseStream(record, id);
      }).filter(Boolean) as StreamItem[];

      const beneficiary = (beneficiaryRaw ?? []).map((entry: unknown) => {
        const record = entry as Record<string, unknown>;
        const id = String(record.id ?? record.streamId ?? "");
        return parseStream(record, id);
      }).filter(Boolean) as StreamItem[];

      createdStreams.value = created;
      beneficiaryStreams.value = beneficiary;
    } catch (e) {
      console.warn("[useNeoPayApp] refreshStreams failed:", e instanceof Error ? e.message : String(e));
      throw e;
    } finally {
      isRefreshing.value = false;
    }
  };

  // -- Actions (via OS services) --

  /**
   * Create a payment stream via PaymentProxy (deposit funds) + VestingProxy
   * (create stream).
   *
   * The OS payment service handles wallet connection and asset transfer.
   * The OS vesting service handles the CreateStream contract call.
   */
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
      const title = formData.name.trim().slice(0, 60);
      const notes = formData.notes.trim().slice(0, 240);

      // Step 1: Deposit funds via PaymentProxy
      await paymentService.deposit(totalFixed, `stream:${formData.asset}:${totalFixed}`);

      // Step 2: Create the stream via VestingProxy
      await vestingService.createStream({
        beneficiary,
        totalAmount: totalFixed,
        rateAmount: rateFixed,
        intervalSeconds: intervalDays * 86400,
        title,
        notes,
      });

      await refreshStreams();
    } catch (e) {
      throw e;
    } finally {
      isLoading.value = false;
    }
  };

  /**
   * Claim vested amounts from a stream via VestingProxy.
   * The edge function handles the ClaimStream contract call.
   */
  const claimStream = async (stream: StreamItem) => {
    if (claimingId.value) return;
    try {
      claimingId.value = stream.id;
      await vestingService.claim(stream.id);
      await refreshStreams();
    } catch (e) {
      throw e;
    } finally {
      claimingId.value = null;
    }
  };

  /**
   * Cancel a stream via VestingProxy.
   * The edge function handles the CancelStream contract call and
   * returns unvested funds to the creator.
   */
  const cancelStream = async (stream: StreamItem) => {
    if (cancellingId.value) return;
    try {
      cancellingId.value = stream.id;
      await vestingService.cancel(stream.id);
      await refreshStreams();
    } catch (e) {
      throw e;
    } finally {
      cancellingId.value = null;
    }
  };

  /**
   * Load all data. Called by defineMiniApp on mount and wallet reconnect.
   */
  const loadAll = async () => {
    await refreshStreams();
  };

  return {
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
    handleCreateVault,
    claimStream,
    cancelStream,
    loadAll,
  };
}

export type UseNeoPayAppReturn = ReturnType<typeof useNeoPayApp>;
