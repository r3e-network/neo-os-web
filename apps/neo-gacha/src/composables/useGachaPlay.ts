import { ref } from "vue";
import { parseStackItem } from "@shared/utils/neo";
import { createUseI18n } from "@shared/composables/useI18n";
import { useContractInteraction } from "@shared/composables/useContractInteraction";
import { messages } from "@/locale/messages";
import { useErrorHandler } from "@shared/composables/useErrorHandler";
import { formatErrorMessage } from "@shared/utils/errorHandling";
import { usePaymentFlow } from "@shared/composables/usePaymentFlow";
import { waitForEventByTransaction } from "@shared/utils/transaction";
import type { Machine, MachineItem } from "@/types";

const APP_ID = "miniapp-neo-gacha";

export function useGachaPlay() {
  const { t } = createUseI18n(messages)();
  const { handleError } = useErrorHandler();
  const { address } = useContractInteraction({ appId: APP_ID, t });
  const { processPayment } = usePaymentFlow(APP_ID);

  const isPlaying = ref(false);
  const showResult = ref(false);
  const resultItem = ref<MachineItem | null>(null);
  const playError = ref<string | null>(null);
  const showFireworks = ref(false);
  const gasInputFromRaw = (raw: number) => {
    if (!Number.isFinite(raw) || raw <= 0) return "0";
    const value = (raw / 1e8).toFixed(8);
    return value.replace(/\.?0+$/, "");
  };

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
      ensureContract: () => Promise<string>;
      onSuccess?: () => Promise<void>;
    }
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

      const contract = await options.ensureContract();
      if (!contract) return;

      const payAmount = gasInputFromRaw(machine.priceRaw);
      const { receiptId, invoke, waitForEvent } = await processPayment(payAmount, `gacha:${machine.id}`);
      if (!receiptId) {
        throw new Error(t("receiptMissing"));
      }

      const initiateTx = await invoke(
        "initiatePlay",
        [
          { type: "Hash160", value: address.value as string },
          { type: "Integer", value: machine.id },
          { type: "Integer", value: String(receiptId) },
        ],
        contract
      );

      const initiatedEvent = await waitForEventByTransaction(initiateTx, "PlayInitiated", waitForEvent);
      if (!initiatedEvent) {
        throw new Error(t("playPending"));
      }

      const evtRecord = initiatedEvent as unknown as Record<string, unknown> | null;
      const initiatedValues = Array.isArray(evtRecord?.state) ? (evtRecord.state as unknown[]).map(parseStackItem) : [];
      const playId = String(initiatedValues[2] ?? "");
      const seed = String(initiatedValues[3] ?? "");
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
        icon: "🎁",
      };
      showResult.value = true;
      showFireworks.value = true;

      const settleTx = await invoke(
        "settlePlay",
        [
          { type: "Hash160", value: address.value as string },
          { type: "Integer", value: playId },
          { type: "Integer", value: String(selectedIndex) },
        ],
        contract
      );

      await waitForEventByTransaction(settleTx, "PlayResolved", waitForEvent);

      if (options.onSuccess) await options.onSuccess();
    } catch (e: unknown) {
      playError.value = formatErrorMessage(e, t("error"));
    } finally {
      isPlaying.value = false;
    }
  };

  const buyMachine = async (
    machine: Machine,
    options: {
      requireAddress: () => Promise<boolean>;
      ensureContract: () => Promise<string>;
      setLoading: (key: string, value: boolean) => void;
      onSuccess?: () => Promise<void>;
    }
  ) => {
    if (!machine.forSale || machine.salePriceRaw <= 0) return;

    const hasAddress = await options.requireAddress();
    if (!hasAddress) return;

    const key = `buy:${machine.id}`;
    if (options.setLoading(key, true)) return;

    try {
      const contract = await options.ensureContract();
      if (!contract) return;

      const { receiptId, invoke } = await processPayment(
        gasInputFromRaw(machine.salePriceRaw),
        `gacha-sale:${machine.id}`
      );
      if (!receiptId) throw new Error(t("receiptMissing"));

      await invoke(
        "buyMachine",
        [
          { type: "Hash160", value: address.value as string },
          { type: "Integer", value: machine.id },
          { type: "Integer", value: String(receiptId) },
        ],
        contract
      );

      if (options.onSuccess) await options.onSuccess();
    } catch (e: unknown) {
      handleError(e, { operation: "buyMachine" });
      throw e;
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
