/**
 * useGachaPublish — Machine creation/publish logic for the GasBox miniapp
 *
 * Receives ChainService + EventBus from PlatformServices.
 */

import { ref } from "vue";
import type { ChainService, EventBus } from "@shared/services";
import { toFixed8, toFixedDecimals } from "@shared/utils/format";
import { addressToScriptHash, parseStackItem } from "@shared/utils/neo";

export interface UseGachaPublishOptions {
  chain: ChainService;
  eventBus: EventBus;
  t: (key: string, params?: Record<string, string | number>) => string;
}

interface MachineItemData {
  name: string;
  probability: number;
  icon: string;
  rarity: string;
  assetType: string;
  assetHash: string;
  amount: string;
  tokenId: string;
}

interface MachineData {
  name: string;
  description: string;
  category: string;
  tags: string;
  price: string;
  items: MachineItemData[];
}

export function useGachaPublish({ chain, eventBus, t }: UseGachaPublishOptions) {
  const isPublishing = ref(false);

  const numberFrom = (value: unknown) => {
    const num = Number(value ?? 0);
    return Number.isFinite(num) ? num : 0;
  };

  const toRawAmount = (value: string, decimals: number) => toFixedDecimals(value, decimals);

  const toHash160 = (value: string) => {
    const trimmed = String(value || "").trim();
    if (!trimmed) return "";
    if (/^(0x)?[0-9a-fA-F]{40}$/.test(trimmed)) {
      return trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`;
    }
    const scriptHash = addressToScriptHash(trimmed);
    return scriptHash ? `0x${scriptHash}` : "";
  };

  const publishMachine = async (
    machineData: MachineData,
    options: {
      requireAddress: () => Promise<boolean>;
      setStatus: (msg: string, variant: "danger" | "success" | "warning") => void;
      onSuccess?: () => Promise<void>;
    },
  ) => {
    if (isPublishing.value) return;

    const hasAddress = await options.requireAddress();
    if (!hasAddress) return;

    const contract = chain.contractAddress.value;
    if (!contract) return;

    try {
      isPublishing.value = true;
      options.setStatus(t("publishing"), "warning");

      const priceRaw = toFixed8(machineData.price);

      // Step 1: Create machine
      const createResult = await chain.invoke(
        "CreateMachine",
        [
          { type: "Hash160", value: chain.address.value as string },
          { type: "String", value: machineData.name },
          { type: "String", value: machineData.description || "" },
          { type: "String", value: machineData.category || "" },
          { type: "String", value: machineData.tags || "" },
          { type: "Integer", value: priceRaw },
        ],
        { waitForEvent: "MachineCreated" },
      );

      const createdEvent = createResult.event;
      if (!createdEvent) {
        throw new Error(t("createPending"));
      }

      const evtRecord = createdEvent as Record<string, unknown> | null;
      const createdValues = Array.isArray(evtRecord?.state) ? (evtRecord.state as unknown[]).map(parseStackItem) : [];
      const machineId = String(createdValues[1] ?? "");
      if (!machineId) {
        throw new Error(t("createPending"));
      }

      // Step 2: Add items
      for (const item of machineData.items) {
        const assetTypeValue = item.assetType === "nep11" ? 2 : 1;
        const assetHash = toHash160(item.assetHash);
        if (!assetHash) {
          throw new Error(t("invalidAsset"));
        }

        let amountRaw = "0";
        if (assetTypeValue === 1) {
          let decimals = 8;
          try {
            decimals = numberFrom(await chain.read("Decimals", [], { scriptHash: assetHash }));
          } catch {
            /* Token decimals read failed -- default to 8 */
            decimals = 8;
          }
          amountRaw = toRawAmount(item.amount, decimals);
        }
        const tokenId = assetTypeValue === 2 ? item.tokenId : "";

        await chain.invoke(
          "AddMachineItem",
          [
            { type: "Hash160", value: chain.address.value as string },
            { type: "Integer", value: machineId },
            { type: "String", value: item.name },
            { type: "Integer", value: String(item.probability) },
            { type: "String", value: item.rarity },
            { type: "Integer", value: String(assetTypeValue) },
            { type: "Hash160", value: assetHash },
            { type: "Integer", value: amountRaw },
            { type: "String", value: tokenId },
          ],
          { waitForEvent: "MachineItemAdded" },
        );
      }

      eventBus.emit("machine:published", { machineId, name: machineData.name });
      options.setStatus(t("publishSuccess"), "success");
      if (options.onSuccess) await options.onSuccess();
    } catch (e) {
      const msg = e instanceof Error ? e.message : t("error");
      options.setStatus(msg, "danger");
      throw e;
    } finally {
      isPublishing.value = false;
    }
  };

  return {
    isPublishing,
    publishMachine,
    t,
  };
}

export type UseGachaPublishReturn = ReturnType<typeof useGachaPublish>;
