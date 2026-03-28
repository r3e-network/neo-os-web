/**
 * useBreakup — Domain logic for the Breakup Contract miniapp
 *
 * Receives ChainService + EventBus from PlatformServices.
 * Replaces the legacy pages/index/composables/useBreakupContract.ts
 * which instantiated its own useContractInteraction / useStatusMessage / useEvents.
 */

import { ref, computed } from "vue";
import type { ChainService, EventBus } from "@shared/services";
import { parseGas, toFixed8 } from "@shared/utils/format";
import { parseStackItem } from "@shared/utils/neo";
import { BLOCKCHAIN_CONSTANTS } from "@shared/constants";
import type { ContractStatus, RelationshipContractView } from "../types";

const APP_ID = "miniapp-breakupcontract";

const isValidNeoAddress = (value: string) => /^N[0-9a-zA-Z]{33}$/.test(value.trim());

export interface UseBreakupOptions {
  chain: ChainService;
  eventBus: EventBus;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function useBreakup({ chain, eventBus, t }: UseBreakupOptions) {
  // -- Form state -----------------------------------------------------------
  const partnerAddress = ref("");
  const stakeAmount = ref("");
  const duration = ref("");
  const contractTitle = ref("");
  const contractTerms = ref("");

  // -- Data state -----------------------------------------------------------
  const contracts = ref<RelationshipContractView[]>([]);
  const isLoading = ref(false);

  // -- Derived state --------------------------------------------------------
  const contractCount = computed(() => contracts.value.length);
  const activeCount = computed(() => contracts.value.filter((c) => c.status === "active").length);
  const pendingCount = computed(() => contracts.value.filter((c) => c.status === "pending").length);
  const brokenCount = computed(() => contracts.value.filter((c) => c.status === "broken").length);

  // -- Helpers --------------------------------------------------------------

  const parseContract = (
    id: number,
    data: Record<string, unknown> | unknown[] | null,
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

    const addr = chain.address.value;
    const partner = addr && addr === party1 ? party2 : party1;

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

  // -- Data loading ---------------------------------------------------------

  const loadContracts = async () => {
    isLoading.value = true;
    try {
      const createdEvents = await chain.listAllEvents("ContractCreated");
      const ids = new Set<number>();
      createdEvents.forEach((evt) => {
        const evtRecord = evt as unknown as Record<string, unknown>;
        const values = Array.isArray(evtRecord?.state) ? (evtRecord.state as unknown[]).map(parseStackItem) : [];
        const id = Number(values[0] ?? 0);
        if (id > 0) ids.add(id);
      });

      const contractViews: RelationshipContractView[] = [];
      for (const id of Array.from(ids).sort((a, b) => b - a)) {
        const parsed = await chain.read("getContractDetails", [{ type: "Integer", value: id }]);
        const view = parseContract(id, parsed as Record<string, unknown> | unknown[] | null);
        if (view) contractViews.push(view);
      }
      contracts.value = contractViews;
    } catch (e) {
      eventBus.emit("breakup:error", { message: e instanceof Error ? e.message : t("loadFailed") });
      throw e;
    } finally {
      isLoading.value = false;
    }
  };

  // -- Actions --------------------------------------------------------------

  const createContract = async () => {
    if (isLoading.value) return;

    const partnerValue = partnerAddress.value.trim();
    if (!partnerValue) throw new Error(t("partnerRequired"));
    if (!isValidNeoAddress(partnerValue)) throw new Error(t("partnerInvalid"));
    if (!stakeAmount.value) throw new Error(t("error"));

    const stake = parseFloat(stakeAmount.value);
    const durationDays = parseInt(duration.value, 10);
    const titleValue = contractTitle.value.trim();
    const termsValue = contractTerms.value.trim();

    if (!Number.isFinite(stake) || stake < 1 || !Number.isFinite(durationDays) || durationDays < 30) {
      throw new Error(t("error"));
    }
    if (!titleValue) throw new Error(t("titleRequired"));
    if (titleValue.length > 100) throw new Error(t("titleTooLong"));
    if (termsValue.length > 2000) throw new Error(t("termsTooLong"));

    await chain.ensureWallet();
    const contractHash = chain.contractAddress.value as string;

    // Step 1: Transfer GAS stake to contract
    await chain.invoke(
      "transfer",
      [
        { type: "Hash160", value: chain.address.value as string },
        { type: "Hash160", value: contractHash },
        { type: "Integer", value: toFixed8(stakeAmount.value) },
        { type: "String", value: `${APP_ID}:create:${partnerValue.slice(0, 10)}` },
      ],
      { scriptHash: BLOCKCHAIN_CONSTANTS.GAS_HASH },
    );

    await new Promise((resolve) => setTimeout(resolve, 4000));

    // Step 2: Create the contract on-chain
    await chain.invoke(
      "createContract",
      [
        { type: "Hash160", value: chain.address.value as string },
        { type: "Hash160", value: partnerValue },
        { type: "Integer", value: toFixed8(stakeAmount.value) },
        { type: "Integer", value: durationDays },
        { type: "String", value: titleValue },
        { type: "String", value: termsValue },
      ],
      { scriptHash: contractHash },
    );

    eventBus.emit("breakup:created", { action: t("contractCreated") });

    // Reset form
    partnerAddress.value = "";
    stakeAmount.value = "";
    duration.value = "";
    contractTitle.value = "";
    contractTerms.value = "";

    await loadContracts();
  };

  const signContract = async (contract: { id: number; stake: number }) => {
    if (isLoading.value || !chain.address.value) return;

    const contractHash = chain.contractAddress.value as string;

    // Step 1: Transfer matching stake
    await chain.invoke(
      "transfer",
      [
        { type: "Hash160", value: chain.address.value },
        { type: "Hash160", value: contractHash },
        { type: "Integer", value: toFixed8(contract.stake.toFixed(8)) },
        { type: "String", value: `${APP_ID}:sign:${contract.id}` },
      ],
      { scriptHash: BLOCKCHAIN_CONSTANTS.GAS_HASH },
    );

    await new Promise((resolve) => setTimeout(resolve, 4000));

    // Step 2: Sign the contract
    await chain.invoke(
      "signContract",
      [
        { type: "Integer", value: contract.id },
        { type: "Hash160", value: chain.address.value },
      ],
      { scriptHash: contractHash },
    );

    eventBus.emit("breakup:signed", { action: t("contractSigned") });
    await loadContracts();
  };

  const breakContract = async (contract: { id: number }) => {
    if (!chain.address.value) throw new Error(t("error"));

    await chain.invoke("triggerBreakup", [
      { type: "Integer", value: contract.id },
      { type: "Hash160", value: chain.address.value },
    ]);

    eventBus.emit("breakup:broken", { action: t("contractBroken") });
    await loadContracts();
  };

  return {
    // Wallet state
    address: chain.address,

    // Form state
    partnerAddress,
    stakeAmount,
    duration,
    contractTitle,
    contractTerms,

    // Data state
    contracts,
    isLoading,

    // Derived state
    contractCount,
    activeCount,
    pendingCount,
    brokenCount,

    // Methods
    loadContracts,
    createContract,
    signContract,
    breakContract,
  };
}

export type UseBreakupReturn = ReturnType<typeof useBreakup>;
