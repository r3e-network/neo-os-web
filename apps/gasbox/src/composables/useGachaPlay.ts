/**
 * useGachaPlay — Gacha play and buy machine logic for the GasBox miniapp
 *
 * Receives ChainService + EventBus from PlatformServices.
 */

import { ref } from "vue";
import type { ChainService, EventBus } from "@shared/services";
import { parseStackItem } from "@shared/utils/neo";
import { BLOCKCHAIN_CONSTANTS } from "@shared/constants";
import type { Machine, MachineItem } from "@/types";

const APP_ID = "miniapp-gasbox";

export interface UseGachaPlayOptions {
  chain: ChainService;
  eventBus: EventBus;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function useGachaPlay({ chain, eventBus, t }: UseGachaPlayOptions) {
  const isPlaying = ref(false);
  const showResult = ref(false);
  const resultItem = ref<MachineItem | null>(null);
  const playError = ref<string | null>(null);
  const showFireworks = ref(false);

  const hexToBigInt = (hex: string): bigint => {
    const cleanHex = hex.startsWith("0x") ? hex.slice(2) : hex;
    return BigInt("0x" + cleanHex);
  };

  const isItemAvailable = (item: MachineItem) => {
    if (item.assetType === 1) return item.stockRaw >= item.amountRaw && item.amountRaw > 0;
    if (item.assetType === 2) return item.tokenCount > 0;
    return false;
  };

  const simulateGachaSelection = (seed: string, items: MachineItem[]): number => {
    const availableItems = items
      .map((item, idx) => ({ item, index: idx + 1 }))
      .filter(({ item }) => isItemAvailable(item));
    if (availableItems.length === 0) return 0;
    const totalWeight = availableItems.reduce((sum, { item }) => sum + item.probability, 0);
    if (totalWeight <= 0) return 0;
    const rand = hexToBigInt(seed);
    const roll = Number(rand % BigInt(totalWeight));
    let cumulative = 0;
    for (const { item, index } of availableItems) {
      cumulative += item.probability;
      if (roll < cumulative) return index;
    }
    return availableItems[availableItems.length - 1].index;
  };

  const resetResult = () => {
    showResult.value = false;
    resultItem.value = null;
    playError.value = null;
  };

  const playMachine = async (
    machine: Machine,
    options: {
      requireAddress: () => Promise<boolean>;
      ensureContract: () => string | null;
      onSuccess?: () => Promise<void>;
    },
  ) => {
    if (isPlaying.value) return;
    if (!machine.active || !machine.inventoryReady) {
      playError.value = t("inventoryUnavailable");
      return;
    }

    const hasAddress = await options.requireAddress();
    if (!hasAddress) return;

    try {
      isPlaying.value = true;
      playError.value = null;
      resetResult();

      const contract = options.ensureContract();
      if (!contract) return;

      // Step 1: Transfer GAS payment
      await chain.invoke(
        "transfer",
        [
          { type: "Hash160", value: chain.address.value as string },
          { type: "Hash160", value: contract },
          { type: "Integer", value: String(machine.priceRaw) },
          { type: "String", value: `${APP_ID}:play:${machine.id}` },
        ],
        { scriptHash: BLOCKCHAIN_CONSTANTS.GAS_HASH },
      );
      await new Promise((resolve) => setTimeout(resolve, 4000));

      // Step 2: Initiate play
      const initiateTx = await chain.invoke(
        "initiatePlay",
        [
          { type: "Hash160", value: chain.address.value as string },
          { type: "Integer", value: machine.id },
        ],
        { waitForEvent: "PlayInitiated" },
      );

      const initiatedEvent = initiateTx.event;
      if (!initiatedEvent) {
        throw new Error(t("playPending"));
      }

      const evtRecord = initiatedEvent as Record<string, unknown> | null;
      const rawValues = Array.isArray(evtRecord?.state) ? (evtRecord.state as Record<string, unknown>[]) : [];
      const initiatedValues = rawValues.map(parseStackItem);
      const playId = String(initiatedValues[2] ?? "");
      let seed = "";
      const seedItem = rawValues[3] as Record<string, unknown> | undefined;
      if (seedItem?.type === "ByteString" && typeof seedItem.value === "string") {
        seed = Buffer.from(seedItem.value, "base64").toString("hex");
      } else {
        seed = String(initiatedValues[3] ?? "");
      }
      if (!playId || !seed) {
        throw new Error(t("playPending"));
      }

      const selectedIndex = simulateGachaSelection(seed, machine.items);
      if (selectedIndex <= 0) {
        throw new Error(t("noAvailableItems"));
      }

      const item = machine.items.find((_, idx) => idx + 1 === selectedIndex) || null;
      resultItem.value = item || {
        name: t("unknownPrize"),
        probability: 0,
        displayProbability: 0,
        rarity: "UNKNOWN",
        assetType: 0,
        assetHash: "",
        amountRaw: 0,
        amountDisplay: "0",
        tokenId: "",
        stockRaw: 0,
        stockDisplay: "0",
        tokenCount: 0,
        decimals: 0,
        available: false,
        icon: "gift",
      };
      showResult.value = true;
      showFireworks.value = true;

      // Step 3: Settle play
      await chain.invoke(
        "settlePlay",
        [
          { type: "Hash160", value: chain.address.value as string },
          { type: "Integer", value: playId },
          { type: "Integer", value: String(selectedIndex) },
        ],
        { waitForEvent: "PlayResolved" },
      );

      eventBus.emit("play:resolved", { machineId: machine.id, selectedIndex });
      if (options.onSuccess) await options.onSuccess();
    } catch (e) {
      playError.value = e instanceof Error ? e.message : t("error");
    } finally {
      isPlaying.value = false;
    }
  };

  const buyMachine = async (
    machine: Machine,
    options: {
      requireAddress: () => Promise<boolean>;
      ensureContract: () => string | null;
      setLoading: (key: string, value: boolean) => void;
      onSuccess?: () => Promise<void>;
    },
  ) => {
    if (!machine.forSale || machine.salePriceRaw <= 0) return;

    const hasAddress = await options.requireAddress();
    if (!hasAddress) return;

    const key = `buy:${machine.id}`;
    options.setLoading(key, true);

    try {
      const contract = options.ensureContract();
      if (!contract) return;

      // Step 1: Transfer GAS payment for purchase
      await chain.invoke(
        "transfer",
        [
          { type: "Hash160", value: chain.address.value as string },
          { type: "Hash160", value: contract },
          { type: "Integer", value: String(machine.salePriceRaw) },
          { type: "String", value: `${APP_ID}:sale:${machine.id}` },
        ],
        { scriptHash: BLOCKCHAIN_CONSTANTS.GAS_HASH },
      );

      await new Promise((resolve) => setTimeout(resolve, 4000));

      // Step 2: Execute buy
      await chain.invoke("buyMachine", [
        { type: "Hash160", value: chain.address.value as string },
        { type: "Integer", value: machine.id },
      ]);

      eventBus.emit("machine:bought", { machineId: machine.id });
      if (options.onSuccess) await options.onSuccess();
    } finally {
      options.setLoading(key, false);
    }
  };

  return {
    isPlaying,
    showResult,
    resultItem,
    playError,
    showFireworks,
    resetResult,
    playMachine,
    buyMachine,
    simulateGachaSelection,
    APP_ID,
    t,
  };
}

export type UseGachaPlayReturn = ReturnType<typeof useGachaPlay>;
