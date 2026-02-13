import { ref, computed } from "vue";
import { useWallet } from "@neo/uniapp-sdk";
import type { WalletSDK } from "@neo/types";
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";
import { requireNeoChain } from "@shared/utils/chain";
import { useContractAddress } from "@shared/composables/useContractAddress";
import { useStatusMessage } from "@shared/composables/useStatusMessage";
import { formatErrorMessage } from "@shared/utils/errorHandling";
import { formatGas, formatAddress, toFixed8, toFixedDecimals } from "@shared/utils/format";
import { addressToScriptHash, normalizeScriptHash, parseInvokeResult } from "@shared/utils/neo";
import { parseBigInt, parseBool } from "@shared/utils/parsers";
import { BLOCKCHAIN_CONSTANTS } from "@shared/constants";
import type { EscrowItem } from "../pages/index/components/EscrowList.vue";

const NEO_HASH_NORMALIZED = normalizeScriptHash(BLOCKCHAIN_CONSTANTS.NEO_HASH);

export function useEscrowContract() {
  const { t } = createUseI18n(messages)();
  const { address, connect, invokeContract, invokeRead, chainType } = useWallet() as WalletSDK;
  const { contractAddress, ensure: ensureContractAddress } = useContractAddress(t);

  const { status, setStatus } = useStatusMessage();
  const isRefreshing = ref(false);
  const isLoading = ref(false);
  const approvingId = ref<string | null>(null);
  const claimingId = ref<string | null>(null);
  const cancellingId = ref<string | null>(null);

  const creatorEscrows = ref<EscrowItem[]>([]);
  const beneficiaryEscrows = ref<EscrowItem[]>([]);

  const formatAmount = (assetSymbol: "NEO" | "GAS", amount: bigint) => {
    if (assetSymbol === "NEO") return amount.toString();
    return formatGas(amount, 4);
  };

  const statusLabel = (statusValue: "active" | "completed" | "cancelled") => {
    if (statusValue === "completed") return t("statusCompleted");
    if (statusValue === "cancelled") return t("statusCancelled");
    return t("statusActive");
  };

  const parseBoolArray = (value: unknown, count: number) => {
    if (!Array.isArray(value)) return new Array(count).fill(false);
    return value.map((item) => parseBool(item));
  };

  const parseBigIntArray = (value: unknown, count: number) => {
    if (!Array.isArray(value)) return new Array(count).fill(0n);
    return value.map((item) => parseBigInt(item));
  };

  const parseEscrow = (raw: Record<string, unknown> | null, id: string): EscrowItem | null => {
    if (!raw || typeof raw !== "object") return null;
    const asset = String(raw.asset || "");
    const assetNormalized = normalizeScriptHash(asset);
    const assetSymbol: "NEO" | "GAS" = assetNormalized === NEO_HASH_NORMALIZED ? "NEO" : "GAS";
    const milestoneCount = Number(raw.milestoneCount || 0);

    const milestoneAmounts = parseBigIntArray(raw.milestoneAmounts, milestoneCount);
    const milestoneApproved = parseBoolArray(raw.milestoneApproved, milestoneCount);
    const milestoneClaimed = parseBoolArray(raw.milestoneClaimed, milestoneCount);

    return {
      id,
      creator: String(raw.creator || ""),
      beneficiary: String(raw.beneficiary || ""),
      assetSymbol,
      totalAmount: parseBigInt(raw.totalAmount),
      releasedAmount: parseBigInt(raw.releasedAmount),
      status: String(raw.status || "active") as "active" | "completed" | "cancelled",
      milestoneAmounts,
      milestoneApproved,
      milestoneClaimed,
      title: String(raw.title || ""),
      notes: String(raw.notes || ""),
      active: Boolean(raw.active),
    };
  };

  const fetchEscrowDetails = async (escrowId: string) => {
    const contract = await ensureContractAddress();
    const details = await invokeRead({
      scriptHash: contract,
      operation: "GetEscrowDetails",
      args: [{ type: "Integer", value: escrowId }],
    });
    const parsed = parseInvokeResult(details) as Record<string, unknown>;
    return parseEscrow(parsed, escrowId);
  };

  const fetchEscrowIds = async (operation: string, walletAddress: string) => {
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

  const refreshEscrows = async () => {
    if (!address.value) return;
    if (isRefreshing.value) return;
    try {
      isRefreshing.value = true;
      const creatorIds = await fetchEscrowIds("getCreatorEscrows", address.value);
      const beneficiaryIds = await fetchEscrowIds("getBeneficiaryEscrows", address.value);

      const creator = await Promise.all(creatorIds.map(fetchEscrowDetails));
      const beneficiary = await Promise.all(beneficiaryIds.map(fetchEscrowDetails));

      creatorEscrows.value = creator.filter(Boolean) as EscrowItem[];
      beneficiaryEscrows.value = beneficiary.filter(Boolean) as EscrowItem[];
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
        await refreshEscrows();
      }
    } catch (e: unknown) {
      setStatus(formatErrorMessage(e, t("walletNotConnected")), "error");
    }
  };

  const handleCreateEscrow = async (
    data: {
      name: string;
      beneficiary: string;
      asset: string;
      notes: string;
      milestones: Array<{ amount: string }>;
    },
    escrowFormRef: { setLoading: (v: boolean) => void; reset: () => void } | null
  ) => {
    if (isLoading.value) return;
    if (!requireNeoChain(chainType, t)) return;

    const beneficiary = data.beneficiary.trim();
    if (!beneficiary || !addressToScriptHash(beneficiary)) {
      setStatus(t("invalidAddress"), "error");
      return;
    }

    if (data.milestones.length < 1 || data.milestones.length > 12) {
      setStatus(t("milestoneLimit"), "error");
      return;
    }

    const decimals = data.asset === "NEO" ? 0 : 8;
    const milestoneValues: string[] = [];
    let totalAmount = 0n;

    for (const milestone of data.milestones) {
      const raw = String(milestone.amount || "").trim();
      if (!raw) {
        setStatus(t("invalidAmount"), "error");
        return;
      }
      if (decimals === 0 && raw.includes(".")) {
        setStatus(t("invalidAmount"), "error");
        return;
      }
      const fixed = decimals === 8 ? toFixed8(raw) : toFixedDecimals(raw, 0);
      const amount = parseBigInt(fixed);
      if (amount <= 0n) {
        setStatus(t("invalidAmount"), "error");
        return;
      }
      milestoneValues.push(fixed);
      totalAmount += amount;
    }

    if (totalAmount <= 0n) {
      setStatus(t("invalidAmount"), "error");
      return;
    }

    try {
      isLoading.value = true;
      escrowFormRef?.setLoading(true);
      if (!address.value) await connect();
      if (!address.value) throw new Error(t("walletNotConnected"));

      const contract = await ensureContractAddress();
      const assetHash = data.asset === "NEO" ? BLOCKCHAIN_CONSTANTS.NEO_HASH : BLOCKCHAIN_CONSTANTS.GAS_HASH;
      const title = data.name.trim().slice(0, 60);
      const notes = data.notes.trim().slice(0, 240);

      await invokeContract({
        scriptHash: contract,
        operation: "CreateEscrow",
        args: [
          { type: "Hash160", value: address.value },
          { type: "Hash160", value: beneficiary },
          { type: "Hash160", value: assetHash },
          { type: "Integer", value: totalAmount.toString() },
          {
            type: "Array",
            value: milestoneValues.map((amount) => ({ type: "Integer", value: amount })),
          },
          { type: "String", value: title },
          { type: "String", value: notes },
        ],
      });

      setStatus(t("escrowCreated"), "success");
      escrowFormRef?.reset();
      await refreshEscrows();
    } catch (e: unknown) {
      setStatus(formatErrorMessage(e, t("contractMissing")), "error");
    } finally {
      isLoading.value = false;
      escrowFormRef?.setLoading(false);
    }
  };

  const approveMilestone = async (escrow: EscrowItem, milestoneIndex: number) => {
    if (approvingId.value) return;
    if (!requireNeoChain(chainType, t)) return;
    try {
      approvingId.value = `${escrow.id}-${milestoneIndex}`;
      if (!address.value) throw new Error(t("walletNotConnected"));
      const contract = await ensureContractAddress();
      await invokeContract({
        scriptHash: contract,
        operation: "ApproveMilestone",
        args: [
          { type: "Hash160", value: address.value },
          { type: "Integer", value: escrow.id },
          { type: "Integer", value: String(milestoneIndex) },
        ],
      });
      await refreshEscrows();
    } catch (e: unknown) {
      setStatus(formatErrorMessage(e, t("contractMissing")), "error");
    } finally {
      approvingId.value = null;
    }
  };

  const claimMilestone = async (escrow: EscrowItem, milestoneIndex: number) => {
    if (claimingId.value) return;
    if (!requireNeoChain(chainType, t)) return;
    try {
      claimingId.value = `${escrow.id}-${milestoneIndex}`;
      if (!address.value) throw new Error(t("walletNotConnected"));
      const contract = await ensureContractAddress();
      await invokeContract({
        scriptHash: contract,
        operation: "ClaimMilestone",
        args: [
          { type: "Hash160", value: address.value },
          { type: "Integer", value: escrow.id },
          { type: "Integer", value: String(milestoneIndex) },
        ],
      });
      await refreshEscrows();
    } catch (e: unknown) {
      setStatus(formatErrorMessage(e, t("contractMissing")), "error");
    } finally {
      claimingId.value = null;
    }
  };

  const cancelEscrow = async (escrow: EscrowItem) => {
    if (cancellingId.value) return;
    if (!requireNeoChain(chainType, t)) return;
    try {
      cancellingId.value = escrow.id;
      if (!address.value) throw new Error(t("walletNotConnected"));
      const contract = await ensureContractAddress();
      await invokeContract({
        scriptHash: contract,
        operation: "CancelEscrow",
        args: [
          { type: "Hash160", value: address.value },
          { type: "Integer", value: escrow.id },
        ],
      });
      await refreshEscrows();
    } catch (e: unknown) {
      setStatus(formatErrorMessage(e, t("contractMissing")), "error");
    } finally {
      cancellingId.value = null;
    }
  };

  return {
    // State
    address,
    status,
    isRefreshing,
    isLoading,
    approvingId,
    claimingId,
    cancellingId,
    creatorEscrows,
    beneficiaryEscrows,
    // Helpers
    formatAmount,
    formatAddress,
    statusLabel,
    // Actions
    refreshEscrows,
    connectWallet,
    handleCreateEscrow,
    approveMilestone,
    claimMilestone,
    cancelEscrow,
  };
}
