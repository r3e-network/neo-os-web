import { ref, reactive, computed } from "vue";
import type { WalletSDK } from "@neo/types";
import { useWallet } from "@neo/uniapp-sdk";
import { useContractAddress } from "@shared/composables/useContractAddress";
import { useStatusMessage } from "@shared/composables/useStatusMessage";
import { formatErrorMessage } from "@shared/utils/errorHandling";
import { requireNeoChain } from "@shared/utils/chain";
import { toFixed8, toFixedDecimals } from "@shared/utils/format";
import { addressToScriptHash, normalizeScriptHash, parseInvokeResult } from "@shared/utils/neo";
import { parseBigInt } from "@shared/utils/parsers";
import { createSidebarItems } from "@shared/utils";
import { BLOCKCHAIN_CONSTANTS } from "@shared/constants";
import type { StreamItem, StreamStatus } from "@/types";

const NEO_HASH_NORMALIZED = normalizeScriptHash(BLOCKCHAIN_CONSTANTS.NEO_HASH);
const GAS_HASH_NORMALIZED = normalizeScriptHash(BLOCKCHAIN_CONSTANTS.GAS_HASH);

export function useStreamVault(t: (key: string) => string) {
  const { address, connect, invokeContract, invokeRead, chainType } = useWallet() as WalletSDK;
  const { ensure: ensureContractAddress } = useContractAddress(t);
  const { status, setStatus } = useStatusMessage();

  const isLoading = ref(false);
  const isRefreshing = ref(false);
  const claimingId = ref<string | null>(null);
  const cancellingId = ref<string | null>(null);

  const createdStreams = ref<StreamItem[]>([]);
  const beneficiaryStreams = ref<StreamItem[]>([]);

  const form = reactive({
    name: "",
    beneficiary: "",
    asset: "GAS",
    total: "20",
    rate: "1",
    intervalDays: "30",
    notes: "",
  });

  const appState = computed(() => ({}));

  const sidebarItems = createSidebarItems(t, [
    { labelKey: "sidebarCreatedStreams", value: () => createdStreams.value.length },
    { labelKey: "sidebarBeneficiaryStreams", value: () => beneficiaryStreams.value.length },
    { labelKey: "sidebarTotalStreams", value: () => createdStreams.value.length + beneficiaryStreams.value.length },
  ]);

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
    } catch (e: unknown) {
      setStatus(formatErrorMessage(e, t("contractMissing")), "error");
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
    } catch (e: unknown) {
      setStatus(formatErrorMessage(e, t("walletNotConnected")), "error");
    }
  };

  const handleCreateVault = async (formData: typeof form) => {
    if (isLoading.value) return;
    if (!requireNeoChain(chainType, t)) return;

    const beneficiary = formData.beneficiary.trim();
    if (!beneficiary || !addressToScriptHash(beneficiary)) {
      setStatus(t("invalidAddress"), "error");
      return;
    }

    const intervalDays = Number.parseInt(formData.intervalDays, 10);
    if (!Number.isFinite(intervalDays) || intervalDays < 1 || intervalDays > 365) {
      setStatus(t("intervalInvalid"), "error");
      return;
    }

    const decimals = formData.asset === "NEO" ? 0 : 8;
    const totalFixed = decimals === 8 ? toFixed8(formData.total) : toFixedDecimals(formData.total, 0);
    const rateFixed = decimals === 8 ? toFixed8(formData.rate) : toFixedDecimals(formData.rate, 0);

    const totalAmount = parseBigInt(totalFixed);
    const rateAmount = parseBigInt(rateFixed);

    if (totalAmount <= 0n || rateAmount <= 0n) {
      setStatus(t("invalidAmount"), "error");
      return;
    }
    if (rateAmount > totalAmount) {
      setStatus(t("rateTooHigh"), "error");
      return;
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

      setStatus(t("vaultCreated"), "success");
      Object.assign(form, {
        name: "",
        beneficiary: "",
        total: form.asset === "NEO" ? "10" : "20",
        rate: "1",
        intervalDays: "30",
        notes: "",
      });

      await refreshStreams();
    } catch (e: unknown) {
      setStatus(formatErrorMessage(e, t("contractMissing")), "error");
    } finally {
      isLoading.value = false;
    }
  };

  const claimStream = async (stream: StreamItem) => {
    if (claimingId.value) return;
    if (!requireNeoChain(chainType, t)) return;
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
    } catch (e: unknown) {
      setStatus(formatErrorMessage(e, t("contractMissing")), "error");
    } finally {
      claimingId.value = null;
    }
  };

  const cancelStream = async (stream: StreamItem) => {
    if (cancellingId.value) return;
    if (!requireNeoChain(chainType, t)) return;
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
    } catch (e: unknown) {
      setStatus(formatErrorMessage(e, t("contractMissing")), "error");
    } finally {
      cancellingId.value = null;
    }
  };

  return {
    // Wallet state
    address,

    // Reactive state
    form,
    createdStreams,
    beneficiaryStreams,
    isLoading,
    isRefreshing,
    claimingId,
    cancellingId,
    status,

    // Derived state
    appState,
    sidebarItems,

    // Methods
    refreshStreams,
    connectWallet,
    handleCreateVault,
    claimStream,
    cancelStream,
  };
}
