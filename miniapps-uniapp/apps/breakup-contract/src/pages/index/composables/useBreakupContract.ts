import { ref, computed } from "vue";
import { useWallet } from "@neo/uniapp-sdk";
import type { WalletSDK } from "@neo/types";
import { parseGas, toFixed8 } from "@shared/utils/format";
import { parseStackItem } from "@shared/utils/neo";
import { useContractInteraction } from "@shared/composables/useContractInteraction";
import { useAllEvents } from "@shared/composables/useAllEvents";
import { useStatusMessage } from "@shared/composables/useStatusMessage";
import { formatErrorMessage } from "@shared/utils/errorHandling";
import { createSidebarItems } from "@shared/utils";
import { useEvents } from "@neo/uniapp-sdk";
import type { ContractStatus, RelationshipContractView } from "@/types";

const APP_ID = "miniapp-breakupcontract";

const isValidNeoAddress = (value: string) => /^N[0-9a-zA-Z]{33}$/.test(value.trim());

export function useBreakupContract(t: (key: string) => string) {
  const { chainType } = useWallet() as WalletSDK;
  const {
    address,
    ensureWallet,
    read,
    invoke,
    invokeDirectly,
    ensureContractAddress,
    isProcessing: isLoading,
  } = useContractInteraction({ appId: APP_ID, t });
  const { list: listEvents } = useEvents();
  const { listAllEvents } = useAllEvents(listEvents, APP_ID);
  const { status, setStatus, clearStatus } = useStatusMessage();

  const partnerAddress = ref("");
  const stakeAmount = ref("");
  const duration = ref("");
  const contractTitle = ref("");
  const contractTerms = ref("");
  const contracts = ref<RelationshipContractView[]>([]);

  const appState = computed(() => ({
    contracts: contracts.value.length,
  }));

  const sidebarItems = createSidebarItems(t, [
    { labelKey: "tabContracts", value: () => contracts.value.length },
    { labelKey: "active", value: () => contracts.value.filter((c) => c.status === "active").length },
    { labelKey: "broken", value: () => contracts.value.filter((c) => c.status === "broken").length },
  ]);

  const parseContract = (
    id: number,
    data: Record<string, unknown> | unknown[] | null
  ): RelationshipContractView | null => {
    if (!data || typeof data !== "object") return null;
    const details = Array.isArray(data)
      ? {
          party1: data[0],
          party2: data[1],
          stake: data[2],
          party1Signed: data[3],
          party2Signed: data[4],
          createdTime: data[5],
          startTime: data[6],
          duration: data[7],
          signDeadline: data[8],
          active: data[9],
          completed: data[10],
          cancelled: data[11],
          title: data[12],
          terms: data[13],
          milestonesReached: data[14],
          totalPenaltyPaid: data[15],
          breakupInitiator: data[16],
        }
      : (data as Record<string, unknown>);

    const party1 = String(details.party1 ?? "");
    const party2 = String(details.party2 ?? "");
    const stakeRaw = String(details.stake ?? "0");
    const party2Signed = Boolean(details.party2Signed);
    const startTimeSeconds = Number(details.startTime ?? 0);
    const durationSeconds = Number(details.duration ?? 0);
    const active = Boolean(details.active);
    const completed = Boolean(details.completed);
    const cancelled = Boolean(details.cancelled);
    const title = String(details.title ?? "");
    const terms = String(details.terms ?? "");

    const startTimeMs = startTimeSeconds * 1000;
    const durationMs = durationSeconds * 1000;
    const now = Date.now();
    const endTime = startTimeMs + durationMs;
    const elapsed = startTimeMs > 0 ? Math.max(0, Math.min(durationMs, now - startTimeMs)) : 0;
    const computedProgress = durationMs > 0 ? Math.round((elapsed / durationMs) * 100) : 0;
    const progressPercent = Number((details as Record<string, unknown>).progressPercent ?? 0);
    const progress = progressPercent > 0 ? Math.min(100, Math.max(0, Math.floor(progressPercent))) : computedProgress;
    const remainingSeconds = Number((details as Record<string, unknown>).remainingTime ?? 0);
    const daysLeft =
      remainingSeconds > 0
        ? Math.max(0, Math.ceil(remainingSeconds / 86400))
        : durationMs > 0
          ? Math.max(0, Math.ceil((endTime - now) / 86400000))
          : 0;

    let contractStatus: ContractStatus = "pending";
    if (active) contractStatus = "active";
    else if (completed) contractStatus = "broken";
    else if (party2Signed || cancelled) contractStatus = "ended";

    const partner = address.value && address.value === party1 ? party2 : party1;

    return {
      id,
      party1,
      party2,
      partner,
      title,
      terms,
      stake: parseGas(stakeRaw),
      stakeRaw,
      progress,
      daysLeft,
      status: contractStatus,
    };
  };

  const loadContracts = async () => {
    try {
      await ensureContractAddress();
      const createdEvents = await listAllEvents("ContractCreated");
      const ids = new Set<number>();
      createdEvents.forEach((evt) => {
        const evtRecord = evt as unknown as Record<string, unknown>;
        const values = Array.isArray(evtRecord?.state) ? (evtRecord.state as unknown[]).map(parseStackItem) : [];
        const id = Number(values[0] ?? 0);
        if (id > 0) ids.add(id);
      });

      const contractViews: RelationshipContractView[] = [];
      for (const id of Array.from(ids).sort((a, b) => b - a)) {
        const parsed = await read("GetContractDetails", [{ type: "Integer", value: id }]);
        const view = parseContract(id, parsed as Record<string, unknown> | unknown[] | null);
        if (view) contractViews.push(view);
      }
      contracts.value = contractViews;
    } catch (e: unknown) {
      setStatus(t("loadFailed"), "error");
    }
  };

  const createContract = async () => {
    if (isLoading.value) return;
    const partnerValue = partnerAddress.value.trim();
    if (!partnerValue) {
      setStatus(t("partnerRequired"), "error");
      return;
    }
    if (!isValidNeoAddress(partnerValue)) {
      setStatus(t("partnerInvalid"), "error");
      return;
    }
    if (!stakeAmount.value) {
      setStatus(t("error"), "error");
      return;
    }
    const stake = parseFloat(stakeAmount.value);
    const durationDays = parseInt(duration.value, 10);
    const titleValue = contractTitle.value.trim();
    const termsValue = contractTerms.value.trim();
    if (!Number.isFinite(stake) || stake < 1 || !Number.isFinite(durationDays) || durationDays < 30) {
      setStatus(t("error"), "error");
      return;
    }
    if (!titleValue) {
      setStatus(t("titleRequired"), "error");
      return;
    }
    if (titleValue.length > 100) {
      setStatus(t("titleTooLong"), "error");
      return;
    }
    if (termsValue.length > 2000) {
      setStatus(t("termsTooLong"), "error");
      return;
    }
    try {
      await ensureWallet();

      await invoke(stakeAmount.value, `contract:${partnerValue.slice(0, 10)}`, "createContract", [
        { type: "Hash160", value: address.value as string },
        { type: "Hash160", value: partnerValue },
        { type: "Integer", value: toFixed8(stakeAmount.value) },
        { type: "Integer", value: durationDays },
        { type: "String", value: titleValue },
        { type: "String", value: termsValue },
      ]);
      setStatus(t("contractCreated"), "success");
      partnerAddress.value = "";
      stakeAmount.value = "";
      duration.value = "";
      contractTitle.value = "";
      contractTerms.value = "";
      await loadContracts();
    } catch (e: unknown) {
      setStatus(formatErrorMessage(e, t("error")), "error");
    }
  };

  const signContract = async (contract: RelationshipContractView) => {
    if (isLoading.value || !address.value) return;
    try {
      await invoke(contract.stake.toFixed(8), `contract:sign:${contract.id}`, "signContract", [
        { type: "Integer", value: contract.id },
        { type: "Hash160", value: address.value },
      ]);
      setStatus(t("contractSigned"), "success");
      await loadContracts();
    } catch (e: unknown) {
      setStatus(formatErrorMessage(e, t("error")), "error");
    }
  };

  const breakContract = async (contract: RelationshipContractView) => {
    if (!address.value) {
      setStatus(t("error"), "error");
      return;
    }
    try {
      await invokeDirectly("TriggerBreakup", [
        { type: "Integer", value: contract.id },
        { type: "Hash160", value: address.value },
      ]);
      setStatus(t("contractBroken"), "error");
      await loadContracts();
    } catch (e: unknown) {
      setStatus(formatErrorMessage(e, t("error")), "error");
    }
  };

  return {
    // Wallet state
    address,
    chainType,

    // Form state
    partnerAddress,
    stakeAmount,
    duration,
    contractTitle,
    contractTerms,

    // Derived state
    appState,
    sidebarItems,
    contracts,
    status,
    isLoading,

    // Methods
    loadContracts,
    createContract,
    signContract,
    breakContract,
    clearStatus,
  };
}
